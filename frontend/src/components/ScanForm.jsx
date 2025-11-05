import { useState } from 'react';

function ScanForm({ onSubmit, disabled }) {
  const [targets, setTargets] = useState('scanme.nmap.org');
  const [ports, setPorts] = useState('80,443');
  const [count, setCount] = useState(3);
  const [interval, setInterval] = useState(1000);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      targets,
      ports,
      count: Number(count),
      interval_ms: Number(interval),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Objetivos (IP, rango, CIDR)
        <input
          type="text"
          value={targets}
          onChange={(e) => setTargets(e.target.value)}
          required
          placeholder="192.168.1.1-254"
        />
      </label>
      <label>
        Puertos (opcional)
        <input type="text" value={ports} onChange={(e) => setPorts(e.target.value)} placeholder="80,443,22" />
      </label>
      <label>
        Repeticiones (count)
        <input
          type="number"
          min="1"
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
      </label>
      <label>
        Intervalo (ms)
        <input
          type="number"
          min="100"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
        />
      </label>
      <button type="submit" disabled={disabled}>
        {disabled ? 'Lanzando…' : 'Iniciar escaneo'}
      </button>
    </form>
  );
}

export default ScanForm;
