# Smart Travel Bag — IoT Security Dashboard

Real-time, local-network monitoring and AI-assisted security dashboard for the
**Smart Travel Bag** — an ESP32-powered luggage prototype. One clear screen:
current condition, alerts, device health, location, camera and advisory AI
review.

> **Data honesty rule (PRD §4.3 / §10):** the dashboard shows **live device
> values or explicit "No live data" labels**. It never presents sample data
> as telemetry — and it does not ship a demo mode. Connect the ESP32 and the
> screen lights up with its real values.

---

## What you get

| Feature | PRD ref | Detail |
|---------|---------|--------|
| Project header & connection state | FR-01 | Project name, USB/backend state, last-update timestamp, overall security banner |
| Weight monitoring | FR-02 | Calibrated HX711 value in kg + trend chart |
| Smart lock | FR-03 | Locked/unlocked state + RFID accept/reject result |
| Bag opening | FR-04 | Reed-switch open/closed + event on change |
| Movement | FR-05 | MPU6050 state + acceleration |
| GPS tracking | FR-06 | Valid coordinates + dotted world map + map link (only when a valid fix exists) |
| Obstacle/distance | FR-07 | Ultrasonic distance in cm, invalid values flagged |
| Buzzer / alerts | FR-08 | Alert state + reason (not "working" unless the controller reports it) |
| ESP32-CAM | FR-09 | Live stream when reachable; clear offline state otherwise |
| AI analysis | FR-10 | Advisory result + risk + explanation + timestamp, or an explicit "unavailable" |
| Sensor health | FR-11 | RFID / servo / HX711 / MPU6050 / reed / ultrasonic / GPS / buzzer / CAM — Online / Offline / Not tested / Error |
| Event history | FR-12 | Timestamped events, newest-first, with severities + filters |
| Responsive layout | FR-13 | Laptop & mobile browsers |
| Manual refresh | FR-14 | Refresh button + auto poll |

## Architecture

```
 Sensors + actuators (ESP32 DevKit V1)
   RFID · HX711 · MPU6050 · reed · ultrasonic · GPS · buzzer · SG90
                │  USB serial (ONE connection mode)
                ▼
     Dashboard Flask backend (dashboard/app.py)      AI reference service
     • reads the USB port, validates & stores        POST /analyze       (ai_server/ai_server.py)
       one JSON object per line                    ◄────────►  returns SAFE/WARNING/ALERT
     • generates state-change events                          + risk + explanation
     • serves the browser
                │
                ▼
   Browser dashboard (static, self-contained)
   • live cards · weight trend · dotted world map
   • camera panel · AI panel · event feed
                          │
   ESP32-CAM ──────────┘      (separate board, separate stream)
```

The dashboard is a local-machine prototype. The ESP32 is connected by USB
serial — the bag does not use Wi-Fi — and the dashboard is meant to be opened
on the same machine, **not** exposed to the public internet without
authentication and transport security first.

## Quick start

```bash
# 1. Install dependencies (Python 3.10+, no Node required)
pip install -r requirements.txt

# 2. Run the dashboard backend  (http://127.0.0.1:5001)
python dashboard/app.py

# 3. (optional) Run the AI reference service (http://127.0.0.1:3000)
python ai_server/ai_server.py
```

Open **http://127.0.0.1:5001**. With no hardware attached, the dashboard
honestly shows *OFFLINE / NO DATA* — plug in the ESP32 below to light it up.

## Deploying to Render

Render hosts the dashboard shell at a public URL — it cannot read the USB
port (no USB hardware on cloud hosts, and USB is the ONE connection mode).
On Render the dashboard honestly shows OFFLINE / NO DATA; the backend that
reads the USB port must run next to the ESP32. See
[docs/deployment.md](docs/deployment.md) for both options, the Blueprint
(`render.yaml`), and the honest limitations.

```bash
# Local, on the machine with the ESP32 attached — the real path:
pip install -r requirements.txt
STB_HOST=0.0.0.0 python dashboard/app.py      # then LAN / VPN view

# Cloud, as a shell only (Render Blueprint, auto-detected):
#   New → Blueprint → render.yaml
```

## Connecting the ESP32

One connection mode, and it is USB serial — no Wi-Fi, no HTTP.

1. Flash the firmware in `firmware/main_esp32/esp32_main.ino` onto the ESP32
   DevKit V1 (UNVERIFIED skeleton — confirm pin map on the physical bag).
   The firmware prints one JSON telemetry object per line over USB serial
   at 115200 baud every 1–3 seconds — see `docs/api_contract.md`.
2. Plug the ESP32 into your machine over USB.
3. (optional) Set `STB_SERIAL_PORT` / `STB_SERIAL_BAUD` if the auto-detect
   picks the wrong port (e.g. `STB_SERIAL_PORT=/dev/ttyUSB0 python dashboard/app.py`).
