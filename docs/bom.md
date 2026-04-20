# Bill of Materials (BOM) - PoE HVPS Controller (Olimex Edition)

| Item | Reference | Qty | Part Number | Description | Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Logic/PoE**| MOD1 | 1 | Olimex ESP32-POE | ESP32 Module with integrated Ethernet and PoE | [Mouser](https://www.mouser.com) |
| **Control** | U1 | 1 | AD5282BRUZ200 | Dual 200kΩ Digital Potentiometer (I2C) | [DigiKey](https://www.digikey.com) |
| **Monitor** | U2 | 1 | INA226AIDGSR | I2C Power Monitor | [DigiKey](https://www.digikey.com) |
| **Monitor** | RS1 | 1 | 0.01Ω / 2512 | Shunt Resistor (2W) | [DigiKey](https://www.digikey.com) |
| **Analog** | U3 | 1 | TLV9002IDR | Dual Precision Op-Amp (Buffer) | [DigiKey](https://www.digikey.com) |
| **Power** | U4 | 1 | AP63203WU-7 | 3.3V DC/DC (For Baseboard Logic) | [DigiKey](https://www.digikey.com) |
| **IO** | J1-J4 | 4 | Screw Terminals | 3.5mm Pitch Screw Terminals | [DigiKey](https://www.digikey.com) |

## Component Selection Notes
1. **Olimex ESP32-POE**: This board serves as the "brain". Ensure you use the standard version with an external antenna if needed for range, though WiFi is disabled in this design.
2. **AD5282**: The dual 200k channel is used to replace manual trimming on two separate HVPS units.
3. **INA226**: Monitors the total power consumed by the system from the PoE line. 
4. **TLV9002**: Buffers the 1V/1000V feedback signals to provide high impedance and protection for the ESP32 ADC.
