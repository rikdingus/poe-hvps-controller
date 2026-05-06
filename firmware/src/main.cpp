#include <Arduino.h>
#include <ETH.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <Wire.h>
#include <INA226.h>
#include <ArduinoJson.h>
#include <ESPmDNS.h>

// --- Firmware Info ---
#define FW_VERSION "1.1.0"

// --- Hardware Pins (Olimex ESP32-POE-ISO-IND) ---
#define I2C_SDA 13
#define I2C_SCL 16
#define ADC_HV1 32
#define ADC_HV2 33

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
volatile float poe_voltage  = 0;
volatile float poe_current  = 0;
volatile float hv1_feedback = 0;
volatile float hv2_feedback = 0;
bool ina_ok        = false;
bool eth_connected = false;
unsigned long lastSensorRead = 0;
unsigned long uptime_seconds = 0;

const unsigned long RAMP_INTERVAL   = 4;    // ~1 s for full 0–255 sweep
const unsigned long SENSOR_INTERVAL = 500;  // Read sensors every 500 ms

// --- AD5282 Digital Pot Driver ---
void updateHardwarePot(uint8_t channel, uint8_t value) {
  Wire.beginTransmission(0x2C);
  Wire.write(channel == 0 ? 0x00 : 0x10);  // RDAC1 = 0x00, RDAC2 = 0x10 (RS bit)
  Wire.write(value);
  Wire.endTransmission();
}

// --- Slew Rate Controller ---
void processSlewRate() {
  unsigned long now = millis();

  if (ch1.current != ch1.target && now - ch1.lastStep > RAMP_INTERVAL) {
    if (ch1.current < ch1.target) ch1.current++;
    else ch1.current--;
    updateHardwarePot(0, ch1.current);
    ch1.lastStep = now;
  }

  if (ch2.current != ch2.target && now - ch2.lastStep > RAMP_INTERVAL) {
    if (ch2.current < ch2.target) ch2.current++;
    else ch2.current--;
    updateHardwarePot(1, ch2.current);
    ch2.lastStep = now;
  }
}

// --- Sensor Read (loop-only — keeps I2C single-tasked) ---
void readSensors() {
  if (millis() - lastSensorRead < SENSOR_INTERVAL) return;
  lastSensorRead = millis();

  if (ina_ok) {
    poe_voltage = INA.getBusVoltage();
    poe_current = INA.getCurrent();
  }
  hv1_feedback = analogReadMilliVolts(ADC_HV1) / 1000.0f;
  hv2_feedback = analogReadMilliVolts(ADC_HV2) / 1000.0f;
  uptime_seconds = millis() / 1000;
}

