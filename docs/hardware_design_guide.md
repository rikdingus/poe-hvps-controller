# PoE HVPS Controller - Hardware Wiring Guide

## 1. Power Rails
- **+3.3V**: Main logic supply from Olimex ESP32-POE.
- **GND**: Common ground for logic and HVPS (Isolated from PoE side via Olimex ISO board).
- **+12V/24V_HVPS**: The output from your step-up converters, monitored by INA226.

## 2. I2C Bus (Addresses: AD5282=0x2C, INA226=0x40)
| Signal | ESP32 Pin | Component Pins |
| :--- | :--- | :--- |
| **SDA** | GPIO 13 | AD5282 (Pin 5), INA226 (Pin 3) |
| **SCL** | GPIO 16 | AD5282 (Pin 4), INA226 (Pin 4) |
| **Pull-ups** | - | 4.7kΩ to +3.3V |

## 3. Power Monitor (INA226)
- **VCC**: +3.3V
- **VBUS**: +12V/24V_HVPS (Measure the supply to the HVPS)
- **Vin+ / Vin-**: Across 10mΩ shunt on the +12V/24V rail.
- **A0 / A1**: GND (Address 0x40)

## 4. Digital Pot (AD5282 - 3-Terminal Mode)
- **VDD**: +3.3V
- **VSS / GND**: GND
- **Pot 1 (A1, B1, W1)**: Connect A/B/W to the HVPS Channel 1 trim pot terminals.
- **Pot 2 (A2, B2, W2)**: Connect A/B/W to the HVPS Channel 2 trim pot terminals.
- **AD0 / AD1**: GND (Address 0x2C)
- **SHDN / PR**: Pull to +3.3V

## 5. HV Feedback (TLV9002 Buffers)
- **V+**: +3.3V
- **V-**: GND
- **Ch 1 Path**: HV_DIV1 -> 1kΩ Res -> OpAmp (+IN A) -> OpAmp (OUT A) -> ESP32 GPIO 32.
- **Ch 2 Path**: HV_DIV2 -> 1kΩ Res -> OpAmp (+IN B) -> OpAmp (OUT B) -> ESP32 GPIO 33.
- **Protection**: PESD5V0S2BT TVS diodes on +IN A and +IN B pins.
