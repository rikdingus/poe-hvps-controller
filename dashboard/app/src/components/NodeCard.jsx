import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Zap, ShieldAlert, Cpu } from 'lucide-react';

const NodeCard = ({ node }) => {
  const { nodeId, status, channels, power, ups } = node;
  
  // Calculate percentage for the gauge (0.5kV - 3.0kV)
  const calculatePct = (kv) => {
    const min = 0.5;
    const max = 3.0;
    const pct = ((kv - min) / (max - min)) * 100;
    return Math.min(Math.max(pct, 0), 100);
  };

  const mainKv = channels[0].current_kv;
  const gaugePct = calculatePct(mainKv);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="relative overflow-hidden glass rounded-3xl p-6 border border-white/10 group"
    >
      {/* Background Pulse for Active Nodes */}
      {status === 'online' && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[60px] rounded-full -mr-16 -mt-16 animate-pulse" />
      )}

      {/* Header */}
      <div class="flex justify-between items-start mb-6">
        <div>
          <h3 class="text-xs uppercase tracking-[0.2em] text-white/40 font-bold mb-1">Node Unit</h3>
          <div class="flex items-center gap-2">
            <span class="text-2xl font-bold tracking-tighter">0{nodeId}</span>
            <span class={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
          </div>
        </div>
        <div class="p-2 rounded-xl bg-white/5 border border-white/10">
          <Cpu size={16} className="text-white/40" />
        </div>
      </div>

      {/* Main Gauge */}
      <div class="relative flex flex-col items-center justify-center mb-8 py-4">
        <svg viewBox="0 0 100 60" class="w-full max-w-[200px]">
          {/* Background Arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Active Progress Arc */}
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: gaugePct / 100 }}
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={mainKv > 2.5 ? '#f87171' : '#22d3ee'}
            strokeWidth="8"
            strokeLinecap="round"
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>
        
        <div class="absolute inset-0 flex flex-col items-center justify-center pt-4">
          <span class="text-4xl font-bold tracking-tighter leading-none">{mainKv.toFixed(2)}</span>
          <span class="text-[10px] uppercase tracking-widest text-cyan-400 font-bold mt-1">kV Output</span>
        </div>
      </div>

      {/* Secondary Stats */}
      <div class="grid grid-cols-2 gap-4">
        <div class="glass bg-white/[0.02] p-3 rounded-2xl border border-white/5">
          <div class="flex items-center gap-2 mb-1">
            <Zap size={10} className="text-amber-400" />
            <span class="text-[9px] uppercase tracking-widest text-white/30 font-bold">Current</span>
          </div>
          <div class="flex items-baseline gap-1">
            <span class="text-sm font-bold">{(power.a * 1000).toFixed(1)}</span>
            <span class="text-[10px] text-white/20">mA</span>
          </div>
        </div>
        <div class="glass bg-white/[0.02] p-3 rounded-2xl border border-white/5">
          <div class="flex items-center gap-2 mb-1">
            <Activity size={10} className="text-cyan-400" />
            <span class="text-[9px] uppercase tracking-widest text-white/30 font-bold">Power</span>
          </div>
          <div class="flex items-baseline gap-1">
            <span class="text-sm font-bold">{power.w.toFixed(1)}</span>
            <span class="text-[10px] text-white/20">W</span>
          </div>
        </div>
      </div>

      {/* UPS / Battery Indicator */}
      <div class="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
        <div class="flex items-center gap-2">
          <div class="w-8 h-4 rounded-sm border border-white/20 relative flex items-center p-0.5">
             <div 
               class="h-full bg-emerald-500 rounded-[1px]" 
               style={{ width: `${ups.battery_pct}%` }}
             ></div>
             <div class="absolute -right-1 w-1 h-2 bg-white/20 rounded-r-sm"></div>
          </div>
          <span class="text-[10px] text-white/40 font-bold">{ups.battery_pct}%</span>
        </div>
        <span class="text-[9px] uppercase tracking-widest text-white/20 font-bold">
          Source: {ups.source.toUpperCase()}
        </span>
      </div>
    </motion.div>
  );
};

export default NodeCard;
