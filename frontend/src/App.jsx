import { useEffect, useMemo, useState } from 'react';
import { startScan, listScans, connectSocket } from './api.js';
import ScanForm from './components/ScanForm.jsx';
import HostsTable from './components/HostsTable.jsx';
import LatencyChart from './components/LatencyChart.jsx';

function App() {
  const [scans, setScans] = useState([]);
  const [currentScanId, setCurrentScanId] = useState(null);
  const [hostsMap, setHostsMap] = useState({});
  const [selectedHost, setSelectedHost] = useState(null);
  const [latencyHistory, setLatencyHistory] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listScans()
      .then(setScans)
      .catch(() => setStatusMessage('No se pudieron cargar los escaneos previos.'));
  }, []);

  useEffect(() => {
    const socket = connectSocket();

    socket.on('scan:started', (payload) => {
      setStatusMessage(`Escaneo ${payload.scan_id} en ejecución (${payload.targets} objetivos).`);
      setCurrentScanId(payload.scan_id);
      setHostsMap({});
      setLatencyHistory({});
      setSelectedHost(null);
      setScans((prev) => [{ id: payload.scan_id, status: 'running', createdAt: payload.startedAt, updatedAt: payload.startedAt }, ...prev]);
    });

    socket.on('scan:progress', (event) => {
      setCurrentScanId((prev) => prev || event.scan_id);
      setHostsMap((prev) => ({
        ...prev,
        [event.host]: event,
      }));
      setLatencyHistory((prev) => {
        const history = prev[event.host] ? [...prev[event.host]] : [];
        if (event.avgRtt != null) {
          history.push({ timestamp: event.timestamp, value: event.avgRtt });
        }
        return {
          ...prev,
          [event.host]: history.slice(-50),
        };
      });
      setScans((prev) =>
        prev.map((scan) =>
          scan.id === event.scan_id
            ? { ...scan, status: 'running', updatedAt: event.timestamp }
            : scan,
        ),
      );
    });

    socket.on('scan:done', (summary) => {
      setStatusMessage(`Escaneo ${summary.scan_id} finalizado.`);
      setScans((prev) =>
        prev.map((scan) =>
          scan.id === summary.scan_id
            ? {
                ...scan,
                status: 'done',
                updatedAt: summary.finishedAt,
                summary: {
                  total: summary.hosts.length,
                  up: summary.hosts.filter((host) => host.state === 'UP').length,
                },
              }
            : scan,
        ),
      );
    });

    socket.on('scan:error', (payload) => {
      setStatusMessage(`Error en escaneo ${payload.scan_id}: ${payload.error}`);
      setScans((prev) =>
        prev.map((scan) =>
          scan.id === payload.scan_id
            ? { ...scan, status: 'error', updatedAt: new Date().toISOString(), error: payload.error }
            : scan,
        ),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const hosts = useMemo(() => Object.values(hostsMap).sort((a, b) => a.host.localeCompare(b.host)), [hostsMap]);

  const handleSelectHost = (host) => {
    setSelectedHost(host);
  };

  const handleStartScan = async (formValues) => {
    setIsSubmitting(true);
    setStatusMessage('Enviando escaneo...');
    try {
      const response = await startScan(formValues);
      setCurrentScanId(response.scan_id);
      setHostsMap({});
      setLatencyHistory({});
      setSelectedHost(null);
      setStatusMessage(`Escaneo ${response.scan_id} encolado.`);
    } catch (error) {
      setStatusMessage(`No se pudo iniciar el escaneo: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h1>NetProbe Dashboard</h1>
      <p>Monitoriza latencia y puertos abiertos en tiempo real. Usa el formulario para iniciar un nuevo escaneo.</p>
      <ScanForm onSubmit={handleStartScan} disabled={isSubmitting} />
      {statusMessage && <div className="status-message">{statusMessage}</div>}
      <HostsTable hosts={hosts} onSelectHost={handleSelectHost} selectedHost={selectedHost} />
      <LatencyChart host={selectedHost} data={selectedHost ? latencyHistory[selectedHost.host] || [] : []} />
      <section className="chart-wrapper">
        <h2>Escaneos recientes</h2>
        {scans.length === 0 ? (
          <p>No hay escaneos previos.</p>
        ) : (
          <ul>
            {scans.map((scan) => (
              <li key={scan.id}>
                #{scan.id} → {scan.status} {scan.summary ? `| Hosts: ${scan.summary.total} (${scan.summary.up} UP)` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default App;
