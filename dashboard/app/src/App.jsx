import React, { useState, useEffect, useCallback } from 'react';
import { Activity, ShieldCheck, Zap, Settings, Gauge, TrendingUp, LayoutDashboard, Cpu, Radio, AlertTriangle, Sun, Moon } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import NodeCard from './components/NodeCard';
import Analytics from './components/Analytics';
import SettingsView from './components/Settings';

// ─── Sub-widgets ──────────────────────────────────────────────────────────────

const DigitizerWidget = ({ data, darkMode }) => {
  if (!data) return null;
  return (
    <div className={`${darkMode ? 'bg-[#151722] border-[#222533]' : 'bg-white border-[#e5e5e5]'} border p-8 mb-8`}>
      <h3 className="text-[10px] uppercase text-[#be2c2e] mb-6 flex items-center gap-2 font-black tracking-widest">
        <Cpu className="w-3 h-3" /> Central Digitizer (KORSTMOS)
      </h3>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <span className={`text-[9px] uppercase font-black mb-1 tracking-widest ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>Trigger Rate</span>
            <span className={`text-4xl font-black ${darkMode ? 'text-white' : 'text-[#1d1d1b]'}`}>{data.triggerRate} <span className="text-sm">Hz</span></span>
          </div>
          <div className="flex flex-col items-end">
            <span className={`text-[9px] uppercase font-black mb-1 tracking-widest ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>Coincidence</span>
            <span className="text-xl font-black text-[#be2c2e] uppercase">{data.coincidenceMode}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className={`${darkMode ? 'bg-[#1a1d2b] border-[#262a3d]' : 'bg-[#fafafa] border-gray-100'} p-4 border`}>
            <span className={`text-[8px] uppercase font-black block mb-1 ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>Active Plates</span>
            <span className={`text-lg font-black ${darkMode ? 'text-white' : 'text-[#1d1d1b]'}`}>{data.activeChannels}</span>
          </div>
          <div className={`${darkMode ? 'bg-[#1a1d2b] border-[#262a3d]' : 'bg-[#fafafa] border-gray-100'} p-4 border text-right`}>
            <span className={`text-[8px] uppercase font-black block mb-1 ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>Muon Pulse</span>
            <div className="flex items-center justify-end gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
              <span className={`text-lg font-black ${darkMode ? 'text-white' : 'text-[#1d1d1b]'}`}>LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfraWidget = ({ data, darkMode }) => {
  if (!data) return null;
  const isOffline = !data.lastSeen;
  return (
    <div className={`${darkMode ? 'bg-[#151722] border-[#222533]' : 'bg-white border-[#e5e5e5]'} border p-8 mb-8`}>
      <h3 className="text-[10px] uppercase text-[#be2c2e] mb-6 flex items-center gap-2 font-black tracking-widest w-full">
        <Settings className="w-3 h-3" /> Facility Infrastructure
        {isOffline && <span className="text-[8px] text-[#be2c2e] font-black uppercase ml-auto border border-[#be2c2e]/20 px-1.5 py-0.5 animate-pulse">Offline</span>}
      </h3>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <span className={`text-[9px] uppercase font-black mb-1 tracking-widest ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>Bus Voltage</span>
            <span className="text-3xl font-black text-[#be2c2e]">{isOffline ? '--' : `${(data.voltage ?? 0).toFixed(1)}`} <span className="text-sm">V</span></span>
          </div>
          <div className="flex flex-col items-end">
            <span className={`text-[9px] uppercase font-black mb-1 tracking-widest ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>Lab Temp</span>
            <span className={`text-3xl font-black ${darkMode ? 'text-white' : 'text-[#1d1d1b]'}`}>{isOffline ? '--' : `${(data.temp ?? 0).toFixed(1)}°C`}</span>
          </div>
        </div>
        {isOffline && data.error && (
          <div className={`border p-2 mt-2 ${darkMode ? 'bg-red-950/20 border-[#be2c2e]/20' : 'bg-red-50/50 border-[#be2c2e]/10'}`}>
            <p className="text-[8px] text-[#be2c2e] font-black uppercase tracking-wider leading-tight">{data.error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [detectors,         setDetectors]         = useState([]);
  const [digitizer,         setDigitizer]         = useState({ triggerRate: 0, coincidenceMode: '2-fold', activeChannels: 4 });
  const [history,           setHistory]           = useState([]);
  const [downsampledHistory, setDownsampledHistory] = useState([]);
  const [infra,             setInfra]             = useState({ voltage: 0, temp: 0, cpu: 0, lastSeen: null, error: 'Connecting...' });
  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);
  const [eStopPending,      setEStopPending]      = useState(false);
  const [view,              setView]              = useState('dashboard');
  const [darkMode,          setDarkMode]          = useState(true);

  const fetchDownsampledHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setDownsampledHistory(data);
      }
    } catch (e) {
      console.error('Failed to fetch downsampled history:', e);
    }
  }, []);

  useEffect(() => {
    fetchDownsampledHistory();
    const interval = setInterval(fetchDownsampledHistory, 30000); // refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchDownsampledHistory]);

  const handleEmergencyStop = useCallback(async () => {
    setEStopPending(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = localStorage.getItem('DASHBOARD_API_TOKEN');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      await fetch('/api/emergency-stop', {
        method: 'POST',
        headers,
        body: JSON.stringify({ active: true, reason: 'dashboard-halt-button' }),
      });
    } catch (e) {
      console.error('[E-STOP] Server unreachable:', e.message);
    }
    setIsEmergencyStopped(true);
    setDetectors(prev => prev.map(d => ({
      ...d,
      channels: d.channels?.map(ch => ({ ...ch, current_kv: 0 })),
      alert: true
    })));
    setEStopPending(false);
  }, []);

  const handleResume = useCallback(async () => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = localStorage.getItem('DASHBOARD_API_TOKEN');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      await fetch('/api/emergency-stop', {
        method: 'POST',
        headers,
        body: JSON.stringify({ active: false, reason: 'dashboard-resume' }),
      });
    } catch (e) {
      console.error('[E-STOP] Resume call failed:', e.message);
    }
    setIsEmergencyStopped(false);
  }, []);

  const fetchData = useCallback(async () => {
    if (isEmergencyStopped) return;
    try {
      const [detRes, digRes, infraRes] = await Promise.all([
        fetch('/api/detectors'),
        fetch('/api/digitizer'),
        fetch('/api/infra'),
      ]);

      const liveDets  = await detRes.json();
      const liveDig   = await digRes.json();
      const liveInfra = await infraRes.json();

      setDigitizer(liveDig);
      setInfra(liveInfra);

      if (liveDets && liveDets.length > 0) {
        setDetectors(liveDets);
        setHistory(prev => [...prev.slice(-29), {
          time: new Date().toLocaleTimeString(),
          rate: parseFloat(liveDig.triggerRate)
        }]);
      } else {
        const mockDets = Array.from({ length: 4 }, (_, i) => ({
          nodeId: i + 1,
          name: `Detector-${i + 1}`,
          status: 'online',
          channels: [
            { ch: 1, target_kv: 1.2, current_kv: 1.2 + (Math.random()*0.02), limit_kv: 2.5 },
            { ch: 2, target_kv: 1.2, current_kv: 1.15 + (Math.random()*0.02), limit_kv: 2.5 }
          ],
          power: { v: 48.2, a: 0.12, w: 5.8 },
          ups: { battery_pct: 100, source: 'dc' }
        }));
        setDetectors(mockDets);
        setHistory(prev => [...prev.slice(-29), {
          time: new Date().toLocaleTimeString(),
          rate: parseFloat((Math.random() * 5 + 2).toFixed(2))
        }]);
      }
    } catch (e) {
      console.error('Korstmos Fetch Error:', e);
    }
  }, [isEmergencyStopped]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-[#0d0e12] text-[#e3e5eb]' : 'bg-[#f8f9fa] text-[#1d1d1b]'}`}>
      <header className={`${darkMode ? 'bg-[#151722] border-b border-[#222533]' : 'bg-white border-b border-[#e5e5e5]'} px-12 py-8 mb-12 shadow-sm transition-colors duration-300`}>
        <div className="max-w-[1700px] mx-auto flex justify-between items-end">
          <div className="flex items-center gap-8">
            <div className="w-16 h-16 bg-[#be2c2e] flex items-center justify-center text-white">
              <Radio className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase leading-none text-[#be2c2e]">
                Project <span className={darkMode ? 'text-white' : 'text-[#1d1d1b]'}>Korstmos</span>
              </h1>
              <p className={`text-[10px] uppercase tracking-[0.4em] font-bold mt-2 ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                Kosmisch Onderzoek Radboud Studenten Meetopstelling
              </p>
            </div>
          </div>
          <div className="flex gap-6 items-center">
            <div className="text-right">
              <p className={`text-[9px] uppercase font-black tracking-widest ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>Array Status</p>
              <p className="text-sm font-bold flex items-center gap-2 justify-end">
                {isEmergencyStopped ? (
                  <><span className="w-2 h-2 rounded-full bg-[#be2c2e]"></span> Halted</>
                ) : (
                  <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Measuring Muons</>
                )}
              </p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-3 border rounded transition-colors ${
                darkMode 
                  ? 'border-[#222533] bg-[#151722] hover:bg-[#1a1d2b] text-[#38bdf8]' 
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-amber-500'
              }`}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={handleEmergencyStop}
              disabled={eStopPending || isEmergencyStopped}
              className="bg-[#be2c2e] text-white px-8 py-3 font-black text-xs uppercase tracking-widest hover:bg-[#7a0000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {eStopPending ? 'Halting…' : 'Halt Acquisition →'}
            </button>
          </div>
        </div>
      </header>

      {isEmergencyStopped && (
        <div className={`fixed inset-0 z-50 backdrop-blur-md flex flex-col items-center justify-center ${darkMode ? 'bg-[#0d0e12]/90' : 'bg-white/90'}`}>
          <div className="text-center p-16 border-4 border-[#be2c2e]">
            <ShieldCheck className="w-24 h-24 text-[#be2c2e] mx-auto mb-6" />
            <h1 className="text-7xl font-black tracking-tighter text-[#be2c2e] mb-4 uppercase italic">
              ACQUISITION HALTED
            </h1>
            <p className="text-gray-500 tracking-widest uppercase text-sm font-bold">
              Scientific Override Active — PoE power cut to all detectors
            </p>
            <button
              onClick={handleResume}
              className="mt-12 px-12 py-4 bg-[#be2c2e] text-white text-sm font-black uppercase tracking-widest hover:bg-[#7a0000]"
            >
              Resume Run →
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1700px] mx-auto grid grid-cols-12 gap-12 px-12 pb-24">
        <aside className="col-span-4">
          <nav className="mb-10 space-y-2">
            <button
              onClick={() => setView('dashboard')}
              className={`w-full px-8 py-5 text-left font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center gap-4 ${
                view === 'dashboard'
                  ? 'bg-[#be2c2e] text-white'
                  : darkMode
                    ? 'bg-[#151722] border border-[#222533] text-zinc-300 hover:border-[#be2c2e]'
                    : 'bg-white border border-[#e5e5e5] hover:border-[#be2c2e] text-[#1d1d1b]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> Detector Array
            </button>
            <button
              onClick={() => setView('analytics')}
              className={`w-full px-8 py-5 text-left font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center gap-4 ${
                view === 'analytics'
                  ? 'bg-[#be2c2e] text-white'
                  : darkMode
                    ? 'bg-[#151722] border border-[#222533] text-zinc-300 hover:border-[#be2c2e]'
                    : 'bg-white border border-[#e5e5e5] hover:border-[#be2c2e] text-[#1d1d1b]'
              }`}
            >
              <TrendingUp className="w-4 h-4" /> Event History
            </button>
            <button
              onClick={() => setView('settings')}
              className={`w-full px-8 py-5 text-left font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center gap-4 ${
                view === 'settings'
                  ? 'bg-[#be2c2e] text-white'
                  : darkMode
                    ? 'bg-[#151722] border border-[#222533] text-zinc-300 hover:border-[#be2c2e]'
                    : 'bg-white border border-[#e5e5e5] hover:border-[#be2c2e] text-[#1d1d1b]'
              }`}
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
          </nav>

          <DigitizerWidget data={digitizer} darkMode={darkMode} />
          <InfraWidget data={infra} darkMode={darkMode} />

          <div className={`${darkMode ? 'bg-[#151722] border-[#222533]' : 'bg-white border-[#e5e5e5]'} border p-8`}>
            <h3 className="text-[11px] uppercase text-[#be2c2e] mb-8 font-black tracking-widest flex items-center gap-3">
              Trigger Rate (Hz)
            </h3>
            <div className="h-[150px]" style={{ minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={history}>
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="#be2c2e"
                    strokeWidth={3}
                    fill="#be2c2e"
                    fillOpacity={darkMode ? 0.15 : 0.05}
                  />
                  <YAxis hide domain={['auto', 'auto']} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </aside>

        <main className="col-span-8">
          {view === 'dashboard' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {detectors.map(det => (
                <NodeCard key={det.nodeId} node={det} darkMode={darkMode} />
              ))}
            </div>
          ) : view === 'analytics' ? (
            <Analytics history={history} detectors={detectors} downsampledHistory={downsampledHistory} darkMode={darkMode} />
          ) : (
            <SettingsView darkMode={darkMode} />
          )}
        </main>
      </div>
    </div>
  );
}
