const fs = require('fs');
const path = require('path');

function isIpv4(value) {
  if (typeof value !== 'string') return false;
  const octets = value.split('.');
  if (octets.length !== 4) return false;
  return octets.every((octet) => {
    const num = Number(octet);
    return Number.isInteger(num) && num >= 0 && num <= 255;
  });
}

// Convierte la entrada de objetivos en una lista única de direcciones IPv4
function isHostname(value) {
  if (typeof value !== 'string' || !value) return false;
  // Permite nombres de host simples o FQDN, incluyendo IPv4 ya validados aparte
  const hostnameRegex = /^(?!-)(?:[a-zA-Z0-9-]{1,63}\.)*[a-zA-Z0-9-]{1,63}$/;
  return hostnameRegex.test(value);
}

function parseTargets(input) {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input.filter((item) => isIpv4(item) || isHostname(item));
  }

  if (typeof input !== 'string') return [];

  const segments = input
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const targets = new Set();

  for (const segment of segments) {
    if (segment.includes('/')) {
      expandCidr(segment).forEach((ip) => targets.add(ip));
    } else if (segment.includes('-') && isIpv4(segment.split('-')[0].trim())) {
      expandRange(segment).forEach((ip) => targets.add(ip));
    } else if (isIpv4(segment) || isHostname(segment)) {
      targets.add(segment);
    }
  }

  return Array.from(targets);
}

// Expande notaciones tipo 192.168.1.1-254 o 192.168.1.1-192.168.1.50
function expandRange(segment) {
  const trimmed = segment.trim();
  const parts = trimmed.split('-');
  if (parts.length !== 2) return [];

  const startPart = parts[0].trim();
  const endPart = parts[1].trim();

  if (!isIpv4(startPart)) return [];

  const startOctets = startPart.split('.').map(Number);

  if (isIpv4(endPart)) {
    const endOctets = endPart.split('.').map(Number);
    if (startOctets.slice(0, 3).join('.') !== endOctets.slice(0, 3).join('.')) {
      return [];
    }
    const from = startOctets[3];
    const to = endOctets[3];
    if (to < from) return [];
    const prefix = startOctets.slice(0, 3).join('.');
    const list = [];
    for (let i = from; i <= to; i += 1) {
      list.push(`${prefix}.${i}`);
    }
    return list;
  }

  const lastOctet = startOctets[3];
  const endOctet = Number(endPart);
  if (!Number.isInteger(endOctet) || endOctet < lastOctet || endOctet > 255) {
    return [];
  }

  const prefix = startOctets.slice(0, 3).join('.');
  const list = [];
  for (let i = lastOctet; i <= endOctet; i += 1) {
    list.push(`${prefix}.${i}`);
  }
  return list;
}

// Expande un bloque CIDR completo (p.e. 192.168.1.0/30) en direcciones individuales
function expandCidr(segment) {
  const [base, maskStr] = segment.split('/');
  const mask = Number(maskStr);
  if (!isIpv4(base) || !Number.isInteger(mask) || mask < 0 || mask > 32) {
    return [];
  }

  const baseOctets = base.split('.').map(Number);
  const baseInt =
    (baseOctets[0] << 24) +
    (baseOctets[1] << 16) +
    (baseOctets[2] << 8) +
    baseOctets[3];

  const hostBits = 32 - mask;
  const hostCount = Math.max(1, 2 ** hostBits);
  const results = [];

  for (let i = 0; i < hostCount; i += 1) {
    const ipInt = (baseInt & (~0 << hostBits)) + i;
    const ip = [
      (ipInt >>> 24) & 255,
      (ipInt >>> 16) & 255,
      (ipInt >>> 8) & 255,
      ipInt & 255,
    ].join('.');
    results.push(ip);
  }

  return results;
}

// Normaliza la lista de puertos ya sea en string o array
function parsePorts(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(Number).filter((port) => Number.isInteger(port) && port > 0 && port <= 65535);
  }
  if (typeof input !== 'string') return [];
  return input
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((port) => Number.isInteger(port) && port > 0 && port <= 65535);
}

// Promesa utilitaria para pausar la ejecución con async/await
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Crea el directorio si aún no existe
function ensureDir(targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
}

function buildDataPath(dataDir, scanId) {
  return path.join(dataDir, `${scanId}.json`);
}

module.exports = {
  parseTargets,
  parsePorts,
  sleep,
  ensureDir,
  buildDataPath,
};
