# NetProbe

NetProbe es un monitor de red con API REST, CLI y dashboard web en tiempo real. Permite realizar barridos de ping, recopilar estadísticas de latencia y probar puertos TCP sobre rangos de direcciones IPv4, todo con seguimiento en vivo vía Socket.IO.

## Características clave
- Backend Node.js con Express y Socket.IO para coordinar escaneos concurrentes.
- Motor de escaneo con control de concurrencia, ping promedio y pruebas TCP.
- Persistencia de resultados en `backend/data/<scan_id>.json`.
- Dashboard React (Vite) con Chart.js para visualizar latencias en tiempo real.
- CLI que delega en el backend o ejecuta el escaneo localmente si no hay conexión.

## Estructura del proyecto
```
netprobe/
├─ backend/
│  ├─ server.js
│  ├─ package.json
│  └─ src/
│     ├─ api.js
│     ├─ jobs.js
│     ├─ scanner.js
│     └─ utils.js
├─ cli/
│  ├─ index.js
│  └─ package.json
├─ frontend/
│  ├─ index.html
│  ├─ package.json
│  └─ src/
│     ├─ App.jsx
│     ├─ main.jsx
│     ├─ styles.css
│     └─ components/
│        ├─ HostsTable.jsx
│        ├─ LatencyChart.jsx
│        └─ ScanForm.jsx
├─ .gitignore
└─ README.md
```

## Requisitos previos
- Node.js 18+ (incluye `fetch` nativo y soporte para ESM/React con Vite).
- npm 9+.

## Instalación y ejecución

### 1. Backend (API + Socket.IO)
```bash
cd backend
npm install
npm run dev
```
El backend queda escuchando en `http://localhost:3001`.

### 2. Frontend (dashboard React)
```bash
cd frontend
npm install
npm run dev
```
Abre `http://localhost:5173` en tu navegador para ver el panel.

### 3. CLI
```bash
cd cli
npm install
node index.js scan --targets 192.168.1.0/24 --count 2
```
El comando intentará contactar al backend (`http://localhost:3001`). Si no responde, ejecutará el escaneo localmente empleando el mismo motor.

## API REST
- `POST /api/scan` — inicia un escaneo. Cuerpo JSON:
  ```json
  {
    "targets": "192.168.1.1-254",
    "ports": "80,443",
    "count": 3,
    "interval_ms": 750
  }
  ```
  Devuelve `{ "scan_id": "<uuid>" }`.
- `GET /api/scan/:id` — estado y resultados parciales o completos.
- `GET /api/scans` — listado de escaneos recientes.

Los eventos en tiempo real via Socket.IO son: `scan:started`, `scan:progress`, `scan:done` y `scan:error`.

## Ejemplo rápido con curl
Iniciar un escaneo contra `scanme.nmap.org`:
```bash
curl -X POST http://localhost:3001/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "targets": "scanme.nmap.org",
    "ports": "22,80,443",
    "count": 4,
    "interval_ms": 750
  }'
```

## Dashboard web
1. Inicia el backend (`npm run dev` en `backend/`).
2. Inicia el frontend (`npm run dev` en `frontend/`).
3. Abre `http://localhost:5173` y lanza un escaneo desde el formulario.
4. Observa la tabla de hosts y el gráfico de latencia en vivo. Los puertos probados se muestran junto a cada host.

## Notas de seguridad
- Usa NetProbe únicamente en redes y hosts sobre los que tengas autorización explícita.
- Las sondas ICMP/TCP pueden generar alertas en sistemas de monitorización; coordina cualquier prueba con el equipo de seguridad.
- Almacena y protege los ficheros JSON generados en `backend/data`, ya que contienen información operativa de la red objetivo.

## Ejemplos adicionales
- Barrido LAN: `targets="192.168.0.1-50"`, `count=2`, `interval_ms=500`, `ports="22,3389"`.
- Hosts públicos combinados: `targets="8.8.8.8,1.1.1.1,scanme.nmap.org"`, `count=3`, sin puertos.
- CIDR interno controlado: `targets="10.10.5.0/28"`, `ports="80,443,8080"`, `count=1`, `interval_ms=1200`, `maxParallelHosts=5`.

La interfaz permite introducir nombres DNS, rangos `start-end`, listas separadas por comas o bloques CIDR; usa el intervalo que prefieras siempre que sea ≥ 100 ms.

## Desarrollo y personalización
- Ajusta la concurrencia de hosts con la variable de entorno `MAX_PARALLEL_JOBS` al iniciar el backend.
- Modifica `maxParallelHosts` y `portTimeoutMs` al enviar el payload para controlar la carga.
- Añade nuevas visualizaciones en el frontend extendiendo los componentes dentro de `frontend/src/components/`.

¡Listo! NetProbe está preparado para integrarse en tus flujos de troubleshooting de red.
