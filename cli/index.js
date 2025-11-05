#!/usr/bin/env node
const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const http = require('http');
const https = require('https');
const scanner = require('../backend/src/scanner');

function printUsage() {
  console.log('Uso: netprobe scan --targets <rango|lista> [--ports 80,443] [--count 3] [--interval 1000] [--backend http://localhost:3001]');
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        result[key] = true;
      } else {
        result[key] = next;
        i += 1;
      }
    } else {
      result._.push(token);
    }
  }
  return result;
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const handler = target.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);
    const req = handler.request(
      target,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data || '{}'));
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      },
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (!args._.length || args._[0] !== 'scan') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!args.targets) {
    console.error('Error: Debe indicar --targets.');
    process.exitCode = 1;
    return;
  }

  const payload = {
    targets: args.targets,
    ports: args.ports || undefined,
    count: args.count ? Number(args.count) : undefined,
    interval_ms: args.interval ? Number(args.interval) : undefined,
  };

  const backendUrl = args.backend || 'http://localhost:3001';
  const endpoint = `${backendUrl.replace(/\/$/, '')}/api/scan`;

  try {
    const response = await postJson(endpoint, payload);
    console.log(`Escaneo enviado al backend. ID: ${response.scan_id}`);
    console.log('Use curl o la UI para seguir el progreso.');
  } catch (error) {
    console.warn(`No se pudo contactar el backend (${error.message}). Ejecutando escaneo local.`);
    const emitter = new EventEmitter();
    const scanId = uuidv4();
    emitter.on('started', () => {
      console.log(`Escaneo local iniciado (${scanId}).`);
    });
    emitter.on('progress', (event) => {
      const pct = Math.round((event.progress || 0) * 100);
      const rtt = event.avgRtt != null ? `${event.avgRtt.toFixed(2)} ms` : 'N/D';
      console.log(`[${pct}%] ${event.host} => Estado: ${event.state} | RTT: ${rtt} | Pérdida: ${event.packetLoss}%`);
    });
    emitter.on('done', (summary) => {
      console.log('Escaneo local finalizado. Resumen:');
      const up = summary.hosts.filter((host) => host.state === 'UP').length;
      console.log(`Hosts analizados: ${summary.hosts.length}, activos: ${up}`);
      if (summary.outputPath) {
        console.log(`Resultados guardados en: ${summary.outputPath}`);
      }
    });

    await scanner.runScan(
      {
        ...payload,
        scanId,
        dataDir: path.join(__dirname, '..', 'backend', 'data'),
      },
      emitter,
    );
  }
}

run().catch((error) => {
  console.error('Error fatal en CLI:', error);
  process.exit(1);
});