4. Run the backend: `python dashboard/app.py`
5. The **ESP32** sidebar view shows the live handshake — connection state,
   USB port, USB device name, VID/PID, device ID, last update, freshness,
   sequence number, modules reported, parse errors, last event, and a
   copyable read command for the serial port.

No Wi-Fi is needed — the HTTP endpoint and curl flow are gone by design.

For the ESP32-CAM stream, set `STB_CAMERA_URL` (e.g.
`http://<your-esp32-cam-ip>:<port>/stream`) — the camera panel shows LIVE only when the
stream actually loads, otherwise it shows its offline state.

## Configuration

All settings live in `dashboard/config.py`, with environment overrides:

| Environment variable | Default | Meaning |
|----------------------|---------|---------|
| `STB_HOST` / `STB_PORT` | `127.0.0.1` / `5001` | Dashboard bind |
| `STB_SERIAL_PORT` | auto-detect | USB serial port to read (e.g. `/dev/ttyUSB0`, `COM3`) |
| `STB_SERIAL_BAUD` | `115200` | Firmware baud rate |
| `STB_STALE_SECONDS` | `10` | Freshness threshold |
| `STB_POLL_MS` | `2000` | Browser poll interval |
| `STB_CAMERA_URL` | unset | ESP32-CAM stream (e.g. `http://<your-esp32-cam-ip>:<port>/stream`) |
| `STB_AI_URL` | `http://127.0.0.1:3000/analyze` | AI service endpoint |
| `STB_AI_TIMEOUT` | `5` | AI call timeout (s) |

## Views

The dashboard is a real app shell: a closable sidebar (persisted in
`localStorage`) holds the navigation, the device summary and the collapse
control. The main area holds the header (view title, connection pill,
last-update chip, refresh) and the security banner.

- **Dashboard** — black & white terminal hero (falling hex-code streaks),
  live weight + gauge, sensor-health matrix, 15-tile live telemetry grid,
  dotted world map with GPS pin + arc, ESP32-CAM, AI panel, recent events.
- **Sensors** — weight trend chart + per-module detail table.
- **Events** — full event history with severity/security filters.
- **ESP32** — live connection state, USB port + device name + VID/PID,
  device ID, freshness, sequence, modules, parse errors, last event,
  and a copyable read command for the serial port.

## API

See [docs/api_contract.md](docs/api_contract.md). Highlights:

- `GET /api/status` — latest state + freshness (browser poll)
- `GET /api/connection` — ESP32 USB connection details (port, device name, VID/PID, freshness, endpoint-as-text)
- `GET /api/events` / `GET /api/history` / `GET /api/health`
- `POST /api/analyze` — forward snapshot to the AI service
- `GET /api/config` — public configuration (never secrets)

## Firmware skeletons

`firmware/main_esp32/` and `firmware/esp32_cam/` are **unverified skeletons**.
Pin map, calibration, GPS baud and stream URL must be confirmed on the
physically-built bag before they are trusted — see
[docs/hardware_checklist.md](docs/hardware_checklist.md). Nothing is marked
operational here until the acceptance tests in the PRD §10 have passed.

## Project structure

```
Smart-travelbag/
├── dashboard/              # Flask backend + browser UI
│   ├── app.py              # routes, validation, events, ESP32 connection
│   ├── config.py           # single source of configuration
│   ├── templates/dashboard.html
│   └── static/{css,js,vendor}
├── ai_server/
│   └── ai_server.py        # reference advisory service (deterministic rules)
├── firmware/               # ESP32 skeletons (unverified)
├── docs/                   # API contract, hardware checklist
├── README.md
└── requirements.txt
```

## Data integrity

- Telemetry is validated (range, type, GPS validity, sensor state enum).
- Missing values stay `null`/unknown — never replaced with zeros.
- Stale readings are marked stale; the banner and pills never say LIVE when
  the data is old.
- Camera data shown only when the stream actually loads.
- AI results are shown as advisory only — never the sole safety mechanism,
  never presented as a theft detector.

## Security & privacy

Local-network prototype. Do **not** expose it to the public internet without
adding authentication and secure transport first. No Wi-Fi passwords or API
keys belong in the repo. Camera and location data are visible only to
intended users on the trusted network.

## Status & acceptance

This repository is a working prototype. Highlighted, honest status:

- ✅ Dashboard backend, USB serial validation, events, ESP32 connection view — built & tested
- ✅ UI (Dashboard / Sensors / ESP32 / Events), dotted world map, weight trend — built
- ⏳ ESP32 firmware — skeleton, **unverified**
- ⏳ Acceptance tests AT-01…AT-11 — not yet run against hardware (PRD §10)
- ⏳ Hardware checklist — pending pin-map sign-off (docs/hardware_checklist.md)

---

Built for the Smart Travel Bag project. Design language inspired by
[Michele Du](https://micheledu.com/) — dark glasswork, gradient accents,
monospace terminal, dotted world map.
