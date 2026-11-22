// =====================================================================
// Smart Travel Bag — ESP32 DevKit V1 firmware (SKELETON)
// =====================================================================
// Status: UNVERIFIED — placeholder skeleton.
// Every sensor/actuator path must be tested on the physical prototype
// before this sketch is trusted or marked operational. No values here
// should be assumed to be live.
// ---------------------------------------------------------------------
// Required libraries (Arduino IDE):
//   - Wire, SPI, WiFi, HTTPClient (built-in)
//   - HX711, MPU6050, RF522 (RC522), GPS via TinyGPS++ (Arduino)
// ---------------------------------------------------------------------
// Payload contract: see docs/api_contract.md (POST /api/update).
// Keep the JSON builder in ONE function so field names never drift.
// =====================================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>

// ---- Configuration (DO NOT COMMIT REAL SECRETS) ---------------------
// Replace with your own values locally; keep these in a git-ignored
// credential file. Never commit Wi-Fi passwords or device credentials.
const char* WIFI_SSID = "YOUR_SSID";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";
const char* DASHBOARD_HOST = "<dashboard-host>";   // local dashboard server (replace with your machine IP)
const int   DASHBOARD_PORT = 5001;
const char* DASHBOARD_UPDATE_PATH = "/api/update";

const unsigned long TELEMETRY_INTERVAL_MS = 2000;   // 1–3 s target

// ---- Globals ---------------------------------------------------------
unsigned long lastTelemetryMs = 0;
long sequence = 0;

// TODO: include/declare sensor objects here (HX711, MPU6050, GPS, RFID)
// TODO: define GPIO pins per the confirmed pin map (see docs/hardware_checklist.md)

void setup() {
  Serial.begin(115200);
  // TODO: init I2C / SPI sensors
  // TODO: init buzzer, relay/servo driver (external regulated 5 V!)
  // TODO: init WiFi
}

void loop() {
  // TODO: WiFi connection + watchdog
  // TODO: read sensors (weight, lock, bag_open, movement, distance, GPS)
  // TODO: POST telemetry every TELEMETRY_INTERVAL_MS
  //
  // The JSON must contain the fields from docs/api_contract.md. Missing
  // readings are reported as null, never as zeros:
  //   { "device_id": "smart-travel-bag-01", "timestamp": "...",
  //     "weight_kg": <float|null>, "locked": <bool|null>, ... }
}

// ---- Helpers ---------------------------------------------------------
String buildTelemetryJson() {
  // TODO: build the JSON from real sensor readings only.
  // Return "" if no valid readings are available.
  return "";
}

void sendTelemetry(const String& json) {
  if (json.length() == 0) return;
  HTTPClient http;
  String url = "http://" + String(DASHBOARD_HOST) + ":" + String(DASHBOARD_PORT)
               + DASHBOARD_UPDATE_PATH;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(json);
  if (code > 0) {
    Serial.printf("Telemetry sent (HTTP %d)\n", code);
  } else {
    Serial.printf("Telemetry failed (%s)\n", http.errorToString(code).c_str());
  }
  http.end();
}
