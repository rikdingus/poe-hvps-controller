# Pinout Mapping - ESP32-S3

| ESP32 Pin | Function | Device | Description |
| :--- | :--- | :--- | :--- |
| **8** | SDA | I2C Bus | Shared for INA226 and AD5282 |
| **9** | SCL | I2C Bus | Shared for INA226 and AD5282 |
| **1** | ADC_HV1 | HV Feedback 1 | 1V = 100V Feedback Signal |
| **2** | ADC_HV2 | HV Feedback 2 | 1V = 100V Feedback Signal |
| **3** | EN | Reset | Push button to Reset MCU |
| **0** | BOOT | Boot | Hold while resetting to enter Bootloader |
| **43** | TXD0 | UART | Debug/Flash TX |
| **44** | RXD0 | UART | Debug/Flash RX |

## I2C Addresses
- **INA226**: `0x40`
- **AD5282**: `0x2C` (AD0=0, AD1=0)
