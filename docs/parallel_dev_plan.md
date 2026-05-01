# Parallel Development Track: Research Station Alpha

This plan coordinates Gemini Flash (Frontend), Claude Opus (Backend), and Gemini Pro (Audit) to work on the project simultaneously without conflicts.

## 🎨 Track A: Frontend (Gemini Flash)
**Goal**: Create a stunning, high-fidelity user experience.
- **Components**: `Dashboard.jsx`, `NodeCard.jsx`, `SafetyPanel.jsx`.
- **Logic**: UI state management, real-time graph rendering, and CSS/Tailwind animations.
- **Priority**: Responsive design for tablet/mobile lab use.

## ⚙️ Track B: Backend (Claude Opus)
**Goal**: Build a high-performance, safe, and reliable telemetry proxy.
- **Files**: `server.js`, `api/node_proxy.js`, `services/ha_sync.js`.
- **Logic**: Asynchronous polling of 10 nodes, OVP/OCP watchdog triggers, and data persistence.
- **Priority**: Handling network timeouts and node reconnection logic.

## 🤝 The Interface Contract (The Bridge)
To prevent conflicts, both tracks must adhere to this JSON structure for node data:
```json
{
  "nodeId": 1,
  "status": "online",
  "channels": [
    { "ch": 1, "target_kv": 0.5, "current_kv": 0.51, "limit_kv": 3.0 },
    { "ch": 2, "target_kv": 0.5, "current_kv": 0.50, "limit_kv": 3.0 }
  ],
  "power": { "v": 48.2, "a": 0.12, "w": 5.8 },
  "ups": { "battery_pct": 92, "source": "dc" }
}
```

## 🛡️ Track C: Audit & Security (Gemini Pro)
**Goal**: Final verification and stress-testing.
- **Focus**: Testing the **Global Emergency Stop** latency and WireGuard tunnel encryption.
- **Responsibility**: Code review of Track B's safety logic and Track A's input validation.

---

> [!IMPORTANT]
> **Track B (Backend)** should NOT modify the `src/components` folder.
> **Track A (Frontend)** should NOT modify the `server.js` or `services/` folder.
