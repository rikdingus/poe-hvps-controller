# Research Station Alpha: The Vision

Research Station Alpha is a next-generation infrastructure project designed to bridge the gap between high-precision laboratory high-voltage control and modern, secure cloud management.

![Vision Poster](file:///C:/Users/theon/.gemini/antigravity/brain/10718a31-6cb2-4aa4-bb6e-f716b6ce5381/research_station_vision_poster_1777660982418.png)

## 🎯 The Core Mission
Traditionally, controlling multiple high-voltage power supplies (HVPS) requires complex cabling and localized control. Research Station Alpha solves this by deploying **PoE-powered, Ethernet-native controllers** that provide:
- **Precision**: 12-bit digital control over 1.5kV - 3kV outputs.
- **Isolation**: Galvanic isolation via the Olimex ESP32-POE-ISO-IND to protect networking gear.
- **Ubiquity**: Secure access from anywhere in the world via Tailscale and WireGuard.

## 🛠️ The Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Hardware** | Olimex ESP32-POE-ISO-IND | The industrial core of every node. |
| **Logic** | Digital Potentiometers (AD5282) | High-precision voltage trimming. |
| **Backbone** | MikroTik RB5009 | Industrial routing and battery-backed UPS. |
| **Security** | Tailscale Mesh | Zero-config, encrypted remote access. |
| **Interface** | React + Framer Motion | Glassmorphic, real-time telemetry dashboard. |

## 🛡️ Safety-First Architecture
This isn't just about control; it's about **safe** control.
- **Non-Linear Slew Rate**: Firmware-level ramping prevents mechanical and electrical stress on the supply components.
- **Global Emergency Stop**: A single click on the dashboard immediately shuts down all 10 nodes.
- **Autonomous Monitoring**: INA226 power monitors provide real-time wattage and current draw analytics to detect faults before they happen.

---

## 📈 Future Capabilities
Research Station Alpha is built to scale. The current architecture supports up to 255 nodes, integrated Home Assistant automations, and long-term data logging for advanced scientific experiments.

---

## ⚡ Uninterruptible Research: Power Resilience
A laboratory experiment should never fail due to a power outage. We have integrated the **MikroTik NetPower Lite 8P** and high-capacity **LiFePO4 battery storage** to ensure the station is "Always Hot."

![Power Resilience Vision](file:///C:/Users/theon/.gemini/antigravity/brain/10718a31-6cb2-4aa4-bb6e-f716b6ce5381/research_station_power_vision_1777661156619.png)

### Key Features:
- **Zero-Downtime UPS**: Automatic switching between 48V primary power and 24V battery backup.
- **Redundant PoE Delivery**: Dedicated hardware channels for each of the 10 nodes to ensure localized faults don't cascade.
- **Battery Intelligence**: Real-time State-of-Charge monitoring integrated into the Master Dashboard.

> [!TIP]
> This project is open for collaboration and review. Check out the full documentation in the `/docs` folder of our repository!
