# ⚛️ High-Speed Muon Pulse Capture (20ns)

## 📌 Overview
The Korstmos Scintillator Units generate extremely fast pulses (~20ns) upon muon detection. Standard GPIO interrupts on the ESP32-POE are insufficient for this timescale due to interrupt service routine (ISR) latency (~2µs).

## ⚡ Performance Limits & Capable Width
For the Korstmos project, we must differentiate between software-limited and hardware-native detection capabilities:

| Method | Min Pulse Width | 20ns Muon Status | Rationale |
| :--- | :--- | :--- | :--- |
| **GPIO Interrupt** | ~2,000ns | ❌ **Invisible** | CPU ISR latency is 100x slower than the pulse. |
| **ESP32 PCNT** | **12.5ns** | ✅ **Detected** | 1 clock cycle @ 80MHz (APB bus). |
| **MCPWM Capture** | 6.25ns | ✅ **Detected** | 1 clock cycle @ 160MHz (PWM timer). |

### 1. Hardware Pulse Counter (PCNT) — RECOMMENDED
The ESP32 includes a dedicated PCNT peripheral capable of counting pulses as short as **12.5ns**.
*   **Implementation**: Configure PCNT on a designated input pin (e.g., GPIO 14).
*   **Filter**: Disable the hardware noise filter or set it below 10ns to ensure 20ns pulses are not ignored.
*   **Pros**: Zero CPU overhead, highly reliable counting.
*   **Cons**: No event timestamping (counting only).

### 2. MCPWM Capture Unit
For coincidence timing between nodes, the MCPWM Capture Unit can timestamp edges with **~6ns resolution**.
*   **Usage**: Requires high-precision time synchronization between all array nodes (e.g., SNTP or PTP over Ethernet).

### 3. Pulse Stretching (Hardware remediation)
To allow standard interrupt handling, a **74HC123 Monostable Multivibrator** or a high-speed comparator circuit can be used to stretch the 20ns pulse to 1-2µs.

## 📋 Integration Tasks for Agents
- [ ] Implement `PulseCounter` class in `firmware/src/`.
- [ ] Add `hits` field to `/status` and `/info` endpoints.
- [ ] Update `node_mapper.js` to process cumulative hit counts into a "Hits/Second" (Hz) rate.
- [ ] Verify PCNT detection limits with a signal generator before field deployment.

---
**Status**: Research Phase. Implementation pending verification of signal logic levels (3.3V vs 5V).
