# Hardware Manuals & Datasheets

This directory contains the essential datasheets and manuals for the hardware components used in the Korstmos Cosmic Ray Observatory.

## Core Computing & Network
* **Olimex ESP32-POE-ISO (Rev M)**: Primary controller node.
  * [Rev M Schematic (PDF)](ESP32-PoE-ISO_Rev_M_Schematic.pdf)
  * Features: 802.3at PoE, 3000V DC isolation, LiPo battery backup, native board voltage sensing.
* **MikroTik RB5009UG+S+IN**: Main laboratory router.
* **MikroTik NetPower 8P**: Outdoor-rated PoE switch for distributing 48-50V PoE to the detector nodes.

## Sensors & Control
* **Texas Instruments INA226**: High-Precision I2C Current/Voltage Monitor.
  * [Datasheet (PDF)](INA226_Datasheet.pdf)
  * Role: Optional high-precision PoE input monitoring.
* **Analog Devices AD5282**: Dual-Channel I2C Digital Potentiometer.
  * [Datasheet (PDF)](AD5282_Datasheet.pdf)
  * Role: Precision tuning of the PMT High-Voltage setpoints.
* **Nanjing TP4054**: Standalone Linear Li-Ion Battery Charger.
  * Role: Handles the charging of the backup LiPo battery on the Olimex board.

## Additional Resources
For comprehensive details on how these components integrate, refer to the [Hardware Design Guide](../hardware_design_guide.md) and the [System Integration Plan](../system_integration_plan.md).
