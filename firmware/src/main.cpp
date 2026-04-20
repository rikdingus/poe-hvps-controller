#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <Wire.h>
#include <INA226.h>
#include <ArduinoJson.h>

// --- Configuration ---
const char* ssid = "HVPS_Controller_AP";
const char* password = "password123";

// Pins
#define I2C_SDA 8
#define I2C_SCL 9
#define ADC_HV1 1
#define ADC_HV2 2

// Devices
INA226 INA(0x40);
AsyncWebServer server(80);

// State
float poe_voltage = 0;
float poe_current = 0;
float hv1_feedback = 0;
float hv2_feedback = 0;
int pot1_pos = 127;
int pot2_pos = 127;

// --- AD5282 Digital Pot Driver ---
void setPot(uint8_t channel, uint8_t value) {
  Wire.beginTransmission(0x2C); // Standard AD5282 address
  Wire.write(channel == 0 ? 0x00 : 0x80); // Channel selection
  Wire.write(value);
  Wire.endTransmission();
}

// --- Dashboard HTML ---
const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE HTML><html>
<head>
  <title>HVPS Controller</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.7.2/css/all.css">
  <style>
    :root { --bg: #0f172a; --card: #1e293b; --accent: #38bdf8; --text: #f8fafc; }
    body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { font-weight: 300; letter-spacing: 2px; color: var(--accent); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .card { background: var(--card); padding: 20px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); }
    .card h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-top: 0; }
    .value { font-size: 2.5rem; font-weight: 600; margin: 10px 0; }
    .unit { font-size: 1rem; color: #64748b; margin-left: 5px; }
    .slider-box { margin-top: 20px; }
    input[type=range] { width: 100%; height: 8px; border-radius: 5px; background: #334155; outline: none; -webkit-appearance: none; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: var(--accent); cursor: pointer; border: none; }
    .status { font-size: 0.7rem; text-align: right; margin-top: 10px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>POE HVPS CONTROLLER</h1>
    </div>
    
    <div class="grid">
      <!-- Power Card -->
      <div class="card">
        <h2>POE POWER INPUT</h2>
        <div class="value" id="voltage">0.00<span class="unit">V</span></div>
        <div class="value" id="current">0.00<span class="unit">A</span></div>
      </div>
      
      <!-- Telemetry Card -->
      <div class="card">
        <h2>HV FEEDBACK (1V/1000V)</h2>
        <div class="value" id="hv1">0<span class="unit">V</span></div>
        <div class="value" id="hv2">0<span class="unit">V</span></div>
      </div>
      
      <!-- Control 1 -->
      <div class="card">
        <h2>HVPS CHANNEL 1</h2>
        <div class="slider-box">
          <input type="range" id="pot1" min="0" max="255" value="127" oninput="updatePot(1, this.value)">
        </div>
        <div class="status">Setting: <span id="val1">127</span> / 255</div>
      </div>
      
      <!-- Control 2 -->
      <div class="card">
        <h2>HVPS CHANNEL 2</h2>
        <div class="slider-box">
          <input type="range" id="pot2" min="0" max="255" value="127" oninput="updatePot(2, this.value)">
        </div>
        <div class="status">Setting: <span id="val2">127</span> / 255</div>
      </div>
    </div>
  </div>

  <script>
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
      });
    }, 1000);
  </script>
</body>
</html>
)rawliteral";

// --- Setup & Loop ---
void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA, I2C_SCL);

  // Initialize INA226
  if (!INA.begin()) {
    Serial.println("Could not find INA226");
  } else {
    INA.setMaxCurrentShunt(2.0, 0.01); // 2A max, 10mOhm shunt
  }

  // WiFi
  WiFi.softAP(ssid, password);
  Serial.print("IP address: ");
  Serial.println(WiFi.softAPIP());

  // Routes
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send_P(200, "text/html", index_html);
  });

  server.on("/status", HTTP_GET, [](AsyncWebServerRequest *request){
    JsonDocument doc;
    doc["v"] = INA.getBusVoltage();
    doc["i"] = INA.getCurrent();
    doc["hv1"] = analogReadMilliVolts(ADC_HV1) / 1000.0;
    doc["hv2"] = analogReadMilliVolts(ADC_HV2) / 1000.0;
    String res;
    serializeJson(doc, res);
    request->send(200, "application/json", res);
  });

  server.on("/set", HTTP_GET, [](AsyncWebServerRequest *request){
    if (request->hasParam("pot") && request->hasParam("val")) {
      int p = request->getParam("pot")->value().toInt();
      int v = request->getParam("val")->value().toInt();
      setPot(p == 1 ? 0 : 1, v);
      request->send(200, "text/plain", "OK");
    }
  });

  server.begin();
}

void loop() {
  // Free for telemetry logging or watchdog
  delay(10);
}
