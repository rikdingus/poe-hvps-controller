import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Zap, Settings, Gauge, TrendingUp, LayoutDashboard } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import NodeCard from './components/NodeCard';
import Analytics from './components/Analytics';

const QuotaWidget = ({ credits }) => {
  if (!credits) return null;
  return (
    <div className="bg-white border border-[#e5e5e5] p-6 mb-8">
      <h3 className="text-[10px] uppercase text-[#be2c2e] mb-4 flex items-center gap-2 font-black tracking-widest">
        <Gauge className="w-3 h-3" /> AI Credit Status
      </h3>
      <div className="space-y-4">
        {Object.entries(credits.models).map(([key, model]) => (
          <div key={key}>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-gray-400 font-black uppercase tracking-tighter">{model.display_name}</span>
              <span className={model.status === 'DEPLETED' ? 'text-[#be2c2e]' : 'text-emerald-600 font-black'}>
                {model.status}
              </span>
            </div>
            <div className="h-1 w-full bg-gray-100 overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${model.status === 'DEPLETED' ? 'bg-[#be2c2e]' : 'bg-[#1d1d1b]'}`}
                style={{ width: `${(model.credits_remaining / model.total_budget) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const InfraWidget = ({ data }) => {
  if (!data) return null;
  return (
    <div className="bg-white border border-[#e5e5e5] p-8 mb-8">
      <h3 className="text-[10px] uppercase text-[#be2c2e] mb-6 flex items-center gap-2 font-black tracking-widest">
        <Settings className="w-3 h-3" /> Infrastructure Health
      </h3>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase text-gray-400 font-black mb-1 tracking-widest">UPS Battery</span>
            <span className="text-3xl font-black text-[#be2c2e]">{data.voltage.toFixed(1)} <span className="text-sm">V</span></span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase text-gray-400 font-black mb-1 tracking-widest">Lab Temp</span>
            <span className="text-3xl font-black text-[#1d1d1b]">{data.temp.toFixed(1)}°C</span>
          </div>
        </div>
        <div className="h-2 w-full bg-gray-100 overflow-hidden">
          <div 
            className="h-full bg-[#be2c2e]"
            style={{ width: `${Math.min((data.voltage / 28) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [history, setHistory] = useState([]);
  const [credits, setCredits] = useState(null);
  const [infra, setInfra] = useState({ voltage: 26.4, temp: 42, cpu: 12 });
  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);
  const [view, setView] = useState('dashboard');
  
  const handleEmergencyStop = () => {
    setIsEmergencyStopped(true);
    setNodes(prev => prev.map(node => ({
      ...node,
      channels: node.channels.map(ch => ({ ...ch, current_kv: 0 })),
      alert: true
    })));
  };

  const fetchData = async () => {
    if (isEmergencyStopped) return;

    try {
      const nodeRes = await fetch('/api/nodes');
      const liveNodes = await nodeRes.json();
      
      const infraRes = await fetch('/api/infra');
      const liveInfra = await infraRes.json();
      if (liveInfra.lastSeen) setInfra(liveInfra);

      if (liveNodes && liveNodes.length > 0) {
        setNodes(liveNodes);
        const totalW = liveNodes.reduce((sum, n) => sum + (n.status === 'online' ? n.power.w : 0), 0);
        setHistory(prev => [...prev.slice(-29), { time: new Date().toLocaleTimeString(), load: totalW }]);
      } else {
        const mockNodes = Array.from({ length: 10 }, (_, i) => {
          const hasFault = Math.random() > 0.98;
          const kv = hasFault ? 3.1 : (0.5 + (Math.random() * 0.05));
          return {
            nodeId: i + 1,
            status: i === 0 ? 'online' : (Math.random() > 0.1 ? 'online' : 'offline'),
            channels: [{ ch: 1, target_kv: 0.5, current_kv: kv, limit_kv: 3.0 }],
            power: { v: 48.2, a: hasFault ? 0.8 : (0.05 + Math.random() * 0.1), w: hasFault ? 38 : (5.8 + Math.random() * 2) },
            ups: { battery_pct: 92, source: 'dc' },
            alert: hasFault
          };
        });
        setNodes(mockNodes);
        const totalW = mockNodes.reduce((sum, n) => sum + (n.status === 'online' ? n.power.w : 0), 0);
        setHistory(prev => [...prev.slice(-29), { time: new Date().toLocaleTimeString(), load: totalW }]);
      }
    } catch (e) {
      console.error('Fetch Error:', e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [isEmergencyStopped]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1d1d1b]">
      {/* Institutional Header */}
      <header className="bg-white border-b border-[#e5e5e5] px-12 py-8 mb-12 shadow-sm">
        <div className="max-w-[1700px] mx-auto flex justify-between items-end">
          <div className="flex items-center gap-8">
             <div className="w-16 h-16 bg-[#be2c2e] flex items-center justify-center text-white">
                <Zap className="w-10 h-10" />
             </div>
             <div>
                <h1 className="text-4xl font-black tracking-tighter uppercase leading-none text-[#be2c2e]">
                  Research Station <span className="text-[#1d1d1b]">Alpha</span>
                </h1>
                <p className="text-[10px] uppercase tracking-[0.4em] font-bold mt-2 text-gray-400">
                  Faculty of Science • Radboud University
                </p>
             </div>
          </div>
          <div className="flex gap-6 items-center">
            <div className="text-right">
              <p className="text-[9px] uppercase font-black text-gray-400 tracking-widest">System Status</p>
              <p className="text-sm font-bold flex items-center gap-2 justify-end">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Operational
              </p>
            </div>
            <button onClick={handleEmergencyStop} className="bg-[#be2c2e] text-white px-8 py-3 font-black text-xs uppercase tracking-widest hover:bg-[#7a0000] transition-colors">
              Emergency Stop →
            </button>
          </div>
        </div>
      </header>

      {/* Emergency Overlay */}
      {isEmergencyStopped && (
        <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="text-center p-16 border-4 border-[#be2c2e]">
            <ShieldCheck className="w-24 h-24 text-[#be2c2e] mx-auto mb-6" />
            <h1 className="text-7xl font-black tracking-tighter text-[#be2c2e] mb-4 uppercase italic">SYSTEM INHIBITED</h1>
            <p className="text-gray-500 tracking-widest uppercase text-sm font-bold">Manual Reset Required by Faculty Staff</p>
            <button onClick={() => setIsEmergencyStopped(false)} className="mt-12 px-12 py-4 bg-[#be2c2e] text-white text-sm font-black uppercase tracking-widest hover:bg-[#7a0000]">Reset Station →</button>
          </div>
        </div>
      )}

      <div className="max-w-[1700px] mx-auto grid grid-cols-12 gap-12 px-12 pb-24">
        
        {/* Sidebar */}
        <aside className="col-span-3">
          <nav className="mb-10 space-y-2">
             <button 
               onClick={() => setView('dashboard')}
               className={`w-full px-8 py-5 text-left font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center gap-4 ${view === 'dashboard' ? 'bg-[#be2c2e] text-white' : 'bg-white border border-[#e5e5e5] hover:border-[#be2c2e]'}`}
             >
               <LayoutDashboard className="w-4 h-4" /> Real-Time Feed
             </button>
             <button 
               onClick={() => setView('analytics')}
               className={`w-full px-8 py-5 text-left font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center gap-4 ${view === 'analytics' ? 'bg-[#be2c2e] text-white' : 'bg-white border border-[#e5e5e5] hover:border-[#be2c2e]'}`}
             >
               <TrendingUp className="w-4 h-4" /> Lab Archive
             </button>
          </nav>

          <InfraWidget data={infra} />
          
          <div className="bg-white border border-[#e5e5e5] p-8 mb-8">
            <h3 className="text-[11px] uppercase text-[#be2c2e] mb-8 font-black tracking-widest flex items-center gap-3">
               System Load Trend
            </h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <Area type="monotone" dataKey="load" stroke="#be2c2e" strokeWidth={3} fill="#be2c2e" fillOpacity={0.05} />
                  <YAxis hide domain={['auto', 'auto']} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <QuotaWidget credits={credits} />
        </aside>

        {/* Main Content */}
        <main className="col-span-9">
          {view === 'dashboard' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {nodes.map(node => (
                <NodeCard key={node.nodeId} node={node} />
              ))}
            </div>
          ) : (
            <Analytics />
          )}
        </main>
      </div>
    </div>
  );
}
