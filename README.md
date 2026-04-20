# PoE HVPS Automation Controller

A professional-grade, PoE-powered smart controller for High-Voltage Power Supplies (HVPS). This project automates the manual trimming and monitoring of HVPS systems using an ESP32-S3 and high-precision digital potentiometers.

## 🚀 Features

- **PoE Powered**: Operates from standard PoE (802.3af/at) using a Silvertel Ag9700 module (12V or 24V).
- **Precision Adjustment**: Dual AD5282 200kΩ digital potentiometers (256-tap) replace manual trim pots.
- **Real-time Telemetry**:
    - PoE input voltage/current monitoring (INA226).
    - Dual 1V/100V high-voltage readout feedback.
- **Web Dashboard**: Modern, glassmorphic web interface hosted on the ESP32-S3 for remote control and monitoring.
- **Hardware Integration**: High-quality screw terminals for robust connections.

## 🛠 Hardware Configuration

The PCB is universal and can be configured for two different output voltages:
1. **12V Version**: Populate with Ag9712-FL.
2. **24V Version**: Populate with Ag9724-FL.

## 📂 Project Structure

- `hardware/`: KiCad schematic, PCB layout, and BOM.
- `firmware/`: ESP32-S3 firmware (Arduino/PlatformIO).
- `docs/`: Mechanical drawings and component datasheets.

## 📝 Getting Started

1. Open `hardware/hvps-controller.kicad_pro` in KiCad 8.0+.
2. Flash the firmware in `firmware/` using VS Code + PlatformIO.
3. Connect to the board's IP address to access the dashboard.

---
Created with Antigravity AI.
