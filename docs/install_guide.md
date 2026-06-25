# Research Station Alpha - Installation Guide

This guide covers the end-to-end setup of the PoE HVPS Controller ecosystem.

## 📦 Prerequisites
- **Hardware**: Olimex ESP32-POE-ISO-IND, MikroTik RB5009, Digital Pots (AD5282).
- **Software**: Docker Desktop, PlatformIO (VS Code Extension), Git.

---

## 🚀 Step 1: Firmware Deployment
1. Open the `/firmware` folder in VS Code with PlatformIO.
2. **Set up OTA credentials.** Copy `src/secrets.h.example` to `src/secrets.h`,
   then either:
   - Leave `OTA_PASSWORD_HASH` empty to **disable OTA** (USB-only flashing — safest default), or
   - Set it to the SHA-256 hash of your chosen OTA password.
     Generate with: `echo -n "your-password" | sha256sum` (Linux/macOS) or
     `Get-FileHash -Algorithm SHA256 (New-TemporaryFile | Set-Content "your-password" -PassThru).FullName`
     (PowerShell — or just use an online SHA-256 tool).
   `secrets.h` is `.gitignore`d so your hash never leaves your machine.
3. Connect the Olimex board via USB.
4. Edit `src/main.cpp` calibration constants if needed.
5. Click **PlatformIO: Upload** (arrow icon).
6. Open the **Serial Monitor** (plug icon) to verify the IP address and I2C scan.
   You should see either `[OTA] Disabled: OTA_PASSWORD_HASH is unset.` or
   `[OTA] Started` depending on what you set in step 2.

## 📊 Step 2: Dashboard Setup
The dashboard runs as a dockerized stack containing the React frontend and Node.js proxy.

1. Navigate to the `/dashboard` or `/dashboard/app` directory.
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Set the `DASHBOARD_API_TOKEN` environment variable in `.env`. The token MUST be at least 16 characters long. Generate one using:
   ```bash
   openssl rand -hex 32
   ```
4. Build and start the containers:
   ```bash
   docker-compose up -d --build
   ```
5. Access the UI at `http://localhost:3000`.
6. Configure your 10 nodes in `config/nodes.json`.
7. Navigate to the **Settings** tab on the web dashboard and enter the token into the **API Write Authentication** field. This stores the token in your browser's local storage so that actions like Emergency Stop/Resume and saving limits can be authorized.

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
