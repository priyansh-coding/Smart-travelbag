"""Smart Travel Bag — dashboard backend.

ONE connection mode: USB serial. The ESP32 (DevKit V1, UNVERIFIED skeleton)
prints one JSON telemetry object per line over USB serial at 115200 baud.
This backend reads the serial port on behalf of the dashboard, validates the
payload, records state-change events, and serves the UI + JSON API.

No sample data is ever presented as live: every value shown comes from the
USB serial stream. With no device connected, the dashboard shows OFFLINE.
"""
import json
import logging
import math
import random
import sys
import threading
import time
from datetime import datetime, timezone
from typing import Any, Optional

import requests
import serial
import serial.tools.list_ports
from flask import Flask, jsonify, render_template, request

from config import Config, public_config

log = logging.getLogger("stb")

# Configure logging on import so the worker thread can log even when this
# module is imported by another host. basicConfig is a no-op if a host
# (gunicorn, etc.) already configured handlers.
if not logging.getLogger().handlers:
    logging.basicConfig(level=logging.INFO,
                        format="[%(asctime)s] %(name)s: %(message)s")

# ---------------------------------------------------------------------------
# In-memory device state (local prototype — not cloud storage)
# ---------------------------------------------------------------------------
class DeviceState:
    def __init__(self):
        self.lock = threading.Lock()
        self.device_id: Optional[str] = None
        self.received_at: Optional[float] = None      # server epoch seconds
        self.posted_at: Optional[str] = None          # device timestamp (echoed)
        self.seq: Optional[int] = None
        self.weight_kg: Optional[float] = None
        self.locked: Optional[bool] = None
        self.bag_open: Optional[bool] = None
        self.movement_detected: Optional[bool] = None
        self.acceleration: Optional[dict] = None
        self.distance_cm: Optional[float] = None
        self.gps: dict = {"valid": False, "latitude": None, "longitude": None,
                          "fix_time": None}
        self.sensors: dict = {}
        self.rfid_result: Optional[str] = None        # accepted / rejected
        self.buzzer: Optional[bool] = None
        self.events: list[dict] = []
        self.history: list[dict] = []                 # {ts, weight_kg}
        self.ai_result: Optional[dict] = None
        self.usb_port: Optional[str] = None           # port the worker is reading
        self.usb_parse_errors: int = 0                # malformed lines seen

    def snapshot(self) -> dict:
        now = time.time()
        age = (now - self.received_at) if self.received_at else None
        stale = age is None or age > Config.STALE_SECONDS
        return {
            "device_id": self.device_id,
            "usb_port": self.usb_port,
            "received_at": self.received_at,
            "posted_at": self.posted_at,
            "seq": self.seq,
            "age_s": round(age, 1) if age is not None else None,
            "stale": stale,
            "connection": ("offline" if age is None
                            else ("stale" if stale else "online")),
            "weight_kg": self.weight_kg,
            "locked": self.locked,
            "bag_open": self.bag_open,
            "movement_detected": self.movement_detected,
            "acceleration": self.acceleration,
            "distance_cm": self.distance_cm,
            "gps": self.gps,
            "sensors": self.sensors,
            "rfid_result": self.rfid_result,
            "buzzer": self.buzzer,
            "events_count": len(self.events),
            "ai": self.ai_result,
        }


state = DeviceState()

