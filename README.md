# PoE HVPS Automation Controller

> ⚠️ **Hardware Design Status: [WIP]** — The KiCad schematic is a placeholder. See `docs/bom.md` and `docs/pinout.md` for the full design specification.

A professional-grade, PoE-powered smart controller for High-Voltage Power Supplies (HVPS). This project uses the **Olimex ESP32-POE-ISO-IND** (Industrial, Isolated) as its core module, providing native 10/100 Ethernet, 3000VDC galvanic isolation, and the -40°C to +85°C industrial temperature range.

## 🚀 Key Features

- **Ethernet Native**: 10/100 Ethernet via native RMII (LAN8720 PHY). No WiFi — wired only for reliability and security.
- **PoE Powered**: Fully isolated power extraction using the Olimex on-board IEEE 802.3af PoE circuit (2W max via isolated DC-DC).
- **Galvanic Isolation**: 3000VDC isolation between the PoE/Ethernet and ESP32 power domains. Safe to program via USB while PoE is active.
- **Industrial Grade**: -40°C to +85°C operating temperature (IND variant).
- **Precision Adjustment**: Dual AD5282 200kΩ digital potentiometers (256-tap) for automated HV trimming.
- **Soft-Ramp Slew Rate**: All HV adjustments are ramped at 1 step per 4ms (~1 second full sweep) to prevent sudden voltage spikes and protect sensitive equipment.
- **Real-time Telemetry**:
    - PoE voltage/current monitoring via INA226 with online/error indicators.
    - Dual 0–3V high-voltage readout feedback (1V = 1000V) with ADC overvoltage protection.
- **Web Dashboard**: Modern dark-mode interface with live-updating values and ramping indicators. Served directly from the ESP32's flash — no external server required.
- **mDNS**: Accessible at `http://hvps.local` — no need to find the DHCP IP.
- **JSON API**: RESTful endpoints for integration with external automation systems.
- **Hardware Safety**: I2C pull-ups, bypass capacitors, TVS diodes, and series limiting resistors on all analog inputs.

## 🛠 Hardware Configuration

This project is designed as a custom "Baseboard" that the Olimex ESP32-POE-ISO-IND module plugs into.
- **Baseboard Schematic**: `hardware/hvps-controller.kicad_sch` [WIP].
- **Brain**: [Olimex ESP32-POE-ISO-IND](https://www.olimex.com/Products/IoT/ESP32/ESP32-POE-ISO/open-source-hardware).

See [`docs/pinout.md`](docs/pinout.md) for the full pin mapping and [`docs/bom.md`](docs/bom.md) for the complete bill of materials.

## 📂 Project Structure

```
poe-hvps-controller/
├── firmware/
│   ├── platformio.ini          # PlatformIO config (board: esp32-poe-iso)
│   └── src/main.cpp            # Firmware source (single-file architecture)
├── hardware/
│   ├── hvps-controller.kicad_pro
│   └── hvps-controller.kicad_sch  [WIP]
├── docs/
│   ├── bom.md                  # Full BOM with passives
│   ├── pinout.md               # Pin mapping + protection circuit
│   └── firmware.md             # Firmware architecture & API reference
├── LLM_CONTEXT.md              # AI code review context (full source inline)
├── LICENSE                     # MIT
└── README.md
```

## 📝 Getting Started

### Prerequisites
- [VS Code](https://code.visualstudio.com/) with the [PlatformIO extension](https://platformio.org/install/ide?install=vscode)
- An Olimex ESP32-POE-ISO-IND board
- A Micro-USB data cable (not charge-only)
- An Ethernet cable (PoE optional — USB power is sufficient for development)

### Build & Flash

1. Clone this repository:
   ```bash
   git clone https://github.com/rikdingus/poe-hvps-controller.git
   ```
2. Open `firmware/` in VS Code.
3. PlatformIO will auto-detect the project and install dependencies.
4. Connect the board via USB and click **Build** (✓) then **Upload** (→) in the PlatformIO toolbar.
5. Connect an Ethernet cable.
6. Access the dashboard at **http://hvps.local** (or check the Serial Monitor for the DHCP IP).

> **Note:** The CH340T USB-serial chip may require a [driver installation](https://www.olimex.com/Products/Breadboarding/BB-CH340T/resources/CH341SER.zip) on Windows.

### CLI Alternative (no VS Code)

```bash
pip install platformio
cd firmware
pio run -t upload --upload-port COM7   # adjust port as needed
pio device monitor                      # open serial console
```

## 🌐 API Reference

All endpoints return JSON (except `/` which returns HTML and `/set` which returns plain text).

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | GET | Interactive web dashboard |
| `/status` | GET | Live telemetry (voltage, current, HV feedback, pot positions) |
| `/set?pot=N&val=V` | GET | Set pot target (N: 1 or 2, V: 0–255). Returns `OK` or error. |
| `/info` | GET | Device info: firmware version, uptime, MAC, IP, sensor health |

### Example: `/status` Response
```json
{
  "v": 48.12,
  "i": 0.142,
  "hv1": 0.625,
  "hv2": 0.275,
  "p1": 127,
  "p2": 127,
  "c1": 127,
  "c2": 127,
  "ok": true
}
```
| Field | Type | Description |
| :--- | :--- | :--- |
| `v` | float | PoE bus voltage (V) from INA226. `0` if sensor unavailable. |
| `i` | float | PoE bus current (A) from INA226. `0` if sensor unavailable. |
| `hv1` | float | HV channel 1 feedback voltage (V). Multiply by 1000 for HV estimate. |
| `hv2` | float | HV channel 2 feedback voltage (V). Multiply by 1000 for HV estimate. |
| `p1`, `p2` | int | Target pot positions (0–255). |
| `c1`, `c2` | int | Current (actual) pot positions. Differs from target while ramping. |
| `ok` | bool | `true` if INA226 is connected and responding. |

### Example: `/info` Response
```json
{
  "fw": "1.0.0",
  "uptime": 736,
  "mac": "EC:C9:FF:BA:8D:AB",
  "ip": "192.168.1.221",
  "eth": true,
  "ina": false,
  "ch1_target": 127,
  "ch1_current": 127,
  "ch2_target": 127,
  "ch2_current": 127
}
```

## 🔬 Firmware Architecture

The firmware follows a **single-task, cooperative** architecture:

1. **`loop()`** runs on the Arduino main task and is the **only** context that touches I2C and ADC hardware, preventing bus contention.
2. **`ESPAsyncWebServer`** handles HTTP requests on a separate FreeRTOS task but only reads **cached** sensor values — it never initiates I2C transactions.
3. **Slew-rate ramping** increments/decrements the digital pot by 1 step every 4ms, giving a smooth ~1-second full sweep from 0→255.

See [`docs/firmware.md`](docs/firmware.md) for detailed architecture documentation.

## 📋 Dependencies

| Library | Version | Purpose |
| :--- | :--- | :--- |
| [mathieucarbou/ESPAsyncWebServer](https://github.com/mathieucarbou/ESPAsyncWebServer) | ^3.6.0 | Async HTTP server |
| [mathieucarbou/AsyncTCP](https://github.com/mathieucarbou/AsyncTCP) | ^3.3.2 | Async TCP transport |
| [robtillaart/INA226](https://github.com/RobTillaart/INA226) | ^0.6.0 | PoE power monitoring |
| [bblanchon/ArduinoJson](https://github.com/bblanchon/ArduinoJson) | ^7.0.4 | JSON serialization |

## 📄 License

MIT — See [LICENSE](LICENSE).

---
Created with [Antigravity AI](https://github.com/google-deepmind/antigravity).
