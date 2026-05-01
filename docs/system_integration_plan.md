# Implementation Plan - System Integration

## 1. Master Dashboard (Containerized)
- **App Type**: React (Vite) + TailwindCSS for the UI.
- **Polling Logic**: Automated discovery and telemetry aggregation for 10x Olimex nodes.
- **Aesthetics**: Glassmorphic dark-mode, animated transitions, real-time gauges.

## 2. Home Assistant Integration
- **Platform**: Docker-based Home Assistant Container.
- **Strategy**: Define RESTful sensors in `configuration.yaml` to pull from each node's `/status` endpoint.

## 3. Remote Access (WireGuard)
- **Gateway**: MikroTik RB5009.
- **Peer**: Secure peer-to-peer connection for management from any device.

## Verification Plan
- [ ] **Aggregation Test**: Verify the dashboard can successfully poll multiple ESP32 nodes simultaneously.
- [ ] **Home Assistant Sync**: Confirm sensor values appear in HA dashboard.
- [ ] **Remote Tunnel Test**: Verify external access to the dashboard through the WireGuard tunnel.