# ---------------------------------------------------------------------------
# Validation (PRD §6.2, adapted for the serial stream)
# ---------------------------------------------------------------------------
def validate_payload(payload: Any) -> tuple[Optional[dict], Optional[str]]:
    """Return (sanitized_payload, error_message). Missing values stay null."""
    if not isinstance(payload, dict):
        return None, "Payload must be a JSON object"

    if "device_id" in payload and not isinstance(payload["device_id"], str):
        return None, "device_id must be a string"

    clean: dict = {}
    clean["device_id"] = payload.get("device_id") or "smart-travel-bag-01"
    clean["timestamp"] = payload.get("timestamp") if isinstance(payload.get("timestamp"), str) else None
    clean["seq"] = payload.get("seq") if isinstance(payload.get("seq"), (int, float)) else None

    # Weight
    w = payload.get("weight_kg")
    if w is not None:
        if not isinstance(w, (int, float)) or isinstance(w, bool):
            return None, "weight_kg must be a number"
        if not math.isfinite(w) or w < 0 or w > Config.WEIGHT_MAX_KG:
            return None, f"weight_kg out of range (0..{Config.WEIGHT_MAX_KG})"
        clean["weight_kg"] = float(w)

    # Lock / bag / movement
    for key in ("locked", "bag_open", "movement_detected", "buzzer"):
        v = payload.get(key)
        if v is not None:
            if not isinstance(v, bool):
                return None, f"{key} must be a boolean"
            clean[key] = v

    # Acceleration (optional)
    acc = payload.get("acceleration")
    if acc is not None:
        if isinstance(acc, dict):
            clean_acc = {}
            for axis in ("x", "y", "z", "total"):
                v = acc.get(axis)
                if isinstance(v, (int, float)) and math.isfinite(v):
                    clean_acc[axis] = float(v)
            clean["acceleration"] = clean_acc
        elif isinstance(acc, (int, float)) and math.isfinite(acc):
            clean["acceleration"] = {"total": float(acc)}

    # Distance
    d = payload.get("distance_cm")
    if d is not None:
        if not isinstance(d, (int, float)) or isinstance(d, bool):
            return None, "distance_cm must be a number"
        if not math.isfinite(d) or d < 0 or d > Config.DISTANCE_MAX_CM:
            return None, f"distance_cm out of range (0..{Config.DISTANCE_MAX_CM})"
        clean["distance_cm"] = float(d)

    # GPS
    gps = payload.get("gps")
    if gps is not None:
        if not isinstance(gps, dict):
            return None, "gps must be an object"
        g = {}
        g["valid"] = bool(gps.get("valid", False))
        lat = gps.get("latitude")
        lon = gps.get("longitude")
        if lat is not None:
            if not isinstance(lat, (int, float)) or not math.isfinite(lat) or not (-90 <= lat <= 90):
                return None, "gps.latitude out of range (-90..90)"
            g["latitude"] = float(lat)
        if lon is not None:
            if not isinstance(lon, (int, float)) or not math.isfinite(lon) or not (-180 <= lon <= 180):
                return None, "gps.longitude out of range (-180..180)"
            g["longitude"] = float(lon)
        g["fix_time"] = gps.get("fix_time") if isinstance(gps.get("fix_time"), str) else None
        # A valid fix without coordinates is meaningless; degrade to invalid.
        if g["valid"] and (g.get("latitude") is None or g.get("longitude") is None):
            g["valid"] = False
        clean["gps"] = g

    # Sensors health block
    sensors = payload.get("sensors")
    if sensors is not None:
        if not isinstance(sensors, dict):
            return None, "sensors must be an object"
        clean_sensors = {}
        for name, value in sensors.items():
            if value is None:
                continue
            v = str(value).lower().replace("-", "_")
            if v == "not tested":
                v = "not_tested"
            if v not in Config.SENSOR_STATES:
                return None, f"sensor '{name}' has invalid state '{value}'"
            clean_sensors[str(name)] = v
        clean["sensors"] = clean_sensors

    # RFID result
    rfid = payload.get("rfid_result") or (payload.get("rfid") if isinstance(payload.get("rfid"), str) else None)
    if rfid is not None:
        v = str(rfid).lower()
        if v not in ("accepted", "rejected", "unknown"):
            return None, "rfid_result must be accepted/rejected/unknown"
        clean["rfid_result"] = v

    return clean, None


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------
def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _add_event(etype: str, message: str, severity: str = "info"):
    with state.lock:
        ev = {
            "id": f"ev-{int(time.time() * 1000)}-{random.randint(0, 9999)}",
            "ts": _now_iso(),
            "type": etype,
            "message": message,
            "severity": severity,
            "source": "device",
        }
        state.events.insert(0, ev)
        if len(state.events) > Config.EVENTS_MAX:
            state.events = state.events[:Config.EVENTS_MAX]
        return ev


