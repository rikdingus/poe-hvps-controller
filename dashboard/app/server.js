import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Paths to configurations
const NODES_CONFIG = process.env.NODES_CONFIG || '../config/nodes.json';
const SAFETY_CONFIG = '../config/safety_limits.json';
const CREDITS_CONFIG = '../config/ai_credits.json';

let nodeCache = {};

// Aggregator Loop
const pollNodes = async () => {
  try {
    const rawNodes = await fs.readFile(NODES_CONFIG, 'utf-8');
    const nodes = JSON.parse(rawNodes);

    for (const node of nodes) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        
        const res = await fetch(`http://${node.ip}/status`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const status = await res.json();
          nodeCache[node.id] = { ...node, status: 'online', data: status, lastSeen: new Date() };
        } else {
          nodeCache[node.id] = { ...node, status: 'error', lastSeen: new Date() };
        }
      } catch (e) {
        nodeCache[node.id] = { ...node, status: 'offline', lastSeen: new Date() };
      }
    }
  } catch (err) {
    console.error('Polling Error:', err);
  }
};

// Poll every 2 seconds
setInterval(pollNodes, 2000);

// API Endpoints
app.get('/api/nodes', (req, res) => res.json(Object.values(nodeCache)));

app.get('/api/credits', async (req, res) => {
  const data = await fs.readFile(CREDITS_CONFIG, 'utf-8');
  res.json(JSON.parse(data));
});

app.get('/api/safety', async (req, res) => {
  const data = await fs.readFile(SAFETY_CONFIG, 'utf-8');
  res.json(JSON.parse(data));
});

// Serve the static frontend in production
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Master Controller Backend running on port ${PORT}`);
  pollNodes(); // Initial poll
});
