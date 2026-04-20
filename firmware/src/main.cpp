#include <Arduino.h>
#include <ETH.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <Wire.h>
#include <INA226.h>
#include <ArduinoJson.h>

// --- Hardware Pins (Olimex ESP32-POE Layout) ---
#define I2C_SDA 13
#define I2C_SCL 16
#define ADC_HV1 32
#define ADC_HV2 33

// Ethernet Config for Olimex ESP32-POE
#define ETH_PHY_TYPE  ETH_PHY_LAN8720
#define ETH_PHY_ADDR  0
#define ETH_PHY_MDC   23
#define ETH_PHY_MDIO  18
#define ETH_PHY_POWER 12
#define ETH_CLK_MODE  ETH_CLOCK_GPIO17_OUT

// --- Devices ---
INA226 INA(0x40);
AsyncWebServer server(80);

// --- State & Slew Rate ---
struct Channel {
  uint8_t target = 127;
  uint8_t current = 127;
  unsigned long lastStep = 0;
  float feedback = 0;
};

Channel ch1, ch2;
float poe_voltage = 0;
float poe_current = 0;
bool ina_ok = false;

const unsigned long RAMP_INTERVAL = 4; // ~1 second for 0-255 sweep (256 * 4ms = 1024ms)

// --- AD5282 Digital Pot Driver ---
void updateHardwarePot(uint8_t channel, uint8_t value) {
  Wire.beginTransmission(0x2C);
  Wire.write(channel == 0 ? 0x00 : 0x10); // RDAC1 = 0x00, RDAC2 = 0x10
  Wire.write(value);
  Wire.endTransmission();
}

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

// --- Dashboard HTML (No external CDNs) ---
const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE HTML><html>
<head>
  <title>HVPS Controller</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root { --bg: #0f172a; --card: #1e293b; --accent: #38bdf8; --text: #f8fafc; --err: #ef4444; }
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
        <div class="status">Setting: <span id="val1">--</span> / 255</div>
      </div>
      <div class="card">
        <h2>HVPS CHANNEL 2</h2>
        <div class="slider-box"><input type="range" id="pot2" min="0" max="255" oninput="updatePot(2, this.value)"></div>
        <div class="status">Setting: <span id="val2">--</span> / 255</div>
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
        document.getElementById('hv1').innerHTML = Math.round(data.hv1 * 1000) + '<span class="unit">V</span>';
        document.getElementById('hv2').innerHTML = Math.round(data.hv2 * 1000) + '<span class="unit">V</span>';
        const st = document.getElementById('p-status');
        if(!data.ok) { st.innerHTML = 'ERROR'; st.className = 'badge error'; }
        else { st.innerHTML = 'ONLINE'; st.className = 'badge'; }
        if(firstLoad) {
          document.getElementById('pot1').value = data.p1; document.getElementById('val1').innerHTML = data.p1;
          document.getElementById('pot2').value = data.p2; document.getElementById('val2').innerHTML = data.p2;
          firstLoad = false;
        }
      });
    }, 1000);
  </script>
</body>
</html>
)rawliteral";

void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA, I2C_SCL);

  // Ethernet Initialization
  ETH.begin(ETH_PHY_ADDR, ETH_PHY_POWER, ETH_PHY_MDC, ETH_PHY_MDIO, ETH_PHY_TYPE, ETH_CLK_MODE);
  
  // INA226 Initialization
  ina_ok = INA.begin();
  if (ina_ok) INA.setMaxCurrentShunt(2.0, 0.01);

  // Web Server Routes
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send_P(200, "text/html", index_html);
  });

  server.on("/status", HTTP_GET, [](AsyncWebServerRequest *request){
    JsonDocument doc;
    doc["v"] = INA.getBusVoltage();
    doc["i"] = INA.getCurrent();
    doc["hv1"] = analogReadMilliVolts(ADC_HV1) / 1000.0;
    doc["hv2"] = analogReadMilliVolts(ADC_HV2) / 1000.0;
    doc["p1"] = ch1.target;
    doc["p2"] = ch2.target;
    doc["ok"] = ina_ok;
    String res;
    serializeJson(doc, res);
    request->send(200, "application/json", res);
  });

  server.on("/set", HTTP_GET, [](AsyncWebServerRequest *request){
    if (request->hasParam("pot") && request->hasParam("val")) {
      int p = request->getParam("pot")->value().toInt();
      int v = constrain(request->getParam("val")->value().toInt(), 0, 255);
      if (p == 1) ch1.target = v;
      else if (p == 2) ch2.target = v;
      request->send(200, "text/plain", "OK");
    } else {
      request->send(400, "text/plain", "Bad Request");
    }
  });

  server.begin();
}

void loop() {
  processSlewRate();
  delay(1);
}
