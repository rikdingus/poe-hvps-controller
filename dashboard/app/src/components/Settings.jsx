import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, ShieldAlert, CheckCircle, Loader2 } from 'lucide-react';

export default function Settings() {
  const [defaultLimits, setDefaultLimits] = useState({
    max_hv_volts: 2500,
    max_poe_current_amps: 1.5,
    max_temp_c: 65
  });
  const [apiToken, setApiToken] = useState(localStorage.getItem('DASHBOARD_API_TOKEN') || '');
  const [channelOverrides, setChannelOverrides] = useState({});
  const [newOverrideNode, setNewOverrideNode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchSafetyStatus();
  }, []);

  const fetchSafetyStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/safety-status');
      if (res.ok) {
        const data = await res.json();
        if (data.default_limits) {
          setDefaultLimits(data.default_limits);
        }
        if (data.channel_overrides) {
          setChannelOverrides(data.channel_overrides);
        }
      } else {
        showFeedback('error', 'Failed to retrieve safety status.');
      }
    } catch (e) {
      showFeedback('error', `Connection error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleDefaultChange = (field, value) => {
    setDefaultLimits(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  const handleOverrideChange = (nodeName, field, value) => {
    setChannelOverrides(prev => {
      const nodeOverride = { ...prev[nodeName] };
      if (field === 'note') {
        nodeOverride[field] = value;
      } else {
        const parsedVal = parseFloat(value);
        if (isNaN(parsedVal) || value === '') {
          delete nodeOverride[field];
        } else {
          nodeOverride[field] = parsedVal;
        }
      }
      return {
        ...prev,
        [nodeName]: nodeOverride
      };
    });
  };

  const handleAddOverride = () => {
    if (!newOverrideNode.trim()) return;
    const formattedNode = newOverrideNode.trim().toUpperCase();
    if (channelOverrides[formattedNode]) {
      showFeedback('error', `Override for ${formattedNode} already exists.`);
      return;
    }
    setChannelOverrides(prev => ({
      ...prev,
      [formattedNode]: { note: 'New custom override' }
    }));
    setNewOverrideNode('');
  };

  const handleRemoveOverride = (nodeName) => {
    setChannelOverrides(prev => {
      const next = { ...prev };
      delete next[nodeName];
      return next;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    if (apiToken.trim()) {
      localStorage.setItem('DASHBOARD_API_TOKEN', apiToken.trim());
    } else {
      localStorage.removeItem('DASHBOARD_API_TOKEN');
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiToken.trim()) {
        headers['Authorization'] = `Bearer ${apiToken.trim()}`;
      }

      const res = await fetch('/api/safety-limits', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          default_limits: defaultLimits,
          channel_overrides: channelOverrides
        })
      });
      if (res.ok) {
        showFeedback('success', 'Safety configuration saved and hot-reloaded successfully.');
      } else {
        const errorData = await res.json();
        showFeedback('error', `Save failed: ${errorData.error || res.statusText}`);
      }
    } catch (e) {
      showFeedback('error', `Network error while saving: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#e5e5e5] p-12 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-[#be2c2e] animate-spin mb-4" />
        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Loading safety configuration…</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="bg-white border border-[#e5e5e5] p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-black text-[#1d1d1b] uppercase tracking-tight">Safety Thresholds</h2>
          <p className="text-[10px] uppercase font-bold text-gray-500 mt-1 tracking-wider">
            Configure default and override limits to protect detector components.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-[#be2c2e] text-white px-6 py-2.5 font-black text-xs uppercase tracking-widest hover:bg-[#7a0000] transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Limits
        </button>
      </div>

      {/* Message Notifications */}
      {message.text && (
        <div className={`p-4 flex items-center gap-3 border ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-[#be2c2e]'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <ShieldAlert className="w-5 h-5 flex-shrink-0" />}
          <span className="text-xs font-bold uppercase tracking-wider">{message.text}</span>
        </div>
      )}

      {/* Global Default Limits */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase text-gray-700 tracking-widest border-b border-gray-50 pb-2">Global Default Limits</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black text-gray-600 block tracking-wider">Max HV Voltage (V)</label>
            <input
              type="number"
              value={defaultLimits.max_hv_volts}
              onChange={(e) => handleDefaultChange('max_hv_volts', e.target.value)}
              className="w-full border border-[#e5e5e5] px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#be2c2e]"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black text-gray-600 block tracking-wider">Max PoE Current (A)</label>
            <input
              type="number"
              step="0.01"
              value={defaultLimits.max_poe_current_amps}
              onChange={(e) => handleDefaultChange('max_poe_current_amps', e.target.value)}
              className="w-full border border-[#e5e5e5] px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#be2c2e]"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black text-gray-600 block tracking-wider">Max Temperature (°C)</label>
            <input
              type="number"
              value={defaultLimits.max_temp_c}
              onChange={(e) => handleDefaultChange('max_temp_c', e.target.value)}
              className="w-full border border-[#e5e5e5] px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#be2c2e]"
              required
            />
          </div>
        </div>
      </div>

      {/* Per-Node Overrides */}
      <div className="space-y-6 pt-4">
        <div className="flex justify-between items-end border-b border-gray-50 pb-2">
          <h3 className="text-xs font-black uppercase text-gray-700 tracking-widest">Per-Detector Custom Overrides</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. HVPS-07"
              value={newOverrideNode}
              onChange={(e) => setNewOverrideNode(e.target.value)}
              className="border border-[#e5e5e5] px-3 py-1.5 uppercase font-mono text-xs focus:outline-none focus:border-[#be2c2e]"
            />
            <button
              type="button"
              onClick={handleAddOverride}
              className="flex items-center gap-1 bg-[#1d1d1b] text-white px-4 py-1.5 font-black text-[10px] uppercase tracking-widest hover:bg-[#be2c2e] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {Object.keys(channelOverrides).length === 0 ? (
          <div className="bg-[#fafafa] border border-dashed border-[#e5e5e5] p-6 text-center text-xs text-gray-500 uppercase tracking-widest">
            No custom detector overrides configured. Using global defaults.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(channelOverrides).map(([nodeName, override]) => (
              <div key={nodeName} className="border border-[#e5e5e5] p-6 bg-[#fcfcfc] space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="font-mono font-black text-sm text-[#be2c2e]">{nodeName}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveOverride(nodeName)}
                    className="text-gray-500 hover:text-[#be2c2e] transition-colors p-1"
                    title="Remove Override"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[9px] uppercase font-black text-gray-600 block mb-1">Max HV Voltage (V)</label>
                    <input
                      type="number"
                      placeholder={`Default (${defaultLimits.max_hv_volts})`}
                      value={override.max_hv_volts ?? ''}
                      onChange={(e) => handleOverrideChange(nodeName, 'max_hv_volts', e.target.value)}
                      className="w-full border border-[#e5e5e5] px-2 py-1.5 font-mono text-xs focus:outline-none focus:border-[#be2c2e] bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-black text-gray-600 block mb-1">Max PoE Current (A)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={`Default (${defaultLimits.max_poe_current_amps})`}
                      value={override.max_poe_current_amps ?? ''}
                      onChange={(e) => handleOverrideChange(nodeName, 'max_poe_current_amps', e.target.value)}
                      className="w-full border border-[#e5e5e5] px-2 py-1.5 font-mono text-xs focus:outline-none focus:border-[#be2c2e] bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-black text-gray-600 block mb-1">Max Temperature (°C)</label>
                    <input
                      type="number"
                      placeholder={`Default (${defaultLimits.max_temp_c})`}
                      value={override.max_temp_c ?? ''}
                      onChange={(e) => handleOverrideChange(nodeName, 'max_temp_c', e.target.value)}
                      className="w-full border border-[#e5e5e5] px-2 py-1.5 font-mono text-xs focus:outline-none focus:border-[#be2c2e] bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-black text-gray-600 block mb-1">Override Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Sensitive load"
                      value={override.note ?? ''}
                      onChange={(e) => handleOverrideChange(nodeName, 'note', e.target.value)}
                      className="w-full border border-[#e5e5e5] px-2 py-1.5 text-xs focus:outline-none focus:border-[#be2c2e] bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Access Security */}
      <div className="space-y-4 pt-4 border-t border-gray-100">
        <h3 className="text-xs font-black uppercase text-gray-700 tracking-widest border-b border-gray-50 pb-2">API Write Authentication</h3>
        <div className="space-y-1 max-w-md">
          <label className="text-[10px] uppercase font-black text-gray-600 block tracking-wider">Dashboard API Bearer Token</label>
          <input
            type="password"
            placeholder="Enter DASHBOARD_API_TOKEN"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            className="w-full border border-[#e5e5e5] px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#be2c2e]"
          />
          <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider block mt-1">
            Required if DASHBOARD_API_TOKEN is enabled on the server. Stored locally in your browser.
          </span>
        </div>
      </div>
    </form>
  );
}
