# 🌌 Project Korstmos: Handoff Manifest
**Kosmisch Onderzoek Radboud Studenten Meetopstelling**

Project Korstmos has been fully re-architected as a dedicated Cosmic Ray Observatory. The system is optimized for scintillation-based muon detection, utilizing individual Olimex POE units for each detector plate and a centralized digitizer hub for coincidence monitoring.

## 🛑 Critical Path: Detector Readiness
*   **Software Fixed**: I2C pin mapping (GPIO 13/16) and Dynamic Calibration API (v1.1.0) are fully operational.
*   **Physical Action**: Ensure 4.7kΩ pull-up resistors are soldered to the expansion headers to enable RDAC/INA226 communication.
*   **Calibration**: Perform first-run tuning using a High-Voltage reference multimeter and the `/set?ratio1=...` API.

---

## 🏛️ Korstmos Research Features (v1.1.0)
*   **Dynamic Calibration**: Move from static constants to runtime-adjustable gains and offsets. Precision tuning without firmware re-flashing.
*   **Dual-Channel PMT Support**: Each detector card now visualizes and logs **two** independent PMT channels (CH1/CH2), critical for coincidence correlation.
*   **Institutional Identity**: Unified "Radboud University" theme across all components, featuring high-fidelity telemetry bars and ramping indicators.
*   **Scientific Data Logging**: Real-time dual-channel HV, current, and power logging to CSV for post-acquisition analysis.

---

## 🛠️ System Architecture (Unified)
- **Firmware**: v1.1.0 (ESP32-POE). Supports `POST /set` for control and `GET /set` for calibration.
- **Backend**: Node.js Proxy with `node_mapper.js` (calibrated) and `safety_guardian.js` (watchdog).
- **Frontend**: React 19 + Tailwind + Lucide. High-fidelity glassmorphic cards for all 10 nodes.
- **Infrastructure**: MikroTik RB5009 + NetPower 8P (PoE & SNMP management).

---

## 📅 Roadmap for Muon Acquisition (Testing Tomorrow)
1.  **Environment Audit**: Run `node audit_environment.js` from the dashboard folder.
2.  **Calibration Run**: Power a single node, measure HV rail, and use the dashboard to set the `ratio` and `offset` for both channels.
3.  **Safety Verification**: Trigger a mock overvoltage (1.6kV) to verify the `safety_guardian` cuts PoE power via SNMP.
4.  **Data Capture**: Start a long-term run and monitor the `/logs/telemetry_*.csv` output.

---
**Status: MISSION READY FOR CALIBRATION & FIRST LIGHT.** 🌌🛸🏛️
