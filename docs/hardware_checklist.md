# Smart Travel Bag — Hardware checklist

> **Status: unverified.** The dashboard does not trust these values until
> each module is tested on the physical prototype. Do not mark any feature
> operational until its acceptance test (PRD §10) has been run.

## Power

- [ ] SG90 servo powered from a suitable regulated 5 V supply (not the ESP32 3.3 V rail)
- [ ] Grounds tied together: servo 5 V / ESP32 5 V / ESP32 GND
- [ ] No motor driven from a weak USB/board rail
- [ ] Load cell / HX711 calibration verified with known reference weights

## Wiring (to be confirmed on the board)

| Module | Bus / pin | Notes |
|--------|-----------|-------|
| MPU6050 | I2C | check I2C address (0x68 / 0x69) |
| OLED | I2C | shared bus with MPU6050 |
| RFID RC522 | SPI | check SPI pin map with the RC522 datasheet |
| GPS module | UART | check baud rate (9600 / 38400) |
| Reed switch | GPIO + pull-up | confirm active level |
| Ultrasonic | GPIO (echo) | confirm echo voltage compatibility with ESP32 GPIO |
| Buzzer | GPIO | confirm current draw vs. rail capacity |
| SG90 servo | PWM GPIO | signal via external regulated supply |
| ESP32-CAM | Wi-Fi | separate board; stream URL + port to be confirmed |

## Firmware / integration

- [ ] Telemetry JSON payload built once and printed over USB serial every 1–3 s
- [ ] Payload field names match docs/api_contract.md exactly
- [ ] GPS only reported valid with coordinates
- [ ] Weight calibration recorded (reference weight + expected kg)
- [ ] RFID acceptance/rejection reported as an explicit field
- [ ] Stale threshold 10 s and camera streaming kept independent of sensor updates
- [ ] Camera stream confirmed reachable from the dashboard browser

## Dashboard integration

- [ ] USB serial reader accepts the ESP32 payload (auto-detect or STB_SERIAL_PORT)
- [ ] GET /api/status feeds the dashboard (browser poll)
- [ ] /api/analyze forwards the snapshot to the AI service
- [ ] Dashboard shows OFFLINE/STALE, never fake values, when telemetry stops

## Not yet done

- [ ] Pin map signed off from serial logs
- [ ] Camera stream URL confirmed
- [ ] Acceptance tests AT-01..AT-11 run against hardware (see PRD §10)
- [ ] Demonstrate with a live device, not fixtures
