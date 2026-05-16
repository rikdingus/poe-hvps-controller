# Korstmos Cosmic Ray Observatory: Hardware Manual

This document serves as the central hardware reference for the Korstmos Cosmic Ray Observatory, detailing the components, their roles, and where to find official documentation.

## 1. Computing & Networking Core

### 1.1 Olimex ESP32-POE-ISO (Rev M)
The primary microcontroller used in every detector node.
* **Role:** Handles high-speed pulse counting (PCNT), reads high-voltage feedback (via ADC and INA226), controls the digital potentiometers via I2C, and communicates telemetry over Ethernet to the central server.
* **Key Features:**
  * 3000V DC Galvanic Isolation (safe for HV environments).
  * 802.3at PoE support (powers the ESP32 and the connected HV circuitry).
  * Built-in LiPo battery management (TP4054) for backup power.
  * Native board voltage sensing on GPIO35.
* **Documentation:**
  * [Rev M Schematic PDF](datasheets/ESP32-PoE-ISO_Rev_M_Schematic.pdf) (included in repo)
  * [Official Olimex GitHub Repo](https://github.com/OLIMEX/ESP32-POE-ISO)
  * [ESP32-WROOM-32E Datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.pdf)

### 1.2 MikroTik RB5009UG+S+IN
The central laboratory router and Master Controller gateway.
* **Role:** Routes telemetry between the Master Controller PC and the PoE switch. Exposes a management API for SNMP polling.
* **Documentation:** [MikroTik RB5009 Manual](https://help.mikrotik.com/docs/display/UM/RB5009UG%2BS%2BIN)

### 1.3 MikroTik NetPower 8P (CRS318-1Fi-15S-2Q-OUT)
The PoE distribution switch.
* **Role:** Delivers ~48-50V PoE to the ESP32-POE-ISO detector nodes. 
* **Integration:** Monitored via SNMP by the Master Controller to determine actual delivered PoE port voltage, current, and wattage (`1.3.6.1.4.1.14988.1.1.15.1.1.4` tree).
* **Documentation:** [MikroTik NetPower Series Manual](https://help.mikrotik.com/docs/display/UM/netPower+15FR)

---

## 2. Telemetry & Control Silicon

### 2.1 Texas Instruments INA226
High-Precision I2C Current/Voltage Monitor.
* **Role:** Monitors the actual power consumption and voltage delivered to the High Voltage circuitry on the custom PCB shield.
* **Address:** `0x40` (configurable via A0/A1 pins).
* **Documentation:** [INA226 Datasheet PDF](datasheets/INA226_Datasheet.pdf) (included in repo)

### 2.2 Analog Devices AD5282
Dual-Channel I2C Digital Potentiometer.
* **Role:** Replaces mechanical trimpots on the PMT HV DC-DC converters, allowing the ESP32 to safely and digitally ramp the high voltage up/down via I2C commands.
* **Address:** `0x2C` (typical).
* **Documentation:** [AD5282 Official Product Page & Datasheet](https://www.analog.com/en/products/ad5282.html)

### 2.3 Nanjing TP4054
Standalone Linear Li-Ion Battery Charger (integrated on the Olimex board).
* **Role:** Manages the 4.2V charging profile for the LiPo backup battery connected to the ESP32-POE-ISO. Monitored indirectly by GPIO35 when the `BAT_SENS_E1` jumper is closed.
* **Documentation:** [TP4054 Datasheet](https://dlnmh9ip6v2uc.cloudfront.net/datasheets/Prototyping/TP4054.pdf)

---

## 3. Maintenance & Safety Notes

* **PoE Voltage:** The MikroTik switch delivers raw 48V-50V over the Ethernet cable. The Olimex isolation transformer steps this down. **Never probe the raw PoE rails without proper high-voltage oscilloscope probes.**
* **Battery Sensing:** By default, the Olimex Rev M uses a 2:1 voltage divider (two 470kΩ resistors) on GPIO35. This measures the battery connector voltage, *not* the PoE voltage. 
* **Emergency Shutdowns:** If a safety limit is breached, the Master Controller issues an SNMP command to the MikroTik switch to cut PoE power to that specific port. Ensure the switch's SNMP Write community string is securely configured.
