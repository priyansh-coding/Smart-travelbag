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

```json
{
  "ok": true,
  "device": {
    "device_id": "smart-travel-bag-01",
    "source_ip": "192.168.1.42",
    "received_at": 1795375714.29,
    "posted_at": "2026-11-22T09:30:00+05:30",
    "seq": 1042,
    "age_s": 0.8,
    "stale": false,
    "connection": "online",
    "weight_kg": 4.25,
    "locked": true,
    "bag_open": false,
    "movement_detected": false,
    "acceleration": { "x": 0.1, "y": 0.2, "z": 1.0, "total": 10.4 },
    "distance_cm": 85.4,
    "gps": { "valid": true, "latitude": 20.4625, "longitude": 85.8828, "fix_time": "2026-11-22T09:30:00+05:30" },
    "sensors": {
      "rfid": "online", "servo": "online", "hx711": "online",
      "mpu6050": "online", "reed_switch": "online", "ultrasonic": "online",
      "gps": "online", "buzzer": "online", "esp32_cam": "offline"
    },
    "rfid_result": "accepted",
    "buzzer": false,
    "events_count": 12,
      "ai": { "classification": "SAFE", "risk": "low", "explanation": "...", "timestamp": "2026-11-22T09:30:12+00:00", "source": "ai-service" }
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
| `device_id` | string | yes (default `smart-travel-bag-01`) | any string |
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

`{"ok": true, "history": [ {"ts": <epoch>, "weight_kg": 4.25}, ... ] }`
Last N samples (default 240), oldest first.

## GET /api/health

`{"ok": true, "sensors": {module: state}, "unknown": [module,...], "counts": {...}, "total": 9}`

## POST /api/analyze

Forwards the current snapshot to the AI service.

```json
{ "ok": true, "status": "ok", "error": null,
  "result": { "classification": "SAFE", "risk": "low", "explanation": "...", "timestamp": "...", "source": "ai-service" } }
```

Failure (AI service unreachable or unhelpful) → HTTP 503 with
`{"ok": false, "status": "unavailable", "error": "...", "result": null}`.
The UI must never show SAFE in this case.

The reference AI server (`ai_server/ai_server.py`) implements `POST /analyze`
with a deterministic, advisory rule set. It is **not** a trained model and
not a theft detector.

## GET /api/connection

ESP32 connection details for the ESP32 view:

```json
{
  "ok": true,
  "connected": true,
  "connection": "online",
  "device_id": "smart-travel-bag-01",
  "source_ip": "192.168.1.42",
  "received_at": 1795375714.29,
  "posted_at": "2026-11-22T09:30:00+05:30",
  "age_s": 0.8,
  "seq": 1042,
  "stale_seconds": 10.0,
  "modules_reported": 9,
  "modules_total": 9,
  "last_event": { "id": "ev-...", "ts": "...", "type": "device_connected", "message": "...", "severity": "info", "source": "device" },
  "endpoint": { "host": "127.0.0.1", "port": 5001, "path": "/api/update", "description": "ESP32 posts its JSON telemetry here" }
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