def _diff_and_record(prev: dict, new: dict):
    """Generate events from state changes."""
    def changed(key):
        return new.get(key) != prev.get(key)

    # First-ever telemetry: record a connection event, not fake "changes".
    if prev.get("received_at") is None:
        _add_event("device_connected", "Device telemetry started — USB connection established", "info")
        return

    if changed("bag_open"):
        if new["bag_open"]:
            _add_event("bag_opened", "Bag opened — reed switch changed to open", "critical")
        else:
            _add_event("bag_closed", "Bag closed — reed switch returned to closed", "info")
    if changed("locked"):
        _add_event("lock_changed",
                   f"Lock is now {'LOCKED' if new['locked'] else 'UNLOCKED'}",
                   "warning" if not new["locked"] else "info")
    if changed("movement_detected") and new["movement_detected"]:
        _add_event("movement_detected", "Movement detected — MPU6050 above threshold", "warning")
    if changed("rfid_result") and new["rfid_result"] in ("accepted", "rejected"):
        msg = ("RFID tag ACCEPTED — tag authenticated" if new["rfid_result"] == "accepted"
               else "RFID tag REJECTED — unauthorized access attempt")
        _add_event("rfid_accepted" if new["rfid_result"] == "accepted" else "rfid_rejected",
                   msg, "info" if new["rfid_result"] == "accepted" else "critical")
    if changed("buzzer") and new.get("buzzer"):
        _add_event("buzzer_on", "Buzzer triggered by controller", "warning")
    if new.get("gps") and new["gps"].get("valid") and (not prev.get("gps") or not prev["gps"].get("valid")):
        _add_event("gps_fix", "Valid GPS fix acquired", "info")
    if prev.get("gps") and prev["gps"].get("valid") and (not new.get("gps") or not new["gps"].get("valid")):
        _add_event("gps_fix_lost", "GPS fix lost — no valid coordinates", "warning")


def _apply_telemetry(clean: dict):
    """Merge a validated payload into device state and record events."""
    with state.lock:
        prev = state.snapshot()
        state.device_id = clean.get("device_id") or state.device_id
        state.received_at = time.time()
        state.posted_at = clean.get("timestamp")
        state.seq = clean.get("seq") if clean.get("seq") is not None else state.seq
        if "weight_kg" in clean:
            state.weight_kg = clean["weight_kg"]
            state.history.append({"ts": state.received_at, "weight_kg": clean["weight_kg"]})
            if len(state.history) > Config.HISTORY_MAX:
                state.history = state.history[-Config.HISTORY_MAX:]
        if "locked" in clean: state.locked = clean["locked"]
        if "bag_open" in clean: state.bag_open = clean["bag_open"]
        if "movement_detected" in clean: state.movement_detected = clean["movement_detected"]
        if "acceleration" in clean: state.acceleration = clean["acceleration"]
        if "distance_cm" in clean: state.distance_cm = clean["distance_cm"]
        if "gps" in clean: state.gps = clean["gps"]
        if "sensors" in clean: state.sensors.update(clean["sensors"])
        if "rfid_result" in clean: state.rfid_result = clean["rfid_result"]
        if "buzzer" in clean: state.buzzer = clean["buzzer"]

    _diff_and_record(prev, state.snapshot())


# ---------------------------------------------------------------------------
# USB serial ingestion — ONE connection mode
# ---------------------------------------------------------------------------
def _detect_serial_port() -> Optional[str]:
    """The serial port to read. STB_SERIAL_PORT wins; otherwise, auto-detect.

    Returns None when nothing looks like a serial adapter. Honest by design:
    no guesses, no HTTP, no Wi-Fi. On hosted backends (Render, etc.) there is
    no USB hardware — always None, and the UI must show OFFLINE honestly.
    """
    if Config.IS_HOSTED:
        return None
    if Config.SERIAL_PORT:
        return Config.SERIAL_PORT
    try:
        ports = list(serial.tools.list_ports.comports())
    except Exception:
        return None
    if sys.platform.startswith("win"):
        candidates = [p.device for p in ports if p.device.upper().startswith("COM")]
    elif sys.platform == "darwin":
        candidates = [p.device for p in ports if "usbmodem" in p.device or "usbserial" in p.device.lower()]
    else:
        candidates = [p.device for p in ports
                      if any(t in p.device for t in ("ttyUSB", "ttyACM"))]
    return candidates[0] if candidates else None


def _usb_port_details(port: Optional[str]) -> dict:
    """USB device identity for a serial port (best effort, honest)."""
    if not port:
        return {"device_name": None, "vid_pid": None, "manufacturer": None,
                "serial_number": None}
    try:
        for p in serial.tools.list_ports.comports():
            if p.device == port:
                return {
                    "device_name": (p.description or p.manufacturer or None),
                    "vid_pid": (f"0x{p.vid:04X}:0x{p.pid:04X}"
                                if p.vid is not None and p.pid is not None else None),
                    "manufacturer": (p.manufacturer or None),
                    "serial_number": (p.serial_number or None),
                }
    except Exception as e:
        log.debug("USB port lookup failed for %s: %s", port, e)
    return {"device_name": None, "vid_pid": None, "manufacturer": None,
            "serial_number": None}


