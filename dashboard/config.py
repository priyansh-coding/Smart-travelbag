"""Single source of truth for the Smart Travel Bag dashboard.

Every host, port, interval and schema value lives here (or in environment
variables) — never hard-coded inside routes or the frontend.
"""
import os


class Config:
    # --- Server ---------------------------------------------------------
    HOST = os.environ.get("STB_HOST", "127.0.0.1")
    PORT = int(os.environ.get("STB_PORT", "5001"))
    DEBUG = os.environ.get("STB_DEBUG", "0") == "1"

    # --- Freshness / staleness -----------------------------------------
    # Telemetry older than this is reported as stale/offline.
    STALE_SECONDS = float(os.environ.get("STB_STALE_SECONDS", "10"))
    # Expected cadence between telemetry posts (used for the freshness bar).
    TELEMETRY_INTERVAL_S = float(os.environ.get("STB_TELEMETRY_INTERVAL_S", "2"))

    # --- AI service ------------------------------------------------------
    AI_SERVICE_URL = os.environ.get("STB_AI_URL", "http://127.0.0.1:3000/analyze")
    AI_TIMEOUT_SECONDS = float(os.environ.get("STB_AI_TIMEOUT", "5"))
    AI_AUTO_ANALYZE_S = float(os.environ.get("STB_AI_AUTO_S", "30"))

    # --- Camera ------------------------------------------------------------
    # ESP32-CAM stream endpoint (e.g. http://<your-esp32-cam-ip>:<port>/stream).
    CAMERA_URL = os.environ.get("STB_CAMERA_URL", "") or None

    # --- Frontend polling ---------------------------------------------------
    POLL_INTERVAL_MS = int(os.environ.get("STB_POLL_MS", "2000"))
    HEALTH_POLL_MS = int(os.environ.get("STB_HEALTH_POLL_MS", "5000"))

    # --- USB serial (the ONE connection mode) ------------------------------
    # Port to read (e.g. /dev/ttyUSB0, COM3). Empty = auto-detect.
    SERIAL_PORT = os.environ.get("STB_SERIAL_PORT", "") or None
    # Baud rate the firmware prints at.
    SERIAL_BAUD = int(os.environ.get("STB_SERIAL_BAUD", "115200"))

    # --- Storage limits -----------------------------------------------------
    EVENTS_MAX = 100
    HISTORY_MAX = 240  # weight samples kept for the trend chart

    # --- Telemetry schema ----------------------------------------------------
    # Validated ranges from the PRD (weight, distance, GPS).
    WEIGHT_MAX_KG = 20.0
    DISTANCE_MAX_CM = 400.0
    MAX_PAYLOAD_BYTES = 32 * 1024

    # Allowed sensor health states (PRD status vocabulary).
    SENSOR_STATES = ("online", "offline", "not_tested", "error")
    # Required sensor block keys when present.
    SENSOR_MODULES = (
        "rfid", "servo", "hx711", "mpu6050", "reed_switch",
        "ultrasonic", "gps", "buzzer", "esp32_cam",
    )

    # Frontend-facing public config (never secrets).
    PUBLIC_CONFIG = {
        "pollIntervalMs": POLL_INTERVAL_MS,
        "healthPollMs": HEALTH_POLL_MS,
        "staleSeconds": STALE_SECONDS,
        "cameraUrl": CAMERA_URL,
        "maxWeightKg": WEIGHT_MAX_KG,
        "maxDistanceCm": DISTANCE_MAX_CM,
        "aiAutoMs": int(AI_AUTO_ANALYZE_S * 1000),
    }


def public_config():
    return dict(Config.PUBLIC_CONFIG)
