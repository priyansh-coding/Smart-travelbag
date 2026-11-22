/* Dotted world map for the GPS panel.
   - Dots sampled from real land geometry (d3.geoContains + world-atlas land-110m)
   - Pin: current valid fix with a pulsing ring
   - Arc: great-circle path between the last two valid fixes (real trajectory only)
   Never draws a location without a valid fix. */
(function () {
  'use strict';

  let land = null;
  let canvas = null, ctx = null, W = 0, H = 0, dpr = 1;
  let dots = null, projection = null;
  let fix = null;        // {lat, lon, ts}
  let arcFrom = null;    // previous fix {lat, lon, ts}
  let animId = null, t0 = 0;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function load() {
    try {
      const res = await fetch('/static/vendor/land-110m.json');
      const topo = await res.json();
      land = topojson.feature(topo, topo.objects.land);
    } catch (e) {
      land = null;
    }
  }

  function project(lon, lat) {
    if (!projection) return null;
    return projection([lon, lat]);
  }

  function setup() {
    canvas = document.getElementById('worldMap');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.max(1, Math.floor(W * dpr));
    canvas.height = Math.max(1, Math.floor(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = 12;
    projection = d3.geoNaturalEarth1().fitExtent([[pad, pad], [W - pad, H - pad]], land ? land : { type: 'Sphere' });

    if (land) {
      dots = [];
      for (let lat = -58; lat <= 84; lat += 2.6) {
        for (let lon = -179; lon <= 179; lon += 2.9) {
          if (d3.geoContains(land, [lon, lat])) {
            const p = project(lon, lat);
            if (p) dots.push(p);
          }
        }
      }
    }
  }

  function draw() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b0b10';
    ctx.fillRect(0, 0, W, H);

    if (dots) {
      ctx.fillStyle = fix ? 'rgba(148, 163, 184, 0.55)' : 'rgba(120, 130, 150, 0.28)';
      for (const p of dots) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (!fix) return;
    const cur = project(fix.lon, fix.lat);
    if (!cur) return;

    // great-circle arc from previous fix to current fix
    if (arcFrom && (Math.abs(arcFrom.lat - fix.lat) > 0.01 || Math.abs(arcFrom.lon - fix.lon) > 0.01)) {
      const interp = d3.geoInterpolate([arcFrom.lon, arcFrom.lat], [fix.lon, fix.lat]);
      const steps = 110;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 121, 250, 0.6)';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([3.5, 6]);
      if (!reduce) ctx.lineDashOffset = -((performance.now() - t0) / 8) % 90;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const [lon, lat] = interp(i / steps);
        const p = project(lon, lat);
        if (!p) continue;
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
      ctx.restore();

      // previous pin
      const prev = project(arcFrom.lon, arcFrom.lat);
      if (prev) {
        ctx.beginPath();
        ctx.arc(prev[0], prev[1], 3.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
        ctx.fill();
      }
    }

    const pulse = reduce ? 0.5 : (0.5 + 0.5 * Math.sin(performance.now() / 420));

    // halo
    ctx.beginPath();
    ctx.arc(cur[0], cur[1], 15 + pulse * 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(3, 195, 123, ${0.10 + pulse * 0.16})`;
    ctx.lineWidth = 6;
    ctx.stroke();

    // pulsing ring
    ctx.beginPath();
    ctx.arc(cur[0], cur[1], 8 + pulse * 8, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(3, 195, 123, ${0.55 - pulse * 0.35})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // core
    ctx.beginPath();
    ctx.arc(cur[0], cur[1], 4.6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cur[0], cur[1], 2.3, 0, Math.PI * 2);
    ctx.fillStyle = '#03c37b';
    ctx.fill();
  }

  function animate() {
    draw();
    if (!reduce && fix) animId = requestAnimationFrame(animate);
    else animId = null;
  }

  function start() {
    if (reduce) return;
    if (animId) return;
    t0 = performance.now();
    animId = requestAnimationFrame(animate);
  }

  function stop() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
  }

  window.STB_MAP = {
    setFix(lat, lon, ts) {
      const valid = lat != null && lon != null && !isNaN(lat) && !isNaN(lon);
      if (!valid) {
        fix = null;
        arcFrom = null;
        stop();
        draw();
        return;
      }
      if (fix && fix.lat !== lat && fix.lon !== lon) arcFrom = fix;
      fix = { lat, lon, ts };
      start();
      draw();
    },
    resize() { setup(); draw(); if (!reduce && fix) start(); },
  };

  document.addEventListener('DOMContentLoaded', async () => {
    await load();
    setup();
    draw();
    const wrap = document.getElementById('mapWrap');
    if (wrap && window.ResizeObserver) {
      new ResizeObserver(() => window.STB_MAP.resize()).observe(wrap);
    }
  });
})();
