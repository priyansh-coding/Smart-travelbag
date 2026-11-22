# Smart Travel Bag — API contract

One connection mode: **USB serial**. The ESP32 prints one JSON telemetry
object per line over USB serial; the dashboard backend reads the port and
hands the UI the validated state. The routes below describe the browser-facing
API (GET) plus the serial contract. Keep hostnames, ports, update intervals
and JSON field names in `dashboard/config.py` (or environment variables),
never hard-coded across files.

## Base URL

`http://<host>:5001` (default port 5001 — confirm against deployment).

## Authentication

Out of scope for the first release: the dashboard is a local-machine
prototype. It must never be exposed to the public internet without adding
authentication and secure transport first (see the PRD, risk register).

---

## Serial contract (ESP32 → dashboard)

**Firmware** — `firmware/main_esp32/esp32_main.ino` (UNVERIFIED skeleton):
prints one JSON object per line (`Serial.println`), every 1–3 seconds, over
USB serial at 115200 baud. The ESP32 DevKit V1 is connected to the machine
over USB — no Wi-Fi, no HTTP.

| Field | Type | Required | Range / rule |
|-------|------|----------|--------------|
| `device_id` | string | yes (defaults to the firmware's `smart-travel-bag-01`) | any string |
| `timestamp` | string | no | ISO-8601; echoed, not trusted |
| `seq` | number | no | monotonic sequence hint |
| `weight_kg` | number | no | `0..20` (bag capacity — configure) |
| `locked` | bool | no | controller's reported lock state |
| `bag_open` | bool | no | reed-switch state |
| `movement_detected` | bool | no | MPU6050 activity flag |
| `acceleration` | object/number | no | `{x,y,z,total}` m/s² or scalar |
| `distance_cm` | number | no | `0..400` |
| `gps` | object | no | `{valid, latitude (-90..90), longitude (-180..180), fix_time}` |
| `sensors` | object | no | module → state in `online/offline/not_tested/error` |
| `rfid_result` | string | no | `accepted` / `rejected` / `unknown` |
| `buzzer` | bool | no | controller's reported buzzer state |

**Validation (PRD §6.2)** — malformed JSON / wrong types / out-of-range
lines are rejected with an incrementing `parse_errors` count (the line is
never applied). Missing values are preserved as `null`/unknown, never
replaced with zeros. A `valid:true` fix without coordinates is degraded to
`valid:false`. A GPS fix is only displayed when `valid` is true **and**
coordinates are present.

**Events** — on every valid line, the backend compares the previous
state and generates events (`bag_opened`, `bag_closed`, `lock_changed`,
`movement_detected`, `rfid_accepted`, `rfid_rejected`, `buzzer_on`,
`gps_fix`, `gps_fix_lost`, `device_connected`), newest-first.

**Port selection** — the backend auto-detects the ESP32's serial port
(`/dev/ttyUSB*`, `/dev/ttyACM*`, `COM*`, …). Override with
`STB_SERIAL_PORT` / `STB_SERIAL_BAUD`. No port detected → OFFLINE, honestly.

---

## GET /

Serve the dashboard page (HTML). No auth, local machine only.

## GET /api/status

Latest device state plus staleness. The browser polls this endpoint every
`POLL_INTERVAL_MS`.

Shape only — every value below is a placeholder or `null`, not a reading:

```json
{
  "ok": true,
  "device": {
    "device_id": "<from the firmware>",
    "usb_port": "<serial port the worker is reading>",
    "received_at": <server epoch seconds>,
    "posted_at": "<device timestamp, echoed>",
    "seq": <sequence hint>,
    "age_s": <seconds since last telemetry>,
    "stale": <bool>,
    "connection": "online | stale | offline",
    "weight_kg": <number|null>,
    "locked": <bool|null>,
    "bag_open": <bool|null>,
    "movement_detected": <bool|null>,
    "acceleration": <{x,y,z,total}|null>,
    "distance_cm": <number|null>,
    "gps": { "valid": <bool>, "latitude": <number|null>, "longitude": <number|null>, "fix_time": <string|null> },
    "sensors": { "rfid": "online|offline|not_tested|error", "servo": "...", "hx711": "...", "mpu6050": "...", "reed_switch": "...", "ultrasonic": "...", "gps": "...", "buzzer": "...", "esp32_cam": "..." },
    "rfid_result": "accepted|rejected|unknown|null",
    "buzzer": <bool|null>,
    "events_count": <number>,
    "ai": <object|null>
  },
  "config": { "cameraUrl": null, "pollIntervalMs": 2000, "staleSeconds": 10.0 }
}
```

`connection` is one of `online` (fresh telemetry), `stale` (older than
`STB_STALE_SECONDS`), `offline` (never received). Nothing is ever presented
as live without one of these states.

## GET /api/connection

USB connection details for the ESP32 view. The dashboard polls this from
the ESP32 view only.

Shape only — every value below is a placeholder or `null`, not a reading:

```json
{
  "ok": true,
  "mode": "usb-serial",
  "connected": <bool>,
  "connection": "online | stale | offline",
  "device_id": "<from the firmware|null>",
  "usb_port": "<serial port|null>",
  "usb_device_name": "<USB device description|null>",
  "usb_vid_pid": "<VID:PID|null>",
  "usb_manufacturer": "<manufacturer|null>",
  "usb_serial_number": "<serial number|null>",
  "baud": <number>,
  "received_at": <server epoch seconds|null>,
  "posted_at": "<device timestamp|null>",
  "age_s": <number|null>,
  "seq": <number|null>,
  "stale_seconds": <number>,
  "modules_reported": <number>,
  "modules_total": 9,
  "parse_errors": <number>,
  "last_event": <event object|null>,
  "endpoint": {
    "description": "ESP32 prints one JSON telemetry object per line here",
    "test_command": "<copy-pasteable live-read command>"
  }
}
```

`usb_device_name` / `vid_pid` describe the **USB-serial adapter** (e.g. the
CH340/CP210x bridge) — never the firmware. `device_id` is the firmware's own
declared id. `endpoint.test_command` is copy-pasteable and reads the live
port (e.g. `cat /dev/ttyUSB0`).

## GET /api/events?limit=50

`{"ok": true, "events": [ {id, ts, type, message, severity, source}, ... ], "total": N}`

Newest-first, capped at `EVENTS_MAX` (100). `severity` ∈ `info/warning/critical`.

## GET /api/history

`{"ok": true, "history": [ {"ts": <epoch>, "weight_kg": <number>}, ... ] }`
Last N samples (default 240), oldest first.

## GET /api/health

`{"ok": true, "sensors": {module: state}, "unknown": [module,...], "counts": {...}, "total": 9}`

## POST /api/analyze

Forwards the current snapshot to the AI service.

Shape only — classification comes from the AI service, never from fixed text:

```json
{ "ok": true, "status": "ok", "error": null,
  "result": { "classification": "<SAFE|WARNING|ALERT|UNKNOWN>", "risk": "<risk level>", "explanation": "<reason>", "timestamp": "<ISO-8601>", "source": "ai-service" } }
```

Failure (AI service unreachable or unhelpful) → HTTP 503 with
`{"ok": false, "status": "unavailable", "error": "...", "result": null}`.
The UI must never show SAFE in this case.

The reference AI server (`ai_server/ai_server.py`) implements `POST /analyze`
with a deterministic, advisory rule set. It is **not** a trained model and
not a theft detector.

## GET /api/config

Public, non-secret configuration for the frontend:
`cameraUrl`, `pollIntervalMs`, `healthPollMs`, `staleSeconds`,
`maxWeightKg`, `maxDistanceCm`.

---

## Event types

| type | severity | when |
|------|----------|------|
| device_connected | info | first telemetry seen from a device |
| bag_opened | critical | reed switch → open |
| bag_closed | info | reed switch → closed |
| lock_changed | info/warning | lock state flips (warning when UNLOCKED) |
| movement_detected | warning | MPU6050 above threshold (rising edge) |
| rfid_accepted | info | tag authenticated |
| rfid_rejected | critical | tag rejected |
| buzzer_on | warning | controller reported buzzer |
| gps_fix | info | valid fix acquired |
| gps_fix_lost | warning | valid fix lost |
