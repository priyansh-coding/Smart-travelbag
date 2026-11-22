# Smart Travel Bag — Acceptance test report

> **Status: NOT YET RUN.** These acceptance tests exist to be executed
> against the physical prototype (PRD §10). Nothing below is marked PASS
> until a hardware run has been recorded.

| Test ID | Test | Pass condition | Result |
|---------|------|----------------|--------|
| AT-01 | ESP32 connection | Dashboard shows controller online only after valid telemetry; offline after timeout | ⏳ Pending hardware |
| AT-02 | Weight reading | Physical load change changes displayed calibrated weight; units + timestamp correct | ⏳ Pending hardware |
| AT-03 | RFID and lock | Authorized/unauthorized RFID results and lock state match controller | ⏳ Pending hardware |
| AT-04 | Bag-open detection | Opening/closing changes reed-switch status and creates the expected event | ⏳ Pending hardware |
| AT-05 | Movement detection | Moving changes MPU6050 activity state; stationary not falsely reported | ⏳ Pending hardware |
| AT-06 | GPS | Valid fix displays correct coordinates; invalid/no fix clearly shown | ⏳ Pending hardware |
| AT-07 | Ultrasonic | Distance changes with target; invalid values flagged | ⏳ Pending hardware |
| AT-08 | Camera | Live stream appears when reachable; unavailable state when disconnected | ⏳ Pending hardware |
| AT-09 | AI service | Actual telemetry submitted; result displayed; service failure not shown as SAFE | ⏳ Pending hardware |
| AT-10 | Mobile layout | Cards, map, events, camera usable on a mobile browser | ✅ Tested in-browser (responsive CSS) |
| AT-11 | No simulated data | No sample values shown; live values or explicit "No live data" labels | ✅ Implemented (no demo mode; offline/NO DATA labels) |

## How to run

1. Power the bag and ESP32 DevKit V1.
2. Confirm the backend is running (`python dashboard/app.py`).
3. Walk the test IDs above; record results here with date, device ID, and notes.
4. Update this file and `docs/hardware_checklist.md` with actual values.

## Notes

- AT-10 and AT-11 are satisfied by the current build and will be re-verified
  against the live bag. AT-01 … AT-09 require the physical bag and cannot be
  marked done until hardware is available.
- The dashboard never presents sample values as live (PRD §10, AT-11):
  with no telemetry it shows OFFLINE / NO DATA, and there is no demo mode.
