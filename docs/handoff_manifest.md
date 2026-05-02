# 🌌 Project Korstmos: Handoff Manifest
**Kosmisch Onderzoek Radboud Studenten Meetopstelling**

Project Korstmos has been fully re-architected as a dedicated Cosmic Ray Observatory. The system is optimized for scintillation-based muon detection, utilizing individual Olimex POE units for each detector plate and a centralized digitizer hub for coincidence monitoring.

## 🛑 Critical Path: Detector Readiness
The I2C bus currently reports `NO DEVICES FOUND`.
- **Diagnosis**: Missing physical 4.7kΩ pull-up resistors on GPIO 13/16 for PMT control.
- **Action Required**: Physical soldering of resistors to each of the 10 Detector Units.

---

## 🏛️ Korstmos Research Features
*   **One-Node-Per-Detector**: Architecture optimized for 1:1 Olimex-to-Scintillator mapping.
*   **Central Digitizer Dashboard**: New UI widget monitoring Trigger Rates (Hz), Coincidence Mode (2-fold/3-fold), and global event synchronicity.
*   **PMT Optimized Telemetry**: Updated Detector Cards focusing on High-Voltage (0-1500V) and Discriminator Thresholds (0-500mV).
*   **Institutional Identity**: Fully rebranded to Project Korstmos with Radboud University academic styling.

---

## 🛠️ System Architecture
- **Detectors**: Scintillator plates + PMTs + Olimex ESP32-POE.
- **Digitizer**: Central logic hub for muon pulse coincidence.
- **Backbone**: MikroTik RB5009 + NetPower 8P (PoE Power & Telemetry).
- **Control**: Node.js Master Controller + React 19 Observation Dashboard.

---

## 📅 Roadmap for Muon Acquisition (Tomorrow)
1. **Array Audit**: Run `node audit_environment.js` to verify all 10 detector paths.
2. **First Light**: Power up Detector-01 and verify PMT Voltage feedback.
3. **Coincidence Tuning**: Use the Digitizer Widget to adjust thresholds until the Muon Trigger Rate (Hz) stabilizes.
4. **Physical Remediation**: Solder I2C pull-ups to enable live PMT gain adjustment.

---
**Status: READY FOR MUON ACQUISITION.** 🌌🛸🏛️
