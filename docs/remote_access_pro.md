# Remote Access Pro: Tailscale & RustDesk Integration

This guide optimizes your station for Tailscale mesh networking and high-performance RustDesk remote control.

## 🌌 1. Tailscale Subnet Routing (MikroTik)
By making the RB5009 a Tailscale Subnet Router, your 10 HVPS nodes become accessible on your private mesh.

1. **Enable Tailscale on MikroTik** (Requires v7.13+):
   ```bash
   /container/config/set ram-high=512M
   # Install the Tailscale package from MikroTik's extra-packages
   /tool/tailscale/set enabled=yes
   ```
2. **Advertise Routes**:
   In the Tailscale settings, advertise your local subnet (e.g., `192.168.1.0/24`).
3. **Result**: Your HVPS dashboard and nodes are now reachable at their local IPs from any Tailscale-connected device.

---

## 🖥️ 2. Self-Hosted RustDesk Relay
Avoid public relay lag by hosting your own signal server in the dashboard stack.

### Updated `docker-compose.yml` Snippet:
```yaml
services:
  hbbs:
    image: rustdesk/rustdesk-server:latest
    container_name: hbbs
    command: hbbs -r <YOUR_PC_IP>
    network_mode: host
    restart: always

  hbr:
    image: rustdesk/rustdesk-server:latest
    container_name: hbr
    command: hbr
    network_mode: host
    restart: always
```

---

## 🔄 3. Unified Workflow
1. **Connect**: Open Tailscale on your remote laptop.
2. **Access UI**: Navigate to the local IP of your dashboard PC.
3. **Remote Control**: Use RustDesk pointed to your local `hbbs` instance for zero-lag hardware management.
