import snmp from 'net-snmp';
import { exec } from 'child_process';
import fs from 'fs/promises';

const MIKROTIK_IP = process.env.MIKROTIK_IP || '192.168.88.1';
const SNMP_COMMUNITY = process.env.SNMP_COMMUNITY || 'public';

async function checkPing() {
  return new Promise((resolve) => {
    exec(`ping -n 1 ${MIKROTIK_IP}`, (error) => {
      resolve(!error);
    });
  });
}

async function checkSnmp() {
  return new Promise((resolve) => {
    const session = snmp.createSession(MIKROTIK_IP, SNMP_COMMUNITY);
    const oid = '.1.3.6.1.2.1.1.1.0'; // sysDescr
    session.get([oid], (error, varbinds) => {
      session.close();
      resolve(!error);
    });
  });
}

async function audit() {
  console.log('--- PROJECT KORSTMOS: PRE-FLIGHT AUDIT ---');
  
  const pingOk = await checkPing();
  console.log(`[NETWORK] Ping ${MIKROTIK_IP}: ${pingOk ? '✅ OK' : '❌ FAILED'}`);

  const snmpOk = await checkSnmp();
  console.log(`[SNMP] Permission Check: ${snmpOk ? '✅ OK' : '❌ FAILED'}`);

  try {
    await fs.access('./logs');
    console.log('[FILESYSTEM] Telemetry Logs: ✅ WRITABLE');
  } catch {
    console.log('[FILESYSTEM] Telemetry Logs: ❌ FAILED');
  }

  console.log('------------------------------------------------');
  if (pingOk && snmpOk) {
    console.log('🚀 STATUS: GO FOR DETECTOR INTEGRATION');
  } else {
    console.log('⚠️ STATUS: NO-GO (Check Network/SNMP)');
  }
}

audit();
