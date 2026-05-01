#include <Arduino.h>
#include <ETH.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <Wire.h>
#include <INA226.h>
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <ArduinoOTA.h>

// --- Firmware Info ---
#define FW_VERSION "1.1.0"

// --- Hardware Pins (Olimex ESP32-POE-ISO-IND) ---
#define I2C_SDA 13
#define I2C_SCL 16
#define ADC_HV1 32
#define ADC_HV2 33

// --- HV Feedback Calibration ---
// Adjust these after measuring with a known reference.
// output_kV = (adc_volts * HV_CAL_GAIN) + HV_CAL_OFFSET
#define HV1_CAL_GAIN   1000.0  // default 1V = 1000V
#define HV1_CAL_OFFSET 0.0
#define HV2_CAL_GAIN   1000.0
#define HV2_CAL_OFFSET 0.0

// --- Devices ---
INA226 INA(0x40);
AsyncWebServer server(80);

// --- State & Slew Rate ---
struct Channel {
  volatile uint8_t target = 127;
  uint8_t current = 127;
  unsigned long lastStep = 0;
};

Channel ch1, ch2;

// Cached sensor values (written in loop, read by web handlers)
volatile float poe_voltage = 0;
volatile float poe_current = 0;
volatile float hv1_feedback = 0;
volatile float hv2_feedback = 0;
bool ina_ok = false;
bool eth_connected = false;
unsigned long lastSensorRead = 0;
unsigned long uptime_seconds = 0;

const unsigned long RAMP_INTERVAL = 4;    // ~1s for full 0-255 sweep
const unsigned long SENSOR_INTERVAL = 500; // Read sensors every 500ms

// --- AD5282 Digital Pot Driver ---
void updateHardwarePot(uint8_t channel, uint8_t value) {
  Wire.beginTransmission(0x2C);
  Wire.write(channel == 0 ? 0x00 : 0x10); // RDAC1 = 0x00, RDAC2 = 0x10
  Wire.write(value);
  Wire.endTransmission();
}

// --- Slew Rate Controller ---
void processSlewRate() {
  unsigned long now = millis();

  // Channel 1
  if (ch1.current != ch1.target && now - ch1.lastStep > RAMP_INTERVAL) {
    if (ch1.current < ch1.target) ch1.current++;
    else ch1.current--;
    updateHardwarePot(0, ch1.current);
    ch1.lastStep = now;
  }

  // Channel 2
  if (ch2.current != ch2.target && now - ch2.lastStep > RAMP_INTERVAL) {
    if (ch2.current < ch2.target) ch2.current++;
    else ch2.current--;
    updateHardwarePot(1, ch2.current);
    ch2.lastStep = now;
  }
}

// --- Sensor Read (called from loop only — keeps I2C on one task) ---
void readSensors() {
  if (millis() - lastSensorRead < SENSOR_INTERVAL) return;
  lastSensorRead = millis();

  if (ina_ok) {
    poe_voltage = INA.getBusVoltage();
    poe_current = INA.getCurrent();
  }
  float hv1_raw = analogReadMilliVolts(ADC_HV1) / 1000.0;
  float hv2_raw = analogReadMilliVolts(ADC_HV2) / 1000.0;
  hv1_feedback = hv1_raw; 
  hv2_feedback = hv2_raw;
  uptime_seconds = millis() / 1000;

  // Log telemetry for testing
  Serial.printf("[HVPS] CH1: %.2f kV | CH2: %.2f kV | PoE: %.2fV @ %.2fA\n", 
    hv1_feedback * HV1_CAL_GAIN / 1000.0, 
    hv2_feedback * HV2_CAL_GAIN / 1000.0, 
    poe_voltage, poe_current);
}

// --- Ethernet Event Handler ---
void onEthEvent(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_ETH_START:
      Serial.println("[ETH] Started");
      ETH.setHostname("hvps-controller");
      break;
    case ARDUINO_EVENT_ETH_GOT_IP:
      Serial.printf("[ETH] IP: %s  Link: %dMbps %s\n",
        ETH.localIP().toString().c_str(),
        ETH.linkSpeed(),
        ETH.fullDuplex() ? "Full-Duplex" : "Half-Duplex");
      eth_connected = true;
      // Start mDNS so device is reachable at http://hvps.local
      if (MDNS.begin("hvps")) {
        MDNS.addService("http", "tcp", 80);
        Serial.println("[mDNS] http://hvps.local");
      }
      break;
    case ARDUINO_EVENT_ETH_DISCONNECTED:
      Serial.println("[ETH] Disconnected");
      eth_connected = false;
      break;
    default:
      break;
  }
}

