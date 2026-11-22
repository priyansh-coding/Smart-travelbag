/* Smart Travel Bag — app shell.
   Sidebar navigation, collapse state, polling, rendering.
   Never invents data — nothing is shown unless the device reports it. */
(function () {
  'use strict';

  const CONFIG = window.__STB_CONFIG__ || {};
  const POLL_MS = CONFIG.pollIntervalMs || 2000;
  const MAX_W = CONFIG.maxWeightKg || 20;

  const $ = id => document.getElementById(id);

  const MODULE_META = [
    { key: 'rfid',        label: 'RFID RC522' },
    { key: 'servo',       label: 'Servo Lock' },
    { key: 'hx711',       label: 'HX711 Weight' },
    { key: 'mpu6050',     label: 'MPU6050 Motion' },
    { key: 'reed_switch', label: 'Reed Switch' },
    { key: 'ultrasonic',  label: 'Ultrasonic' },
    { key: 'gps',         label: 'GPS Module' },
    { key: 'buzzer',      label: 'Buzzer' },
    { key: 'esp32_cam',   label: 'ESP32-CAM' },
  ];

  const VIEW_META = {
    dashboard: { title: 'Dashboard', sub: 'Live state of the Smart Travel Bag' },
    sensors:   { title: 'Sensors', sub: 'Per-module health, readings and weight trend' },
    connection: { title: 'ESP32', sub: 'Wireless connection to the bag' },
    events:    { title: 'Events', sub: 'Security and device event history' },
  };

  let last = null;
  let conn = null;
  let events = [];
  let history = [];
  let aiHistory = null;
  let lastWeight = null;
  let currentFilter = 'all';

  /* ---------- helpers ---------- */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function fmtCoords(g) {
    if (!g || !g.valid || g.latitude == null || g.longitude == null) return 'No valid GPS fix';
    const la = Math.abs(g.latitude).toFixed(4);
    const lo = Math.abs(g.longitude).toFixed(4);
    return `${la}° ${g.latitude >= 0 ? 'N' : 'S'}, ${lo}° ${g.longitude >= 0 ? 'E' : 'W'}`;
  }
  function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function fmtAge(s) {
    if (s == null) return '—';
    if (s < 2) return 'just now';
    if (s < 60) return `${Math.round(s)}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }
  function fmtAgoTs(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- network ---------- */
  async function getJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }
  async function postJSON(url) {
    const res = await fetch(url, { method: 'POST', cache: 'no-store' });
    return res.json();
  }

  /* ---------- sidebar ---------- */
  function setSidebarCollapsed(collapsed) {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    $('reopenBtn').hidden = !collapsed;
    $('collapseBtn').setAttribute('aria-expanded', String(!collapsed));
    localStorage.setItem('stb-sidebar-collapsed', collapsed ? '1' : '0');
  }

  function renderSidebar(device) {
    const conn = device.connection || 'offline';
    $('sideDeviceDot').className = 'side-device-dot ' + (conn === 'online' ? 'live' : conn === 'stale' ? 'stale' : 'off');
    $('sideDeviceName').textContent = device.device_id || 'smart-travel-bag-01';
    $('sideWeight').textContent = device.weight_kg == null ? '–– kg' : `${device.weight_kg.toFixed(2)} kg`;
    const state = $('sideState');
    state.textContent = conn.toUpperCase();
    state.className = 'side-state ' + (conn === 'online' ? 'ok' : conn === 'stale' ? 'mid' : '');
  }

  /* ---------- header ---------- */
  function renderHeader(device) {
    const conn = device.connection || 'offline';
    const pill = $('connPill');
    pill.classList.remove('online', 'stale', 'offline');
    pill.classList.add(conn === 'online' ? 'online' : conn === 'stale' ? 'stale' : 'offline');
    $('connText').textContent = conn.toUpperCase();
    const updated = $('updatedChip');
    updated.textContent = device.posted_at ? `Updated ${fmtTime(device.posted_at)}` : 'Last update —';
  }

  function renderViewTitle(view) {
    const meta = VIEW_META[view] || VIEW_META.dashboard;
    $('viewTitle').textContent = meta.title;
    $('viewSub').textContent = meta.sub;
  }

  /* ---------- banner ---------- */
  function setChip(id, text, cls) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'sec-chip' + (cls ? ' ' + cls : '');
  }

  function renderBanner(device) {
    const banner = $('securityBanner');
    const title = $('secTitle');
    const sub = $('secSub');
    banner.classList.remove('warn', 'alert', 'offline');

    if (device.connection === 'offline') {
      banner.classList.add('offline');
      title.textContent = 'AWAITING TELEMETRY';
      sub.textContent = 'No device data received yet — showing nothing as live.';
    } else if (device.connection === 'stale') {
      banner.classList.add('warn');
      title.textContent = 'CONNECTION STALE';
      sub.textContent = `No fresh readings for ${fmtAge(device.age_s)} — the bag may have been left behind.`;
    } else {
      const bagOpen = device.bag_open;
      const locked = device.locked;
      const movement = device.movement_detected;
      const gps = device.gps && device.gps.valid;

      if (device.rfid_result === 'rejected') {
        banner.classList.add('alert');
        title.textContent = 'ALERT — RFID REJECTED';
        sub.textContent = 'Tag authentication failed. Unauthorized access attempt.';
      } else if (bagOpen && locked === false) {
        banner.classList.add('alert');
        title.textContent = 'ALERT — BAG OPEN, LOCK UNLOCKED';
        sub.textContent = 'Bag is open and the lock is not secured.';
      } else if (bagOpen) {
        banner.classList.add('warn');
        title.textContent = 'WARNING — BAG OPEN';
        sub.textContent = 'Reed switch reports the bag as open.';
      } else if (movement) {
        banner.classList.add('warn');
        title.textContent = 'ATTENTION — MOVEMENT DETECTED';
        sub.textContent = 'MPU6050 reports movement above threshold.';
      } else if (!gps) {
        banner.classList.add('warn');
        title.textContent = 'SECURE — LOCATION UNKNOWN';
        sub.textContent = 'Locked and closed, but no valid GPS fix. Location is unknown, not invented.';
      } else {
        title.textContent = 'SECURE — ALL SYSTEMS NOMINAL';
        sub.textContent = 'Locked, closed and reporting.';
      }
    }

    setChip('secChipLock', device.locked === true ? 'LOCKED' : device.locked === false ? 'UNLOCKED' : '—',
      device.locked === true ? 'ok' : device.locked === false ? 'bad' : '');
    setChip('secChipBag', device.bag_open === true ? 'OPEN' : device.bag_open === false ? 'CLOSED' : '—',
      device.bag_open === true ? 'bad' : device.bag_open === false ? 'ok' : '');
    setChip('secChipMove', device.movement_detected === true ? 'MOVING' : device.movement_detected === false ? 'STILL' : '—',
      device.movement_detected === true ? 'mid' : '');
    setChip('secChipGps', device.gps && device.gps.valid ? 'FIX' : device.gps ? 'NO FIX' : '—',
      device.gps && device.gps.valid ? 'ok' : device.gps ? 'mid' : '');
  }

  /* ---------- hero ---------- */
  function renderHero(device) {
    const chip = $('heroDeviceChip');
    const status = $('heroStatus');
    chip.textContent = 'DEVICE — ' + (device.device_id || 'unknown');
    chip.title = 'Source: ' + (device.source_ip || 'no device connected');
    status.classList.remove('live', 'stale', 'offline');
    if (device.connection === 'online') {
      status.textContent = 'LIVE';
      status.classList.add('live');
    } else if (device.connection === 'stale') {
      status.textContent = 'STALE';
      status.classList.add('stale');
    } else {
      status.textContent = 'OFFLINE';
      status.classList.add('offline');
    }
    const state = device.connection === 'online' ? 'connected'
      : device.connection === 'stale' ? 'stale' : 'awaiting telemetry';
    $('heroCode').innerHTML = `let bag = device.current(); <em>&gt;</em> ${state}`;
  }

  /* ---------- weight ---------- */
  function renderNumber(el, to) {
    if (!el) return;
    if (to == null) { el.textContent = '––'; lastWeight = null; return; }
    const from = lastWeight == null ? 0 : lastWeight;
    lastWeight = to;
    const t0 = performance.now();
    const dur = 650;
    function step(now) {
      const p = clamp((now - t0) / dur, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = (from + (to - from) * e).toFixed(2);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderWeight(device) {
    const v = device.weight_kg;
    renderNumber($('weightVal'), v);
    const cap = $('weightCap');
    const chip = $('weightChip');
    if (v == null) {
      cap.textContent = 'Calibrated · no live data';
      chip.textContent = 'NO DATA';
      chip.className = 'chip';
    } else {
      cap.textContent = `Calibrated · ${fmtAge(device.age_s)}`;
      chip.textContent = device.connection === 'online' ? 'LIVE' : device.connection === 'stale' ? 'STALE' : 'NO DATA';
      chip.className = 'chip' + (device.connection === 'online' ? ' ok' : '');
    }
    $('weightStamp').textContent = v == null ? '—' : `${Math.min(100, (v / MAX_W) * 100).toFixed(0)}% OF MAX`;

    const frac = clamp((v || 0) / MAX_W, 0, 1);
    const L = Math.PI * 125;
    $('gaugeArc').setAttribute('stroke-dasharray', `${(frac * L).toFixed(1)} 9999`);
    const theta = Math.PI * (1 - frac);
    const knob = $('gaugeKnob');
    knob.setAttribute('cx', (150 + 125 * Math.cos(theta)).toFixed(1));
    knob.setAttribute('cy', (145 - 125 * Math.sin(theta)).toFixed(1));
  }

  /* ---------- health ---------- */
  function moduleReading(key, device) {
    const s = device.sensors || {};
    const st = s[key] || 'not_tested';
    if (st === 'not_tested') return '—';
    if (st === 'offline') return 'OFFLINE';
    if (st === 'error') return 'ERROR';
    switch (key) {
      case 'rfid': return device.rfid_result ? device.rfid_result.toUpperCase() : 'ARMED';
      case 'servo': return device.locked == null ? '—' : device.locked ? 'LOCKED' : 'UNLOCKED';
      case 'hx711': return device.weight_kg == null ? '—' : `${device.weight_kg.toFixed(2)} kg`;
      case 'mpu6050': return device.movement_detected === true ? 'MOVING' : device.movement_detected === false ? 'STILL' : '—';
      case 'reed_switch': return device.bag_open === true ? 'OPEN' : device.bag_open === false ? 'CLOSED' : '—';
      case 'ultrasonic': return device.distance_cm == null ? '—' : `${device.distance_cm.toFixed(1)} cm`;
      case 'gps': return device.gps && device.gps.valid ? 'FIX VALID' : 'NO FIX';
      case 'buzzer': return device.buzzer ? 'ALERT' : 'IDLE';
      case 'esp32_cam': return 'MODULE OK';
      default: return '—';
    }
  }

  function renderHealth(device) {
    const list = $('healthList');
    const stateList = $('healthStateList');
    const bar = $('healthBar');
    const chip = $('healthChip');
    const sensors = device.sensors || {};

    let rows = '', states = '', barHTML = '';
    let online = 0;
    for (const m of MODULE_META) {
      const st = sensors[m.key] || 'not_tested';
      if (st === 'online') online++;
      rows += `<li><span class="name"><span class="st-dot" data-st="${st}"></span>${m.label}</span><span class="st-chip ${st}">${st.replace('_', ' ').toUpperCase()}</span></li>`;
      states += `<li>${moduleReading(m.key, device)}</li>`;
      barHTML += `<span class="${st}" title="${m.label}: ${st.replace('_', ' ')}"></span>`;
    }
    list.innerHTML = rows;
    stateList.innerHTML = states;
    bar.innerHTML = barHTML;

    list.querySelectorAll('.st-dot').forEach(d => {
      const st = d.dataset.st;
      d.style.background = st === 'online' ? '#03c37b'
        : st === 'offline' ? '#3d3d49'
        : st === 'error' ? '#ff7d6b' : '#a86bd6';
      d.style.boxShadow = st === 'online' ? '0 0 8px rgba(3,195,123,.55)' : 'none';
    });

    chip.textContent = `${online}/${MODULE_META.length} ONLINE`;
    chip.className = 'chip' + (online === MODULE_META.length ? ' ok' : online > 0 ? ' warn' : '');
  }

  /* ---------- telemetry grid ---------- */
  function renderTelemetry(device) {
    const grid = $('telemetryGrid');
    const legend = $('telemetryLegend');
    const strip = $('telemetryStrip');
    const count = $('telemetryCount');
    const sensors = device.sensors || {};

    const tiles = [
      { name: 'Weight', val: device.weight_kg == null ? '—' : `${device.weight_kg.toFixed(2)} kg`, dot: device.weight_kg == null ? 'unknown' : 'online' },
      { name: 'Lock', val: device.locked === true ? 'LOCKED' : device.locked === false ? 'UNLOCKED' : '—', dot: device.locked == null ? 'unknown' : device.locked ? 'online' : 'bad' },
      { name: 'Bag', val: device.bag_open === true ? 'OPEN' : device.bag_open === false ? 'CLOSED' : '—', dot: device.bag_open == null ? 'unknown' : device.bag_open ? 'bad' : 'online' },
      { name: 'Motion', val: device.movement_detected === true ? 'MOVING' : device.movement_detected === false ? 'STILL' : '—', dot: device.movement_detected == null ? 'unknown' : device.movement_detected ? 'warn' : 'online' },
      { name: 'Distance', val: device.distance_cm == null ? '—' : `${device.distance_cm.toFixed(1)} cm`, dot: device.distance_cm == null ? 'unknown' : 'online' },
      { name: 'GPS', val: device.gps && device.gps.valid ? 'FIX VALID' : 'NO FIX', dot: device.gps && device.gps.valid ? 'online' : 'unknown' },
      { name: 'RFID', val: device.rfid_result ? device.rfid_result.replace('accepted', 'ACCEPTED').replace('rejected', 'REJECTED').toUpperCase() : '—', dot: device.rfid_result === 'accepted' ? 'online' : device.rfid_result === 'rejected' ? 'bad' : 'unknown' },
      { name: 'Servo', val: sensors.servo === 'online' ? (device.locked === true ? 'LOCKED' : device.locked === false ? 'UNLOCKED' : 'ARMED') : 'OFFLINE', dot: sensors.servo === 'online' ? 'online' : 'unknown' },
      { name: 'HX711', val: sensors.hx711 === 'online' ? (device.weight_kg == null ? 'NO READING' : 'READING') : (sensors.hx711 || '—').toUpperCase(), dot: sensors.hx711 === 'online' ? 'online' : 'unknown' },
      { name: 'MPU6050', val: sensors.mpu6050 === 'online' ? (device.movement_detected === true ? 'MOVING' : 'IDLE') : (sensors.mpu6050 || '—').toUpperCase(), dot: sensors.mpu6050 === 'online' ? 'online' : 'unknown' },
      { name: 'Reed', val: device.bag_open === true ? 'OPEN' : device.bag_open === false ? 'CLOSED' : '—', dot: device.bag_open == null ? 'unknown' : device.bag_open ? 'bad' : 'online' },
      { name: 'Ultrasonic', val: device.distance_cm == null ? '—' : `${device.distance_cm.toFixed(1)} cm`, dot: device.distance_cm == null ? 'unknown' : 'online' },
      { name: 'Buzzer', val: sensors.buzzer === 'error' ? 'ERROR' : (device.buzzer ? 'ALERT' : 'IDLE'), dot: sensors.buzzer === 'error' ? 'bad' : sensors.buzzer === 'online' ? 'online' : 'unknown' },
      { name: 'ESP32-CAM', val: sensors.esp32_cam === 'online' ? 'MODULE OK' : (sensors.esp32_cam || 'OFFLINE').toUpperCase(), dot: sensors.esp32_cam === 'online' ? 'online' : 'unknown' },
      { name: 'AI Service', val: aiHistory ? aiHistory.classification : '—', dot: aiHistory ? (aiHistory.classification === 'SAFE' ? 'online' : aiHistory.classification === 'WARNING' ? 'warn' : 'bad') : 'unknown' },
    ];

    grid.innerHTML = tiles.map(t => `
      <div class="tile">
        <span class="tile-dot ${t.dot}"></span>
        <div class="tile-name">${t.name}</div>
        <div class="tile-val">${t.val}</div>
      </div>`).join('');

    const counts = { online: 0, offline: 0, not_tested: 0, error: 0 };
    MODULE_META.forEach(m => { const st = sensors[m.key] || 'not_tested'; counts[st] = (counts[st] || 0) + 1; });
    const total = MODULE_META.length;
    const labels = { online: 'Online', offline: 'Offline', not_tested: 'Not tested', error: 'Error' };
    const colors = { online: '#03c37b', offline: '#3d3d49', not_tested: '#a86bd6', error: '#ff7d6b' };
    legend.innerHTML = Object.keys(counts).map(k => `
      <div class="legend-row">
        <span class="swatch" style="background:${colors[k]}"></span>
        <span>${labels[k]}</span>
        <b>${counts[k]}</b>
        <span class="pct">${Math.round((counts[k] / total) * 100)}%</span>
      </div>`).join('');

    count.textContent = String(total).padStart(2, '0');

    strip.innerHTML = MODULE_META.map(m => {
      const st = sensors[m.key] || 'not_tested';
      return `<span class="${st}" title="${m.label}"></span>`;
    }).join('');
  }

  /* ---------- GPS ---------- */
  function renderGps(device) {
    const gps = device.gps;
    const valid = gps && gps.valid && gps.latitude != null;
    $('mapWrap').classList.toggle('valid', !!valid);
    const chip = $('gpsChip');
    chip.textContent = valid ? 'VALID FIX' : 'NO FIX';
    chip.className = 'chip' + (valid ? ' ok' : '');
    $('gpsCoords').textContent = valid ? fmtCoords(gps) : 'No valid fix';
    const link = $('gpsLink');
    if (valid) {
      link.href = `https://www.google.com/maps/search/?api=1&query=${gps.latitude},${gps.longitude}`;
      link.hidden = false;
      $('gpsFixTime').textContent = `Fix: ${fmtTime(gps.fix_time)}`;
      $('gpsAge').textContent = `Age: ${fmtAge(device.age_s)}`;
      window.STB_MAP.setFix(gps.latitude, gps.longitude, gps.fix_time);
    } else {
      link.hidden = true;
      $('gpsFixTime').textContent = 'Fix: —';
      $('gpsAge').textContent = 'Age: —';
      window.STB_MAP.setFix(null, null, null);
    }
  }

  /* ---------- camera ---------- */
  function renderCamera() {
    const url = CONFIG.cameraUrl;
    const img = $('cameraImg');
    const off = $('cameraOff');
    const chip = $('cameraChip');
    const title = $('cameraOffTitle');
    const sub = $('cameraOffSub');

    if (!url) {
      img.hidden = true;
      off.hidden = false;
      chip.textContent = 'NOT CONFIGURED';
      chip.className = 'chip';
      title.textContent = 'CAMERA NOT CONFIGURED';
      sub.textContent = 'Set STB_CAMERA_URL to the ESP32-CAM stream';
      $('cameraOffNote').textContent = 'Example: http://192.168.1.50:81/stream';
      return;
    }
    if (!img.src || img.dataset.url !== url) {
      img.dataset.url = url;
      img.hidden = true;
      img.onerror = () => {
        img.hidden = true;
        off.hidden = false;
        chip.textContent = 'OFFLINE';
        chip.className = 'chip bad';
        title.textContent = 'CAMERA OFFLINE';
        sub.textContent = 'Stream unreachable — check network and power';
        $('cameraOffNote').textContent = 'The browser keeps showing this state. Retry to re-attempt.';
      };
      img.onload = () => {
        off.hidden = true;
        img.hidden = false;
        chip.textContent = 'LIVE';
        chip.className = 'chip ok';
        title.textContent = 'STREAM LIVE';
        sub.textContent = '';
      };
      img.src = url;
    }
  }

  /* ---------- AI ---------- */
  function renderAI() {
    const chip = $('aiChip');
    const cls = $('aiClass');
    const risk = $('aiRisk');
    const expl = $('aiExplanation');
    const meta = $('aiMeta');

    if (!aiHistory) {
      chip.textContent = 'UNAVAILABLE'; chip.className = 'chip';
      cls.textContent = '—'; cls.className = 'ai-classification';
      risk.textContent = 'No analysis available';
      expl.textContent = 'No live snapshot has been analysed yet. This panel never claims SAFE when the AI service is down.';
      meta.textContent = 'Advisory only — not a theft detector';
      return;
    }
    const c = aiHistory.classification;
    chip.textContent = c; chip.className = 'chip ' + (c === 'SAFE' ? 'ok' : c === 'WARNING' ? 'warn' : 'bad');
    cls.textContent = c;
    cls.className = 'ai-classification ' + c.toLowerCase();
    risk.textContent = `RISK · ${(aiHistory.risk || 'unknown').toUpperCase()}`;
    expl.textContent = aiHistory.explanation || 'No explanation returned.';
    meta.textContent = `Advisory · ${aiHistory.advisory !== false ? 'not a theft detector' : 'service-reported'} · ${fmtTime(aiHistory.timestamp)}`;
  }

  /* ---------- events ---------- */
  function evHTML(ev) {
    const ago = fmtAgoTs(ev.ts);
    return `<li>
      <span class="ev-dot ${ev.severity}"></span>
      <div class="ev-body">
        <div class="ev-msg">${escapeHTML(ev.message)}</div>
        <div class="ev-meta">${ev.type.toUpperCase().replace(/_/g, ' ')} · ${ago} · ${fmtTime(ev.ts)}</div>
      </div>
    </li>`;
  }

  function filteredEvents() {
    if (currentFilter === 'all') return events;
    if (currentFilter === 'security') {
      return events.filter(ev => ['rfid_accepted', 'rfid_rejected', 'bag_opened', 'bag_closed', 'lock_changed', 'gps_fix', 'gps_fix_lost'].includes(ev.type));
    }
    return events.filter(ev => ev.severity === currentFilter);
  }

  function renderEvents() {
    $('eventsCount').textContent = String(events.length);
    $('eventsTotal').textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;

    $('eventList').innerHTML = events.slice(0, 5).map(evHTML).join('') ||
      `<li class="ev-empty">No events yet. They will appear here once the bag starts reporting.</li>`;

    const full = $('fullEventList');
    const filtered = filteredEvents();
    full.innerHTML = filtered.map(evHTML).join('') ||
      `<li class="ev-empty">No matching events.</li>`;
  }

  /* ---------- footer ---------- */
  function renderFooter(device) {
    const conn = device.connection || 'offline';
    $('footerDot').className = 'pulse-dot ' + (conn === 'online' ? 'live' : conn === 'stale' ? 'stale' : 'offline');
    if (conn === 'online') $('footerStatus').textContent = `Live — age ${fmtAge(device.age_s)}`;
    else if (conn === 'stale') $('footerStatus').textContent = `Stale — last update ${fmtAge(device.age_s)}`;
    else $('footerStatus').textContent = 'Offline — no telemetry received';
    $('footerMeta').textContent = device.posted_at
      ? `Updated ${fmtTime(device.posted_at)} · device ${device.device_id || '—'}`
      : 'Last update: —';
  }

  /* ---------- charts / tables ---------- */
  function renderTrend() {
    const el = $('chartWrap');
    if (el && window.STB_CHART) window.STB_CHART.render(el, history, MAX_W);
    const stats = $('trendStats');
    if (stats && window.STB_CHART) window.STB_CHART.stats(stats, history);
    const chip = $('trendChip');
    if (chip) chip.textContent = history.length >= 2 ? 'LIVE TREND' : '—';
  }

  function renderModuleTable(device) {
    const body = $('modTableBody');
    if (!body) return;
    const sensors = device.sensors || {};
    body.innerHTML = MODULE_META.map(m => {
      const st = sensors[m.key] || 'not_tested';
      return `<tr>
        <td>${m.label}</td>
        <td><span class="state-tag ${st}">${st.replace('_', ' ').toUpperCase()}</span></td>
        <td class="reading">${moduleReading(m.key, device)}</td>
        <td class="ts">${fmtAge(device.age_s)}</td>
      </tr>`;
    }).join('');
  }

  /* ---------- master render ---------- */
  function render() {
    if (!last) {
      const d = { connection: 'offline', sensors: {}, age_s: null };
      renderHeader(d); renderHero(d); renderBanner(d); renderWeight(d); renderHealth(d);
      renderTelemetry(d); renderGps(d); renderCamera(); renderAI(); renderEvents(); renderFooter(d);
      renderSidebar(d); renderTrend(); renderModuleTable(d); renderConnection();
      return;
    }
    const d = last.device;
    renderHeader(d); renderHero(d); renderBanner(d); renderWeight(d); renderHealth(d);
    renderTelemetry(d); renderGps(d); renderCamera(); renderAI(); renderEvents(); renderFooter(d);
    renderSidebar(d); renderTrend(); renderModuleTable(d); renderConnection();
  }

  /* ---------- polling ---------- */
  async function poll() {
    try {
      last = await getJSON('/api/status');
      conn = await getJSON('/api/connection').catch(() => null);
      render();
    } catch (e) {
      if (last) {
        last.device.connection = 'offline';
        last.device.age_s = null;
      } else {
        last = null;
      }
      render();
    }

    try {
      const ev = await getJSON('/api/events?limit=60');
      events = ev.events || [];
      renderEvents();
    } catch (_) {}

    try {
      const h = await getJSON('/api/history');
      history = (h.history || []).map(x => ({ ts: x.ts, weight_kg: x.weight_kg }));
      renderTrend();
    } catch (_) {}
  }

  /* ---------- AI ---------- */
  async function runAI() {
    try {
      const res = await postJSON('/api/analyze');
      aiHistory = (res.ok && res.result) ? res.result : null;
    } catch (e) {
      aiHistory = null;
    }
    renderAI();
    renderTelemetry(last ? last.device : { sensors: {} });
  }

  /* ---------- views ---------- */
  const navItems = document.querySelectorAll('.side-nav-item');
  function setView(view, push) {
    navItems.forEach(b => {
      b.classList.toggle('active', b.dataset.view === view);
      if (b.dataset.view === view) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    renderViewTitle(view);
    if (view === 'sensors') renderTrend();
    if (view === 'events') renderEvents();
  }
  navItems.forEach(b => b.addEventListener('click', () => {
    setView(b.dataset.view);
    location.hash = b.dataset.view;
  }));

  // hash-based deep link
  const initial = (location.hash || '').replace('#', '');
  if (VIEW_META[initial]) setView(initial);
  else setView('dashboard');

  /* ---------- events list filter ---------- */
  document.querySelectorAll('#filterChips .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#filterChips .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderEvents();
    });
  });

  /* ---------- manual refresh ---------- */
  $('refreshBtn').addEventListener('click', () => {
    const btn = $('refreshBtn');
    btn.classList.add('spinning');
    poll().finally(() => setTimeout(() => btn.classList.remove('spinning'), 700));
  });

  /* ---------- sidebar collapse ---------- */
  const stored = localStorage.getItem('stb-sidebar-collapsed');
  const mobileDefault = window.matchMedia && window.matchMedia('(max-width: 860px)').matches;
  setSidebarCollapsed(stored !== null ? stored === '1' : mobileDefault);
  $('collapseBtn').addEventListener('click', () => setSidebarCollapsed(true));
  $('reopenBtn').addEventListener('click', () => setSidebarCollapsed(false));

  /* ---------- connection view ---------- */
  function renderConnection() {
    const big = $('connBig');
    const sub = $('connSub');
    const chip = $('connStatusChip');
    if (!big || !conn || !$('connEndpointUrl')) return;
    const connName = conn.connection || 'offline';
    const map = {
      online:  { text: 'CONNECTED', cls: 'ok',   sub: `ESP32 reporting — last update ${fmtAge(conn.age_s)}.` },
      stale:   { text: 'STALE',     cls: 'warn', sub: `No fresh telemetry for ${fmtAge(conn.age_s)} — check the ESP32 and its Wi-Fi.` },
      offline: { text: 'OFFLINE',   cls: '',     sub: 'No ESP32 connected yet — the dashboard lights up the moment the bag starts reporting.' },
    };
    const m = map[connName] || map.offline;
    big.textContent = m.text;
    big.className = 'conn-big ' + m.cls;
    chip.textContent = m.text;
    chip.className = 'chip ' + m.cls;
    sub.textContent = m.sub;
    $('connDeviceId').textContent = conn.device_id || '—';
    $('connSourceIp').textContent = conn.source_ip || '—';
    $('connLastUpdate').textContent = conn.posted_at ? fmtTime(conn.posted_at) : '—';
    $('connAge').textContent = conn.age_s == null ? '—' : `${conn.age_s}s (threshold ${(conn.stale_seconds || 10)}s)`;
    $('connSeq').textContent = conn.seq == null ? '—' : `#${conn.seq}`;
    $('connModules').textContent = `${conn.modules_reported || 0} / ${conn.modules_total || 9}`;

    const ep = conn.endpoint;
    if (ep) {
      $('connEndpointUrl').textContent = `POST http://${ep.host}:${ep.port}${ep.path}`;
    }
  }
  $('connRetryBtn').addEventListener('click', () => poll());
  $('connCopyBtn').addEventListener('click', async () => {
    const host = conn && conn.endpoint ? conn.endpoint.host : 'YOUR_HOST';
    const port = conn && conn.endpoint ? conn.endpoint.port : 5001;
    const url = `http://${host}:${port}/api/update`;
    const text = `curl -X POST ${url} -H 'Content-Type: application/json' \
  -d '{"device_id":"smart-travel-bag-01","weight_kg":4.25,"locked":true,"bag_open":false,"movement_detected":false,"distance_cm":85.4,"gps":{"valid":true,"latitude":20.4625,"longitude":85.8828},"sensors":{"rfid":"online","servo":"online","hx711":"online","mpu6050":"online","reed_switch":"online","ultrasonic":"online","gps":"online","buzzer":"online","esp32_cam":"online"}}'`;
    try {
      await navigator.clipboard.writeText(text);
      $('connCopyBtn').textContent = 'Copied!';
      setTimeout(() => { $('connCopyBtn').textContent = 'Copy curl example'; }, 1600);
    } catch (_) {
      $('connCopyBtn').textContent = 'Copy not available';
    }
  });

  /* ---------- AI button ---------- */
  $('aiAnalyzeBtn').addEventListener('click', runAI);

  /* ---------- events view button ---------- */
  $('viewAllEvents').addEventListener('click', () => setView('events'));

  /* ---------- camera retry ---------- */
  $('cameraRetry').addEventListener('click', () => {
    const img = $('cameraImg');
    if (img) { img.dataset.url = ''; delete img.onload; delete img.onerror; renderCamera(); }
  });

  window.addEventListener('resize', () => { renderTrend(); }, { passive: true });

  /* ---------- boot ---------- */
  poll();
  setInterval(poll, POLL_MS);
  setInterval(() => {
    if (last && last.device && last.device.connection === 'online') runAI();
  }, (CONFIG.aiAutoMs || 30000) * 1);
})();
