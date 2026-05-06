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

// --- HV Feedback Calibration ---
// Adjust these after measuring with a known reference.
// output_kV = (adc_volts * gain) + offset
float hv1_gain = 1000.0;     // Default 1V = 1000V
float hv1_offset = 0.0;
float hv2_gain = 1000.0;
float hv2_offset = 0.0;
unsigned long ramp_interval = 4;    // ~1s for full 0-255 sweep

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

// Cached sensor values
volatile float poe_voltage  = 0;
volatile float poe_current  = 0;
volatile float hv1_feedback = 0;
volatile float hv2_feedback = 0;
bool ina_ok        = false;
bool eth_connected = false;
unsigned long lastSensorRead = 0;
unsigned long uptime_seconds = 0;

const unsigned long SENSOR_INTERVAL = 500; // Read sensors every 500ms

// --- AD5282 Digital Pot Driver ---
void updateHardwarePot(uint8_t channel, uint8_t value) {
  Wire.beginTransmission(0x2C);
  Wire.write(channel == 0 ? 0x00 : 0x10);  // RDAC1 = 0x00, RDAC2 = 0x10
  Wire.write(value);
  Wire.endTransmission();
}

// --- Slew Rate Controller ---
void processSlewRate() {
  unsigned long now = millis();

  if (ch1.current != ch1.target && now - ch1.lastStep > ramp_interval) {
    if (ch1.current < ch1.target) ch1.current++;
    else ch1.current--;
    updateHardwarePot(0, ch1.current);
    ch1.lastStep = now;
  }

  if (ch2.current != ch2.target && now - ch2.lastStep > ramp_interval) {
    if (ch2.current < ch2.target) ch2.current++;
    else ch2.current--;
    updateHardwarePot(1, ch2.current);
    ch2.lastStep = now;
  }
}

// --- Sensor Read ---
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

  // Log telemetry
  Serial.printf("[HVPS] CH1: %.2f kV | CH2: %.2f kV | PoE: %.2fV @ %.2fA\n", 
    (hv1_feedback * hv1_gain + hv1_offset) / 1000.0, 
    (hv2_feedback * hv2_gain + hv2_offset) / 1000.0, 
    poe_voltage, poe_current);
}

// --- CORS helper ---
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
      Serial.printf("[ETH] IP: %s\n", ETH.localIP().toString().c_str());
      eth_connected = true;
      if (MDNS.begin("hvps")) {
        MDNS.addService("http", "tcp", 80);
      }
      break;
    case ARDUINO_EVENT_ETH_DISCONNECTED:
      eth_connected = false;
      break;
    default:
      break;
  }
}

// --- Dashboard HTML (Minimal version for emergency access) ---
const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE HTML><html>
<head><title>HVPS Emergency Dashboard</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body><h1>KORSTMOS HVPS v1.1.0</h1><p>Emergency access only. Use the main dashboard for control.</p></body>
</html>
)rawliteral";

void setup() {
  Serial.begin(115200);
  Serial.printf("\n[HVPS] Firmware v%s\n", FW_VERSION);

  WiFi.onEvent(onEthEvent);
  Wire.begin(I2C_SDA, I2C_SCL);
  ETH.begin();

  ina_ok = INA.begin();
  if (ina_ok) INA.setMaxCurrentShunt(2.0, 0.01);

  updateHardwarePot(0, ch1.current);
  updateHardwarePot(1, ch2.current);

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *req) {
    auto *resp = req->beginResponse_P(200, "text/html", index_html);
    addCorsHeaders(resp);
    req->send(resp);
  });

  server.onNotFound([](AsyncWebServerRequest *req) {
    if (req->method() == HTTP_OPTIONS) {
      auto *resp = req->beginResponse(200);
      addCorsHeaders(resp);
      req->send(resp);
    } else {
      req->send(404, "text/plain", "Not found");
    }
  });

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
    doc["hv1g"] = hv1_gain;
    doc["hv1o"] = hv1_offset;
    doc["hv2g"] = hv2_gain;
    doc["hv2o"] = hv2_offset;
    String res;
    serializeJson(doc, res);
    auto *resp = req->beginResponse(200, "application/json", res);
    addCorsHeaders(resp);
    req->send(resp);
  });

  // POST /set for Voltage Control (RDAC)
  server.on("/set", HTTP_POST, [](AsyncWebServerRequest *req) {
    if (!req->hasParam("pot", true) || !req->hasParam("val", true)) {
      auto *resp = req->beginResponse(400, "text/plain", "Missing pot/val");
      addCorsHeaders(resp);
      req->send(resp);
      return;
    }
    int p = req->getParam("pot", true)->value().toInt();
    int v = constrain(req->getParam("val", true)->value().toInt(), 0, 255);
    if (p == 1) ch1.target = v;
    else if (p == 2) ch2.target = v;
    auto *resp = req->beginResponse(200, "text/plain", "OK");
    addCorsHeaders(resp);
    req->send(resp);
  });

  // GET /set for Calibration Only
  server.on("/set", HTTP_GET, [](AsyncWebServerRequest *request){
    bool updated = false;
    if (request->hasParam("ratio1")) { hv1_gain = request->getParam("ratio1")->value().toFloat(); updated = true; }
    if (request->hasParam("ratio2")) { hv2_gain = request->getParam("ratio2")->value().toFloat(); updated = true; }
    if (request->hasParam("offset1")) { hv1_offset = request->getParam("offset1")->value().toFloat(); updated = true; }
    if (request->hasParam("offset2")) { hv2_offset = request->getParam("offset2")->value().toFloat(); updated = true; }
    if (request->hasParam("ramp")) { ramp_interval = request->getParam("ramp")->value().toInt(); updated = true; }
    
    if (updated) {
      auto *resp = request->beginResponse(200, "text/plain", "Calibration Updated");
      addCorsHeaders(resp);
      request->send(resp);
    } else {
      auto *resp = request->beginResponse(405, "text/plain", "Use POST /set for voltage control");
      addCorsHeaders(resp);
      request->send(resp);
    }
  });

  server.on("/info", HTTP_GET, [](AsyncWebServerRequest *req) {
    JsonDocument doc;
    doc["fw"] = FW_VERSION;
    doc["mac"] = ETH.macAddress();
    doc["ip"] = ETH.localIP().toString();
    doc["uptime"] = uptime_seconds;
    String res;
    serializeJson(doc, res);
    auto *resp = req->beginResponse(200, "application/json", res);
    addCorsHeaders(resp);
    req->send(resp);
  });

  server.begin();
}

void loop() {
  processSlewRate();
  readSensors();
  delay(1);
}
