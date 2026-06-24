import fs from 'fs/promises';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const TELEMETRY_FILE = path.join(LOG_DIR, `telemetry_${new Date().toISOString().split('T')[0]}.csv`);
const DOWNSAMPLED_FILE = path.join(LOG_DIR, 'history_downsampled.csv');

export async function initLogger() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    try {
      await fs.access(TELEMETRY_FILE);
    } catch {
      const header = 'timestamp,node_id,status,kv1,kv2,ma,watts,infra_v,infra_temp\n';
      await fs.writeFile(TELEMETRY_FILE, header);
    }
    console.log(`[LOGGER] Telemetry active: ${TELEMETRY_FILE}`);
  } catch (e) {
    console.error('[LOGGER] Init failed:', e);
  }
}

export async function logTelemetry(nodeData, infraData) {
  try {
    const timestamp = new Date().toISOString();
    const rows = nodeData.map(node => {
      const kv1 = (node.channels && node.channels[0]) ? node.channels[0].current_kv : 0;
      const kv2 = (node.channels && node.channels[1]) ? node.channels[1].current_kv : 0;
      const ma = (node.power && node.power.a) ? (node.power.a * 1000).toFixed(2) : 0;
      const w = (node.power && node.power.w) ? node.power.w.toFixed(2) : 0;
      return `${timestamp},${node.nodeId},${node.status},${kv1},${kv2},${ma},${w},${infraData.voltage},${infraData.temp}`;
    }).join('\n') + '\n';
    
    await fs.appendFile(TELEMETRY_FILE, rows);
  } catch (e) {
    console.error('[LOGGER] Log write failed:', e);
  }
}

export async function initDownsampledLogger() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    try {
      await fs.access(DOWNSAMPLED_FILE);
    } catch {
      const header = 'timestamp,rate,voltage,temp\n';
      await fs.writeFile(DOWNSAMPLED_FILE, header);
    }
  } catch (e) {
    console.error('[LOGGER] Downsampled Logger init failed:', e);
  }
}

export async function logDownsampledSample(rate, voltage, temp) {
  try {
    const timestamp = new Date().toISOString();
    const row = `${timestamp},${rate},${voltage},${temp}\n`;
    await fs.appendFile(DOWNSAMPLED_FILE, row);
  } catch (e) {
    console.error('[LOGGER] Downsampled Log write failed:', e);
  }
}

export async function readDownsampledHistory(limit = 8640) {
  try {
    await initDownsampledLogger();
    const content = await fs.readFile(DOWNSAMPLED_FILE, 'utf-8');
    const lines = content.trim().split('\n').slice(1); // skip header
    const lastLines = lines.slice(-limit);
    return lastLines.map(line => {
      const parts = line.split(',');
      return {
        timestamp: parts[0],
        rate: parseFloat(parts[1]) || 0,
        voltage: parseFloat(parts[2]) || 0,
        temp: parseFloat(parts[3]) || 0
      };
    });
  } catch (e) {
    console.error('[LOGGER] Reading downsampled history failed:', e);
    return [];
  }
}

