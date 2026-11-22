# Smart Travel Bag — Deploying to Render

Render can host the dashboard shell at a public URL. It **cannot** host the
live ESP32 connection — that part is USB serial, tethered to the machine
that physically holds the ESP32. This page is honest about the difference
before you deploy.

## What actually works on Render

| Capability | On Render (cloud) | Where the ESP32 is |
|------------|-------------------|--------------------|
| Dashboard UI, cards, map, events, AI panel | ✅ | — |
| `GET /api/status`, `/api/connection`, `/api/events`, … | ✅ (all honestly OFFLINE) | — |
| USB serial ingestion (`/api/update` is gone — ESP32 uses USB only) | ❌ no USB hardware | ✅ |
| ESP32-CAM stream | ✅ if `STB_CAMERA_URL` is reachable | ✅ |

In short: a deployed Render dashboard shows **OFFLINE / NO DATA** until a
backend runs next to the ESP32. That is the honest state — do not mistake the
deployed screen for live data.

## Two honest deployment options

### A. Live as close to the hardware as Render allows
Run the backend on the machine that holds the ESP32 (laptop / Raspberry Pi),
and expose it to your LAN / a small VPN (Tailscale, ZTNA). This is the **real**
way to see the bag live — Render contributes nothing here.

```bash
# on the machine with the ESP32 attached (Linux example)
pip install -r requirements.txt
STB_HOST=0.0.0.0 python dashboard/app.py     # or gunicorn on the LAN
```

### B. Deploy the dashboard shell to Render (this doc's focus)
Use Render Blueprint (`render.yaml` in this repo) because it builds in one
click and is checked on every push.

Steps:

1. Push this branch to GitHub.
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect the `Smart-travelbag` repo and select `render.yaml`.
4. Render builds (`pip install -r requirements.txt`) and starts
   `cd dashboard && gunicorn app:app --bind 0.0.0.0:$PORT --workers 2`.
5. Health check uses `GET /api/health`. All other routes are plain HTTP.

Or do it manually in the Render UI:

- **Service name**: `smart-travelbag-dashboard`
- **Runtime**: Python
- **Build command**: `pip install -r requirements.txt`
- **Start command**: `cd dashboard && gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4`
- **Health check path**: `/api/health`
- **Environment**: do NOT set `STB_SERIAL_PORT` (no USB port exists on
  Render — setting it would be a lie). Set `STB_CAMERA_URL` only if the
  ESP32-CAM stream is reachable from the internet.

### What you would see on Render
- Sidebar: `—` device name, state `OFFLINE` / `AWAITING TELEMETRY`
- ESP32 view: `<port>` empty, `OFFLINE`, all meta rows `—`
- Banner: `AWAITING TELEMETRY — No device data received yet`

No value is shown as live without real USB telemetry. That is by design and
is the reason no sample data is ever presented.

## Why not deploy on Render as "live"?

Render has no USB hardware, and the ONE connection mode is USB serial — the
ESP32 prints one JSON line per telemetry tick over USB. Render cannot read a
port it does not own. The honest ways to see the bag live, chosen in order:

1. Backend on the bag's machine (option A) + LAN/VPN remote view.
2. Render-hosted shell only (this doc) — for a remote URL with an honest
   OFFLINE state, e.g. as a status page.
3. A remote viewer pointed at the local backend via a VPN or tunnel — this
   adds a second connection path, which contradicts the "one option" design;
   do not build it without an explicit decision.

## Backups of the endpoint
- `render.yaml` — Blueprint (autoDeploy, free plan, health check)
- `Procfile` is NOT used — Render's Blueprint is authoritative
- Do **not** commit `.env` / secrets — `.gitignore` enforces it
