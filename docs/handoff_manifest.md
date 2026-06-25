# 🌌 Project Korstmos: Handoff Manifest
**Kosmisch Onderzoek Radboud Studenten Meetopstelling**

Project Korstmos has been fully re-architected as a dedicated Cosmic Ray Observatory. The system is optimized for scintillation-based muon detection, utilizing individual Olimex POE units for each detector plate and a centralized digitizer hub for coincidence monitoring.

---

## 🛑 Critical Path & Current Status
*   **Code Integration**: All open development branches and PRs (PR #8, #11, #12, #13, #20, #21, `pcnt-pulse-capture`, `server-reboot-retry`, `audit-followups`, `safe-boot`, `repo-hygiene`) are successfully merged into the local `main` branch.
*   **Builds & Verification**: Vite frontend builds successfully, and all 23 backend unit tests pass (`npm run build && npm test`).
*   **Physical Action**: Ensure 4.7kΩ pull-up resistors are soldered to the expansion headers on the Olimex boards to enable RDAC/INA226 communication.
*   **Calibration**: Perform first-run tuning using a High-Voltage reference multimeter and the `/set?ratio1=...` API.

---

## 🏛️ Korstmos Research & Production Features (v1.1.0)
*   **Timing-Safe API Authorization**: Write and mutate endpoints (`POST /api/reboot-detector`, `POST /api/emergency-stop`, and `POST /api/safety-limits`) are protected via timing-safe `DASHBOARD_API_TOKEN` bearer authentication. Telemetry reads remain open for polling.
*   **Token UI Management**: The web dashboard **Settings** panel includes an **API Write Authentication** field, saving the token to browser `localStorage` to authorize frontend operations.
*   **Dynamic Calibration**: Move from static constants to runtime-adjustable gains and offsets. Precision tuning without firmware re-flashing.
*   **Safe-Boot Initialisation**: Both RDAC channels safe-boot to `0` (HV off) instead of the previous mid-rail default (`127`), ensuring high-voltage outputs remain completely disabled until explicitly commanded.
*   **Downsampled Telemetry History**: Backend logs 5-minute downsampled records (coincidence rate, bus voltage, lab temp) to `logs/history_downsampled.csv`. Telemetry cache is loaded on boot and served via `/api/history`.
*   **Historical Charts**: The **Event History** (Analytics) panel renders historical time-series plots of lab temperature and bus voltage from the new downsampled history API.
*   **Server Security & Monitoring (`tongelreep`)**:
  - `setup-fail2ban.sh` configures automated brute-force IP blocking for the `xrdp-sesman` login pool.
  - `alert-status.sh` is deployed as an hourly systemd service/timer that checks Tailscale routes and RDP active session counts, logging alerts directly to `systemd-journald`.

---

## 🛠️ System Architecture (Unified)
- **Firmware**: v1.1.0 (ESP32-POE). Supports `POST /set` for control, `GET /set` for calibration, and hardware PCNT pulse counting.
- **Backend**: Node.js Proxy with `node_mapper.js` (calibrated) and `safety_guardian.js` (watchdog).
- **Frontend**: React 19 + Vite + Tailwind + Lucide + Recharts.
- **Infrastructure**: MikroTik RB5009 + NetPower 8P (PoE & SNMP management).

---

## 📅 Roadmap for Muon Acquisition
1.  **Environment Audit**: Run `node audit_environment.js` from the dashboard folder.
2.  **Calibration Run**: Power a single node, measure HV rail, and use the dashboard to set the `ratio` and `offset` for both channels.
3.  **Safety Verification**: Trigger a mock overvoltage (1.6kV) to verify the `safety_guardian` cuts PoE power via SNMP.
4.  **Data Capture**: Start a long-term run and monitor the `/logs/telemetry_*.csv` output.
