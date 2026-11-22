"""Smart Travel Bag — reference AI advisory service (reference implementation).

This is a *reference* advisory service. Its classification is deterministic
rule-based analysis, NOT a trained model and NOT a guaranteed theft
detector. The AI panel must always show it as advisory.

Run:
    python ai_server/ai_server.py            # listens on :3000

The dashboard backend POSTs the current sensor snapshot to /analyze and
displays the returned classification, risk level, explanation and timestamp.
"""
import json
import logging
from datetime import datetime, timezone

from flask import Flask, jsonify, request

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(name)s: %(message)s")
log = logging.getLogger("stb.ai")

app = Flask(__name__)


def analyze_snapshot(p: dict) -> dict:
    """Deterministic advisory classification. Never presented as a guarantee."""
    reasons = []
    bag_open = p.get("bag_open")
    locked = p.get("locked")
    movement = p.get("movement_detected")
    rfid = p.get("rfid_result")
    stale = p.get("stale")
    gps_valid = p.get("gps_valid")

    if rfid == "rejected":
        reasons.append("RFID rejected — unauthorized access attempt")
    if bag_open:
        reasons.append("bag open — access possible")
    if locked is False:
        reasons.append("lock is UNLOCKED")
    if movement:
        reasons.append("movement detected")
    if stale:
        reasons.append("telemetry is STALE — state may be out of date")

    if rfid == "rejected" or (bag_open and locked is False):
        classification, risk = "ALERT", "critical"
    elif reasons:
        classification, risk = "WARNING", "elevated" if not bag_open else "high"
    else:
        classification, risk = "SAFE", "low"

    if not gps_valid:
        reasons.append("GPS fix unavailable — location unknown")
        if classification == "SAFE":
            classification, risk = "WARNING", "elevated"
            reasons.append("safe state unconfirmed without location")

    explanation = "; ".join(reasons) if reasons else "All reported checks nominal"
    return {
        "classification": classification,
        "risk": risk,
        "explanation": explanation,
        "advisory": True,
        "basis": "deterministic rule-based reference (not a trained model)",
        "timestamp": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
    }


@app.post("/analyze")
def analyze():
    try:
        p = request.get_json(silent=True)
    except Exception:
        p = None
    if not isinstance(p, dict):
        return jsonify({"classification": "UNKNOWN", "risk": "unknown",
                        "explanation": "malformed request", "advisory": True}), 400
    return jsonify(analyze_snapshot(p))


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "stb-ai-reference"})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=3000, debug=False)
