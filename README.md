# PoE HVPS Automation Controller (Olimex Edition)

A professional-grade, PoE-powered smart controller for High-Voltage Power Supplies (HVPS). This project integrates the **Olimex ESP32-POE** as a core module, providing native Ethernet connectivity and robust power extraction.

## 🚀 Key Features

- **Ethernet Native**: High-performance 10/100 Ethernet via native RMII.
- **PoE Powered**: Fully isolated power extraction using the Olimex on-board Poe circuit.
- **Precision Adjustment**: Dual AD5282 200kΩ digital potentiometers (256-tap) for automated trimming.
- **Soft-Ramp Slew Rate**: All HV adjustments are "soft-ramped" (1 second for full range) to prevent sudden voltage spikes and protect sensitive equipment.
- **Real-time Telemetry**:
    - PoE voltage/current monitoring (INA226).
    - Dual 1V/1000V high-voltage readout feedback.
- **Web Dashboard**: Modern, offline-capable interface for remote control and monitoring.
- **Hardware Integration**: Heavy-duty screw terminals for secure laboratory connections.

## 🛠 Hardware Configuration

This project is designed as a custom "Baseboard" that the Olimex ESP32-POE module plugs into.
- **Baseboard Component**: `hardware/hvps-controller.kicad_sch` [WIP].
- **Brain**: [Olimex ESP32-POE](https://www.olimex.com/Products/IoT/ESP32/ESP32-POE/open-source-hardware).

## 📂 Project Structure

- `hardware/`: KiCad baseboard schematic and BOM.
- `firmware/`: ESP32 firmware (PlatformIO).
- `docs/`: Pinout mapping and component datasheets.

## 📝 Getting Started

1. Mount the **Olimex ESP32-POE** onto the baseboard.
2. Flash the firmware in `firmware/` using VS Code + PlatformIO.
3. Access the dashboard over Ethernet (DHCP assigned IP).

---
Created with Antigravity AI.
