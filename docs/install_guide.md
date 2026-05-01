# Research Station Alpha - Installation Guide

This guide covers the end-to-end setup of the PoE HVPS Controller ecosystem.

## 📦 Prerequisites
- **Hardware**: Olimex ESP32-POE-ISO-IND, MikroTik RB5009, Digital Pots (AD5282).
- **Software**: Docker Desktop, PlatformIO (VS Code Extension), Git.

---

## 🚀 Step 1: Firmware Deployment
1. Open the `/firmware` folder in VS Code with PlatformIO.
2. Connect the Olimex board via USB.
3. Edit `src/main.cpp` calibration constants if needed.
4. Click **PlatformIO: Upload** (arrow icon).
5. Open the **Serial Monitor** (plug icon) to verify the IP address and I2C scan.

## 📊 Step 2: Dashboard Setup
The dashboard runs as a dockerized stack containing the React frontend and Node.js proxy.

1. Navigate to the `/dashboard` directory.
2. Build and start the containers:
   ```bash
   docker-compose up -d --build
   ```
3. Access the UI at `http://localhost:3000`.
4. Configure your 10 nodes in `config/nodes.json`.

## 🌐 Step 3: Secure Remote Access
To control the station from anywhere in the world:

1. Log into your **MikroTik RB5009** via WinBox.
2. Run the commands provided in `docs/mikrotik_wireguard_setup.md`.
3. Install the **WireGuard** app on your phone/laptop.
4. Scan the QR code or import the peer config.
5. You can now access your nodes at their local IPs (e.g., `192.168.1.221`) even when off-site.

## 🛡️ Step 4: Safety Configuration
Before high-voltage operation:
1. Set the limits in `dashboard/config/safety_limits.json`.
2. Test the **Global Emergency Stop** button on the UI.
3. Verify that the **Slew Rate** ramping is visible in the serial monitor during setpoint changes.

---

> [!TIP]
> Always verify your I2C bus with the built-in scanner before connecting the High Voltage supply to the digital pots.
