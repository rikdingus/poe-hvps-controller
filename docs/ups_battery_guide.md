# UPS & Battery Guide: Uninterruptible Research

This guide details the power resilience strategy for Research Station Alpha using the MikroTik NetPower Lite 8P.

## ⚡ 1. The Power Backbone: NetPower Lite 8P
The PRS-8P is an outdoor switch that supports multiple power inputs. We will use it in **UPS Mode**.

### Wiring Configuration:
1. **Primary Input**: 48V 2A Industrial Power Supply (connected to the DC jack).
2. **Backup Input**: 24V or 48V LiFePO4 Battery Bank (connected via the same DC bus or Reverse PoE).
3. **Behavior**: The NetPower Lite will power the 10 nodes from the DC jack and automatically switch to the battery if the mains power fails, with zero millisecond switch-over time.

---

## 🔋 2. Battery Selection: LiFePO4
We recommend a **24V 100Ah LiFePO4** battery bank.

### Advantages:
- **Voltage Stability**: Stays above 25V for 90% of the discharge cycle, ensuring the HVPS units don't brown out.
- **Safety**: Non-combustible chemistry suitable for laboratory environments.
- **Longevity**: 3000+ cycles (approx. 10 years of life).

---

## 🛠️ 3. Implementation Checklist
- [ ] **External Charger**: Since the PRS-8P charging current is limited, use a dedicated LiFePO4 Smart Charger (e.g., Victron BlueSmart) in parallel with the battery.
- [ ] **Fusing**: Install a 15A DC circuit breaker between the battery and the MikroTik switch.
- [ ] **Monitoring**: Connect the battery's BMS (if supported) to Home Assistant for real-time "State of Charge" (SOC) tracking on the dashboard.

---

> [!CAUTION]
> Always ensure your battery voltage matches the input voltage requirements of your PoE injectors. 48V is standard for 802.3af/at compatibility.