// --- Dashboard HTML ---
const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE HTML><html>
<head>
  <title>HVPS Controller</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root { --bg: #0f172a; --card: #1e293b; --accent: #38bdf8; --text: #f8fafc; --err: #ef4444; --warn: #f59e0b; }
    body { font-family: sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { font-weight: 300; letter-spacing: 2px; color: var(--accent); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .card { background: var(--card); padding: 20px; border-radius: 15px; box-shadow: 0 10px 15px rgba(0,0,0,0.3); }
    .card h2 { font-size: 0.8rem; text-transform: uppercase; color: #94a3b8; margin-top: 0; }
    .value { font-size: 2.2rem; font-weight: 600; margin: 10px 0; }
    .unit { font-size: 0.9rem; color: #64748b; margin-left: 5px; }
    .slider-box { margin-top: 20px; }
    input[type=range] { width: 100%; height: 8px; border-radius: 5px; background: #334155; outline: none; -webkit-appearance: none; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); cursor: pointer; }
    .status { font-size: 0.7rem; text-align: right; margin-top: 10px; color: #64748b; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; float: right; background: #22c55e; color: #fff; }
    .badge.error { background: var(--err); }
    .badge.ramping { background: var(--warn); }
    .ramp-indicator { font-size: 0.7rem; color: var(--warn); display: none; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>POE HVPS CONTROLLER</h1></div>
    <div class="grid">
      <div class="card">
        <h2>POE POWER <span id="p-status" class="badge">ONLINE</span></h2>
        <div class="value" id="voltage">0.00<span class="unit">V</span></div>
        <div class="value" id="current">0.000<span class="unit">A</span></div>
      </div>
      <div class="card">
        <h2>HV FEEDBACK (1V=1000V)</h2>
        <div class="value" id="hv1">0<span class="unit">V</span></div>
        <div class="value" id="hv2">0<span class="unit">V</span></div>
      </div>
      <div class="card">
        <h2>HVPS CHANNEL 1</h2>
        <div class="slider-box"><input type="range" id="pot1" min="0" max="255" oninput="updatePot(1, this.value)"></div>
        <div class="status">Target: <span id="val1">--</span> | Actual: <span id="cur1">--</span></div>
        <div class="ramp-indicator" id="ramp1">⏳ Ramping...</div>
      </div>
      <div class="card">
        <h2>HVPS CHANNEL 2</h2>
        <div class="slider-box"><input type="range" id="pot2" min="0" max="255" oninput="updatePot(2, this.value)"></div>
        <div class="status">Target: <span id="val2">--</span> | Actual: <span id="cur2">--</span></div>
        <div class="ramp-indicator" id="ramp2">⏳ Ramping...</div>
      </div>
    </div>
  </div>
  <script>
    let firstLoad = true;
    function updatePot(pot, val) {
      document.getElementById('val' + pot).innerHTML = val;
      fetch(`/set?pot=${pot}&val=${val}`);
    }
    setInterval(() => {
      fetch('/status').then(r => r.json()).then(data => {
        document.getElementById('voltage').innerHTML = data.v.toFixed(2) + '<span class="unit">V</span>';
        document.getElementById('current').innerHTML = data.i.toFixed(3) + '<span class="unit">A</span>';
        document.getElementById('hv1').innerHTML = Math.round(data.hv1 * data.hv1g + (data.hv1o||0)) + '<span class="unit">V</span>';
        document.getElementById('hv2').innerHTML = Math.round(data.hv2 * data.hv2g + (data.hv2o||0)) + '<span class="unit">V</span>';
        const st = document.getElementById('p-status');
        if(!data.ok) { st.innerHTML = 'SENSOR ERROR'; st.className = 'badge error'; }
        else { st.innerHTML = 'ONLINE'; st.className = 'badge'; }
        // Show current (actual) pot positions
        document.getElementById('cur1').innerHTML = data.c1;
        document.getElementById('cur2').innerHTML = data.c2;
        // Show ramping indicators
        document.getElementById('ramp1').style.display = (data.p1 !== data.c1) ? 'block' : 'none';
        document.getElementById('ramp2').style.display = (data.p2 !== data.c2) ? 'block' : 'none';
        if(firstLoad) {
          document.getElementById('pot1').value = data.p1; document.getElementById('val1').innerHTML = data.p1;
          document.getElementById('pot2').value = data.p2; document.getElementById('val2').innerHTML = data.p2;
          firstLoad = false;
        }
      }).catch(() => {
        document.getElementById('p-status').innerHTML = 'OFFLINE';
        document.getElementById('p-status').className = 'badge error';
      });
    }, 1000);
  </script>
</body>
</html>
)rawliteral";

// --- Setup ---
void setup() {
  Serial.begin(115200);
  Serial.printf("\n[HVPS] Firmware v%s\n", FW_VERSION);

  // Register Ethernet events BEFORE ETH.begin()
  WiFi.onEvent(onEthEvent);

  // I2C (Pin Swap Test: SDA=16, SCL=13, Slow Clock)
  Wire.begin(16, 13, 100000); 
  pinMode(16, INPUT_PULLUP);
  pinMode(13, INPUT_PULLUP);

  delay(5000); // Wait for peripherals to stabilize

  // Ethernet — board definition handles PHY config
  ETH.begin();

  // I2C Scanner
  Serial.println("[I2C] Scanning...");
  byte error, address;
  int nDevices = 0;
  for(address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();
    if (error == 0) {
      Serial.printf("[I2C] Device found at 0x%02X\n", address);
      nDevices++;
    }
  }
  if (nDevices == 0) Serial.println("[I2C] NO DEVICES FOUND");

  // INA226
  ina_ok = INA.begin();
  if (ina_ok) {
    INA.setMaxCurrentShunt(2.0, 0.01); // 2A max, 10mOhm shunt
    Serial.println("[INA226] OK");
  } else {
    Serial.println("[INA226] NOT FOUND");
  }

  // Initialize pots to safe mid-position
  updateHardwarePot(0, ch1.current);
  updateHardwarePot(1, ch2.current);

  // --- Web Server Routes ---

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(200, "text/html", index_html);
  });

  server.on("/status", HTTP_GET, [](AsyncWebServerRequest *request){
    JsonDocument doc;
    // Serve cached sensor values (no I2C in this context)
    doc["v"] = poe_voltage;
    doc["i"] = poe_current;
    doc["hv1"] = hv1_feedback;
    doc["hv2"] = hv2_feedback;
    doc["p1"] = ch1.target;
    doc["p2"] = ch2.target;
    doc["c1"] = ch1.current;  // Actual position
    doc["c2"] = ch2.current;
    doc["ok"] = ina_ok;
    doc["hv1g"] = HV1_CAL_GAIN;
    doc["hv1o"] = HV1_CAL_OFFSET;
    doc["hv2g"] = HV2_CAL_GAIN;
    doc["hv2o"] = HV2_CAL_OFFSET;
    String res;
    serializeJson(doc, res);
    request->send(200, "application/json", res);
  });

  server.on("/set", HTTP_GET, [](AsyncWebServerRequest *request){
    if (!request->hasParam("pot") || !request->hasParam("val")) {
      request->send(400, "text/plain", "Missing parameters");
      return;
    }
    int p = request->getParam("pot")->value().toInt();
    int v = constrain(request->getParam("val")->value().toInt(), 0, 255);
    if (p == 1) {
      ch1.target = v;
      request->send(200, "text/plain", "OK");
    } else if (p == 2) {
      ch2.target = v;
      request->send(200, "text/plain", "OK");
    } else {
      request->send(400, "text/plain", "Invalid channel (1 or 2)");
    }
  });

  server.on("/info", HTTP_GET, [](AsyncWebServerRequest *request){
    JsonDocument doc;
    doc["fw"] = FW_VERSION;
    doc["uptime"] = uptime_seconds;
    doc["mac"] = ETH.macAddress();
    doc["ip"] = ETH.localIP().toString();
    doc["eth"] = eth_connected;
    doc["ina"] = ina_ok;
    doc["ch1_target"] = ch1.target;
    doc["ch1_current"] = ch1.current;
    doc["ch2_target"] = ch2.target;
    doc["ch2_current"] = ch2.current;
    String res;
    serializeJson(doc, res);
    request->send(200, "application/json", res);
  });

  server.begin();
  Serial.println("[HTTP] Server started");

  // --- OTA Updates ---
  ArduinoOTA.setHostname("hvps-controller");
  ArduinoOTA.onStart([]() {
    Serial.println("[OTA] Update starting...");
  });
  ArduinoOTA.onEnd([]() {
    Serial.println("[OTA] Update complete. Rebooting.");
  });
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("[OTA] Error[%u]\n", error);
  });
  ArduinoOTA.begin();
  Serial.println("[OTA] Ready");
}

// --- Main Loop (all I2C and ADC access happens here) ---
void loop() {
  ArduinoOTA.handle();
  processSlewRate();
  readSensors();
  delay(1);
}
