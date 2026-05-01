# MikroTik WireGuard Secure Access Setup

Follow these steps on your **RB5009** to enable secure remote access.

## 1. Interface Configuration
Run these commands in the RouterOS Terminal:

```bash
/interface wireguard add listen-port=13231 name=wireguard-remote comment="Remote Access for Research Station"
/ip address add address=10.88.0.1/24 interface=wireguard-remote
```

## 2. Firewall Rules
Ensure the port is open for incoming connections:

```bash
/ip firewall filter add action=accept chain=input dst-port=13231 protocol=udp comment="Allow WireGuard"
```

## 3. Adding a Peer (Your Device)
Get the **Public Key** from your WireGuard client (phone/laptop) and add it to the router:

```bash
/interface wireguard peers add allowed-address=10.88.0.2/32 interface=wireguard-remote public-key="[YOUR_DEVICE_PUBLIC_KEY]"
```

## 4. Client Side Configuration
Use these settings in your WireGuard app:

- **Address**: `10.88.0.2/32`
- **DNS**: `1.1.1.1` (or your local DNS)
- **Endpoint**: `[YOUR_HOME_PUBLIC_IP]:13231`
- **Allowed IPs**: `10.88.0.0/24`, `192.168.1.0/24` (allows access to the entire local network)
- **Public Key**: (Copy the public key from `/interface wireguard print` on the router)
