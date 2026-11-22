// =====================================================================
// Smart Travel Bag — ESP32 DevKit V1 firmware (SKELETON)
// =====================================================================
// Status: UNVERIFIED — placeholder skeleton.
// One connection mode: USB serial. The firmware prints ONE JSON telemetry
// object per line over USB serial (Serial.println) at 115200 baud.
// The dashboard reads the port, validates the payload, and updates the screen.
// Nothing here is trusted until tested on the physical prototype.
// ---------------------------------------------------------------------
// Required libraries (Arduino IDE):
//   - Serial + Wire (built-in)
//   - HX711, MPU6050, RF522 (RC522), GPS via TinyGPS++
// ---------------------------------------------------------------------
// Payload contract: docs/api_contract.md (one JSON object per line).
// Keep the JSON builder in ONE function so field names never drift.
// =====================================================================

// ---- Configuration (DO NOT COMMIT REAL SECRETS) ---------------------
// DEVICE_ID is safe to commit. Never commit Wi-Fi credentials, tokens
// or other secrets here — .env / *.credentials / *.secrets are git-ignored.
const char* DEVICE_ID = "smart-travel-bag-01";

#define SERIAL_BAUD 115200
const unsigned long TELEMETRY_INTERVAL_MS = 2000;   // 1–3 s target

// ---- Globals ---------------------------------------------------------
unsigned long lastTelemetryMs = 0;
long sequence = 0;

// TODO: include/declare sensor objects here (HX711, MPU6050, GPS, RFID)
// TODO: define GPIO pins per the confirmed pin map (see docs/hardware_checklist.md)

void setup() {
  Serial.begin(SERIAL_BAUD);
  // TODO: init I2C / SPI sensors
  // TODO: init buzzer, relay/servo driver (external regulated 5 V!)
}

void loop() {
  // TODO: read sensors (weight, lock, bag_open, movement, distance, GPS, RFID)
  unsigned long now = millis();
  if (now - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = now;
    String json = buildTelemetryJson();
    if (json.length() > 0) {
      Serial.println(json);   // ONE JSON object per line — the dashboard's USB link
    }
  }
}

// ---- Helpers ---------------------------------------------------------
String buildTelemetryJson() {
  // TODO: build the JSON from real sensor readings only.
  // Missing readings are reported as null, never as zeros.
  // The payload must match docs/api_contract.md:
  //   { "device_id": "<DEVICE_ID>", "timestamp": "<ISO-8601|null>", "seq": <int>,
  //     "weight_kg": <float|null>, "locked": <bool|null>, "bag_open": <bool|null>,
  //     "movement_detected": <bool|null>, "distance_cm": <float|null>,
  //     "gps": { "valid": <bool>, "latitude": <float|null>,
  //              "longitude": <float|null>, "fix_time": <string|null> },
  //     "sensors": { "rfid": "online", ... },
  //     "rfid_result": "accepted" | "rejected" | "unknown" | null,
  //     "buzzer": <bool|null> }
  return "";   // nothing sent until the real loop is implemented
}
