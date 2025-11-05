const fs = require('fs');
const path = require('path');
const net = require('net');
const ping = require('ping');
const { v4: uuidv4 } = require('uuid');
const { parseTargets, parsePorts, sleep, ensureDir, buildDataPath } = require('./utils');

// Realiza ping múltiples veces para medir RTT y pérdida de paquetes
async function pingHost(host, count, intervalMs) {
  let success = 0;
  const samples = [];
  for (let i = 0; i < count; i += 1) {
    const result = await ping.promise.probe(host, { timeout: Math.ceil(intervalMs / 1000) + 1 });
    if (result.alive) {
      const rtt = Number(result.time);
      if (!Number.isNaN(rtt)) {
        samples.push(rtt);
        success += 1;
      }
    }
    if (i < count - 1) {
      await sleep(intervalMs);
    }
  }

  const avgRtt = samples.length ? samples.reduce((acc, val) => acc + val, 0) / samples.length : null;
  const packetLoss = ((count - success) / count) * 100;

  return {
    host,
    avgRtt,
    packetLoss,
    alive: success > 0,
    samples,
  };
}

// Intenta abrir una conexión TCP para determinar si el puerto está accesible
function probePort(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const startedAt = Date.now();
    let status = 'closed';

    const finalize = (state) => {
      status = state;
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);

    socket.once('connect', () => finalize('open'));
    socket.once('timeout', () => finalize('timeout'));
    socket.once('error', () => finalize('closed'));
    socket.once('close', () => {
      resolve({
        port,
        status,
        latency: Date.now() - startedAt,
      });
    });

    try {
      socket.connect(port, host);
    } catch (error) {
      resolve({ port, status: 'error', latency: null, error: error.message });
    }
  });
}

async function scanPorts(host, ports, timeoutMs) {
  const results = [];
  for (const port of ports) {
    // Evitamos bombardear al host en paralelo para mantener el control
    // sobre los timeouts
    // eslint-disable-next-line no-await-in-loop
    const portResult = await probePort(host, port, timeoutMs);
    results.push(portResult);
  }
  return results;
}

async function runWithConcurrency(items, limit, iterator) {
  const results = new Array(items.length);
  let index = 0;
  const executing = [];

  async function enqueue() {
    if (index >= items.length) {
      return;
    }
    const currentIndex = index;
    index += 1;
    const item = items[currentIndex];
    const p = Promise.resolve()
      .then(() => iterator(item, currentIndex))
      .then((value) => {
        results[currentIndex] = value;
      });
    executing.push(p);
    const remove = () => {
      const pos = executing.indexOf(p);
      if (pos >= 0) {
        executing.splice(pos, 1);
      }
    };
    p.then(remove).catch(remove);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
    await enqueue();
  }

  await enqueue();
  await Promise.all(executing);
  return results;
}

// Ejecuta un escaneo completo gestionando concurrencia y eventos de progreso
async function runScan(scanOpts = {}, emitter) {
  const scanId = scanOpts.scanId || uuidv4();
  const targets = parseTargets(scanOpts.targets);
  const ports = parsePorts(scanOpts.ports);
  const count = Math.max(1, Number(scanOpts.count) || 3);
  const intervalMs = Math.max(100, Number(scanOpts.interval_ms) || 1000);
  const maxParallelHosts = Math.max(1, Number(scanOpts.maxParallelHosts) || 10);
  const portTimeoutMs = Math.max(500, Number(scanOpts.portTimeoutMs) || 2000);
  const dataDir = scanOpts.dataDir || path.join(__dirname, '..', 'data');
  const writeToFile = scanOpts.writeToFile !== false;

  if (!targets.length) {
    throw new Error('No se encontraron objetivos válidos para el escaneo');
  }

  ensureDir(dataDir);

  const startedAt = new Date().toISOString();
  const progress = {
    scan_id: scanId,
    startedAt,
    targets: targets.length,
  };

  if (emitter && typeof emitter.emit === 'function') {
    emitter.emit('started', progress);
  }

  let cancelled = false;
  if (emitter && typeof emitter.once === 'function') {
    emitter.once('cancel', () => {
      cancelled = true;
    });
  }

  const hostResults = [];
  let completedHosts = 0;

  await runWithConcurrency(targets, maxParallelHosts, async (host) => {
    if (cancelled) {
      return null;
    }

    const pingResult = await pingHost(host, count, intervalMs);
    let portResults = [];
    if (ports.length) {
      portResults = await scanPorts(host, ports, portTimeoutMs);
    }

    completedHosts += 1;

    const avgRtt = pingResult.avgRtt != null ? Number(pingResult.avgRtt.toFixed(2)) : null;
    const hostPayload = {
      scan_id: scanId,
      host,
      state: pingResult.alive ? 'UP' : 'DOWN',
      avgRtt,
      packetLoss: Number(pingResult.packetLoss.toFixed(2)),
      samples: pingResult.samples,
      ports: portResults,
      timestamp: new Date().toISOString(),
      progress: completedHosts / targets.length,
    };

    hostResults.push(hostPayload);

    if (emitter && typeof emitter.emit === 'function') {
      emitter.emit('progress', hostPayload);
    }

    return hostPayload;
  });

  const finishedAt = new Date().toISOString();
  const summary = {
    scan_id: scanId,
    startedAt,
    finishedAt,
    options: {
      targets,
      ports,
      count,
      interval_ms: intervalMs,
      maxParallelHosts,
      portTimeoutMs,
    },
    hosts: hostResults,
  };

  if (writeToFile) {
    const outputPath = buildDataPath(dataDir, scanId);
    await fs.promises.writeFile(outputPath, JSON.stringify(summary, null, 2), 'utf8');
    summary.outputPath = outputPath;
  }

  if (emitter && typeof emitter.emit === 'function') {
    emitter.emit('done', summary);
  }

  return summary;
}

module.exports = {
  runScan,
};
