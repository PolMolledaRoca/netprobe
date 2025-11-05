const fs = require('fs');
const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const { parseTargets, parsePorts, buildDataPath } = require('./utils');

module.exports = function registerApi(app, context) {
  const { io, jobQueue, scanner, scansStore, dataDir } = context;

  // Alta de nuevos escaneos vía REST
  app.post('/api/scan', (req, res) => {
    const { body } = req;
    const resolvedTargets = parseTargets(body.targets);

    if (!resolvedTargets.length) {
      return res.status(400).json({ error: 'Debe especificar al menos un objetivo válido en "targets"' });
    }

    const ports = parsePorts(body.ports);
    const scanId = uuidv4();
    const now = new Date().toISOString();

    const record = {
      id: scanId,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      options: {
        targets: body.targets,
        ports: body.ports,
        count: body.count,
        interval_ms: body.interval_ms,
      },
      hosts: {},
    };

    scansStore.set(scanId, record);

    res.json({ scan_id: scanId });

    const emitter = new EventEmitter();

    emitter.on('started', (payload) => {
      record.status = 'running';
      record.startedAt = payload.startedAt;
      record.updatedAt = new Date().toISOString();
      io.emit('scan:started', payload);
    });

    emitter.on('progress', (payload) => {
      record.status = 'running';
      record.updatedAt = payload.timestamp;
      record.hosts[payload.host] = payload;
      io.emit('scan:progress', payload);
    });

    emitter.on('done', (summary) => {
      record.status = 'done';
      record.finishedAt = summary.finishedAt;
      record.updatedAt = summary.finishedAt;
      record.summary = {
        total: summary.hosts.length,
        up: summary.hosts.filter((host) => host.state === 'UP').length,
      };
      record.outputPath = summary.outputPath || buildDataPath(dataDir, scanId);
      record.result = summary;
      io.emit('scan:done', summary);
    });

    emitter.on('error', (error) => {
      record.status = 'error';
      record.updatedAt = new Date().toISOString();
      record.error = error.message;
      io.emit('scan:error', { scan_id: scanId, error: error.message });
    });

    const jobPayload = {
      id: scanId,
      run: () =>
        scanner.runScan(
          {
            ...body,
            scanId,
            dataDir,
          },
          emitter,
        ),
      cancel: () => emitter.emit('cancel'),
    };

    jobQueue
      .enqueue(jobPayload)
      .catch((error) => {
        record.status = 'error';
        record.updatedAt = new Date().toISOString();
        record.error = error.message;
        io.emit('scan:error', { scan_id: scanId, error: error.message });
      });

    return null;
  });

  // Consulta de un escaneo concreto
  app.get('/api/scan/:id', async (req, res) => {
    const scanId = req.params.id;
    const record = scansStore.get(scanId);

    if (!record) {
      return res.status(404).json({ error: 'Escaneo no encontrado' });
    }

    if (record.status === 'done' && record.result) {
      return res.json(record.result);
    }

    if (record.status === 'done') {
      const filePath = record.outputPath || buildDataPath(dataDir, scanId);
      try {
        const raw = await fs.promises.readFile(filePath, 'utf8');
        const data = JSON.parse(raw);
        record.result = data;
        return res.json(data);
      } catch (error) {
        return res.status(500).json({ error: 'No se pudo leer el resultado almacenado', details: error.message });
      }
    }

    const hosts = Object.values(record.hosts);
    return res.json({
      scan_id: record.id,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      options: record.options,
      hosts,
    });
  });

  // Listado sucinto de escaneos recientes
  app.get('/api/scans', (_req, res) => {
    const list = Array.from(scansStore.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50)
      .map((item) => ({
        id: item.id,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        summary: item.summary || null,
      }));

    res.json(list);
  });
};
