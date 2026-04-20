# Bill of Materials (BOM) - PoE HVPS Controller

| Item | Reference | Qty | Part Number | Description | Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Logic** | MCU1 | 1 | ESP32-S3-WROOM-1 | ESP32-S3 Module (16MB Flash) | [DigiKey](https://www.digikey.com) |
| **PoE** | MOD1 | 1 | Ag9712-FL / Ag9724-FL | Silvertel PoE Module (12V or 24V) | [DigiKey](https://www.digikey.com) |
| **PoE** | J1 | 1 | MagJack (8P8C) | RJ45 with PoE Magnetics | [DigiKey](https://www.digikey.com) |
| **Control** | U1 | 1 | AD5282BRUZ200 | Dual 200kΩ Digital Potentiometer (I2C) | [DigiKey](https://www.digikey.com) |
| **Monitor** | U2 | 1 | INA226AIDGSR | I2C Power Monitor | [DigiKey](https://www.digikey.com) |
| **Monitor** | RS1 | 1 | 0.01Ω / 2512 | Shunt Resistor (2W) | [DigiKey](https://www.digikey.com) |
| **Analog** | U3 | 1 | TLV9002IDR | Dual Precision Op-Amp (Buffer) | [DigiKey](https://www.digikey.com) |
| **Power** | U4 | 1 | AP63203WU-7 | 3.3V DC/DC (or LDO) | [DigiKey](https://www.digikey.com) |
| **IO** | J2-J5 | 4 | Screw Terminals (2-pin) | 3.5mm Pitch Screw Terminals | [DigiKey](https://www.digikey.com) |

## Component Selection Notes
1. **Ag9700**: Choose the version matching your target voltage (12V or 24V).
2. **INA226 Shunt**: 10mΩ provides high resolution for the currents expected (~0.5A to 1A).
3. **TLV9002**: Buffers the 1V/100V feedback to protect the ESP32 ADC and ensure high impedance.
