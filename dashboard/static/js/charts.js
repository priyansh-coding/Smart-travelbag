/* Weight trend chart — smooth SVG area chart from live telemetry history. */
(function () {
  'use strict';

  function fmt(n, d) { return n.toFixed(d == null ? 1 : d); }

  function smoothPath(points) {
    if (points.length < 2) return points.length ? `M ${points[0][0]} ${points[0][1]}` : '';
    let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  }

  window.STB_CHART = {
    render(el, history, maxWeight) {
      if (!el) return;
      const W = el.clientWidth || 600;
      const H = el.clientHeight || 230;
      const pad = { top: 18, right: 16, bottom: 26, left: 44 };
      const iw = W - pad.left - pad.right;
      const ih = H - pad.top - pad.bottom;

      if (!history || history.length < 2) {
        el.innerHTML = `<div class="chart-empty"><span>⌁</span><br>No live weight history yet<br><small>Send telemetry with weight_kg to draw a trend</small></div>`;
        return;
      }

      const vals = history.map(h => h.weight_kg);
      const mn = Math.min(...vals), mx = Math.max(...vals);
      const range = Math.max(0.5, mx - mn);
      const yMin = Math.max(0, mn - range * 0.45);
      const yMax = Math.min(maxWeight || 20, mx + range * 0.45);
      const xFor = i => pad.left + (i / (history.length - 1)) * iw;
      const yFor = v => pad.top + ih - ((v - yMin) / (yMax - yMin)) * ih;

      const pts = history.map((h, i) => [xFor(i), yFor(h.weight_kg)]);
      const line = smoothPath(pts);
      const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${(pad.top + ih).toFixed(1)} L ${pts[0][0].toFixed(1)} ${(pad.top + ih).toFixed(1)} Z`;

      // grid lines + y labels
      const ticks = [yMin, yMin + (yMax - yMin) / 2, yMax];
      let grid = '';
      ticks.forEach(t => {
        const y = yFor(t);
        grid += `<line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" stroke="rgba(255,255,255,.07)" stroke-dasharray="3 5"/>`;
        grid += `<text x="${pad.left - 9}" y="${y + 3.5}" text-anchor="end" font-family="'JetBrains Mono',monospace" font-size="9" fill="#6f6f7d">${fmt(t, 1)}kg</text>`;
      });

      const firstTs = history[0].ts, lastTs = history[history.length - 1].ts;
      const mid = Math.floor(history.length / 2);
      const fmtTime = ts => {
        const d = new Date(ts * 1000);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      };
      const xLabels = `
        <text x="${pad.left}" y="${H - 7}" font-family="'JetBrains Mono',monospace" font-size="9" fill="#6f6f7d">${fmtTime(firstTs)}</text>
        <text x="${pad.left + iw}" y="${H - 7}" text-anchor="end" font-family="'JetBrains Mono',monospace" font-size="9" fill="#6f6f7d">${fmtTime(lastTs)}</text>`;

      const last = pts[pts.length - 1];

      const svg = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ff79fa" stop-opacity="0.42"/>
            <stop offset="45%" stop-color="#8a7dff" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#03c37b" stop-opacity="0.03"/>
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#ff79fa"/>
            <stop offset="55%" stop-color="#8a7dff"/>
            <stop offset="100%" stop-color="#03c37b"/>
          </linearGradient>
        </defs>
        ${grid}${xLabels}
        <path d="${area}" fill="url(#areaGrad)"/>
        <path d="${line}" fill="none" stroke="url(#lineGrad)" stroke-width="2.6" stroke-linecap="round"/>
        <circle cx="${last[0]}" cy="${last[1]}" r="5" fill="#fff"/>
        <circle cx="${last[0]}" cy="${last[1]}" r="9" fill="none" stroke="rgba(3,195,123,.55)" stroke-width="1.4"/>
      </svg>`;
      el.innerHTML = svg;
    },

    stats(el, history) {
      if (!el) return;
      if (!history || history.length < 2) { el.innerHTML = ''; return; }
      const vals = history.map(h => h.weight_kg);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const max = Math.max(...vals), min = Math.min(...vals);
      el.innerHTML = `
        <div class="stat"><span class="stat-num">${fmt(avg, 2)}kg</span><span class="stat-label">Avg</span></div>
        <div class="stat"><span class="stat-num">${fmt(max, 2)}kg</span><span class="stat-label">Peak</span></div>
        <div class="stat"><span class="stat-num">${fmt(min, 2)}kg</span><span class="stat-label">Low</span></div>
        <div class="stat"><span class="stat-num">${history.length}</span><span class="stat-label">Samples</span></div>`;
    },
  };
})();
