// =====================================================================
//  audit_environment.js  -- Project Korstmos pre-flight audit
//
//  Run before first-light / each session start. Verifies:
//    1. MikroTik reachability + SNMP read permission
//    2. Each detector node in nodes.json: ping + firmware /info,
//       including comparison of reported firmware version against
//       EXPECTED_FW (default '1.1.0', override via env).
//    3. logs/ directory exists and is writable
//
//  Usage:
//    cd dashboard/app
//    node audit_environment.js
//    # or via the package.json script:
//    npm run audit
// =====================================================================

import snmp from 'net-snmp';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const MIKROTIK_IP    = process.env.MIKROTIK_IP    || '192.168.88.1';
const SNMP_COMMUNITY = process.env.SNMP_COMMUNITY || 'public';
const NODES_CONFIG   = process.env.NODES_CONFIG   || '../config/nodes.json';
const LOGS_DIR       = process.env.LOGS_DIR       || './logs';
const FETCH_TIMEOUT  = Number(process.env.FETCH_TIMEOUT_MS || 1500);
const EXPECTED_FW    = process.env.EXPECTED_FW || '1.1.0';

// Cross-platform single-shot ping. Returns true on reachable.
// Validate that a host string is a sane IPv4 or hostname before we hand it
// to a subprocess. Belt-and-braces alongside execFile (which already avoids
// shell injection by not invoking /bin/sh).
function _isSafeHost(s) {
  if (typeof s !== 'string' || s.length === 0 || s.length > 253) return false;
  // Accept IPv4 (loose) or hostname/FQDN. Reject anything with shell metachars.
  return /^[A-Za-z0-9._-]+$/.test(s);
}

async function pingHost(host) {
  if (!_isSafeHost(host)) return false;
  const isWin = os.platform() === 'win32';
  const args = isWin
    ? ['-n', '1', '-w', '1500', host]
    : ['-c', '1', '-W', '2', host];
  return new Promise((resolve) => {
    execFile('ping', args, { timeout: 3000 }, (error) => resolve(!error));
  });
}

async function checkSnmp() {
  return new Promise((resolve) => {
    const session = snmp.createSession(MIKROTIK_IP, SNMP_COMMUNITY, { timeout: 2000, retries: 1 });
    const oid = '1.3.6.1.2.1.1.1.0'; // sysDescr
    session.get([oid], (error, varbinds) => {
      session.close();
      if (error) return resolve({ ok: false, error: error.message });
      const desc = varbinds && varbinds[0] && varbinds[0].value
        ? varbinds[0].value.toString()
        : '(empty sysDescr)';
      resolve({ ok: true, desc });
    });
  });
}

// Hit /info on a detector and parse fw + uptime. AbortController + timeout
// since some Node versions don't honor fetch's signal+timeout combo well.
async function probeDetector(node) {
  const url = `http://${node.ip}/info`;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    const info = await r.json();
    return { ok: true, info };
  } catch (e) {
    clearTimeout(tid);
    return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : (e.message || 'unknown') };
  }
}

async function ensureLogsDir() {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    // Probe writability by touching a test file.
    const probe = path.join(LOGS_DIR, '.audit_probe');
    await fs.writeFile(probe, '');
    await fs.unlink(probe);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function loadNodes() {
  try {
    const raw = await fs.readFile(NODES_CONFIG, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function pad(s, n) { return (s + ' '.repeat(n)).slice(0, n); }

async function audit() {
  let failures = 0;
  console.log('--- PROJECT KORSTMOS: PRE-FLIGHT AUDIT ---');
  console.log(`Platform: ${os.platform()} ${os.release()}  Node: ${process.version}`);

  // 1. Router
  const routerPing = await pingHost(MIKROTIK_IP);
  console.log(`[NETWORK] Ping ${MIKROTIK_IP}: ${routerPing ? 'OK' : 'FAILED'}`);
  if (!routerPing) failures++;

  const snmpRes = await checkSnmp();
  if (snmpRes.ok) {
    console.log(`[SNMP] Read OK  -- sysDescr: ${snmpRes.desc.slice(0, 60)}`);
  } else {
    console.log(`[SNMP] Read FAILED: ${snmpRes.error}`);
    failures++;
  }

  // 2. Detectors
  const nodes = await loadNodes();
  if (!nodes) {
    console.log(`[DETECTORS] Could not read ${NODES_CONFIG} -- skipping per-node probe`);
    failures++;
  } else {
    console.log(`[DETECTORS] Probing ${nodes.length} node(s) from ${NODES_CONFIG}`);
    for (const n of nodes) {
      const ping = await pingHost(n.ip);
      let line = `  ${pad(n.name || `node-${n.id}`, 10)} ${pad(n.ip, 16)} ping=${ping ? 'ok ' : 'NO '}`;
      if (ping) {
        const probe = await probeDetector(n);
        if (probe.ok) {
          const info = probe.info;
          const fw = info.fw || '?';
          const fwMatch = (fw === EXPECTED_FW);
          line += `fw=${fw}${fwMatch ? '' : ` (EXPECTED ${EXPECTED_FW})`} uptime=${info.uptime || '?'}s mac=${(info.mac || '').slice(-8)}`;
          if (!fwMatch) failures++;
        } else {
          line += `api=FAIL(${probe.reason})`;
          failures++;
        }
      } else {
        failures++;
      }
      console.log(line);
    }
  }

  // 3. Logs dir
  const logsRes = await ensureLogsDir();
  if (logsRes.ok) {
    console.log(`[FILESYSTEM] Logs dir ${LOGS_DIR}: WRITABLE`);
  } else {
    console.log(`[FILESYSTEM] Logs dir ${LOGS_DIR}: FAILED (${logsRes.error})`);
    failures++;
  }

  console.log('------------------------------------------------');
  if (failures === 0) {
    console.log('STATUS: GO FOR DETECTOR INTEGRATION');
    process.exit(0);
  } else {
    console.log(`STATUS: NO-GO (${failures} check(s) failed)`);
    process.exit(1);
  }
}

audit();
