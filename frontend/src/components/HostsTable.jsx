function HostsTable({ hosts, onSelectHost, selectedHost }) {
  return (
    <div className="table-container">
      <h2>Hosts analizados</h2>
      {hosts.length === 0 ? (
        <p>Sin datos todavía. Ejecuta un escaneo para comenzar.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Host</th>
              <th>Estado</th>
              <th>RTT medio (ms)</th>
              <th>Pérdida (%)</th>
              <th>Puertos</th>
              <th>Última actualización</th>
            </tr>
          </thead>
          <tbody>
            {hosts.map((host) => {
              const isSelected = selectedHost && selectedHost.host === host.host;
              return (
                <tr
                  key={host.host}
                  style={{ cursor: 'pointer', backgroundColor: isSelected ? 'rgba(56,189,248,0.2)' : undefined }}
                  onClick={() => onSelectHost(host)}
                >
                  <td>{host.host}</td>
                  <td>
                    <span className={`badge ${host.state === 'UP' ? 'up' : 'down'}`}>{host.state}</span>
                  </td>
                  <td>{host.avgRtt != null ? host.avgRtt.toFixed(2) : '—'}</td>
                  <td>{host.packetLoss != null ? host.packetLoss : '—'}</td>
                  <td>
                    {host.ports && host.ports.length ? (
                      host.ports.map((port) => `${port.port}:${port.status}`).join(', ')
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td>{new Date(host.timestamp).toLocaleTimeString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default HostsTable;
