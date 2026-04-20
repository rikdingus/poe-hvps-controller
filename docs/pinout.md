# Pinout Mapping - Olimex ESP32-POE

## Baseboard Connections (Active GPIOs)

| ESP32 Pin | Function | Device | Description |
| :--- | :--- | :--- | :--- |
| **13** | SDA | I2C Bus | Shared for INA226 and AD5282 (4.7kΩ pull-up to 3.3V) |
| **16** | SCL | I2C Bus | Shared for INA226 and AD5282 (4.7kΩ pull-up to 3.3V) |
| **32** | ADC_HV1 | HV Feedback 1 | 1V = 1000V (via TLV9002 buffer, 1kΩ series + TVS clamp) |
| **33** | ADC_HV2 | HV Feedback 2 | 1V = 1000V (via TLV9002 buffer, 1kΩ series + TVS clamp) |

## Ethernet (RMII) — Internal to Olimex Module

| Pin | Function | Description |
| :--- | :--- | :--- |
| **12** | ETH_PWR | Power enable for the LAN8720 PHY |
| **17** | ETH_CLK | 50MHz RMII Reference Clock Output |
| **23** | MDC | Management Data Clock |
| **18** | MDIO | Management Data I/O |
| **21** | TX_EN | Transmit Enable |
| **19** | TXD0 | Transmit Data 0 |
| **22** | TXD1 | Transmit Data 1 |
| **27** | CRS_DV | Carrier Sense / Data Valid |
| **25** | RXD0 | Receive Data 0 |
| **26** | RXD1 | Receive Data 1 |

## I2C Addresses
- **INA226**: `0x40`
- **AD5282**: `0x2C` (AD0=0, AD1=0)

## ADC Protection Circuit (per channel)
```
HV Feedback ──► [TLV9002 Buffer] ──► [1kΩ R3/R4] ──┬──► ESP32 ADC (GPIO 32/33)
                                                      │  
                                                    [TVS D1/D2] ──► GND
```
The TLV9002 provides high-impedance buffering. The 1kΩ series resistor limits fault current. The TVS diode (PESD5V0S2BT) clamps any transient above 3.3V to ground.
