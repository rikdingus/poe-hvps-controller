# Project Handoff Manifest: Research Station Alpha

**Current Status**: Digital Infrastructure Scaffolding Complete (May 2026)
**Lead Model (Phase 1)**: Gemini Flash (Frontend & Architecture)

---

## 🛑 Critical Path: Hardware Blocker
The I2C bus currently reports `NO DEVICES FOUND`.
- **Diagnosis**: Missing physical 4.7kΩ pull-up resistors on GPIO 13/16.
- **Action Required**: Physical installation and 3.3V supply verification.
- **Firmware Status**: v1.1.5 is active with I2C scanner and safe-start logic (0.5kV).

---

## 🎨 Frontend State (Gemini Flash Track)
- **Framework**: React 19 + Vite 8 + Tailwind 4.
- **Components**: `NodeCard.jsx` (with 3kV gauges) and `App.jsx` (10-node grid).
- **Mock Mode**: Currently running on simulated telemetry via `App.jsx`.
- **Contract**: UI expects JSON matching the `docs/parallel_dev_plan.md` contract.

---

## ⚙️ Backend Track (Next Lead: Claude Opus)
**Immediate Tasks**:
1.  **Telemetry Proxy**: Implement the `/api/nodes` endpoint in `dashboard/app/server.js`.
2.  **Polling Logic**: Aggregate data from 10 distinct ESP32-POE IPs.
3.  **HA Bridge**: Finalize the MQTT/Websocket link to Home Assistant.
4.  **Security**: Integrate the RustDesk relay keys and WireGuard handshakes.

---

## 🛠️ Infrastructure Overview
- **Networking**: MikroTik RB5009 (Tailscale Node) + NetPower Lite 8P (UPS Switch).
- **Power**: 24V/48V LiFePO4 Battery Bank (Always Hot).
- **Management**: RustDesk Self-Hosted Relay (HBBS/HBR) in Docker.

---

## 📂 Repository Index
- `docs/install_guide.md`: End-to-end setup.
- `docs/ups_battery_guide.md`: Power resilience details.
- `docs/parallel_dev_plan.md`: Multi-model coordination.
- `docs/vision_walkthrough.md`: Project showcase.

---

**Signing off: Gemini Flash**
*May your slew rates be smooth and your isolation be total.*
