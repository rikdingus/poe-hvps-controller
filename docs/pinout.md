# Pinout Mapping - Olimex ESP32-POE

| ESP32 Pin | Function | Device | Description |
| :--- | :--- | :--- | :--- |
| **13** | SDA | I2C Bus | Shared for INA226 and AD5282 (Olimex Default) |
| **16** | SCL | I2C Bus | Shared for INA226 and AD5282 (Olimex Default) |
| **32** | ADC_HV1 | HV Feedback 1 | 1V = 1000V Feedback Signal |
| **33** | ADC_HV2 | HV Feedback 2 | 1V = 1000V Feedback Signal |
| **12** | ETH_PWR | LAN8720 Power | Power enable for the Ethernet PHY |
| **17** | ETH_CLK | LAN8720 Clock | 50MHz RMII Reference Clock |

## Ethernet (RMII) - Internal to Module
| Pin | Function | Description |
| :--- | :--- | :--- |
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
