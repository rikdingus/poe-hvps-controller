# I2C Wiring Verification Checklist

Use this guide to diagnose why the `[I2C] NO DEVICES FOUND` error is occurring.

## 1. Power Audit (Multimeter set to DC Volts)
- [ ] **3.3V Rail**: Measure the voltage between the VCC pin of the AD5282 and GND. It must be exactly 3.3V.
- [ ] **GND Continuity**: Verify 0.1Ω or less between the ESP32 GND and the AD5282/INA226 GND pins.
- [ ] **PoE vs USB**: If testing via USB, ensure the 3.3V rail is actually being powered. Some boards only power the EXT header when PoE is active.

## 2. Bus Resistance (POWER OFF - Multimeter set to Ohms)
- [ ] **SDA Pull-up**: Measure resistance between **GPIO 13** and **3.3V**. It should be between **2.2kΩ and 10kΩ**.
- [ ] **SCL Pull-up**: Measure resistance between **GPIO 16** and **3.3V**. It should be between **2.2kΩ and 10kΩ**.
- [ ] **Short Circuit**: Measure resistance between SDA and SCL. It must be **Infinite (OL)**. If you see a low resistance, you have a solder bridge.

## 3. Continuity (POWER OFF - Multimeter set to Continuity/Beep)
- [ ] **SDA Path**: Verify "beep" from Olimex **Pin 3** (GPIO 13) to AD5282 **Pin 14** (SDA).
- [ ] **SCL Path**: Verify "beep" from Olimex **Pin 4** (GPIO 16) to AD5282 **Pin 13** (SCL).

## 4. Addressing Logic
- [ ] **AD0 / AD1**: Check the address pins on the AD5282. Our code expects them to be tied to **GND** (for address 0x2C).
- [ ] **A0 / A1**: Check the address pins on the INA226. Our code expects them to be tied to **GND** (for address 0x40).

> [!IMPORTANT]
> If all measurements pass but the scanner still finds nothing, try disconnecting the INA226 to see if a faulty sensor is pulling the entire bus down.
