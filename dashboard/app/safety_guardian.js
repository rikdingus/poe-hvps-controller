import snmp from 'net-snmp';

const MIKROTIK_IP = process.env.MIKROTIK_IP || '192.168.88.1';
const SNMP_COMMUNITY_WRITE = process.env.SNMP_COMMUNITY_WRITE || 'private'; // Often 'private' for write access

// OID for PoE Out Control: .1.3.6.1.4.1.14988.1.1.15.1.1.2.<port_index>
// Values: 1: auto-on, 2: forced-on, 3: off
const POE_CONTROL_OID = '.1.3.6.1.4.1.14988.1.1.15.1.1.2';

const session = snmp.createSession(MIKROTIK_IP, SNMP_COMMUNITY_WRITE);

export async function emergencyShutdown(nodeId) {
  // Mapping Node ID to MikroTik Port (Assuming Node 1 = Port 2, etc.)
  const portIndex = nodeId + 1; 
  const oid = `${POE_CONTROL_OID}.${portIndex}`;
  
  const varbinds = [
    {
      oid: oid,
      type: snmp.ObjectType.Integer,
      value: 3 // Set to 'off'
    }
  ];

  console.error(`[GUARDIAN] EMERGENCY SHUTDOWN INITIATED FOR NODE ${nodeId} (PORT ${portIndex})`);

  session.set(varbinds, (error, varbinds) => {
    if (error) {
      console.error(`[GUARDIAN] FAILED TO CUT POWER TO NODE ${nodeId}:`, error);
    } else {
      console.log(`[GUARDIAN] POWER CUT SUCCESSFUL FOR NODE ${nodeId}`);
    }
  });
}

export function checkSafety(nodeData) {
  const CRITICAL_VOLTAGE = 3.1; // Maximum laboratory safety limit
  
  nodeData.forEach(node => {
    if (node.channels[0].current_kv > CRITICAL_VOLTAGE) {
      emergencyShutdown(node.nodeId);
    }
  });
}
