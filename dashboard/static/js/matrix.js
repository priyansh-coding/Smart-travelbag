/* Hero rain — sparse black & white falling code streaks.
   Faithful to the reference: grey/white hex-like glyphs falling in a
   diagonal streak over near-black. Low opacity, deliberate & quiet. */
(function () {
  'use strict';

  const TOKENS = ['0x1F', '0xA1', '0x7A', '0x0B', '0x63', '0x4C', '0x2D', '0xE9', '0x74', '0xE3',
                  '0x58', '0xB2', '0x12', '0x6B', '0xFF', '0xAC', '0x09', '0xAA', '0x5F',
                  '0xF4', '0x3E', '0x77', '0x9A', '0xDE', '0x1B', '0x84', '0xF0', '0x6E',
                  '0x04', '0x31', '0xBE', '0x7F', '0xB6', '0xC1', '0x0E', '0x55', '0x8D'];

  let ctx = null, canvas = null, raf = null;
  let streams = [], W = 0, H = 0, dpr = 1;

  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.max(1, Math.floor(W * dpr));
    canvas.height = Math.max(1, Math.floor(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed() {
    streams = [];
    const n = Math.max(4, Math.floor(W / 90));
    for (let i = 0; i < n; i++) {
      streams.push(newStream(true));
    }
  }

  function newStream(randomStart) {
    return {
      x: Math.random() * (W + 160) - 90,
      y: randomStart ? Math.random() * H : -20 - Math.random() * 160,
      speed: 0.34 + Math.random() * 0.85,
      len: 20 + Math.floor(Math.random() * 30),
      size: 10.5 + Math.random() * 3.5,
      slope: 0.55 + Math.random() * 0.85,   // diagonal drift (px per row)
      alpha: 0.30 + Math.random() * 0.45,
      bright: Math.random() < 0.32,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'top';

    for (const s of streams) {
      for (let j = 0; j < s.len; j++) {
        const y = s.y + j * 15;
        const x = s.x + j * s.slope;
        if (y < -24 || y > H + 24 || x < -60 || x > W + 60) continue;
        const p = j / s.len;
        const a = s.alpha * (1 - p) * (1 - p);
        const ci = Math.abs((Math.floor(s.y * 0.13) + j * 7 + Math.floor(s.x)) % TOKENS.length);
        ctx.font = `${s.bright && j === 0 ? 14 : s.size}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = s.bright
          ? `rgba(255, 255, 255, ${(a * 1.6).toFixed(3)})`
          : `rgba(205, 214, 228, ${a.toFixed(3)})`;
        ctx.fillText(TOKENS[ci], x, y);
      }
      s.y += s.speed;
      s.x += s.slope * 0.35;
      if (s.y - s.len * 15 > H + 30) {
        Object.assign(s, newStream(false));
      }
    }
  }

  function tick() {
    draw();
    raf = requestAnimationFrame(tick);
  }

  function start() {
    canvas = document.getElementById('heroRain');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    const IO = window.IntersectionObserver || null;
    if (IO) {
      const io = new IO((entries) => {
        const visible = entries.some(e => e.isIntersecting);
        if (visible && !raf) raf = requestAnimationFrame(tick);
        if (!visible && raf) { cancelAnimationFrame(raf); raf = null; }
      });
      io.observe(canvas);
    } else {
      raf = requestAnimationFrame(tick);
    }
    window.addEventListener('resize', resize, { passive: true });
  }

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    // one static pass of glyphs, no animation
    canvas = document.getElementById('heroRain');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const c2 = canvas.getContext('2d');
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = rect.width; H = rect.height;
      ctx = c2;
      seed();
      // draw a few static streams
      for (const s of streams) {
        for (let j = 0; j < s.len; j++) {
          const y = s.y + j * 15;
          const x = s.x + j * s.slope;
          if (y < -24 || y > H + 24) continue;
          const p = j / s.len;
          const a = s.alpha * (1 - p) * (1 - p);
          c2.font = "11px 'JetBrains Mono', monospace";
          c2.fillStyle = `rgba(196, 206, 222, ${a.toFixed(3)})`;
          c2.fillText(TOKENS[(j * 7 + Math.floor(s.x)) % TOKENS.length], x, y);
        }
      }
    }
  } else {
    start();
  }
})();
