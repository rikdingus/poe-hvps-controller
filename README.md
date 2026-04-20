# PoE HVPS Automation Controller (Olimex Edition)

> ⚠️ **Hardware Design Status: [WIP]** — The KiCad schematic is a placeholder. See `docs/bom.md` and `docs/pinout.md` for the full design specification.

A professional-grade, PoE-powered smart controller for High-Voltage Power Supplies (HVPS). This project integrates the **Olimex ESP32-POE** as a core module, providing native Ethernet connectivity and robust PoE power extraction.

## 🚀 Key Features

- **Ethernet Native**: 10/100 Ethernet via native RMII (LAN8720). No WiFi — wired only for security.
- **PoE Powered**: Fully isolated power extraction using the Olimex on-board PoE circuit.
- **Precision Adjustment**: Dual AD5282 200kΩ digital potentiometers (256-tap) for automated trimming.
- **Soft-Ramp Slew Rate**: All HV adjustments are ramped over ~1 second (1 step / 4ms) to prevent sudden voltage spikes and protect sensitive equipment.
- **Real-time Telemetry**:
    - PoE voltage/current monitoring (INA226) with online/error indicators.
    - Dual 1V/1000V high-voltage readout feedback with ADC overvoltage protection.
- **Web Dashboard**: Modern, offline-capable interface with live ramping indicators.
- **mDNS**: Accessible at `http://hvps.local` — no need to find the DHCP IP.
- **Hardware Safety**: I2C pull-ups, bypass capacitors, TVS diodes, and series limiting resistors on all analog inputs.

## 🛠 Hardware Configuration

This project is designed as a custom "Baseboard" that the Olimex ESP32-POE module plugs into.
- **Baseboard Schematic**: `hardware/hvps-controller.kicad_sch` [WIP].
- **Brain**: [Olimex ESP32-POE](https://www.olimex.com/Products/IoT/ESP32/ESP32-POE/open-source-hardware).

## 📂 Project Structure

```
poe-hvps-controller/
├── firmware/
│   ├── platformio.ini      # PlatformIO config (board: esp32-poe)
│   └── src/main.cpp        # Firmware source
├── hardware/
│   ├── hvps-controller.kicad_pro
│   └── hvps-controller.kicad_sch  [WIP]
├── docs/
│   ├── bom.md              # Full BOM with passives
│   └── pinout.md           # Pin mapping + protection circuit
├── LICENSE                  # MIT
└── README.md
```

## 📝 Getting Started

1. Mount the **Olimex ESP32-POE** onto the baseboard headers.
2. Open `firmware/` in VS Code with PlatformIO and flash.
3. Connect an Ethernet cable with PoE.
4. Access the dashboard at **http://hvps.local** (or check Serial for the DHCP IP).

## 🌐 API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | GET | Web dashboard |
| `/status` | GET | JSON: voltage, current, HV feedback, pot positions (target + actual) |
| `/set?pot=1&val=128` | GET | Set pot target (channel 1 or 2, value 0-255) |
| `/info` | GET | JSON: firmware version, uptime, MAC, IP, device health |

---
Created with Antigravity AI.
