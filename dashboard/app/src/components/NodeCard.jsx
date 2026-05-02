import React from 'react';
import { Activity, ShieldAlert, Zap, Battery, Power, Thermometer } from 'lucide-react';

const DetectorCard = ({ node }) => {
  const isOnline = node.status === 'online';
  const isAlert = node.alert;

  return (
    <div className={`relative bg-white border ${isAlert ? 'border-[#be2c2e] ring-4 ring-[#be2c2e]/10' : 'border-[#e5e5e5]'} transition-all duration-500 overflow-hidden`}>
      {/* Institutional Ribbon */}
      <div className={`h-1 w-full ${isOnline ? (isAlert ? 'bg-[#be2c2e]' : 'bg-[#1d1d1b]') : 'bg-gray-200'}`} />
      
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h3 className="text-2xl font-black text-[#1d1d1b] tracking-tighter uppercase leading-none">
              {node.name || `Detector-${node.nodeId.toString().padStart(2, '0')}`}
            </h3>
            <p className="text-[9px] uppercase font-bold text-gray-400 tracking-[0.3em] mt-2">Scintillator Unit</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isOnline ? 'text-emerald-600' : 'text-gray-400'}`}>
              {node.status}
            </span>
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-300'}`} />
          </div>
        </div>

        {/* PMT Telemetry */}
        <div className="mb-10">
          <div className="flex justify-between items-end mb-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">PMT High-Voltage</span>
            <span className={`text-4xl font-black tracking-tighter ${isAlert ? 'text-[#be2c2e]' : 'text-[#1d1d1b]'}`}>
              {node.channels[0].current_kv.toFixed(3)} <span className="text-sm">kV</span>
            </span>
          </div>
          <div className="h-2 w-full bg-gray-100 overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${isAlert ? 'bg-[#be2c2e]' : 'bg-[#1d1d1b]'}`}
              style={{ width: `${(node.channels[0].current_kv / 2.5) * 100}%` }}
            />
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-100">
          <div className="space-y-1">
            <p className="text-[8px] uppercase font-black text-gray-400 tracking-widest">Discriminator</p>
            <p className="text-lg font-black text-[#1d1d1b]">
              {(node.channels[0].target_kv * 100).toFixed(0)} <span className="text-[10px]">mV</span>
            </p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-[8px] uppercase font-black text-gray-400 tracking-widest">PoE Draw</p>
            <p className="text-lg font-black text-[#1d1d1b]">
              {node.power.w.toFixed(1)} <span className="text-[10px]">W</span>
            </p>
          </div>
        </div>
      </div>

      {/* Alert Overlay */}
      {isAlert && (
        <div className="absolute top-4 right-4 animate-bounce">
          <ShieldAlert className="text-[#be2c2e] w-8 h-8" />
        </div>
      )}
    </div>
  );
};

export default DetectorCard;
