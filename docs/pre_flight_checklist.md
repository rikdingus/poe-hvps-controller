# 🚀 Research Station Alpha: Pre-Flight Checklist
**Prepared for Live RB5009 Integration**

Follow these steps tomorrow morning to transition from simulation to live laboratory control.

## 1. Physical Connectivity
- [ ] Connect **RB5009** Main Router to the laboratory backbone.
- [ ] Ensure **NetPower 8P** (Switch) is linked via SFP or Ethernet.
- [ ] Verify **Olimex ESP32-POE** units are connected to PoE-out ports 2-9 on the NetPower.
- [ ] **SAFETY**: Ensure the physical E-Stop button is within reach.

## 2. MikroTik Configuration
- [ ] **SNMP Activation**: 
  - `IP -> SNMP -> Enabled: Yes`
  - `IP -> SNMP -> Communities -> public -> Read: Yes`
- [ ] **IP Assignment**: Ensure the dashboard machine can ping `192.168.88.1`.
- [ ] **PoE Control**: Verify `interface ethernet poe` settings are set to `auto-on` or `forced-on`.

## 3. Dashboard Initialization
- [ ] Update `.env` with live values:
  ```env
  MIKROTIK_IP=192.168.88.1
  SNMP_COMMUNITY=public
  MQTT_BROKER=localhost
  ```
- [ ] Start the backend: `npm run dev`.
- [ ] Observe the **Infrastructure Health** widget for real-time Voltage (expected ~24V-48V) and Temperature measurements.

## 4. First Light Telemetry
- [ ] Verify `dashboard/app/logs/telemetry_YYYY-MM-DD.csv` is being populated.
- [ ] Run a test ramp on Unit-01:
  - Increase voltage to 1.00 kV.
  - Verify PoE wattage increase on the dashboard.
  - Check the log for the corresponding entry.

---
> [!IMPORTANT]
> If any node fails to respond after I2C lock, use the **Infrastructure -> Hard Reboot** feature in the dashboard to power-cycle the specific PoE port.
