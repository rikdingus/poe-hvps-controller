# Bill of Materials (BOM) — PoE HVPS Controller

## Core Module

| Item | Reference | Qty | Part Number | Description | Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Brain** | MOD1 | 1 | Olimex ESP32-POE-ISO-IND | ESP32 module with Ethernet, PoE (isolated), industrial temp | [Olimex](https://www.olimex.com/Products/IoT/ESP32/ESP32-POE-ISO/open-source-hardware) |

## Active Components

| Item | Reference | Qty | Part Number | Description | Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Control** | U1 | 1 | AD5282BRUZ200 | Dual 200kΩ digital potentiometer (256-tap, I2C) | [DigiKey](https://www.digikey.com) |
| **Monitor** | U2 | 1 | INA226AIDGSR | I2C high-side power monitor (bus voltage + shunt current) | [DigiKey](https://www.digikey.com) |
| **Shunt** | RS1 | 1 | 0.01Ω / 2W / 2512 | Current-sense shunt resistor for INA226 | [DigiKey](https://www.digikey.com) |
| **Buffer** | U3 | 1 | TLV9002IDR | Dual precision rail-to-rail op-amp (unity-gain ADC buffer) | [DigiKey](https://www.digikey.com) |

## Passive Components

| Item | Reference | Qty | Value | Package | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **I2C Pull-up** | R1, R2 | 2 | 4.7kΩ | 0603 | SDA/SCL pull-up to 3.3V |
| **ADC Protection** | R3, R4 | 2 | 1kΩ | 0603 | Series current-limiting resistors on HV feedback inputs |
| **Bypass Cap** | C1 | 1 | 100nF | 0603 | AD5282 VDD decoupling |
| **Bypass Cap** | C2 | 1 | 100nF | 0603 | INA226 VS decoupling |
| **Bypass Cap** | C3 | 1 | 100nF | 0603 | TLV9002 VCC decoupling |
| **Bulk Cap** | C4 | 1 | 10µF | 0805 | Main 3.3V rail bulk capacitor |
| **ESD Clamp** | D1, D2 | 2 | PESD5V0S2BT | SOT-23 | TVS diodes on ADC feedback inputs (clamp to 3.3V) |

## Connectors

| Item | Reference | Qty | Part Number | Description |
| :--- | :--- | :--- | :--- | :--- |
| **HVPS Pot Out** | J1, J2 | 2 | Screw Terminal (3-pin, 3.5mm) | W, A, B terminals for potentiometer replacement |
| **HV Feedback** | J3, J4 | 2 | Screw Terminal (2-pin, 3.5mm) | Signal + GND for 0–3V HV readout |

## Component Selection Notes

1. **Olimex ESP32-POE-ISO-IND**: Provides the ESP32 SoC, LAN8720 Ethernet PHY, RJ45 MagJack with integrated magnetics, and IEEE 802.3af PoE extraction — all in a single module. The ISO-IND variant adds 3000VDC galvanic isolation and -40°C to +85°C industrial temperature rating. Maximum available power from the isolated PoE DC-DC is **2W** — keep external peripheral consumption under this limit.

2. **AD5282 (U1)**: Dual 200kΩ digital potentiometer with 256 taps. Connected as a 3-terminal potentiometer (W, A, B) to replace the existing manual trim pots on the HVPS. Each tap step is approximately 781Ω (200kΩ / 256). I2C address `0x2C` (AD0=GND, AD1=GND).

3. **INA226 (U2)**: High-side bus voltage and current monitor. Measures PoE input power (voltage up to 36V, current through RS1). Communicates via I2C at address `0x40`. Configured for 2A max range with a 10mΩ shunt.

4. **TLV9002 (U3)**: Dual rail-to-rail input/output precision op-amp configured as a unity-gain buffer on each HV feedback channel. Prevents the ESP32's ADC sample-and-hold circuitry from loading the external HV resistive divider. Input impedance >10GΩ.

5. **PESD5V0S2BT (D1, D2)**: Bidirectional TVS diodes in SOT-23 package. Clamping voltage is 5V (well above 3.3V operating range but below the ESP32 ADC absolute maximum of 3.6V when combined with the 1kΩ series resistor). Response time <1ns.

6. **R3/R4 (1kΩ series)**: Limit current into the TVS/ADC during a fault event. Even if the feedback line is shorted to a high voltage, the current through the TVS clamp is limited to approximately 3.3mA — well within safe limits for both the TVS diode and the ESP32 GPIO.

7. **C1–C3 (100nF bypass)**: Standard 100nF ceramic bypass capacitors placed as close as physically possible to each IC's power pins. Essential for suppressing high-frequency noise and preventing I2C glitches.

8. **C4 (10µF bulk)**: Provides local energy storage for the 3.3V rail to handle transient current demands from the ESP32 during Ethernet bursts and I2C transactions.
