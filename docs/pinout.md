# Pinout Mapping — Olimex ESP32-POE-ISO-IND

> This document describes the GPIO allocation for the HVPS Controller baseboard.
> Pins used internally by the Olimex module (Ethernet RMII, SD Card) are listed for reference to avoid conflicts.

## Baseboard Connections (Active GPIOs)

| ESP32 Pin | Function | Device | Direction | Description |
| :--- | :--- | :--- | :--- | :--- |
| **GPIO 13** | SDA | I2C Bus | Bidirectional | Shared bus for INA226 + AD5282 (4.7kΩ pull-up to 3.3V) |
| **GPIO 16** | SCL | I2C Bus | Output | Shared bus for INA226 + AD5282 (4.7kΩ pull-up to 3.3V) |
| **GPIO 32** | ADC1_CH4 | HV Feedback 1 | Input | 0–3.3V analog input (via TLV9002 buffer, 1kΩ series + TVS clamp) |
| **GPIO 33** | ADC1_CH5 | HV Feedback 2 | Input | 0–3.3V analog input (via TLV9002 buffer, 1kΩ series + TVS clamp) |

> **Pin Selection Rationale:** GPIO 13 and 16 are chosen for I2C because they are available on the ESP32-POE-ISO expansion header and do not conflict with the Ethernet RMII bus. GPIO 32 and 33 are ADC1 channels, which remain functional even when WiFi is active (though WiFi is disabled in this project).

## Ethernet (RMII) — Internal to Olimex Module (DO NOT USE)

These pins are consumed by the on-board LAN8720 PHY and **must not** be used for any other purpose.

| Pin | Function | Description |
| :--- | :--- | :--- |
| **GPIO 0** | REF_CLK | 50MHz RMII Reference Clock Input (active during Ethernet) |
| **GPIO 12** | ETH_PWR | Power enable for the LAN8720 PHY (active HIGH) |
| **GPIO 17** | ETH_CLK | 50MHz RMII clock output (directly from APLL) |
| **GPIO 18** | MDIO | Management Data I/O |
| **GPIO 19** | TXD0 | Transmit Data 0 |
| **GPIO 21** | TX_EN | Transmit Enable |
| **GPIO 22** | TXD1 | Transmit Data 1 |
| **GPIO 23** | MDC | Management Data Clock |
| **GPIO 25** | RXD0 | Receive Data 0 |
| **GPIO 26** | RXD1 | Receive Data 1 |
| **GPIO 27** | CRS_DV | Carrier Sense / Data Valid |

## I2C Device Addresses

| Device | Address | Address Pins | Description |
| :--- | :--- | :--- | :--- |
| **INA226** | `0x40` | A0=GND, A1=GND | PoE power monitor (bus voltage + shunt current) |
| **AD5282** | `0x2C` | AD0=GND, AD1=GND | Dual 200kΩ digital potentiometer |

## ADC Protection Circuit (per channel)

```
                                  3.3V
                                   │
                              [4.7kΩ pull-up]  ← (I2C only, not on ADC)
                                   │
HV Feedback ──► [TLV9002 Buffer] ──► [1kΩ R3/R4] ──┬──► ESP32 ADC (GPIO 32/33)
                                                     │
                                                   [TVS D1/D2] ──► GND
                                                  (PESD5V0S2BT)
```

**Circuit Notes:**
- The **TLV9002** op-amp provides high-impedance unity-gain buffering, preventing the ESP32's ADC sample-and-hold capacitor from loading the external HV divider.
- The **1kΩ series resistor** (R3/R4) limits fault current to <3.3mA during a clamp event.
- The **PESD5V0S2BT TVS diode** clamps transients above 3.3V to ground, protecting the ESP32 ADC inputs (absolute max 3.6V).
- Together, R3 + TVS provide a worst-case clamping response of <1ns.

## Available GPIOs (Free for Future Expansion)

The following GPIOs are available on the ESP32-POE-ISO-IND expansion header and are not used by the baseboard or the Ethernet PHY:

| Pin | Notes |
| :--- | :--- |
| **GPIO 2** | Connected to on-board LED (active LOW). Can be repurposed. |
| **GPIO 4** | Free. Also usable as ADC2_CH0 (not recommended with WiFi). |
| **GPIO 5** | Free. Has internal pull-up. |
| **GPIO 14** | Free. ADC2_CH6. |
| **GPIO 15** | Free. ADC2_CH3. Directly adjacent to GPIO 14 on header. |
| **GPIO 34** | Input-only. ADC1_CH6. Good for additional analog sensing. |
| **GPIO 35** | Input-only. ADC1_CH7. Good for additional analog sensing. |
| **GPIO 36 (VP)** | Input-only. ADC1_CH0. No internal pull-up. |
| **GPIO 39 (VN)** | Input-only. ADC1_CH3. No internal pull-up. |
