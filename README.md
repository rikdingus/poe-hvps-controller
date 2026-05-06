# 🌌 Project Korstmos: Cosmic Ray Observatory
**Kosmisch Onderzoek Radboud Studenten Meetopstelling**

Project Korstmos is an institutional-grade, 10-node Cosmic Ray Observatory powered by PoE and managed via a high-fidelity research dashboard. The system is optimized for scintillation-based muon detection and long-term scientific data acquisition.

---

## 🚀 Research & Documentation
We have developed a comprehensive documentation suite for the observatory:

### 🔬 Scientific & Capture
- **[High-Speed Pulse Capture](docs/high_speed_pulse_capture.md)**: Strategies for 20ns muon detection (PCNT).
- **[Handoff Manifest](docs/handoff_manifest.md)**: **CRITICAL** pre-flight status and roadmap.
- **[Vision Walkthrough](docs/vision_walkthrough.md)**: Project scope and research objectives.

### 💾 Firmware & Control
- **[Firmware Guide](docs/firmware.md)**: v1.1.0 API, Dynamic Calibration, and RDAC control.
- **[Multi-Model Workflow](docs/multi_model_workflow.md)**: Strategic AI collaboration guidelines.
- **[AGENTS.md](AGENTS.md)**: Coordination rules for Antigravity, Claude, and Gemini.

### 🛠️ Hardware & Infrastructure
- **[Installation Guide](docs/install_guide.md)**: End-to-end system deployment.
- **[Wiring Checklist](docs/wiring_verification.md)**: I2C and power verification.
- **[UPS & Battery Guide](docs/ups_battery_guide.md)**: LiFePO4 configuration and SNMP safety.
- **[Remote Access Pro](docs/remote_access_pro.md)**: Mesh networking and telemetry relay.

---

## ⚡ Technical Core (v1.1.0)
- **Nodes**: Olimex ESP32-POE-ISO-IND (Isolated Industrial Grade).
- **HV Control**: AD5282 Dual-Channel Digital Potentiometers with slew-rate ramping.
- **Precision**: Dynamic Calibration API for multimeter-referenced feedback.
- **Safety**: SNMP-driven PoE cutoff watchdog (`safety_guardian.js`).

---

## 🛰️ Control API (v1.1.0)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/status` | GET | Returns live telemetry (V, I, HV1/2, Pot positions, Cal parameters). |
| `/set` | POST | Set target voltage (body: `pot=1&val=128`). |
| `/set` | GET | Update calibration (query: `ratio1=1025.5&offset1=5.2`). |
| `/info` | GET | System diagnostic information (MAC, IP, Uptime). |

---

## 🤝 Collaboration
This project is an open-source research initiative. All telemetry is logged to CSV for peer-reviewed scientific analysis.

**Maintained by**: @rikdingus & The Korstmos AI Collective
**Status**: Mission Ready (May 2026)