// --- CORS helper — add to every response so browser dev-tools work ---
void addCorsHeaders(AsyncWebServerResponse* response) {
  response->addHeader("Access-Control-Allow-Origin",  "*");
  response->addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response->addHeader("Access-Control-Allow-Headers", "Content-Type");
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

// --- Dashboard HTML (PROGMEM — no filesystem needed) ---
const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE HTML><html>
<head>
  <title>HVPS Controller</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root { --bg:#0f172a; --card:#1e293b; --accent:#38bdf8; --text:#f8fafc; --err:#ef4444; --warn:#f59e0b; --ok:#22c55e; }
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:sans-serif;background:var(--bg);color:var(--text);padding:20px}
    .container{max-width:860px;margin:auto}
    .header{text-align:center;margin-bottom:28px}
    .header h1{font-weight:300;letter-spacing:3px;color:var(--accent);font-size:1.6rem}
    .header p{font-size:.65rem;color:#64748b;margin-top:4px;letter-spacing:.1em}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    .card{background:var(--card);padding:20px;border-radius:14px;box-shadow:0 8px 16px rgba(0,0,0,.35)}
    .card h2{font-size:.72rem;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin-bottom:8px}
    .value{font-size:2rem;font-weight:700;margin:8px 0}
    .unit{font-size:.8rem;color:#64748b;margin-left:4px}
    .slider-box{margin-top:16px}
    input[type=range]{width:100%;height:7px;border-radius:4px;background:#334155;outline:none;-webkit-appearance:none;cursor:pointer}
    input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:var(--accent);cursor:pointer}
    .status{font-size:.65rem;text-align:right;margin-top:8px;color:#64748b}
    .badge{padding:3px 7px;border-radius:4px;font-size:.65rem;float:right;background:var(--ok);color:#fff}
    .badge.error{background:var(--err)}
    .badge.warn{background:var(--warn);color:#1d1d1b}
    .ramp{font-size:.65rem;color:var(--warn);display:none;margin-top:4px}
    .footer{text-align:center;margin-top:24px;font-size:.6rem;color:#334155;letter-spacing:.1em}
    @media(max-width:600px){.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>POE HVPS CONTROLLER</h1>
    <p id="ip-line">Connecting…</p>
  </div>
  <div class="grid">
    <div class="card">
      <h2>POE POWER <span id="p-status" class="badge">ONLINE</span></h2>
      <div class="value" id="voltage">0.00<span class="unit">V</span></div>
      <div class="value" id="current">0.000<span class="unit">A</span></div>
    </div>
    <div class="card">
      <h2>HV FEEDBACK (1V = 1000V)</h2>
      <div class="value" id="hv1">0<span class="unit">V</span></div>
      <div class="value" id="hv2">0<span class="unit">V</span></div>
    </div>
    <div class="card">
      <h2>HVPS CHANNEL 1</h2>
      <div class="slider-box">
        <input type="range" id="pot1" min="0" max="255" value="127">
      </div>
      <div class="status">Target: <span id="val1">127</span> | Actual: <span id="cur1">—</span></div>
      <div class="ramp" id="ramp1">⏳ Ramping…</div>
    </div>
    <div class="card">
      <h2>HVPS CHANNEL 2</h2>
      <div class="slider-box">
        <input type="range" id="pot2" min="0" max="255" value="127">
      </div>
      <div class="status">Target: <span id="val2">127</span> | Actual: <span id="cur2">—</span></div>
      <div class="ramp" id="ramp2">⏳ Ramping…</div>
    </div>
  </div>
  <div class="footer" id="footer">fw v— · hvps.local</div>
</div>
<script>
  // Debounce so we don't spam POST on every pixel of slider movement
  let debounceTimers = {};
  function updatePot(pot, val) {
    document.getElementById('val' + pot).textContent = val;
    clearTimeout(debounceTimers[pot]);
    debounceTimers[pot] = setTimeout(() => {
      // POST /set  body: pot=N&val=V
      // Using POST because this is a state-changing operation.
      fetch('/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'pot=' + pot + '&val=' + val
      }).catch(() => {});  // fire-and-forget; status poll will show divergence
    }, 80);
  }

  document.getElementById('pot1').addEventListener('input', e => updatePot(1, e.target.value));
  document.getElementById('pot2').addEventListener('input', e => updatePot(2, e.target.value));

  let firstLoad = true;

  function poll() {
    fetch('/status').then(r => r.json()).then(d => {
      document.getElementById('voltage').innerHTML = d.v.toFixed(2) + '<span class="unit">V</span>';
      document.getElementById('current').innerHTML = d.i.toFixed(3) + '<span class="unit">A</span>';
      // 1 V on ADC = 1000 V on HV rail; show as integer volts
      document.getElementById('hv1').innerHTML = Math.round(d.hv1 * 1000) + '<span class="unit">V</span>';
      document.getElementById('hv2').innerHTML = Math.round(d.hv2 * 1000) + '<span class="unit">V</span>';

      const st = document.getElementById('p-status');
      if (!d.ok) { st.textContent = 'SENSOR ERR'; st.className = 'badge error'; }
      else        { st.textContent = 'ONLINE';     st.className = 'badge'; }

      document.getElementById('cur1').textContent = d.c1;
      document.getElementById('cur2').textContent = d.c2;
      document.getElementById('ramp1').style.display = (d.p1 !== d.c1) ? 'block' : 'none';
      document.getElementById('ramp2').style.display = (d.p2 !== d.c2) ? 'block' : 'none';

      // Sync sliders to server state only once (avoids fighting the user mid-drag)
      if (firstLoad) {
        document.getElementById('pot1').value = d.p1;
        document.getElementById('val1').textContent = d.p1;
        document.getElementById('pot2').value = d.p2;
        document.getElementById('val2').textContent = d.p2;
        firstLoad = false;
      }
    }).catch(() => {
      const st = document.getElementById('p-status');
      st.textContent = 'OFFLINE'; st.className = 'badge error';
    });
  }

  // Fetch /info once to populate footer with IP + FW version
  fetch('/info').then(r => r.json()).then(d => {
    document.getElementById('ip-line').textContent = d.ip || 'hvps.local';
    document.getElementById('footer').textContent = 'fw v' + d.fw + ' · MAC ' + d.mac + ' · http://hvps.local';
  }).catch(() => {});

  setInterval(poll, 1000);
  poll();
</script>
</body>
</html>
)rawliteral";

// --- Setup ---
void setup() {
  Serial.begin(115200);
  Serial.printf("\n[HVPS] Firmware v%s\n", FW_VERSION);

  WiFi.onEvent(onEthEvent);
  Wire.begin(I2C_SDA, I2C_SCL);
  ETH.begin();

  ina_ok = INA.begin();
  if (ina_ok) {
    INA.setMaxCurrentShunt(2.0, 0.01);
    Serial.println("[INA226] OK");
  } else {
    Serial.println("[INA226] NOT FOUND — power monitoring disabled");
  }

  updateHardwarePot(0, ch1.current);
  updateHardwarePot(1, ch2.current);

  // ---- Route: GET /  (dashboard) ----------------------------------------
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *req) {
    auto *resp = req->beginResponse_P(200, "text/html", index_html);
    addCorsHeaders(resp);
    req->send(resp);
  });

  // ---- Route: OPTIONS * (preflight for CORS) ----------------------------
  // Browsers send an OPTIONS preflight before cross-origin POSTs.
  server.onNotFound([](AsyncWebServerRequest *req) {
    if (req->method() == HTTP_OPTIONS) {
      auto *resp = req->beginResponse(200);
      addCorsHeaders(resp);
      req->send(resp);
    } else {
      req->send(404, "text/plain", "Not found");
    }
  });

  // ---- Route: GET /status -----------------------------------------------
  server.on("/status", HTTP_GET, [](AsyncWebServerRequest *req) {
    JsonDocument doc;
    doc["v"]   = poe_voltage;
    doc["i"]   = poe_current;
    doc["hv1"] = hv1_feedback;
    doc["hv2"] = hv2_feedback;
    doc["p1"]  = ch1.target;
    doc["p2"]  = ch2.target;
    doc["c1"]  = ch1.current;
    doc["c2"]  = ch2.current;
    doc["ok"]  = ina_ok;
    String res;
    serializeJson(doc, res);
    auto *resp = req->beginResponse(200, "application/json", res);
    addCorsHeaders(resp);
    req->send(resp);
  });

  // ---- Route: POST /set  body: pot=1&val=200 ----------------------------
  // Changed from GET to POST (v1.1.0) — state-changing operations should use POST.
  // The dashboard JS was updated accordingly.  A GET /set still responds with a
  // 405 so existing scripts get a clear error rather than silently doing nothing.
  server.on("/set", HTTP_POST, [](AsyncWebServerRequest *req) {
    if (!req->hasParam("pot", true) || !req->hasParam("val", true)) {
      auto *resp = req->beginResponse(400, "text/plain", "Missing parameters");
      addCorsHeaders(resp);
      req->send(resp);
      return;
    }
    int p = req->getParam("pot", true)->value().toInt();
    int v = constrain(req->getParam("val", true)->value().toInt(), 0, 255);
    if (p == 1) {
      ch1.target = v;
      auto *resp = req->beginResponse(200, "text/plain", "OK");
      addCorsHeaders(resp);
      req->send(resp);
    } else if (p == 2) {
      ch2.target = v;
      auto *resp = req->beginResponse(200, "text/plain", "OK");
      addCorsHeaders(resp);
      req->send(resp);
    } else {
      auto *resp = req->beginResponse(400, "text/plain", "Invalid channel (1 or 2)");
      addCorsHeaders(resp);
      req->send(resp);
    }
  });

  // Reject old GET /set with 405 Method Not Allowed
  server.on("/set", HTTP_GET, [](AsyncWebServerRequest *req) {
    auto *resp = req->beginResponse(405, "text/plain", "Use POST /set");
    addCorsHeaders(resp);
    req->send(resp);
  });

  // ---- Route: GET /info -------------------------------------------------
  server.on("/info", HTTP_GET, [](AsyncWebServerRequest *req) {
    JsonDocument doc;
    doc["fw"]          = FW_VERSION;
    doc["uptime"]      = uptime_seconds;
    doc["mac"]         = ETH.macAddress();
    doc["ip"]          = ETH.localIP().toString();
    doc["eth"]         = eth_connected;
    doc["ina"]         = ina_ok;
    doc["ch1_target"]  = ch1.target;
    doc["ch1_current"] = ch1.current;
    doc["ch2_target"]  = ch2.target;
    doc["ch2_current"] = ch2.current;
    String res;
    serializeJson(doc, res);
    auto *resp = req->beginResponse(200, "application/json", res);
    addCorsHeaders(resp);
    req->send(resp);
  });

  server.begin();
  Serial.println("[HTTP] Server started");
}

// --- Main Loop (all I2C and ADC access happens here) ---
void loop() {
  processSlewRate();
  readSensors();
  delay(1);
}