def _usb_test_command(port: Optional[str]) -> Optional[str]:
    """A copy-pasteable read of the live serial stream (as honest as it gets)."""
    if not port:
        return None
    if sys.platform.startswith("win"):
        return f"type {port}"
    return f"cat {port}"


_worker_started = False


def _start_usb_worker():
    """Start the background serial reader (once, regardless of import path).

    On hosted backends (Render, etc.) there is no USB hardware — skip the
    worker entirely and let the UI report OFFLINE honestly.
    """
    global _worker_started
    if _worker_started:
        return
    _worker_started = True
    if Config.IS_HOSTED:
        log.info("Hosted deployment — USB worker disabled (no USB hardware on this host)")
        return
    t = threading.Thread(target=_usb_worker_loop, name="stb-usb-worker", daemon=True)
    t.start()


def _usb_worker_loop():
    log.info("USB serial worker started (auto-detect: STB_SERIAL_PORT unset or configured)")
    while True:
        port = _detect_serial_port()
        if not port:
            state.usb_port = None
            time.sleep(2)
            continue
        try:
            with serial.Serial(port, Config.SERIAL_BAUD, timeout=1) as ser:
                state.usb_port = port
                log.info("USB serial reading from %s @ %d baud", port, Config.SERIAL_BAUD)
                while True:
                    try:
                        raw = ser.readline()
                    except Exception as e:
                        log.warning("serial read failed on %s: %s", port, e)
                        break
                    if not raw:
                        continue  # 1 s timeout, port still open
                    line = raw.decode("utf-8", errors="replace").strip()
                    if not line:
                        continue
                    try:
                        payload = json.loads(line)
                    except Exception:
                        with state.lock:
                            state.usb_parse_errors += 1
                        continue
                    clean, err = validate_payload(payload)
                    if err:
                        with state.lock:
                            state.usb_parse_errors += 1
                        log.debug("rejected payload: %s", err)
                        continue
                    _apply_telemetry(clean)
        except serial.SerialException as e:
            state.usb_port = None
            log.warning("serial port %s unavailable: %s — retrying", port, e)
            time.sleep(2)
        except Exception as e:  # port vanished / driver error — keep trying
            state.usb_port = None
            log.warning("USB worker error: %s — retrying", e)
            time.sleep(2)


# ---------------------------------------------------------------------------
# AI analysis (advisory; never presented as a guarantee)
# ---------------------------------------------------------------------------
def _analyze() -> dict:
    """Send the current snapshot to the AI service; never invent a verdict."""
    snap = state.snapshot()
    if snap["age_s"] is None:
        return {"ok": False,
                "status": "unavailable",
                "error": "No live telemetry to analyze",
                "result": None}
    payload = {
        "device_id": snap["device_id"],
        "timestamp": snap["posted_at"] or _now_iso(),
        "weight_kg": snap["weight_kg"],
        "locked": snap["locked"],
        "bag_open": snap["bag_open"],
        "movement_detected": snap["movement_detected"],
        "distance_cm": snap["distance_cm"],
        "gps_valid": snap["gps"]["valid"] if snap["gps"] else False,
        "rfid_result": snap["rfid_result"],
        "stale": snap["stale"],
    }
    try:
        resp = requests.post(Config.AI_SERVICE_URL, json=payload,
                             timeout=Config.AI_TIMEOUT_SECONDS)
        if resp.status_code != 200:
            return {"ok": False, "status": "unavailable",
                    "error": f"AI service returned HTTP {resp.status_code}",
                    "result": None}
        data = resp.json()
        result = {
            "classification": str(data.get("classification", "UNKNOWN")).upper(),
            "risk": data.get("risk", "unknown"),
            "explanation": data.get("explanation", ""),
            "timestamp": data.get("timestamp") or _now_iso(),
            "source": "ai-service",
        }
        with state.lock:
            state.ai_result = result
        return {"ok": True, "status": "ok", "error": None, "result": result}
    except requests.exceptions.RequestException as e:
        with state.lock:
            state.ai_result = None
        return {"ok": False, "status": "unavailable",
                "error": f"AI service unreachable: {e}",
                "result": None}
    except Exception as e:  # malformed JSON, etc.
        with state.lock:
            state.ai_result = None
        return {"ok": False, "status": "unavailable",
                "error": f"AI service error: {e}",
                "result": None}


# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
def _asset_version():
    """A cheap content-hash of the static tree for cache-busting."""
    import hashlib
    from pathlib import Path
    root = Path(__file__).resolve().parent
    h = hashlib.md5()
    for rel in ("static/css/style.css", "static/js/app.js", "static/js/matrix.js",
                "static/js/map.js", "static/js/charts.js"):
        p = root / rel
        if p.exists():
            h.update(p.read_bytes())
    return h.hexdigest()[:10]


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = Config.MAX_PAYLOAD_BYTES
    app.config["JSON_SORT_KEYS"] = False

    @app.after_request
    def no_cache(resp):
        # Never serve stale dashboard markup or styles.
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        return resp

    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({"ok": False, "error": "Not found"}), 404

    # --- Page ---------------------------------------------------------------
    @app.route("/")
    def index():
        v = _asset_version()
        return render_template("dashboard.html",
                               public_config=public_config(),
                               asset_v=v)

    # --- API -----------------------------------------------------------------
    @app.route("/api/status")
    def api_status():
        snap = state.snapshot()
        return jsonify({
            "ok": True,
            "device": snap,
            "config": public_config(),
        })

    @app.route("/api/connection")
    def api_connection():
        """USB connection details for the ESP32 view."""
        snap = state.snapshot()
        with state.lock:
            port = state.usb_port
            parse_errors = state.usb_parse_errors
            last_event = state.events[0] if state.events else None
        usb = _usb_port_details(port)
        return jsonify({
            "ok": True,
            "mode": "usb-serial",
            "hosted": Config.IS_HOSTED,
            "connected": snap["connection"] == "online",
            "connection": snap["connection"],
            "device_id": snap["device_id"],
            "usb_port": port,
            "usb_device_name": usb["device_name"],
            "usb_vid_pid": usb["vid_pid"],
            "usb_manufacturer": usb["manufacturer"],
            "usb_serial_number": usb["serial_number"],
            "baud": Config.SERIAL_BAUD,
            "received_at": snap["received_at"],
            "posted_at": snap["posted_at"],
            "age_s": snap["age_s"],
            "seq": snap["seq"],
            "stale_seconds": Config.STALE_SECONDS,
            "modules_reported": len(snap["sensors"]),
            "modules_total": len(Config.SENSOR_MODULES),
            "parse_errors": parse_errors,
            "last_event": last_event,
            "endpoint": {
                "description": "ESP32 prints one JSON telemetry object per line here",
                "test_command": _usb_test_command(port),
            },
        })

    @app.route("/api/events")
    def api_events():
        try:
            limit = int(request.args.get("limit", "50"))
        except ValueError:
            limit = 50
        limit = max(1, min(limit, Config.EVENTS_MAX))
        with state.lock:
            events = state.events[:limit]
            total = len(state.events)
        return jsonify({"ok": True, "events": events, "total": total})

    @app.route("/api/history")
    def api_history():
        with state.lock:
            history = state.history[-Config.HISTORY_MAX:]
        return jsonify({"ok": True, "history": history})

    @app.route("/api/analyze", methods=["POST"])
    def api_analyze():
        result = _analyze()
        return jsonify(result), (200 if result["ok"] else 503)

    @app.route("/api/health")
    def api_health():
        snap = state.snapshot()
        sensors = snap["sensors"]
        counts = {"online": 0, "offline": 0, "not_tested": 0, "error": 0}
        for v in sensors.values():
            counts[v] = counts.get(v, 0) + 1
        unknown = [m for m in Config.SENSOR_MODULES if m not in sensors]
        return jsonify({"ok": True,
                        "sensors": sensors,
                        "unknown": unknown,
                        "counts": counts,
                        "total": len(Config.SENSOR_MODULES)})

    @app.route("/api/config")
    def api_config():
        return jsonify({"ok": True, "config": public_config()})

    _start_usb_worker()
    return app


app = create_app()

if __name__ == "__main__":
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
