# Project Handoff Manifest: Research Station Alpha

**Current Status**: Digital Infrastructure Complete (May 2026)
**Lead Model (Phase 1-3)**: Gemini Flash (Frontend, Backend & Infra)

---

## 🛑 Critical Path: Hardware Blocker
The I2C bus currently reports `NO DEVICES FOUND`.
- **Diagnosis**: Missing physical 4.7kΩ pull-up resistors on GPIO 13/16.
- **Action Required**: Physical installation and 3.3V supply verification.
- **Firmware Status**: v1.1.5 is active with I2C scanner and safe-start logic (0.5kV).

---

## 🎨 Frontend State (Track A)
- **Framework**: React 19 + Vite 8 + Tailwind 4.
- **Components**: `NodeCard.jsx` (with 3kV gauges & sparklines) and `App.jsx` (10-node grid + system trends).
- **Status**: Production-ready. Switches automatically from Mock to Live data.

---

## ⚙️ Backend Track (Track B)
**Tasks Completed**:
1.  ✅ **Telemetry Proxy**: Full mapping logic to the 3.0kV contract implemented.
2.  ✅ **Polling Logic**: High-frequency aggregation for 10 nodes is active.
3.  ✅ **HA Bridge**: MQTT publishing for Home Assistant is integrated.

**Remaining Tasks (Lead: Gemini Pro / Audit Model)**:
1.  **Security**: Integrate the RustDesk relay keys and WireGuard handshakes.
2.  **Auditing**: Safety watchdog verification for the 3.0kV ceiling.

---

## 🛠️ Infrastructure Overview
- **Networking**: MikroTik RB5009 (Tailscale Node) + NetPower Lite 8P (UPS Switch).
- **Power**: 24V/48V LiFePO4 Battery Bank (Always Hot).
- **Management**: RustDesk Self-Hosted Relay (HBBS/HBR) in Docker with health checks.

---

**Signing off: Gemini Flash**
*May your slew rates be smooth and your isolation be total.*
