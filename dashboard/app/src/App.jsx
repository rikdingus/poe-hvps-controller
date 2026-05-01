import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Zap, Power, Settings, Gauge } from 'lucide-react';
import NodeCard from './components/NodeCard';

const QuotaWidget = ({ credits }) => {
  if (!credits) return null;
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
      <h3 className="text-[10px] uppercase text-white/40 mb-3 flex items-center gap-2">
        <Gauge className="w-3 h-3" /> AI Fuel Status
      </h3>
      <div className="space-y-4">
        {Object.entries(credits.models).map(([key, model]) => (
          <div key={key}>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-white/60">{model.display_name}</span>
              <span className={model.status === 'DEPLETED' ? 'text-red-400' : 'text-emerald-400'}>
                {model.status}
              </span>
            </div>
            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${model.status === 'DEPLETED' ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${(model.credits_remaining / model.total_budget) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [credits, setCredits] = useState(null);
  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);
  
  const handleEmergencyStop = () => {
    setIsEmergencyStopped(true);
    // In production, this would send a POST to /api/emergency-stop
    setNodes(prev => prev.map(node => ({
      ...node,
      channels: node.channels.map(ch => ({ ...ch, current_kv: 0 })),
      alert: true
    })));
  };

  const fetchData = async () => {
    if (isEmergencyStopped) return;

    try {
      // Mock data for development with occasional fault injection
      const mockNodes = Array.from({ length: 10 }, (_, i) => {
        const hasFault = Math.random() > 0.95; // 5% chance of fault per poll
        const kv = hasFault ? 3.1 : (0.5 + (Math.random() * 0.05));
        
        return {
          nodeId: i + 1,
          status: i === 0 ? 'online' : (Math.random() > 0.1 ? 'online' : 'offline'),
          channels: [
            { ch: 1, target_kv: 0.5, current_kv: kv, limit_kv: 3.0 }
          ],
          power: { v: 48.2, a: hasFault ? 0.8 : (0.05 + Math.random() * 0.1), w: hasFault ? 38 : (5.8 + Math.random() * 2) },
          ups: { battery_pct: 92, source: 'dc' },
          alert: hasFault
        };
      });

      setNodes(mockNodes);
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
    <div className="min-h-screen bg-[#0f172a] text-white p-8">
      {/* Emergency Overlay */}
      {isEmergencyStopped && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-red-900/40 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="glass bg-black/40 p-12 rounded-[40px] border-red-500/50 text-center"
          >
            <ShieldCheck className="w-20 h-20 text-red-500 mx-auto mb-6 animate-pulse" />
            <h1 className="text-6xl font-black tracking-tighter text-red-500 mb-2 uppercase">Emergency Stop Active</h1>
            <p className="text-white/60 tracking-widest uppercase text-sm">All High Voltage Outputs Inhibited</p>
            <button 
              onClick={() => setIsEmergencyStopped(false)}
              className="mt-8 px-8 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold uppercase tracking-widest pointer-events-auto"
            >
              Reset System
            </button>
          </motion.div>
        </motion.div>
      )}

      <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-8">
        
        {/* Sidebar */}
        <aside className="col-span-3">
          <div className="flex items-center gap-4 mb-12">
            <div className="p-3 rounded-2xl bg-cyan-500/20 border border-cyan-500/20">
              <Activity className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-light tracking-tight">Research Station <span className="font-bold text-cyan-400">Alpha</span></h1>
              <p className="text-white/40 text-[10px] uppercase tracking-widest">HVPS Management Center</p>
            </div>
          </div>

          <QuotaWidget credits={credits} />

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-[10px] uppercase text-white/40 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Security Status
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">WireGuard</span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase">Active</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">HA Bridge</span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase">Connected</span>
              </div>
            </div>
            <button 
              onClick={handleEmergencyStop}
              className="w-full mt-6 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold uppercase hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Power className="w-4 h-4" /> Global Emergency Stop
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="col-span-9">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {nodes.map(node => (
              <NodeCard key={node.nodeId} node={node} />
            ))}
          </div>

          <footer className="mt-12 grid grid-cols-3 gap-6 p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <Zap className="w-6 h-6 text-white/40" />
              <div>
                <p className="text-[10px] uppercase text-white/40">Active Nodes</p>
                <p className="text-xl font-bold">{nodes.filter(n => n.status === 'online').length} / {nodes.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 border-l border-white/10 pl-6">
              <Activity className="w-6 h-6 text-white/40" />
              <div>
                <p className="text-[10px] uppercase text-white/40">Last System Sync</p>
                <p className="text-xl font-bold">Just Now</p>
              </div>
            </div>
            <div className="flex items-center gap-4 border-l border-white/10 pl-6">
              <Settings className="w-6 h-6 text-white/40" />
              <div>
                <p className="text-[10px] uppercase text-white/40">SysAdmin Console</p>
                <button className="text-xs text-cyan-400 hover:underline">Open Terminal</button>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
