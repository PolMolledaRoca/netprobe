const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { JobQueue } = require('./src/jobs');
const scanner = require('./src/scanner');
const registerApi = require('./src/api');
const { ensureDir } = require('./src/utils');

const PORT = process.env.PORT || 3001;

// Directorio donde se persisten los resultados
const dataDir = path.join(__dirname, 'data');
ensureDir(dataDir);

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const jobQueue = new JobQueue({ maxParallelJobs: Number(process.env.MAX_PARALLEL_JOBS) || 2 });
const scansStore = new Map();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

registerApi(app, {
  io,
  jobQueue,
  scanner,
  scansStore,
  dataDir,
});

httpServer.listen(PORT, () => {
  console.log(`Servidor NetProbe escuchando en http://localhost:${PORT}`);
});
