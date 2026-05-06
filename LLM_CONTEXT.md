# 🌌 Project Korstmos: LLM Code Review Context (v1.1.0)

> **Purpose:** This document consolidates the full project context into a single file for AI-assisted code review. It contains the unified firmware state, proxy logic, and architectural safety rules.
>
> **Board:** Olimex ESP32-POE-ISO-IND
> **Last Verified:** 2026-05-06 against firmware v1.1.0 (Unified AGENT + CLAUDE)

---

## 1. Project Summary
A high-precision Cosmic Ray Observatory (KORSTMOS). 10 detector nodes monitor muon scintillator plates. Each node features dual-channel HV control with multimeter-referenced dynamic calibration, INA226 power monitoring, and SNMP-driven safety overrides.

## 2. Unified Hardware Mapping
- **I2C SDA:** GPIO 13 · **I2C SCL:** GPIO 16
- **ADC HV1:** GPIO 32 · **ADC HV2:** GPIO 33 (Calibrated via API)
- **INA226:** Address `0x40` (PoE diagnostics)
- **AD5282:** Address `0x2C` (RDAC Voltage Control)

## 3. Control API (v1.1.0)

### `GET /status`
```json
{
  "v": 26.4, "i": 0.15, 
  "hv1": 0.05, "hv2": 0.05, 
  "p1": 127, "p2": 127, 
  "c1": 127, "c2": 127, 
  "ok": true,
  "hv1g": 1025.5, "hv1o": 5.2,
  "hv2g": 1025.5, "hv2o": 5.2
}
```
*Note: `hv[N]g` and `hv[N]o` are gain and offset used for the linear transformation `kV = (ADC * gain + offset) / 1000`.*

### `POST /set` (Operational)
- **Body**: `pot=1&val=200`
- Sets the target RDAC position (0-255). Ramps at 4ms/step.

### `GET /set` (Calibration)
- **Query**: `?ratio1=1030.2&offset1=2.1`
- Updates the feedback multiplier for field-calibrated accuracy.

## 4. Architectural Safety (Safety Guardian)
The `safety_guardian.js` monitors the calibrated `kV` values. If any channel exceeds the `soft_limit` (e.g., 1.5kV), the proxy immediately:
1. Sends an emergency SNMP shutdown to the MikroTik switch.
2. Cuts PoE power to the specific port for the detected node.
3. Locks the dashboard into an "ACQUISITION HALTED" state.

## 5. Ongoing Research: 20ns Capture
We are currently investigating the use of the **ESP32 PCNT (Pulse Counter)** to detect 20ns muon pulses directly on the Olimex nodes. Refer to `docs/high_speed_pulse_capture.md`.

---

## 6. Core Source (v1.1.0 Snippet)

### `firmware/src/main.cpp` (Unified)
```cpp
// POST /set for Voltage Control (RDAC)
server.on("/set", HTTP_POST, [](AsyncWebServerRequest *req) {
  int p = req->getParam("pot", true)->value().toInt();
  int v = constrain(req->getParam("val", true)->value().toInt(), 0, 255);
  if (p == 1) ch1.target = v;
  else if (p == 2) ch2.target = v;
  req->send(200, "text/plain", "OK");
});

// GET /set for Calibration Only
server.on("/set", HTTP_GET, [](AsyncWebServerRequest *request){
  if (request->hasParam("ratio1")) hv1_gain = request->getParam("ratio1")->value().toFloat();
  // ... (updates gains/offsets)
  request->send(200, "text/plain", "Calibration Updated");
});
```

### `dashboard/app/node_mapper.js`
```javascript
function mapNodeData(raw, config) {
  const hv1_calibrated = (raw.hv1 * (raw.hv1g || 1000) + (raw.hv1o || 0)) / 1000.0;
  const hv2_calibrated = (raw.hv2 * (raw.hv2g || 1000) + (raw.hv2o || 0)) / 1000.0;
  // ... (returns canonical object)
}
```

---
**Verified Mission Ready (May 6, 2026)**
