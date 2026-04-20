# Bill of Materials (BOM) - PoE HVPS Controller (Olimex Edition)

## Active Components

| Item | Reference | Qty | Part Number | Description | Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Logic/PoE** | MOD1 | 1 | Olimex ESP32-POE | ESP32 Module with integrated Ethernet and PoE | [Mouser](https://www.mouser.com) |
| **Control** | U1 | 1 | AD5282BRUZ200 | Dual 200kΩ Digital Potentiometer (I2C) | [DigiKey](https://www.digikey.com) |
| **Monitor** | U2 | 1 | INA226AIDGSR | I2C Power Monitor | [DigiKey](https://www.digikey.com) |
| **Monitor** | RS1 | 1 | 0.01Ω / 2512 | Shunt Resistor (2W) | [DigiKey](https://www.digikey.com) |
| **Analog** | U3 | 1 | TLV9002IDR | Dual Precision Op-Amp (ADC Buffer) | [DigiKey](https://www.digikey.com) |

## Passive Components

| Item | Reference | Qty | Value | Package | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **I2C Pull-up** | R1, R2 | 2 | 4.7kΩ | 0603 | SDA/SCL pull-up to 3.3V |
| **ADC Protection** | R3, R4 | 2 | 1kΩ | 0603 | Series limiting resistors on HV feedback inputs |
| **Bypass Cap** | C1 | 1 | 100nF | 0603 | AD5282 VDD decoupling |
| **Bypass Cap** | C2 | 1 | 100nF | 0603 | INA226 VS decoupling |
| **Bypass Cap** | C3 | 1 | 100nF | 0603 | TLV9002 VCC decoupling |
| **Bulk Cap** | C4 | 1 | 10µF | 0805 | Main 3.3V rail bulk capacitor |
| **ESD Clamp** | D1, D2 | 2 | PESD5V0S2BT | SOT-23 | TVS diodes on ADC feedback inputs (clamp to 3.3V) |

## Connectors

| Item | Reference | Qty | Part Number | Description | Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **HVPS Pot Out** | J1, J2 | 2 | Screw Terminal (3-pin) | 3.5mm pitch — W, A, B for potentiometer replacement | [DigiKey](https://www.digikey.com) |
| **HV Feedback** | J3, J4 | 2 | Screw Terminal (2-pin) | 3.5mm pitch — Signal + GND for 1V/1000V readout | [DigiKey](https://www.digikey.com) |

## Component Selection Notes
1. **Olimex ESP32-POE**: Provides the ESP32, Ethernet PHY (LAN8720), RJ45 MagJack, and PoE extraction in a single module. WiFi is disabled in firmware.
2. **AD5282**: Dual 200kΩ digital pot. Connected as a 3-terminal potentiometer (W, A, B) to replace the existing manual trims.
3. **INA226**: Monitors total PoE power consumption. Shunt resistor (RS1) is placed in series with the power rail.
4. **TLV9002**: Unity-gain buffer on each ADC feedback input. Provides high input impedance to avoid loading the HV divider and isolates the ESP32 ADC from the external signal.
5. **PESD5V0S2BT**: TVS diodes clamp any overvoltage transients on the feedback lines to protect the ESP32 ADC pins.
6. **R3/R4 (1kΩ series)**: Limit current into the TVS/ADC during a clamp event, preventing damage even if the feedback line spikes.
