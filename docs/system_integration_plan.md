# Implementation Plan - System Integration

## 1. Master Dashboard (Containerized)
- `[x]` **App Type**: React (Vite) + TailwindCSS for the UI.
- `[x]` **Polling Logic**: Automated discovery and telemetry aggregation for 10x Olimex nodes.
- `[x]` **Aesthetics**: Glassmorphic, animated transitions, real-time gauges, and dark accents.

## 2. Home Assistant Integration
- `[x]` **Platform**: Docker-based Home Assistant Container.
- `[x]` **Strategy**: Integrated MQTT publishing on the backend proxy (`server.js`) to publish detector telemetry (`korstmos/detector/:id/telemetry`) and facility health (`korstmos/infra/health`) on each polling interval.

## 3. Remote Access (WireGuard & Tailscale)
- `[x]` **Gateway**: MikroTik RB5009.
- `[x]` **Peer**: Secure peer-to-peer WireGuard connection and Tailscale subnet router configured for seamless off-site management.

---

## Verification Plan
- `[x]` **Aggregation Test**: Verified using `DEMO_MODE=true` showing successful aggregation of 10 nodes, with Recharts and layout warnings completely addressed.
- `[x]` **Home Assistant Sync**: Confirmed MQTT broker connection and topic publishing logic in `server.js` executes on every cycle.
- `[x]` **Remote Tunnel Test**: Verified remote dashboard access and command routing through the WireGuard and Tailscale VPN setups.
