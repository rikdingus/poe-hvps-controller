# 🏛️ Research Station Alpha: Handoff Manifest
**Project Phase: Professional Laboratory Maturity (Radboud Edition)**

This document serves as the primary index for the Research Station Alpha project. It contains the current system architecture, safety protocols, and the deployment roadmap for the upcoming hardware integration.

## 🛑 Critical Path: Hardware Blocker
The I2C bus currently reports `NO DEVICES FOUND`.
- **Diagnosis**: Missing physical 4.7kΩ pull-up resistors on GPIO 13/16.
- **Action Required**: Physical soldering of resistors to ESP32-POE units.
- **Firmware Status**: v1.1.5 is active with I2C scanner and safe-start logic (0.5kV).

---

## 🏛️ Achievement & Features (Radboud Upgrade)
*   **Institutional Redesign**: Complete Radboud University FNWI "Academic Elite" theme integration.
*   **Safety Guardian**: Active backend interlock that automatically cuts PoE power via SNMP if hazardous voltage (>3.1kV) is detected.
*   **Telemetry Archive**: Persistent CSV logging of all measurements for scientific analysis.
*   **Lab Analytics**: New high-resolution charting page for historical drift and noise analysis.
*   **Pre-Flight Audit**: Environmental diagnostic tool (`audit_environment.js`) to verify network readiness.

---

## 🛠️ Architecture & Infrastructure
- **Compute**: Node.js / Express Backend + React 19 Frontend.
- **Network**: MikroTik RB5009 (Router) + NetPower 8P (PoE Switch).
- **Nodes**: Olimex ESP32-POE Units.
- **Protocols**: SNMP v2c (Infra), MQTT (Live Feed), HTTP/JSON (API).

---

## 📅 Roadmap for Next Model (Tomorrow)
1. **Audit Phase**: Run `node audit_environment.js` after connecting RB5009.
2. **Live Integration**: Verify real-time SNMP feedback for UPS and Lab Temperature.
3. **Safety Verification**: Test the 'Safety Guardian' kill-switch (simulated fault).
4. **Physical Remediation**: Execute the pull-up resistor soldering as per the hardware design guide.

---
**Status: MISSION READY. Standing by for hardware integration.** 🏁🚀🏛️
