import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Analytics = () => {
  // Mock data for initial preview - in production this would fetch from /api/logs
  const data = {
    labels: ['10:00', '10:05', '10:10', '10:15', '10:20', '10:25', '10:30'],
    datasets: [
      {
        label: 'Node-01 Voltage (kV)',
        data: [0.5, 0.52, 1.2, 1.8, 1.8, 1.78, 1.8],
        borderColor: '#be2c2e',
        backgroundColor: 'rgba(190, 44, 46, 0.5)',
        tension: 0.4,
      },
      {
        label: 'Laboratory Temp (°C)',
        data: [22.1, 22.4, 23.8, 25.1, 26.2, 26.8, 27.2],
        borderColor: '#1d1d1b',
        backgroundColor: 'rgba(29, 29, 27, 0.5)',
        tension: 0.4,
      }
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: { weight: 'bold', family: 'Inter' }
        }
      },
    },
    scales: {
      y: { beginAtZero: false }
    }
  };

  return (
    <div className="bg-white p-12 border border-[#e5e5e5]">
      <div className="mb-12">
        <h2 className="text-4xl font-black text-[#1d1d1b] tracking-tighter uppercase mb-2">Laboratory Analytics</h2>
        <p className="text-[10px] uppercase font-black text-gray-400 tracking-[0.4em]">High-Resolution Telemetry Archive</p>
      </div>
      
      <div className="grid grid-cols-1 gap-12">
        <div className="bg-[#fafafa] p-8 border border-gray-100">
           <Line options={options} data={data} />
        </div>
      </div>
    </div>
  );
};

export default Analytics;
