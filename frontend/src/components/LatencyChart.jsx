import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

function LatencyChart({ host, data = [] }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'RTT (ms)',
            data: [],
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.2)',
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Latencia en tiempo real',
            color: '#f8fafc',
          },
          legend: {
            labels: {
              color: '#f8fafc',
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#e2e8f0' },
            grid: { color: 'rgba(148, 163, 184, 0.2)' },
          },
          y: {
            ticks: { color: '#e2e8f0' },
            grid: { color: 'rgba(148, 163, 184, 0.2)' },
            beginAtZero: true,
          },
        },
      },
    });

    chartRef.current = chart;

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;
    const labels = data.map((item) => new Date(item.timestamp).toLocaleTimeString());
    const values = data.map((item) => item.value);
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.options.plugins.title.text = host ? `RTT en ${host.host}` : 'Latencia en tiempo real';
    chart.update('none');
  }, [data, host]);

  return (
    <div className="chart-wrapper">
      <h2>Latencia</h2>
      <canvas ref={canvasRef} height="160" />
    </div>
  );
}

export default LatencyChart;
