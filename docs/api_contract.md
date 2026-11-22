# Smart Travel Bag — API contract

The route names below are the proposed contract for the dashboard. They are
the shape of the integration, **not** a claim that these endpoints exist in
any particular release. Keep hostnames, ports, update intervals and JSON
field names in `dashboard/config.py` (or environment variables), never
hard-coded across files.

## Base URL

`http://<host>:5001` (default port 5001 — confirm against deployment).

## Authentication

Out of scope for the first release: the dashboard is a local-network
prototype. It must never be exposed to the public internet without adding
authentication and secure transport first (see the PRD, risk register).

---

## GET /

Serve the dashboard page (HTML). No auth, local network only.

## GET /api/status

Latest device state plus staleness. The browser polls this endpoint.

Shape only — every value below is a placeholder or `null`, not a reading.
Tags (`<...>`) mark where the real value comes from:

```json
{
  "ok": true,
  "device": {
    "device_id": "<from the firmware>",
    "source_ip": "<ip of the ESP32>",
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

## POST /api/update

Receive ESP32 telemetry (the ingestion endpoint).

**Request** — JSON object, schema below. `Content-Type: application/json`.

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
values → HTTP 400 with `{"ok": false, "error": "<reason>"}`. Missing values
are preserved as `null`/unknown, never replaced with zeros. A `valid:true`
fix without coordinates is degraded to `valid:false`. A GPS fix is only
displayed when `valid` is true **and** coordinates are present.

**Response** — `200 {"ok": true, "device_id": "...", "received_at": <epoch>}`.

**Events** — on a successful update, the backend compares the previous
state and generates events (`bag_opened`, `bag_closed`, `lock_changed`,
`movement_detected`, `rfid_accepted`, `rfid_rejected`, `buzzer_on`,
`gps_fix`, `gps_fix_lost`), newest-first.

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

## GET /api/connection

ESP32 connection details for the ESP32 view:

Shape only — every value below is a placeholder or `null`, not a reading:

```json
{
  "ok": true,
  "connected": <bool>,
  "connection": "online | stale | offline",
  "device_id": "<from the firmware|null>",
  "source_ip": "<ip of the ESP32|null>",
  "received_at": <server epoch seconds|null>,
  "posted_at": "<device timestamp|null>",
  "age_s": <number|null>,
  "seq": <number|null>,
  "stale_seconds": <number>,
  "modules_reported": <number>,
  "modules_total": 9,
  "last_event": <event object|null>,
  "endpoint": { "host": "<your-LAN-IP>", "port": <port>, "path": "/api/update", "description": "ESP32 posts its JSON telemetry here" }
}
```

`connection` is `online` / `stale` / `offline`. The dashboard polls this
from the ESP32 view only (not every cycle).

## GET /api/config

Public, non-secret configuration for the frontend:
`cameraUrl`, `pollIntervalMs`, `healthPollMs`, `staleSeconds`,
`maxWeightKg`, `maxDistanceCm`.

---

## Firmware telemetry (ESP32 → POST /api/update)

ESP32 firmware sends a JSON body per the `POST /api/update` table above,
roughly every 1–3 seconds. Keep the firmware payload builder in one place
(`firmware/main_esp32/esp32_main.ino`) so field names never drift from the
contract.

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
| device_connected | info | first telemetry seen from a device |
