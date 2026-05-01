# Firmware Architecture — PoE HVPS Controller

> **Board:** Olimex ESP32-POE-ISO-IND  
> **Framework:** Arduino (ESP32 Arduino Core 2.x via PlatformIO)  
> **Firmware Version:** 1.0.0

## Overview

The firmware is a single-file (`src/main.cpp`) embedded application that serves a real-time web dashboard over wired Ethernet and controls two HVPS output channels via I2C digital potentiometers. It is designed with a strict **single-task I2C policy** to prevent bus contention.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    ESP32 (Main Task)                │
│                                                     │
│  loop() ─────► processSlewRate() ──► I2C Write      │
│           │                          (AD5282)       │
│           └──► readSensors() ──────► I2C Read       │
│                    │                 (INA226)       │
│                    └──► ADC Read                    │
│                         (GPIO 32/33)                │
│                                                     │
├─────────────────────────────────────────────────────┤
│            ESPAsyncWebServer (Async Task)            │
│                                                     │
│  GET /         ──► Serve index_html (PROGMEM)       │
│  GET /status   ──► Read cached globals (no I2C)     │
│  GET /set      ──► Write ch.target (atomic uint8)   │
│  GET /info     ──► Read cached globals (no I2C)     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Single-Task I2C Access

All I2C operations (INA226 reads, AD5282 writes) happen **exclusively** inside `loop()` on the Arduino main task. The async web server runs on a separate FreeRTOS task but only accesses cached `volatile` global variables — it never touches the I2C bus directly.

**Why:** The ESP32 Arduino `Wire` library is not thread-safe. Concurrent I2C access from multiple FreeRTOS tasks causes bus corruption, NAK storms, and hard-to-debug intermittent failures.

### 2. Slew-Rate Ramping

Rather than writing pot values directly when requested via `/set`, the firmware sets a `target` and the main loop increments/decrements `current` by 1 step every `RAMP_INTERVAL` (4ms). This produces:

- **Full sweep time:** 256 steps × 4ms = ~1.02 seconds
- **Smooth ramping:** prevents sudden voltage transients that could damage downstream HV equipment
- **Real-time feedback:** the dashboard shows both `target` (desired) and `current` (actual) positions, plus a "⏳ Ramping..." indicator

### 3. PROGMEM Dashboard

The entire HTML/CSS/JS dashboard is stored in flash via `PROGMEM` and served as a raw literal string. This means:
- No filesystem (SPIFFS/LittleFS) required
- No separate upload step for web assets
- The dashboard works even if the flash filesystem is corrupted
- Trade-off: dashboard changes require a firmware re-flash

### 4. Graceful INA226 Failure

The INA226 sensor is optional. If `INA.begin()` returns false at startup:
- `ina_ok` is set to `false`
- Voltage and current readings remain at 0
- The dashboard displays "SENSOR ERROR" badge
- All other functionality (pot control, ADC feedback, API) continues normally

This is the expected behavior during development when no custom PCB is connected.

## Memory Usage

Tested build output (PlatformIO, Release mode):

| Resource | Used | Available | Usage |
| :--- | :--- | :--- | :--- |
| **RAM** | 46,352 bytes | 327,680 bytes | 14.1% |
| **Flash** | 884,777 bytes | 1,310,720 bytes | 67.5% |

## Concurrency & Thread Safety

| Global Variable | Written By | Read By | Safety Mechanism |
| :--- | :--- | :--- | :--- |
| `ch1.target`, `ch2.target` | Web handler (`/set`) | `loop()` | `volatile uint8_t` — atomic on ESP32 |
| `ch1.current`, `ch2.current` | `loop()` | Web handler (`/status`) | `uint8_t` — atomic on ESP32 |
| `poe_voltage`, `poe_current` | `loop()` | Web handler (`/status`) | `volatile float` — single-writer pattern |
| `hv1_feedback`, `hv2_feedback` | `loop()` | Web handler (`/status`) | `volatile float` — single-writer pattern |
| `ina_ok` | `setup()` only | Web handlers | Effectively immutable after boot |
| `eth_connected` | Ethernet callback | Web handler (`/info`) | `bool` — atomic on ESP32 |

> **Note:** The `volatile float` reads are not truly atomic on ESP32 (32-bit float = 32-bit word, but FPU registers could theoretically cause tearing). In practice, the worst case is a single corrupted status poll — acceptable for a monitoring dashboard. If strict atomicity is needed in the future, wrap reads in `portENTER_CRITICAL()`.

## Ethernet & mDNS

- Ethernet events are registered via `WiFi.onEvent()` **before** `ETH.begin()` to catch the initial `ETH_START` event.
- mDNS is started only after `ETH_GOT_IP`, advertising `hvps.local` with an HTTP service on port 80.
- On `ETH_DISCONNECTED`, `eth_connected` is set to false (but the web server remains bound — it will resume serving when the link comes back).

## API Endpoint Details

### `GET /status`

Returns cached telemetry. Updated every 500ms by the main loop.

```json
{
  "v": 0,         // PoE bus voltage (V)
  "i": 0,         // PoE current (A)
  "hv1": 0.625,   // HV channel 1 feedback (V)
  "hv2": 0.275,   // HV channel 2 feedback (V)
  "p1": 127,      // Channel 1 target position
  "p2": 127,      // Channel 2 target position
  "c1": 127,      // Channel 1 actual position
  "c2": 127,      // Channel 2 actual position
  "ok": false     // INA226 health
}
```

### `GET /set?pot=N&val=V`

Sets the target for channel N (1 or 2) to value V (0–255). The actual position will ramp toward the target at 1 step per 4ms.

**Responses:**
- `200 OK` — target accepted
- `400 Missing parameters` — `pot` or `val` query param missing
- `400 Invalid channel (1 or 2)` — `pot` is not 1 or 2

### `GET /info`

Returns device metadata. Uptime is updated every 500ms.

```json
{
  "fw": "1.0.0",
  "uptime": 736,
  "mac": "EC:C9:FF:BA:8D:AB",
  "ip": "192.168.1.221",
  "eth": true,
  "ina": false,
  "ch1_target": 127,
  "ch1_current": 127,
  "ch2_target": 127,
  "ch2_current": 127
}
```

## Known Limitations

1. **No OTA update support.** Firmware updates require a USB connection. OTA can be added in a future version.
2. **No authentication.** The web dashboard and API are unauthenticated. This is acceptable for isolated lab networks but should be addressed before deployment on shared networks.
3. **No persistent state.** Pot positions reset to 127 (mid-point) on every power cycle. NVS-based persistence could be added.
4. **No CORS headers.** Cross-origin requests from external dashboards will be blocked by browsers. Add `Access-Control-Allow-Origin: *` header if needed.
5. **Float atomicity.** As noted above, `volatile float` reads are not guaranteed atomic. Acceptable for monitoring but not for safety-critical decisions.
