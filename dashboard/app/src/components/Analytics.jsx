import React from 'react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Activity, Zap, TrendingUp, Clock } from 'lucide-react';

// ─── Analytics ───────────────────────────────────────────────────────────────
// Event history and per-detector summary panel.
// Receives:
//   history  - array of { time: string, rate: number }  (last N samples)
//   detectors - array of detector node objects
// ─────────────────────────────────────────────────────────────────────────────

export default function Analytics({ history = [], detectors = [], downsampledHistory = [], darkMode }) {
  const [activeTab, setActiveTab] = React.useState('rate');

  const avgRate = history.length
    ? (history.reduce((s, p) => s + Number(p.rate), 0) / history.length).toFixed(2)
    : '—';
  const maxRate = history.length
    ? Math.max(...history.map(p => Number(p.rate))).toFixed(2)
    : '—';
  const onlineCount  = detectors.filter(d => d.status === 'online').length;
  const offlineCount = detectors.filter(d => d.status !== 'online').length;

  const historyData = downsampledHistory.map(item => ({
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    rate: item.rate,
    voltage: item.voltage,
    temp: item.temp
  }));

  const chartData = activeTab === 'rate' && historyData.length === 0 
    ? history 
    : historyData;

  return (
    <div className="space-y-8">

      {/* ── Summary stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard icon={<Activity className="w-4 h-4" />} label="Avg Rate"    value={avgRate} unit="Hz" darkMode={darkMode} />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Peak Rate" value={maxRate} unit="Hz" darkMode={darkMode} />
        <StatCard icon={<Zap className="w-4 h-4" />}   label="Online"         value={onlineCount}  unit="nodes" color="text-emerald-500" darkMode={darkMode} />
        <StatCard icon={<Clock className="w-4 h-4" />} label="Offline"        value={offlineCount} unit="nodes" color={offlineCount > 0 ? 'text-[#be2c2e]' : undefined} darkMode={darkMode} />
      </div>

      {/* ── Historical Trend charts ───────────────────────────────── */}
      <div className={`${darkMode ? 'bg-[#151722] border-[#222533]' : 'bg-white border-[#e5e5e5]'} border p-8`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-[10px] uppercase font-black tracking-widest text-[#be2c2e] flex items-center gap-2">
            <Activity className="w-3 h-3" /> Downsampled Telemetry History
          </h2>
          <span className={`text-[9px] uppercase font-bold ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
            {chartData.length} records loaded
          </span>
        </div>

        {/* Tab Selectors */}
        <div className={`flex gap-4 mb-6 border-b pb-2 ${darkMode ? 'border-zinc-800' : 'border-gray-100'}`}>
          <button
            onClick={() => setActiveTab('rate')}
            className={`px-4 py-2 font-black text-[10px] uppercase tracking-widest border-b-2 transition-all ${
              activeTab === 'rate' 
                ? 'border-[#be2c2e] text-[#be2c2e]' 
                : darkMode 
                  ? 'border-transparent text-zinc-400 hover:text-zinc-200'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Trigger Rate
          </button>
          <button
            onClick={() => setActiveTab('voltage')}
            className={`px-4 py-2 font-black text-[10px] uppercase tracking-widest border-b-2 transition-all ${
              activeTab === 'voltage' 
                ? 'border-[#d97706] text-[#d97706]' 
                : darkMode 
                  ? 'border-transparent text-zinc-400 hover:text-zinc-200'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Bus Voltage
          </button>
          <button
            onClick={() => setActiveTab('temp')}
            className={`px-4 py-2 font-black text-[10px] uppercase tracking-widest border-b-2 transition-all ${
              activeTab === 'temp' 
                ? 'border-[#2563eb] text-[#2563eb]' 
                : darkMode 
                  ? 'border-transparent text-zinc-400 hover:text-zinc-200'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Lab Temperature
          </button>
        </div>

        {chartData.length > 0 ? (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop 
                      offset="5%"  
                      stopColor={activeTab === 'rate' ? '#be2c2e' : activeTab === 'voltage' ? '#d97706' : '#2563eb'} 
                      stopOpacity={0.15} 
                    />
                    <stop 
                      offset="95%" 
                      stopColor={activeTab === 'rate' ? '#be2c2e' : activeTab === 'voltage' ? '#d97706' : '#2563eb'} 
                      stopOpacity={0}    
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#222533' : '#f0f0f0'} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 8, fill: darkMode ? '#8b92a5' : '#4b5563', fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: darkMode ? '#222533' : '#e5e5e5' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 8, fill: darkMode ? '#8b92a5' : '#4b5563', fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  unit={activeTab === 'rate' ? ' Hz' : activeTab === 'voltage' ? ' V' : ' °C'}
                />
                <Tooltip
                  contentStyle={{ 
                    background: darkMode ? '#151722' : '#fff', 
                    border: `1px solid ${darkMode ? '#222533' : '#e5e5e5'}`, 
                    borderRadius: 0, 
                    fontSize: 11, 
                    fontWeight: 700,
                    color: darkMode ? '#fff' : '#1d1d1b'
                  }}
                  labelStyle={{ color: darkMode ? '#8b92a5' : '#4b5563', textTransform: 'uppercase', fontSize: 9 }}
                  formatter={(v) => [
                    activeTab === 'rate' ? `${Number(v).toFixed(2)} Hz` : activeTab === 'voltage' ? `${Number(v).toFixed(1)} V` : `${Number(v).toFixed(1)} °C`,
                    activeTab === 'rate' ? 'Rate' : activeTab === 'voltage' ? 'Voltage' : 'Temp'
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey={activeTab}
                  stroke={activeTab === 'rate' ? '#be2c2e' : activeTab === 'voltage' ? '#d97706' : '#2563eb'}
                  strokeWidth={2}
                  fill="url(#chartGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: activeTab === 'rate' ? '#be2c2e' : activeTab === 'voltage' ? '#d97706' : '#2563eb', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="Waiting for trigger history data…" />
        )}
      </div>

      {/* ── Per-detector HV table ─────────────────────────────────── */}
      <div className={`${darkMode ? 'bg-[#151722] border-[#222533]' : 'bg-white border-[#e5e5e5]'} border p-8`}>
        <h2 className="text-[10px] uppercase font-black tracking-widest text-[#be2c2e] mb-6 flex items-center gap-2">
          <Zap className="w-3 h-3" /> Detector HV Summary
        </h2>
        {detectors.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className={`border-b ${darkMode ? 'border-zinc-800' : 'border-[#e5e5e5]'}`}>
                {['Node', 'Status', 'CH1 HV', 'POE V', 'POE A', 'Power'].map(h => (
                  <th key={h} className={`text-[8px] uppercase font-black tracking-widest text-left py-2 pr-4 ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detectors.map(d => {
                const ch1  = d.channels?.[0];
                const pwr  = d.power;
                return (
                  <tr key={d.nodeId} className={`border-b ${darkMode ? 'border-zinc-900/60 hover:bg-[#1a1d2b]' : 'border-[#f8f8f8] hover:bg-[#fafafa]'}`}>
                    <td className={`py-2.5 pr-4 font-black ${darkMode ? 'text-white' : 'text-[#1d1d1b]'}`}>{d.name}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-[8px] font-black uppercase ${
                        d.status === 'online' ? 'text-emerald-400' : 'text-[#be2c2e]'
                      }`}>{d.status}</span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono">
                      {ch1 ? `${(ch1.current_kv * 1000).toFixed(0)} V` : '—'}
                    </td>
                    <td className="py-2.5 pr-4 font-mono">{pwr ? `${(pwr.v ?? 0).toFixed(1)} V` : '—'}</td>
                    <td className="py-2.5 pr-4 font-mono">{pwr ? `${(pwr.a ?? 0).toFixed(3)} A` : '—'}</td>
                    <td className="py-2.5 font-mono">{pwr ? `${(pwr.w ?? 0).toFixed(1)} W` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No detector data available." />
        )}
      </div>

    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, unit, color, darkMode }) {
  const defaultColor = darkMode ? 'text-white' : 'text-[#1d1d1b]';
  const actualColor = color || defaultColor;
  return (
    <div className={`${darkMode ? 'bg-[#151722] border-[#222533]' : 'bg-white border-[#e5e5e5]'} border p-6`}>
      <p className={`text-[8px] uppercase font-black tracking-widest mb-2 flex items-center gap-1.5 ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
        {icon}{label}
      </p>
      <p className={`text-3xl font-black ${actualColor}`}>
        {value} <span className={`text-sm font-bold ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>{unit}</span>
      </p>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest py-8 text-center">
      {message}
    </p>
  );
}
