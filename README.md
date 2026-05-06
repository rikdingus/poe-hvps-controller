# Research Station Alpha - PoE HVPS Controller

Research Station Alpha is an industrial-grade, 10-node High-Voltage Power Supply (HVPS) control system powered by PoE and managed via a unified, cloud-secure glassmorphic dashboard.

![Vision Poster](docs/vision_walkthrough.md#) <!-- Placeholder for vision poster -->

## 🚀 Quick Links & Guides
We have developed a comprehensive documentation suite for every subsystem:

### 🛠️ Hardware & Physical
- **[Installation Guide](docs/install_guide.md)**: End-to-end system deployment.
- **[Wiring Checklist](docs/wiring_verification.md)**: Critical I2C and power verification.
- **[Hardware Design Guide](docs/hardware_design_guide.md)**: PCB and component specifications.
- **[UPS & Battery Guide](docs/ups_battery_guide.md)**: NetPower Lite 8P and LiFePO4 configuration.

### 🌐 Networking & Remote Access
- **[Remote Access Pro](docs/remote_access_pro.md)**: Tailscale Mesh and RustDesk Relay setup.
- **[MikroTik WireGuard Setup](docs/mikrotik_wireguard_setup.md)**: P2P encrypted management.

### 💾 Software & Management
- **[System Integration Plan](docs/system_integration_plan.md)**: Architectural overview.
- **[Multi-Model Workflow](docs/multi_model_workflow.md)**: Strategic AI handoff plan (Flash/Opus/Pro).
- **[Vision Walkthrough](docs/vision_walkthrough.md)**: Project showcase and future goals.

---

## ⚡ Technical Core
- **Firmware**: ESP32 (Olimex ESP32-POE-ISO-IND) with v1.1.5 Safe-Start (0.5kV).
- **Control**: AD5282 Dual-Channel 12-bit Digital Potentiometers.
- **Monitoring**: INA226 I2C Power Analytics.
- **Interface**: Dockerized React + Node.js Proxy with AI Credit Monitoring.

---

## 🛰️ Control API

| Endpoint | Description |
| :--- | :--- |
| `/status` | Returns live telemetry (V, I, HV1/2, Pot positions, Calibration data). |
| `/set?pot=1&val=128` | Set target for Channel 1 (0-255). |
| `/set?ratio1=1025.5` | Update feedback ratio for CH1 (Dynamic Calibration). |
| `/set?offset1=5.2` | Update feedback offset for CH1 (Dynamic Calibration). |
| `/set?ramp=10` | Update slew rate ramp interval (ms/step). |
| `/info` | System diagnostic information (MAC, IP, Firmware v1.1.0). |

---

## 🤝 Collaboration
This project is designed for distributed research. All telemetry is logged via the Master Dashboard and can be exported for scientific analysis.

**Maintained by**: @rikdingus
**Planning Phase**: Complete (May 2026)
