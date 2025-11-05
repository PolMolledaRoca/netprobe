import { io } from 'socket.io-client';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

async function startScan(payload) {
  const response = await fetch(`${API_BASE}/api/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Error al iniciar el escaneo: ${response.status}`);
  }

  return response.json();
}

async function getScan(scanId) {
  const response = await fetch(`${API_BASE}/api/scan/${scanId}`);
  if (!response.ok) {
    throw new Error(`No se pudo obtener el escaneo ${scanId}`);
  }
  return response.json();
}

async function listScans() {
  const response = await fetch(`${API_BASE}/api/scans`);
  if (!response.ok) {
    throw new Error('No se pudo listar los escaneos');
  }
  return response.json();
}

function connectSocket() {
  return io(API_BASE, {
    transports: ['websocket'],
  });
}

export { startScan, getScan, listScans, connectSocket };
