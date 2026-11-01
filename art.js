/* קו האש: ציור רקעים, מחסות, דמויות, כלי רכב ובוסים */
(function () {
  const W = 1280, H = 720;
  const A = { W, H };

  // ---------- כלים ----------
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const lerp = (a, b, t) => a + (b - a) * t;
  function rgbOf(c) {
    if (Array.isArray(c)) return c;
    if (c[0] === '#') {
      let h = c.slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join('');
      const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
    }
    const m = c.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]];
  }
  function mix(a, b, t) {
    const x = rgbOf(a), y = rgbOf(b);
    return '#' + x.map((v, i) => Math.max(0, Math.min(255, Math.round(lerp(v, y[i], t)))).toString(16).padStart(2, '0')).join('');
  }
  const shade = (c, t) => t >= 0 ? mix(c, '#ffffff', t) : mix(c, '#000000', -t);
  const rgba = (c, a) => { const x = rgbOf(c); return `rgba(${x[0]},${x[1]},${x[2]},${a})`; };
  A.rng = rng; A.mk = mk; A.mix = mix; A.shade = shade; A.rgba = rgba; A.lerp = lerp;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); }
  function vgrad(ctx, y0, y1, stops) { const g = ctx.createLinearGradient(0, y0, 0, y1); stops.forEach((s, i) => g.addColorStop(s[0], s[1])); return g; }
  function hgrad(ctx, x0, x1, stops) { const g = ctx.createLinearGradient(x0, 0, x1, 0); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; }
  A.rr = rr; A.poly = poly;

  // רעש לגרעיניות
  const NOISE = mk(256, 256);
  (() => {
    const c = NOISE.getContext('2d'); const d = c.createImageData(256, 256); const r = rng(7);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    c.putImageData(d, 0, 0);
  })();
  A.NOISE = NOISE;

  function speckle(ctx, x, y, w, h, n, col, r, size) {
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) { const px = x + r() * w, py = y + r() * h; const s = (0.5 + r()) * size; ctx.fillRect(px, py, s, s * 0.6); }
  }

  // ---------- זמני יום ----------
  const SKIES = {
    day: { top: '#3f7fc4', mid: '#9cc3e4', hor: '#efe2c4', sun: '#fff7dc', sunX: 0.72, sunY: 0.18, tint: '#000000', ta: 0, fog: '#e9dcc0' },
    dawn: { top: '#2e3d6e', mid: '#b97a82', hor: '#f8c48a', sun: '#ffd9a0', sunX: 0.2, sunY: 0.86, tint: '#3a2038', ta: 0.16, fog: '#e7b48c' },
    dusk: { top: '#1f1a44', mid: '#93446a', hor: '#f3874a', sun: '#ffb466', sunX: 0.78, sunY: 0.84, tint: '#2a1030', ta: 0.3, fog: '#c06a58' },
    night: { top: '#03050c', mid: '#0b1430', hor: '#22304f', sun: '#e6eeff', sunX: 0.24, sunY: 0.2, tint: '#060c22', ta: 0.52, fog: '#1d2844', moon: true },
  };
  A.SKIES = SKIES;

  const PALS = {
    olive: { wood: '#8a6a42', metal: '#5b6048', cloth: '#a8935e', stone: '#8d8676', accent: '#c8a04a', glow: '#ffcf7a' },
    sand: { wood: '#9a7448', metal: '#6b6a52', cloth: '#c9ac74', stone: '#b89a72', accent: '#d9a85a', glow: '#ffcf7a' },
    stone: { wood: '#7d5a3a', metal: '#55585a', cloth: '#b59c76', stone: '#cbb894', accent: '#a8743e', glow: '#ffd28a' },
    basalt: { wood: '#6e5638', metal: '#4f5448', cloth: '#9a8a5e', stone: '#4a4844', accent: '#9a8040', glow: '#ffcf7a' },
    forest: { wood: '#6a4a2c', metal: '#4b5246', cloth: '#7a7a4e', stone: '#7a7c72', accent: '#8a9a4a', glow: '#ffd28a' },
    dark: { wood: '#6e5034', metal: '#4b5560', cloth: '#5a5a50', stone: '#6a6a68', accent: '#c84a2a', glow: '#ffd08a' },
    palace: { wood: '#5a2e1e', metal: '#8a7440', cloth: '#7a2a30', stone: '#d8ccb4', accent: '#d4aa4a', glow: '#ffe2a0' },
    crater: { wood: '#6a4a3a', metal: '#5a6a7a', cloth: '#8a6a5a', stone: '#8a5a48', accent: '#4fe3ff', glow: '#69f5ff' },
    neon: { wood: '#3a3a48', metal: '#3c4a5c', cloth: '#2a3040', stone: '#4a5060', accent: '#ff3fb4', glow: '#4fe3ff' },
    hive: { wood: '#3a2040', metal: '#3a2a50', cloth: '#4a2a5a', stone: '#4a2a50', accent: '#7cffd4', glow: '#7cffd4' },
  };
  A.PALS = PALS;

  // ---------- שמיים ----------
  function paintSky(ctx, sky, HOR, r) {
    ctx.fillStyle = vgrad(ctx, 0, HOR, [[0, sky.top], [0.62, sky.mid], [1, sky.hor]]);
    ctx.fillRect(0, 0, W, HOR + 2);
    const sx = W * sky.sunX, sy = HOR * sky.sunY;
    if (sky.moon) {
      for (let i = 0; i < 260; i++) {
        const a = r() * 0.8 + 0.2; ctx.fillStyle = `rgba(255,255,255,${a * (1 - (i % 3) * 0.25)})`;
        const s = r() < 0.08 ? 2 : 1; ctx.fillRect(r() * W, r() * HOR * 0.9, s, s);
      }
      let g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 160);
      g.addColorStop(0, 'rgba(200,215,255,0.35)'); g.addColorStop(1, 'rgba(200,215,255,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - 160, sy - 160, 320, 320);
      ctx.fillStyle = '#eef2ff'; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(160,170,200,0.35)'; ctx.beginPath(); ctx.arc(sx - 6, sy - 4, 5, 0, 7); ctx.arc(sx + 7, sy + 6, 4, 0, 7); ctx.fill();
    } else {
      let g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 420);
      g.addColorStop(0, rgba(sky.sun, 0.9)); g.addColorStop(0.08, rgba(sky.sun, 0.55)); g.addColorStop(0.4, rgba(sky.sun, 0.12)); g.addColorStop(1, rgba(sky.sun, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, HOR);
      ctx.fillStyle = rgba('#ffffff', 0.9); ctx.beginPath(); ctx.arc(sx, sy, 26, 0, 7); ctx.fill();
    }
    // עננים
    const nc = sky.moon ? 4 : 9;
    for (let i = 0; i < nc; i++) {
      const cx = r() * W, cy = r() * HOR * 0.55 + 20, cw = 120 + r() * 260;
      for (let k = 0; k < 7; k++) {
        const ex = cx + (r() - 0.5) * cw, ey = cy + (r() - 0.5) * 18, er = 20 + r() * 40;
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, er);
        const cc = sky.moon ? '#3a4668' : mix(sky.hor, '#ffffff', 0.5);
        g.addColorStop(0, rgba(cc, sky.moon ? 0.25 : 0.35)); g.addColorStop(1, rgba(cc, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ex, ey, er * 2.2, er * 0.7, 0, 0, 7); ctx.fill();
      }
    }
  }

  function ridge(ctx, HOR, base, amp, freq, col, r, jag) {
    const ph = r() * 100, ph2 = r() * 100;
    ctx.beginPath(); ctx.moveTo(0, HOR + 2);
    for (let x = 0; x <= W; x += 8) {
      let y = Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.7 + ph2) * amp * 0.4;
      if (jag) y += (Math.sin(x * freq * 9 + ph) * 0.5 + (r() - 0.5)) * amp * jag;
      ctx.lineTo(x, HOR - base - y);
    }
    ctx.lineTo(W, HOR + 2); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }

  // ---------- שכבה רחוקה ----------
  function paintFar(ctx, kind, HOR, sky, r, emis) {
    const far = mix(sky.fog, sky.top, 0.35), far2 = mix(sky.fog, '#000000', 0.25);
    if (kind === 'dunes') {
      ridge(ctx, HOR, 26, 16, 0.006, mix(sky.fog, '#c89660', 0.4), r);
      ridge(ctx, HOR, 10, 12, 0.009, mix(sky.fog, '#b88250', 0.6), r);
    } else if (kind === 'mountains') {
      ridge(ctx, HOR, 90, 50, 0.004, far, r, 0.35);
      ridge(ctx, HOR, 40, 30, 0.007, mix(far, far2, 0.6), r, 0.25);
    } else if (kind === 'hills') {
      ridge(ctx, HOR, 50, 26, 0.005, far, r);
      ridge(ctx, HOR, 20, 18, 0.008, mix(far, '#4a5a3a', 0.4), r);
    } else if (kind === 'forest') {
      ridge(ctx, HOR, 60, 20, 0.005, far, r);
      ctx.fillStyle = mix(far, '#1e3020', 0.6);
      for (let x = -20; x < W + 20; x += 9) {
        const h = 40 + r() * 50; ctx.beginPath(); ctx.moveTo(x - 10, HOR + 2); ctx.lineTo(x, HOR - h); ctx.lineTo(x + 10, HOR + 2); ctx.fill();
      }
    } else if (kind === 'sea') {
      ctx.fillStyle = vgrad(ctx, HOR - 6, HOR + 4, [[0, mix(sky.hor, sky.mid, 0.4)], [1, mix(sky.top, '#103050', 0.5)]]);
      ctx.fillRect(0, HOR - 6, W, 10);
      ridge(ctx, HOR - 5, 4, 6, 0.01, mix(far, sky.top, 0.3), r);
    } else if (kind === 'city' || kind === 'airport') {
      const col = mix(far, '#1a1e28', 0.45);
      for (let x = 0; x < W;) {
        const w = 30 + r() * 70, h = (kind === 'airport' ? 20 : 40) + r() * (kind === 'airport' ? 40 : 140);
        ctx.fillStyle = col; ctx.fillRect(x, HOR - h, w, h + 2);
        if (sky.moon) for (let wy = HOR - h + 6; wy < HOR - 4; wy += 9) for (let wx = x + 4; wx < x + w - 4; wx += 8) if (r() < 0.18) emis.push(['rect', wx, wy, 3, 4, r() < 0.5 ? '#ffd890' : '#bfe0ff', 0.7]);
        x += w + r() * 6;
      }
      if (kind === 'airport') { ctx.fillStyle = col; ctx.fillRect(900, HOR - 120, 14, 120); ctx.fillRect(884, HOR - 136, 46, 22); emis.push(['dot', 907, HOR - 140, 3, '#ff3030', 1]); }
    } else if (kind === 'oldcity') {
      const col = mix(far, '#c8b490', 0.35);
      ctx.fillStyle = col; ctx.fillRect(0, HOR - 40, W, 42);
      for (let x = 0; x < W; x += 22) ctx.fillRect(x, HOR - 48, 12, 9);
      for (let i = 0; i < 9; i++) {
        const x = r() * W, w = 30 + r() * 50, h = 50 + r() * 60;
        ctx.fillRect(x, HOR - h, w, h);
        if (r() < 0.5) { ctx.beginPath(); ctx.arc(x + w / 2, HOR - h, w * 0.38, Math.PI, 0); ctx.fill(); }
        else { ctx.fillRect(x + w / 2 - 5, HOR - h - 40, 10, 40); ctx.beginPath(); ctx.arc(x + w / 2, HOR - h - 40, 7, Math.PI, 0); ctx.fill(); }
      }
    } else if (kind === 'neon') {
      for (let x = -10; x < W;) {
        const w = 40 + r() * 80, h = 120 + r() * 230;
        ctx.fillStyle = mix('#0a0f22', sky.mid, 0.25); ctx.fillRect(x, HOR - h, w, h + 2);
        const nc = r() < 0.5 ? '#ff3fb4' : '#4fe3ff';
        emis.push(['rect', x + 3, HOR - h, 2, h, nc, 0.6]);
        for (let wy = HOR - h + 8; wy < HOR - 6; wy += 10) for (let wx = x + 6; wx < x + w - 6; wx += 9) if (r() < 0.22) emis.push(['rect', wx, wy, 4, 3, r() < 0.6 ? '#7fd8ff' : '#ff9ad8', 0.55]);
        if (r() < 0.3) emis.push(['rect', x + 8, HOR - h + 20, w - 16, 14, r() < 0.5 ? '#ffcf4a' : '#ff3fb4', 0.5]);
        x += w + 4 + r() * 10;
      }
    }
    // אובך באופק
    ctx.fillStyle = vgrad(ctx, HOR - 70, HOR + 10, [[0, rgba(sky.fog, 0)], [1, rgba(sky.fog, sky.moon ? 0.25 : 0.55)]]);
    ctx.fillRect(0, HOR - 70, W, 80);
  }

  // ---------- קרקע ----------
  const GROUNDS = {
    sand: ['#d9b47c', '#b88a52'], dirt: ['#9a8058', '#6e5a3a'], grass: ['#8a8a52', '#5a6236'], stone: ['#c9b590', '#9a8562'],
    basalt: ['#6a6450', '#3e3a30'], beach: ['#e2c896', '#b89868'], asphalt: ['#4a4c50', '#2a2c30'], gravel: ['#6a645a', '#3e3a34'],
    rubble: ['#8a8070', '#5a5248'], roof: ['#55575a', '#2e3034'], crater: ['#b07658', '#6a3e2e'], tarmac: ['#55585c', '#303236'],
    deck: ['#7a6248', '#4a3a2a'],
  };
  function paintGround(ctx, theme, HOR, sky, r) {
    const g = GROUNDS[theme.ground] || GROUNDS.dirt;
    ctx.fillStyle = vgrad(ctx, HOR, H, [[0, mix(g[0], sky.fog, 0.45)], [0.35, g[0]], [1, g[1]]]);
    ctx.fillRect(0, HOR, W, H - HOR);
    const vx = W / 2;
    if (theme.ground === 'deck') {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      for (let i = -24; i <= 24; i++) { ctx.beginPath(); ctx.moveTo(vx + i * 8, HOR); ctx.lineTo(vx + i * 90, H); ctx.stroke(); }
    }
    if (theme.ground === 'sand' || theme.ground === 'beach' || theme.ground === 'crater') {
      for (let i = 0; i < 40; i++) {
        const y = HOR + Math.pow(r(), 1.6) * (H - HOR), x = r() * W, w = 60 + (y - HOR) * 1.2;
        ctx.strokeStyle = rgba(r() < 0.5 ? '#ffffff' : '#000000', 0.06); ctx.lineWidth = 2 + (y - HOR) / 60;
        ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y - 6, x + w, y + 2); ctx.stroke();
      }
    }
    if (theme.road) {
      ctx.fillStyle = theme.ground === 'sand' ? '#5a5650' : '#3a3c40';
      poly(ctx, [vx - 18, HOR, vx + 18, HOR, vx + 520, H, vx - 520, H]); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; poly(ctx, [vx - 18, HOR, vx - 10, HOR, vx - 470, H, vx - 520, H]); ctx.fill();
      ctx.fillStyle = theme.pal === 'neon' ? '#4fe3ff' : '#e8d8a0';
      for (let i = 0; i < 14; i++) {
        const t0 = Math.pow(i / 14, 2), t1 = Math.pow((i + 0.45) / 14, 2);
        const y0 = HOR + t0 * (H - HOR), y1 = HOR + t1 * (H - HOR);
        poly(ctx, [vx - 1 - t0 * 8, y0, vx + 1 + t0 * 8, y0, vx + 1 + t1 * 8, y1, vx - 1 - t1 * 8, y1]); ctx.fill();
      }
    }
    if (theme.rails) {
      ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 3;
      for (let i = 0; i < 30; i++) { const t = Math.pow(i / 30, 2), y = HOR + t * (H - HOR), hw = 20 + t * 380; ctx.lineWidth = 1 + t * 10; ctx.beginPath(); ctx.moveTo(vx - hw, y); ctx.lineTo(vx + hw, y); ctx.stroke(); }
      ctx.strokeStyle = '#8a8a90'; ctx.lineWidth = 3;
      [[-12, -300], [12, 300]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(vx + a, HOR); ctx.lineTo(vx + b, H); ctx.stroke(); });
    }
    if (theme.ground === 'tarmac' || theme.ground === 'asphalt' && !theme.road) {
      ctx.strokeStyle = 'rgba(255,220,90,0.5)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(vx - 300, H); ctx.quadraticCurveTo(vx - 60, HOR + 60, vx + 40, HOR); ctx.stroke();
    }
    // מרקם
    for (let i = 0; i < 900; i++) {
      const t = r(), y = HOR + t * t * (H - HOR), s = 1 + t * t * 5;
      ctx.fillStyle = rgba(r() < 0.5 ? '#000000' : '#ffffff', 0.05 + r() * 0.06);
      ctx.fillRect(r() * W, y, s * (1 + r() * 2), s * 0.6);
    }
    if (theme.ground === 'grass') {
      ctx.strokeStyle = 'rgba(60,70,30,0.5)'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 700; i++) { const t = r(), y = HOR + t * t * (H - HOR), x = r() * W, h = 3 + t * 16; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 6, y - h); ctx.stroke(); }
    }
    if (theme.ground === 'rubble' || theme.ground === 'basalt') {
      for (let i = 0; i < 120; i++) {
        const t = r(), y = HOR + t * (H - HOR), x = r() * W, s = 3 + t * 16;
        ctx.fillStyle = mix(g[1], r() < 0.5 ? '#000000' : '#ffffff', 0.15 + r() * 0.15);
        poly(ctx, [x, y, x + s, y - s * 0.5, x + s * 1.6, y + s * 0.1, x + s * 0.6, y + s * 0.4]); ctx.fill();
      }
    }
  }

  // ---------- שכבה אמצעית (כולל חלונות כנקודות הופעה) ----------
  function building(ctx, x, w, h, HOR, col, r, wins, emis, sky, opts) {
    const top = HOR - h;
    ctx.fillStyle = vgrad(ctx, top, HOR, [[0, shade(col, 0.08)], [1, shade(col, -0.18)]]);
    ctx.fillRect(x, top, w, h + 2);
    ctx.fillStyle = rgba('#000000', 0.12); ctx.fillRect(x + w - 8, top, 8, h);
    if (opts && opts.flat) { ctx.fillStyle = shade(col, -0.25); ctx.fillRect(x - 4, top - 6, w + 8, 8); }
    const cols = Math.max(1, Math.floor(w / 46)), rows = Math.max(1, Math.floor(h / 70));
    const ww = 22, wh = 30;
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const wx = x + (w / cols) * (cx + 0.5) - ww / 2, wy = top + 18 + cy * (h - 30) / rows;
      if (wy + wh > HOR - 6) continue;
      ctx.fillStyle = '#16120e'; ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 2; ctx.strokeRect(wx - 1, wy - 1, ww + 2, wh + 2);
      if (opts && opts.arched) { ctx.fillStyle = col; ctx.fillRect(wx - 1, wy - 2, ww + 2, 4); ctx.fillStyle = '#16120e'; ctx.beginPath(); ctx.arc(wx + ww / 2, wy + 2, ww / 2, Math.PI, 0); ctx.fill(); }
      if (sky.moon && r() < 0.35) emis.push(['rect', wx + 2, wy + 2, ww - 4, wh - 4, opts && opts.neon ? (r() < 0.5 ? '#4fe3ff' : '#ff6ad0') : '#ffcc77', 0.45]);
      wins.push({ x: wx, y: wy, w: ww, h: wh, z: 0.08 });
    }
  }

  function paintMid(ctx, theme, HOR, sky, r, wins, emis) {
    const p = PALS[theme.pal];
    const kind = theme.mid;
    if (kind === 'rocks' || kind === 'basaltrocks') {
      for (let i = 0; i < 9; i++) {
        const x = r() * W, s = 20 + r() * 50, y = HOR + 4 + r() * 10;
        ctx.fillStyle = mix(kind === 'rocks' ? p.stone : '#3a3834', sky.fog, 0.3);
        poly(ctx, [x - s, y, x - s * 0.6, y - s * 0.6, x, y - s * 0.8, x + s * 0.7, y - s * 0.4, x + s, y]); ctx.fill();
      }
    } else if (kind === 'fence' || kind === 'wire') {
      ctx.strokeStyle = rgba('#2a2a24', 0.7); ctx.lineWidth = 2;
      const y = HOR + 22;
      for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 30); ctx.stroke(); }
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = 0; x <= W; x += 10) ctx.lineTo(x, y - 8 - k * 9 + Math.sin(x * 0.2) * 1.5); ctx.stroke(); }
      if (kind === 'wire') for (let x = 0; x < W; x += 14) { ctx.beginPath(); ctx.arc(x, y - 30, 6, 0, 7); ctx.stroke(); }
    } else if (kind === 'poles') {
      ctx.strokeStyle = theme.pal === 'neon' ? '#1a2234' : '#3a3026'; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) { const t = i / 6, x = W / 2 + 60 + t * t * 700, y = HOR + t * t * 160, h = 30 + t * t * 260; ctx.lineWidth = 2 + t * 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke(); if (theme.pal === 'neon') emis.push(['dot', x, y - h, 3 + t * 6, '#4fe3ff', 0.9]); else { ctx.beginPath(); ctx.moveTo(x - 10 - t * 20, y - h + 6); ctx.lineTo(x + 10 + t * 20, y - h + 6); ctx.stroke(); } }
    } else if (kind === 'cliffs') {
      [[0, 1], [W, -1]].forEach(([x0, d]) => {
        ctx.fillStyle = vgrad(ctx, 0, HOR + 80, [[0, mix(p.stone, sky.top, 0.25)], [1, shade(p.stone, -0.3)]]);
        ctx.beginPath(); ctx.moveTo(x0, 0);
        for (let y = 0; y <= HOR + 90; y += 20) ctx.lineTo(x0 + d * (300 - y * 0.9 + (r() - 0.5) * 40), y);
        ctx.lineTo(x0, HOR + 90); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = rgba('#000000', 0.15); ctx.lineWidth = 2;
        for (let k = 0; k < 14; k++) { const y = r() * HOR; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + d * (180 + r() * 100), y + 10); ctx.stroke(); }
      });
    } else if (kind === 'stonehouses' || kind === 'houses') {
      const col = kind === 'stonehouses' ? '#d4c09a' : '#cdbfa6';
      for (let x = -20; x < W;) {
        const w = 120 + r() * 120, h = 150 + r() * 120;
        building(ctx, x, w, h, HOR + 10, mix(col, sky.fog, 0.15), r, wins, emis, sky, { arched: kind === 'stonehouses' });
        x += w + 10 + r() * 60;
      }
    } else if (kind === 'ruins') {
      for (let x = -20; x < W;) {
        const w = 130 + r() * 110, h = 160 + r() * 150;
        building(ctx, x, w, h, HOR + 10, mix('#8a8478', sky.fog, 0.2), r, wins, emis, sky, {});
        ctx.fillStyle = sky.top; const bx = x + r() * w * 0.6;
        poly(ctx, [bx, HOR + 10 - h - 2, bx + 70, HOR + 10 - h - 2, bx + 40, HOR + 10 - h + 50 + r() * 40]); ctx.fill();
        x += w + 30 + r() * 80;
      }
    } else if (kind === 'neontowers') {
      for (let x = -20; x < W;) {
        const w = 140 + r() * 120, h = 220 + r() * 120;
        building(ctx, x, w, h, HOR + 10, '#1a2030', r, wins, emis, sky, { neon: true });
        emis.push(['rect', x + 10, HOR + 10 - h + 10, w - 20, 4, r() < 0.5 ? '#ff3fb4' : '#4fe3ff', 0.8]);
        x += w + 40 + r() * 80;
      }
    } else if (kind === 'trees') {
      for (let i = 0; i < 14; i++) {
        const x = r() * W, h = 140 + r() * 160, y = HOR + 8 + r() * 14;
        ctx.fillStyle = mix('#3a2a1a', sky.fog, 0.4); ctx.fillRect(x - 4, y - h * 0.4, 8, h * 0.4);
        ctx.fillStyle = mix('#2a4028', sky.fog, 0.35);
        for (let k = 0; k < 4; k++) { const ty = y - h * 0.3 - k * h * 0.18, tw = 40 - k * 7; poly(ctx, [x - tw, ty, x, ty - h * 0.3, x + tw, ty]); ctx.fill(); }
      }
    } else if (kind === 'palms') {
      for (let i = 0; i < 7; i++) {
        const x = r() * W, h = 120 + r() * 100, y = HOR + 6;
        ctx.strokeStyle = '#1a1a18'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 14, y - h / 2, x + 6, y - h); ctx.stroke();
        ctx.lineWidth = 4; for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x + 6, y - h); ctx.quadraticCurveTo(x + 6 + Math.cos(a) * 30, y - h - 12, x + 6 + Math.cos(a) * 50, y - h + 18); ctx.stroke(); }
      }
    } else if (kind === 'girders') {
      ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 8;
      [[-1], [1]].forEach(([d]) => {
        const x0 = W / 2 + d * 560, x1 = W / 2 + d * 30;
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, HOR - 60); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0, H); ctx.lineTo(x1, HOR); ctx.stroke();
        for (let i = 0; i < 9; i++) { const t = i / 9, xa = lerp(x0, x1, t), ya = lerp(0, HOR - 60, t), yb = lerp(H, HOR, t); ctx.lineWidth = 8 * (1 - t) + 1; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xa, yb); ctx.stroke(); }
      });
    } else if (kind === 'wagons') {
      for (let x = -30; x < W; x += 230) {
        ctx.fillStyle = mix('#5a3a2a', sky.fog, 0.3); ctx.fillRect(x, HOR - 70, 210, 64);
        ctx.fillStyle = rgba('#000000', 0.2); for (let k = 0; k < 8; k++) ctx.fillRect(x + 8 + k * 25, HOR - 66, 3, 56);
        ctx.fillStyle = '#1a1a1a'; [30, 180].forEach(dx => { ctx.beginPath(); ctx.arc(x + dx, HOR - 4, 10, 0, 7); ctx.fill(); });
      }
    } else if (kind === 'cranes') {
      for (let i = 0; i < 3; i++) {
        const x = 150 + i * 420 + r() * 80, h = 260 + r() * 60, col = theme.pal === 'neon' ? '#203048' : '#8a3a2a';
        ctx.strokeStyle = col; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(x, HOR + 4); ctx.lineTo(x, HOR - h); ctx.lineTo(x + 200, HOR - h); ctx.moveTo(x - 60, HOR - h); ctx.lineTo(x, HOR - h); ctx.stroke();
        ctx.lineWidth = 2; for (let k = 0; k < 12; k++) { ctx.beginPath(); ctx.moveTo(x - 10, HOR - k * h / 12); ctx.lineTo(x + 10, HOR - (k + 1) * h / 12); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(x + 150, HOR - h); ctx.lineTo(x + 150, HOR - h + 120); ctx.stroke();
        emis.push(['dot', x + 200, HOR - h, 3, '#ff3030', 1]);
      }
      for (let x = 0; x < W; x += 70) { ctx.fillStyle = mix(['#8a3a2a', '#2a5a7a', '#3a6a3a', '#a8862a'][Math.floor(r() * 4)], sky.fog, 0.4); ctx.fillRect(x, HOR - 36 - (r() < 0.5 ? 30 : 0), 66, 40); }
    } else if (kind === 'shipdeck') {
      ctx.fillStyle = '#2a2e34'; ctx.fillRect(0, HOR - 10, W, 14);
      ctx.fillStyle = '#e8e4dc'; ctx.fillRect(940, HOR - 200, 220, 196);
      ctx.fillStyle = '#16181c'; for (let k = 0; k < 6; k++) { ctx.fillRect(956 + k * 34, HOR - 180, 24, 18); if (r() < 0.5) emis.push(['rect', 958 + k * 34, HOR - 178, 20, 14, '#ffd890', 0.5]); }
      ctx.strokeStyle = '#2a2e34'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(1050, HOR - 200); ctx.lineTo(1050, HOR - 300); ctx.stroke();
      emis.push(['dot', 1050, HOR - 302, 4, '#ff3030', 1]);
      ctx.lineWidth = 2; ctx.strokeStyle = '#8a8e94'; ctx.beginPath(); for (let x = 0; x < 900; x += 40) { ctx.moveTo(x, HOR - 40); ctx.lineTo(x, HOR); } ctx.moveTo(0, HOR - 40); ctx.lineTo(900, HOR - 40); ctx.stroke();
    } else if (kind === 'plane') {
      const cx = 760, cy = HOR - 30;
      ctx.fillStyle = '#d8dce2';
      rr(ctx, cx - 380, cy - 46, 720, 74, 36); ctx.fill();
      poly(ctx, [cx + 300, cy - 40, cx + 380, cy - 150, cx + 420, cy - 150, cx + 380, cy - 30]); ctx.fill();
      ctx.fillStyle = '#b8bcc4'; poly(ctx, [cx - 60, cy, cx + 120, cy, cx + 260, cy + 50, cx + 160, cy + 50]); ctx.fill();
      ctx.fillStyle = '#2a4a8a'; ctx.fillRect(cx - 370, cy - 8, 700, 8);
      ctx.fillStyle = '#1a1e26'; for (let k = 0; k < 22; k++) { ctx.fillRect(cx - 300 + k * 28, cy - 30, 10, 12); if (sky.moon && r() < 0.5) emis.push(['rect', cx - 300 + k * 28 + 1, cy - 29, 8, 10, '#ffe0a0', 0.5]); }
      ctx.fillStyle = '#1a1a1a'; [cx - 240, cx + 60, cx + 90].forEach(x => { ctx.beginPath(); ctx.arc(x, cy + 34, 9, 0, 7); ctx.fill(); });
      emis.push(['dot', cx + 410, cy - 150, 4, '#ff3030', 1]);
    }
  }

  // ---------- פנים ----------
  function paintInterior(ctx, theme, HOR, sky, r, wins, emis, time) {
    const wall = theme.wall, BX0 = 230, BX1 = W - 230, BY0 = 70;
    const isNight = time === 'night';
    // תקרה
    ctx.fillStyle = vgrad(ctx, 0, BY0, [[0, shade(wall, -0.55)], [1, shade(wall, -0.35)]]);
    poly(ctx, [0, 0, W, 0, BX1, BY0, BX0, BY0]); ctx.fill();
    // קיר אחורי
    ctx.fillStyle = vgrad(ctx, BY0, HOR, [[0, shade(wall, 0.05)], [1, shade(wall, -0.15)]]);
    ctx.fillRect(BX0, BY0, BX1 - BX0, HOR - BY0);
    // קירות צד
    [[0, BX0, -0.28], [W, BX1, -0.38]].forEach(([e, b, s]) => { ctx.fillStyle = shade(wall, s); poly(ctx, [e, 0, b, BY0, b, HOR, e, H]); ctx.fill(); });
    // רצפה
    const fcol = { concrete: '#6a6660', tiles: '#a8a6a0', metal: '#4a5260', marble: '#d8d0c0', carpet: '#7a3a34', wood: '#7a5a3a', organic: '#3a2040' }[theme.floor] || '#666';
    ctx.fillStyle = vgrad(ctx, HOR, H, [[0, shade(fcol, -0.15)], [1, shade(fcol, -0.4)]]);
    poly(ctx, [BX0, HOR, BX1, HOR, W, H, 0, H]); ctx.fill();
    if (theme.floor === 'tiles' || theme.floor === 'marble' || theme.floor === 'metal') {
      ctx.strokeStyle = rgba('#000000', 0.18); ctx.lineWidth = 1.5;
      for (let i = 0; i <= 16; i++) { const xb = lerp(BX0, BX1, i / 16), xf = lerp(-W * 0.4, W * 1.4, i / 16); ctx.beginPath(); ctx.moveTo(xb, HOR); ctx.lineTo(xf, H); ctx.stroke(); }
      for (let i = 1; i < 10; i++) { const t = Math.pow(i / 10, 1.8), y = HOR + t * (H - HOR); ctx.beginPath(); ctx.moveTo(lerp(BX0, 0, t), y); ctx.lineTo(lerp(BX1, W, t), y); ctx.stroke(); }
      // השתקפות
      ctx.fillStyle = vgrad(ctx, HOR, H, [[0, rgba('#ffffff', theme.floor === 'marble' ? 0.18 : 0.08)], [1, rgba('#ffffff', 0)]]);
      poly(ctx, [BX0, HOR, BX1, HOR, W, H, 0, H]); ctx.fill();
    } else if (theme.floor === 'wood') {
      ctx.strokeStyle = rgba('#000000', 0.25); for (let i = 0; i <= 24; i++) { ctx.beginPath(); ctx.moveTo(lerp(BX0, BX1, i / 24), HOR); ctx.lineTo(lerp(-W * 0.3, W * 1.3, i / 24), H); ctx.stroke(); }
    } else if (theme.floor === 'organic') {
      for (let i = 0; i < 40; i++) { ctx.strokeStyle = rgba('#7cffd4', 0.08 + r() * 0.08); ctx.lineWidth = 2; ctx.beginPath(); let x = r() * W, y = HOR + r() * (H - HOR); ctx.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 80; y += (r() - 0.3) * 30; ctx.lineTo(x, y); } ctx.stroke(); }
    }
    speckle(ctx, 0, HOR, W, H - HOR, 600, rgba('#000000', 0.08), r, 3);
    // פינות קיר
    ctx.strokeStyle = rgba('#000000', 0.3); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(BX0, BY0); ctx.lineTo(BX0, HOR); ctx.lineTo(BX1, HOR); ctx.lineTo(BX1, BY0); ctx.stroke();
    // אורות תקרה
    const lightCol = theme.deco === 'hive' ? '#7cffd4' : theme.pal === 'neon' ? '#9fe8ff' : '#fff0c8';
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 4, y = lerp(BY0, 0, t * 0.9);
      for (let k = -1; k <= 1; k++) {
        const x = W / 2 + k * lerp(220, 560, t * 0.9);
        emis.push(['rect', x - 40 - t * 30, y - 3, 80 + t * 60, 5 + t * 4, lightCol, 0.95]);
        emis.push(['cone', x, y, 260 + t * 160, lightCol, 0.07]);
      }
    }
    // קישוט קיר אחורי
    const d = theme.deco;
    const doorAt = (x, w, h) => {
      ctx.fillStyle = '#0c0c0e'; ctx.fillRect(x, HOR - h, w, h);
      ctx.strokeStyle = shade(wall, -0.45); ctx.lineWidth = 5; ctx.strokeRect(x - 2, HOR - h - 2, w + 4, h + 2);
      wins.push({ x, y: HOR - h, w, h, z: 0.1, door: true });
    };
    if (d === 'pipes' || d === 'warehouse' || d === 'hangar') {
      ctx.strokeStyle = shade(wall, -0.3); ctx.lineWidth = 10;
      for (let k = 0; k < 3; k++) { const y = BY0 + 30 + k * 26; ctx.beginPath(); ctx.moveTo(BX0, y); ctx.lineTo(BX1, y); ctx.stroke(); }
      ctx.lineWidth = 3; ctx.strokeStyle = shade(wall, 0.1); for (let x = BX0; x < BX1; x += 40) { ctx.beginPath(); ctx.moveTo(x, BY0); ctx.lineTo(x + 40, HOR); ctx.stroke(); }
      if (d === 'hangar') { ctx.fillStyle = shade(wall, -0.25); ctx.fillRect(BX0 + 80, BY0 + 110, BX1 - BX0 - 160, HOR - BY0 - 110); for (let x = BX0 + 90; x < BX1 - 80; x += 24) { ctx.fillStyle = rgba('#000000', 0.2); ctx.fillRect(x, BY0 + 110, 3, HOR - BY0 - 110); } }
      doorAt(BX0 + 60, 70, 140); doorAt(BX1 - 130, 70, 140);
    } else if (d === 'columns' || d === 'hotel' || d === 'villa') {
      for (let k = 0; k < 5; k++) { const x = lerp(BX0 + 30, BX1 - 60, k / 4); ctx.fillStyle = shade(theme.pal === 'palace' ? '#e0d4bc' : wall, 0.1); ctx.fillRect(x, BY0, 30, HOR - BY0); ctx.fillStyle = rgba('#000000', 0.2); ctx.fillRect(x + 22, BY0, 8, HOR - BY0); }
      if (d === 'villa') { ctx.fillStyle = '#0a1830'; ctx.fillRect(BX0 + 140, BY0 + 30, BX1 - BX0 - 280, 150); emis.push(['rect', BX0 + 140, BY0 + 30, BX1 - BX0 - 280, 150, '#2a4a8a', 0.4]); }
      else { ctx.fillStyle = '#8a1e22'; ctx.fillRect(W / 2 - 60, BY0 + 20, 120, 150); ctx.fillStyle = '#d4aa4a'; ctx.fillRect(W / 2 - 50, BY0 + 30, 100, 6); }
      emis.push(['dot', W / 2, 26, 22, '#ffe2a0', 0.8]);
      doorAt(BX0 + 70, 80, 160); doorAt(BX1 - 150, 80, 160);
    } else if (d === 'metro' || d === 'space' || d === 'tower') {
      ctx.fillStyle = shade(wall, -0.2); ctx.fillRect(BX0, HOR - 40, BX1 - BX0, 40);
      emis.push(['rect', BX0, HOR - 44, BX1 - BX0, 3, theme.pal === 'neon' ? '#4fe3ff' : '#ffd890', 0.8]);
      if (d === 'metro') { ctx.fillStyle = '#e8e4d8'; ctx.fillRect(W / 2 - 120, BY0 + 30, 240, 46); ctx.fillStyle = '#1a2a6a'; ctx.font = 'bold 28px Assistant, Arial'; ctx.textAlign = 'center'; ctx.fillText('אלנבי 2090', W / 2, BY0 + 64); }
      if (d === 'space') { ctx.fillStyle = '#02040a'; ctx.fillRect(W / 2 - 200, BY0 + 20, 400, 150); for (let i = 0; i < 80; i++) emis.push(['rect', W / 2 - 200 + r() * 400, BY0 + 20 + r() * 150, 1.5, 1.5, '#ffffff', 0.8]); emis.push(['dot', W / 2 + 120, BY0 + 140, 60, '#3a7ad8', 0.5]); }
      if (d === 'tower') { ctx.fillStyle = '#0a0e18'; ctx.fillRect(BX0 + 20, BY0 + 20, BX1 - BX0 - 40, 140); for (let x = BX0 + 20; x < BX1; x += 120) { ctx.fillStyle = shade(wall, -0.3); ctx.fillRect(x, BY0 + 20, 6, 140); } emis.push(['rect', BX0 + 40, BY0 + 150, 200, 3, '#ff3030', 0.7]); }
      doorAt(BX0 + 50, 74, 150); doorAt(BX1 - 124, 74, 150);
    } else if (d === 'terminal') {
      ctx.fillStyle = '#0a0e18'; ctx.fillRect(BX0 + 20, BY0 + 20, BX1 - BX0 - 40, 170);
      for (let x = BX0 + 20; x < BX1; x += 90) { ctx.fillStyle = shade(wall, -0.3); ctx.fillRect(x, BY0 + 20, 5, 170); }
      emis.push(['rect', W / 2 + 160, BY0 + 150, 6, 6, '#ff3030', 0.9]);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(W / 2 - 140, BY0 - 10, 280, 34); ctx.fillStyle = '#ffcf4a'; ctx.font = 'bold 22px Assistant, Arial'; ctx.textAlign = 'center'; ctx.fillText('שער 4   GATE 4', W / 2, BY0 + 14);
      doorAt(BX0 + 40, 70, 120); doorAt(BX1 - 110, 70, 120);
    } else if (d === 'train') {
      for (let k = 0; k < 6; k++) { const x = lerp(BX0 + 20, BX1 - 110, k / 5); ctx.fillStyle = '#0a1020'; rr(ctx, x, BY0 + 40, 90, 80, 12); ctx.fill(); }
      ctx.fillStyle = shade(wall, -0.25); ctx.fillRect(BX0, BY0 + 10, BX1 - BX0, 14);
      doorAt(W / 2 - 40, 80, 170);
    } else if (d === 'killhouse') {
      ctx.fillStyle = shade(wall, -0.1); for (let x = BX0; x < BX1; x += 70) ctx.fillRect(x, BY0, 2, HOR - BY0);
      speckle(ctx, BX0, BY0, BX1 - BX0, HOR - BY0, 160, rgba('#000000', 0.4), r, 3);
      doorAt(BX0 + 90, 80, 160); doorAt(W / 2 - 40, 80, 160); doorAt(BX1 - 170, 80, 160);
    } else if (d === 'hive') {
      for (let i = 0; i < 30; i++) { const x = BX0 + r() * (BX1 - BX0), y = BY0 + r() * (HOR - BY0); ctx.fillStyle = rgba('#000000', 0.25); ctx.beginPath(); ctx.ellipse(x, y, 20 + r() * 30, 14 + r() * 20, 0, 0, 7); ctx.fill(); emis.push(['dot', x, y, 6 + r() * 8, '#7cffd4', 0.35]); }
      doorAt(BX0 + 80, 90, 170); doorAt(BX1 - 170, 90, 170);
    }
  }

  // ---------- ציור רקע מלא לסצנה ----------
  A.paintScene = function (themeKey, theme, time, seed) {
    const sky = SKIES[time] || SKIES.day;
    const r = rng(seed);
    const HOR = theme.type === 'in' ? 330 : 320;
    const can = mk(W, H), ctx = can.getContext('2d');
    const layer = mk(W, H), lc = layer.getContext('2d');
    const wins = [], emis = [];
    if (theme.type === 'in') {
      paintInterior(lc, theme, HOR, sky, r, wins, emis, time);
    } else {
      paintSky(ctx, sky, HOR, r);
      paintFar(lc, theme.far, HOR, sky, r, emis);
      paintGround(lc, theme, HOR, sky, r);
      paintMid(lc, theme, HOR, sky, r, theme.windows ? wins : [], emis);
    }
    // גוון זמן יום
    const ta = theme.type === 'in' ? sky.ta * 0.55 : sky.ta;
    if (ta > 0) { lc.globalCompositeOperation = 'source-atop'; lc.fillStyle = rgba(sky.tint, ta); lc.fillRect(0, 0, W, H); lc.globalCompositeOperation = 'source-over'; }
    ctx.drawImage(layer, 0, 0);
    // אור פולט
    ctx.globalCompositeOperation = 'lighter';
    emis.forEach(e => {
      if (e[0] === 'rect') { ctx.fillStyle = rgba(e[5], e[6]); ctx.fillRect(e[1], e[2], e[3], e[4]); ctx.fillStyle = rgba(e[5], e[6] * 0.15); ctx.fillRect(e[1] - 4, e[2] - 4, e[3] + 8, e[4] + 8); }
      else if (e[0] === 'dot') { const g = ctx.createRadialGradient(e[1], e[2], 0, e[1], e[2], e[3] * 3); g.addColorStop(0, rgba(e[4], e[5])); g.addColorStop(1, rgba(e[4], 0)); ctx.fillStyle = g; ctx.fillRect(e[1] - e[3] * 3, e[2] - e[3] * 3, e[3] * 6, e[3] * 6); }
      else if (e[0] === 'cone') { const g = ctx.createRadialGradient(e[1], e[2], 0, e[1], e[2] + e[3] * 0.6, e[3]); g.addColorStop(0, rgba(e[4], e[5])); g.addColorStop(1, rgba(e[4], 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(e[1] - 30, e[2]); ctx.lineTo(e[1] + 30, e[2]); ctx.lineTo(e[1] + e[3] * 0.7, e[2] + e[3]); ctx.lineTo(e[1] - e[3] * 0.7, e[2] + e[3]); ctx.fill(); }
    });
    ctx.globalCompositeOperation = 'source-over';
    return { canvas: can, HOR, wins, sky };
  };

  // ---------- מחסות ----------
  const COVERS = {
    sandbags: { w: 230, h: 92 }, crate: { w: 118, h: 112 }, barrel: { w: 70, h: 108 }, rock: { w: 200, h: 118 },
    jeep: { w: 300, h: 140 }, truckWreck: { w: 360, h: 170 }, trench: { w: 440, h: 30 }, stonewall: { w: 270, h: 104 },
    arch: { w: 110, h: 340, tall: true }, cart: { w: 220, h: 112 }, log: { w: 260, h: 70 }, bunker: { w: 300, h: 128 },
    boat: { w: 300, h: 100 }, hedgehog: { w: 150, h: 110 }, tree: { w: 80, h: 440, tall: true }, car: { w: 300, h: 120 },
    container: { w: 330, h: 220, tall: true }, machine: { w: 220, h: 170 }, forklift: { w: 220, h: 180 }, rubble: { w: 270, h: 100 },
    pillar: { w: 104, h: 440, tall: true }, statue: { w: 120, h: 340, tall: true }, table: { w: 230, h: 88 }, vent: { w: 170, h: 120 },
    pod: { w: 170, h: 150 }, wreck2090: { w: 300, h: 120 }, hovercar: { w: 300, h: 112 }, barrier: { w: 230, h: 92 },
    console: { w: 180, h: 120 }, seats: { w: 270, h: 96 }, pillarOrganic: { w: 120, h: 440, tall: true }, plywood: { w: 140, h: 310, tall: true },
    stairs: { w: 180, h: 250, tall: true }, counter: { w: 310, h: 112 }, luggage: { w: 180, h: 90 }, sofa: { w: 270, h: 96 }, winch: { w: 170, h: 110 },
  };
  A.COVERS = COVERS;

  function drawCoverShape(ctx, type, w, h, p, r) {
    // ציור ב-(0,0)=פינה שמאלית עליונה
    const L = (c, t) => shade(c, t);
    switch (type) {
      case 'sandbags': case 'trench': {
        if (type === 'trench') { ctx.fillStyle = '#1a140e'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.9, w / 2, h * 0.5, 0, 0, 7); ctx.fill(); }
        const rows = type === 'trench' ? 1 : 3, bh = h / rows;
        for (let ry = 0; ry < rows; ry++) {
          const n = Math.round(w / 56) - (ry % 2), off = ry % 2 ? 28 : 0;
          for (let i = 0; i < n; i++) {
            const x = off + i * (w - off * 2) / n, y = h - (ry + 1) * bh, bw = (w - off * 2) / n;
            const g = ctx.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, L(p.cloth, 0.18)); g.addColorStop(1, L(p.cloth, -0.3));
            ctx.fillStyle = g; rr(ctx, x + 1, y + 1, bw - 2, bh - 1, bh * 0.45); ctx.fill();
            ctx.strokeStyle = rgba('#000000', 0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + bw * 0.2, y + bh * 0.5); ctx.lineTo(x + bw * 0.8, y + bh * 0.55); ctx.stroke();
          }
        }
        break;
      }
      case 'crate': case 'luggage': case 'winch': case 'vent': {
        const c = type === 'luggage' ? '#3a4a6a' : type === 'vent' ? '#7a7e84' : type === 'winch' ? '#8a4a2a' : p.wood;
        ctx.fillStyle = hgrad(ctx, 0, w, [[0, L(c, 0.12)], [1, L(c, -0.25)]]); ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = L(c, -0.45); ctx.lineWidth = 4; ctx.strokeRect(2, 2, w - 4, h - 4);
        if (type === 'crate') {
          ctx.lineWidth = 3; ctx.beginPath(); for (let y = h / 3; y < h; y += h / 3) { ctx.moveTo(4, y); ctx.lineTo(w - 4, y); } ctx.stroke();
          ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(w - 6, h - 6); ctx.stroke();
          ctx.fillStyle = rgba('#000000', 0.3); ctx.font = `bold ${Math.round(h * 0.18)}px Assistant, Arial`; ctx.textAlign = 'center'; ctx.fillText('7.62', w / 2, h * 0.28);
        } else if (type === 'vent') { ctx.lineWidth = 2; for (let y = 12; y < h - 6; y += 10) { ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(w - 10, y); ctx.stroke(); } }
        else if (type === 'luggage') { ctx.fillStyle = '#8a5a2a'; rr(ctx, 10, 10, w * 0.4, h - 20, 8); ctx.fill(); ctx.fillStyle = '#2a6a5a'; rr(ctx, w * 0.5, 20, w * 0.45, h - 24, 8); ctx.fill(); }
        break;
      }
      case 'barrel': {
        const c = p === PALS.neon ? '#2a5a8a' : p === PALS.dark ? '#8a2a1e' : '#4a5a3a';
        ctx.fillStyle = hgrad(ctx, 0, w, [[0, L(c, -0.3)], [0.35, L(c, 0.25)], [1, L(c, -0.45)]]); rr(ctx, 0, 6, w, h - 6, 8); ctx.fill();
        ctx.fillStyle = L(c, -0.2); ctx.beginPath(); ctx.ellipse(w / 2, 8, w / 2, 7, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = L(c, -0.5); ctx.lineWidth = 3; [h * 0.35, h * 0.68].forEach(y => { ctx.beginPath(); ctx.moveTo(1, y); ctx.lineTo(w - 1, y); ctx.stroke(); });
        break;
      }
      case 'rock': case 'rubble': {
        const c = type === 'rubble' ? '#8a8276' : p.stone;
        const pts = [0, h, w * 0.05, h * 0.45, w * 0.25, h * 0.12, w * 0.55, 0, w * 0.82, h * 0.2, w, h * 0.6, w, h];
        ctx.fillStyle = vgrad(ctx, 0, h, [[0, L(c, 0.15)], [1, L(c, -0.35)]]); poly(ctx, pts); ctx.fill();
        ctx.fillStyle = rgba('#000000', 0.18); poly(ctx, [w * 0.55, 0, w * 0.82, h * 0.2, w, h * 0.6, w, h, w * 0.6, h]); ctx.fill();
        ctx.fillStyle = rgba('#ffffff', 0.1); poly(ctx, [w * 0.25, h * 0.12, w * 0.55, 0, w * 0.45, h * 0.5]); ctx.fill();
        if (type === 'rubble') { ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.3); ctx.lineTo(w * 0.5, -h * 0.2); ctx.moveTo(w * 0.7, h * 0.4); ctx.lineTo(w * 0.9, -h * 0.05); ctx.stroke(); }
        break;
      }
      case 'jeep': case 'car': case 'hovercar': case 'wreck2090': {
        const c = type === 'jeep' ? '#5a5a3a' : type === 'car' ? '#6a2a2a' : type === 'hovercar' ? '#2a3a5a' : '#3a3a48';
        const by = h * 0.35;
        ctx.fillStyle = vgrad(ctx, 0, h, [[0, L(c, 0.15)], [1, L(c, -0.4)]]);
        if (type === 'jeep') { ctx.fillRect(0, by, w, h * 0.45); ctx.strokeStyle = '#222'; ctx.lineWidth = 5; ctx.strokeRect(w * 0.45, 4, w * 0.25, by - 4); }
        else { rr(ctx, 0, by, w, h * 0.45, 14); ctx.fill(); ctx.fillStyle = L(c, -0.1); poly(ctx, [w * 0.18, by, w * 0.32, 4, w * 0.72, 4, w * 0.86, by]); }
        ctx.fill();
        if (type !== 'jeep') { ctx.fillStyle = type === 'hovercar' ? rgba('#4fe3ff', 0.35) : '#1a222a'; poly(ctx, [w * 0.25, by - 4, w * 0.34, 10, w * 0.5, 10, w * 0.5, by - 4]); ctx.fill(); poly(ctx, [w * 0.54, by - 4, w * 0.54, 10, w * 0.7, 10, w * 0.79, by - 4]); ctx.fill(); }
        if (type === 'hovercar' || type === 'wreck2090') { ctx.fillStyle = rgba('#4fe3ff', type === 'wreck2090' ? 0.2 : 0.6); ctx.fillRect(w * 0.05, h * 0.8, w * 0.9, 5); }
        else { ctx.fillStyle = '#141414'; [w * 0.2, w * 0.8].forEach(x => { ctx.beginPath(); ctx.arc(x, h * 0.8, h * 0.2, 0, 7); ctx.fill(); ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(x, h * 0.8, h * 0.08, 0, 7); ctx.fill(); ctx.fillStyle = '#141414'; }); }
        if (type === 'wreck2090') { ctx.fillStyle = rgba('#000000', 0.4); for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(r() * w, by + r() * h * 0.4, 6 + r() * 10, 0, 7); ctx.fill(); } }
        break;
      }
      case 'truckWreck': {
        ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#6a5a3a'], [1, '#2a2418']]); ctx.fillRect(w * 0.3, 0, w * 0.7, h * 0.75);
        ctx.fillStyle = '#4a3e2a'; poly(ctx, [0, h * 0.75, 0, h * 0.35, w * 0.08, h * 0.2, w * 0.3, h * 0.2, w * 0.3, h * 0.75]); ctx.fill();
        ctx.fillStyle = rgba('#000000', 0.45); for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(w * 0.3 + r() * w * 0.7, r() * h * 0.7, 6 + r() * 14, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#121212'; [w * 0.15, w * 0.6, w * 0.85].forEach(x => { ctx.beginPath(); ctx.arc(x, h * 0.82, h * 0.17, 0, 7); ctx.fill(); });
        break;
      }
      case 'stonewall': case 'bunker': {
        const c = type === 'bunker' ? '#7a7a72' : p.stone;
        ctx.fillStyle = c; ctx.fillRect(0, 0, w, h);
        const bw = type === 'bunker' ? w : 46, bh = type === 'bunker' ? h : 26;
        for (let y = 0; y < h; y += bh) for (let x = ((y / bh) % 2) * -bw / 2; x < w; x += bw) {
          ctx.fillStyle = L(c, (r() - 0.5) * 0.3); ctx.fillRect(Math.max(0, x) + 1, y + 1, Math.min(bw, w - Math.max(0, x)) - 2, Math.min(bh, h - y) - 2);
        }
        ctx.fillStyle = vgrad(ctx, 0, h, [[0, rgba('#ffffff', 0.12)], [1, rgba('#000000', 0.3)]]); ctx.fillRect(0, 0, w, h);
        if (type === 'bunker') { ctx.fillStyle = '#0c0c0c'; ctx.fillRect(w * 0.2, h * 0.3, w * 0.6, h * 0.16); }
        break;
      }
      case 'arch': case 'pillar': case 'statue': case 'pillarOrganic': case 'plywood': case 'tree': {
        if (type === 'tree') {
          ctx.fillStyle = hgrad(ctx, 0, w, [[0, '#3a2a1a'], [0.4, '#6a4e32'], [1, '#2a1c10']]); ctx.fillRect(w * 0.15, 0, w * 0.7, h);
          ctx.strokeStyle = rgba('#000000', 0.3); ctx.lineWidth = 2; for (let y = 10; y < h; y += 18) { ctx.beginPath(); ctx.moveTo(w * 0.2, y); ctx.lineTo(w * 0.8, y + 6); ctx.stroke(); }
        } else if (type === 'pillarOrganic') {
          ctx.fillStyle = hgrad(ctx, 0, w, [[0, '#2a1438'], [0.5, '#5a3478'], [1, '#1a0a28']]); ctx.beginPath(); ctx.moveTo(0, h); ctx.bezierCurveTo(w * 0.3, h * 0.6, -w * 0.1, h * 0.3, w * 0.2, 0); ctx.lineTo(w * 0.8, 0); ctx.bezierCurveTo(w * 1.1, h * 0.4, w * 0.7, h * 0.7, w, h); ctx.fill();
          ctx.strokeStyle = rgba('#7cffd4', 0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.5, h); ctx.bezierCurveTo(w * 0.3, h * 0.6, w * 0.7, h * 0.3, w * 0.5, 0); ctx.stroke();
        } else if (type === 'plywood') {
          ctx.fillStyle = hgrad(ctx, 0, w, [[0, '#c8a06a'], [1, '#9a7448']]); ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6); ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
          speckle(ctx, 0, 0, w, h, 60, rgba('#000000', 0.5), r, 3);
        } else if (type === 'statue') {
          ctx.fillStyle = '#d8ccb4'; ctx.fillRect(0, h * 0.7, w, h * 0.3);
          ctx.fillStyle = hgrad(ctx, 0, w, [[0, '#a89a80'], [0.5, '#e8dcc4'], [1, '#8a7c64']]);
          ctx.beginPath(); ctx.ellipse(w / 2, h * 0.16, w * 0.16, w * 0.2, 0, 0, 7); ctx.fill();
          poly(ctx, [w * 0.25, h * 0.26, w * 0.75, h * 0.26, w * 0.68, h * 0.7, w * 0.32, h * 0.7]); ctx.fill();
        } else {
          const c = type === 'arch' ? '#cbb894' : p === PALS.neon ? '#3a4658' : p === PALS.palace ? '#e0d4bc' : '#8a8a84';
          ctx.fillStyle = hgrad(ctx, 0, w, [[0, L(c, -0.25)], [0.35, L(c, 0.2)], [1, L(c, -0.4)]]); ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = L(c, -0.1); ctx.fillRect(-6, 0, w + 12, 18); ctx.fillRect(-6, h - 18, w + 12, 18);
          if (p === PALS.neon) { ctx.fillStyle = rgba('#4fe3ff', 0.7); ctx.fillRect(w * 0.45, 30, 4, h - 60); }
        }
        break;
      }
      case 'cart': {
        ctx.fillStyle = vgrad(ctx, 0, h, [[0, L(p.wood, 0.1)], [1, L(p.wood, -0.3)]]); ctx.fillRect(0, h * 0.15, w, h * 0.55);
        ctx.strokeStyle = L(p.wood, -0.45); ctx.lineWidth = 3; for (let x = 10; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, h * 0.15); ctx.lineTo(x, h * 0.7); ctx.stroke(); }
        ctx.fillStyle = '#e07a2a'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(14 + r() * (w - 28), h * 0.12 + r() * 8, 9, 0, 7); ctx.fill(); }
        ctx.strokeStyle = '#2a1e12'; ctx.lineWidth = 6; [w * 0.25, w * 0.75].forEach(x => { ctx.beginPath(); ctx.arc(x, h * 0.8, h * 0.18, 0, 7); ctx.stroke(); });
        break;
      }
      case 'log': {
        ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#7a5a3a'], [1, '#3a2a1a']]); rr(ctx, 0, 0, w, h, h / 2); ctx.fill();
        ctx.fillStyle = '#b08a5a'; ctx.beginPath(); ctx.ellipse(w - h * 0.25, h / 2, h * 0.25, h * 0.48, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#7a5a3a'; ctx.beginPath(); ctx.ellipse(w - h * 0.25, h / 2, h * 0.12, h * 0.26, 0, 0, 7); ctx.stroke();
        break;
      }
      case 'boat': {
        ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#3a5a7a'], [1, '#1a2a3a']]); ctx.beginPath(); ctx.moveTo(0, h * 0.2); ctx.lineTo(w, h * 0.2); ctx.lineTo(w * 0.85, h); ctx.lineTo(w * 0.1, h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8e0d0'; ctx.fillRect(0, h * 0.2, w, 8);
        break;
      }
      case 'hedgehog': {
        ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(6, h); ctx.lineTo(w - 6, 6); ctx.moveTo(6, 6); ctx.lineTo(w - 6, h); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke(); ctx.lineCap = 'butt';
        break;
      }
      case 'container': {
        const c = ['#8a3a2a', '#2a5a7a', '#3a6a3a', '#a8862a'][Math.floor(r() * 4)];
        ctx.fillStyle = vgrad(ctx, 0, h, [[0, L(c, 0.1)], [1, L(c, -0.35)]]); ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = rgba('#000000', 0.18); for (let x = 8; x < w; x += 16) ctx.fillRect(x, 4, 6, h - 8);
        ctx.strokeStyle = L(c, -0.5); ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = rgba('#ffffff', 0.7); ctx.font = `bold ${Math.round(h * 0.12)}px Assistant, Arial`; ctx.textAlign = 'center'; ctx.fillText('ZIM', w * 0.3, h * 0.25);
        break;
      }
      case 'machine': case 'console': case 'counter': case 'table': case 'barrier': case 'seats': case 'sofa': {
        if (type === 'seats' || type === 'sofa') {
          const c = type === 'sofa' ? '#6a2a2a' : '#2a3a5a';
          const n = type === 'sofa' ? 1 : 4;
          for (let i = 0; i < n; i++) { const sx = i * w / n; ctx.fillStyle = vgrad(ctx, 0, h, [[0, L(c, 0.2)], [1, L(c, -0.3)]]); rr(ctx, sx + 3, 0, w / n - 6, h * 0.62, 10); ctx.fill(); ctx.fillStyle = L(c, -0.15); rr(ctx, sx + 3, h * 0.5, w / n - 6, h * 0.28, 6); ctx.fill(); }
          ctx.fillStyle = '#222'; ctx.fillRect(10, h * 0.78, 8, h * 0.22); ctx.fillRect(w - 18, h * 0.78, 8, h * 0.22);
        } else if (type === 'barrier') {
          const c = p === PALS.neon ? '#2a3448' : '#c8c0b0';
          ctx.fillStyle = vgrad(ctx, 0, h, [[0, L(c, 0.1)], [1, L(c, -0.3)]]); poly(ctx, [w * 0.1, 0, w * 0.9, 0, w, h, 0, h]); ctx.fill();
          ctx.fillStyle = p === PALS.neon ? rgba('#ff3fb4', 0.8) : '#c83a2a'; for (let x = 0; x < w; x += 40) poly(ctx, [x, h * 0.2, x + 20, h * 0.2, x + 34, h * 0.45, x + 14, h * 0.45]), ctx.fill();
        } else if (type === 'table') {
          ctx.fillStyle = vgrad(ctx, 0, h, [[0, L(p.wood, 0.15)], [1, L(p.wood, -0.35)]]); ctx.fillRect(0, 0, w, h); ctx.fillStyle = L(p.wood, -0.45); ctx.fillRect(0, 0, w, 10);
        } else {
          const c = type === 'counter' ? (p === PALS.palace ? '#5a2e1e' : '#5a6270') : '#4a5462';
          ctx.fillStyle = vgrad(ctx, 0, h, [[0, L(c, 0.15)], [1, L(c, -0.35)]]); ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = L(c, 0.25); ctx.fillRect(-4, 0, w + 8, 10);
          if (type === 'console') { ctx.fillStyle = '#05131a'; ctx.fillRect(w * 0.12, 18, w * 0.76, h * 0.4); ctx.fillStyle = rgba(p.glow, 0.85); for (let i = 0; i < 5; i++) ctx.fillRect(w * 0.16, 24 + i * 8, w * (0.2 + r() * 0.5), 3); }
          if (type === 'machine') { ctx.fillStyle = '#c8a02a'; for (let x = 0; x < w; x += 30) poly(ctx, [x, h - 16, x + 15, h - 16, x + 25, h, x + 10, h]), ctx.fill(); ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(w * 0.7, h * 0.4, h * 0.18, 0, 7); ctx.fill(); }
        }
        break;
      }
      case 'forklift': case 'stairs': {
        if (type === 'stairs') { ctx.fillStyle = '#c8ccd2'; for (let i = 0; i < 8; i++) ctx.fillRect(w * 0.1 + i * w * 0.1, h - (i + 1) * h / 8, w * 0.8 - i * w * 0.1, h / 8 - 3); ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, h * 0.8, w, h * 0.2); }
        else { ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#e0b02a'], [1, '#8a6a10']]); ctx.fillRect(w * 0.2, h * 0.35, w * 0.7, h * 0.5); ctx.strokeStyle = '#222'; ctx.lineWidth = 6; ctx.strokeRect(w * 0.3, 4, w * 0.45, h * 0.35); ctx.fillStyle = '#333'; ctx.fillRect(0, 0, 10, h); ctx.fillRect(0, h * 0.7, w * 0.25, 10); ctx.fillStyle = '#141414'; [w * 0.35, w * 0.8].forEach(x => { ctx.beginPath(); ctx.arc(x, h * 0.86, h * 0.13, 0, 7); ctx.fill(); }); }
        break;
      }
      case 'pod': {
        const g = ctx.createRadialGradient(w / 2, h * 0.6, 4, w / 2, h * 0.6, w * 0.6); g.addColorStop(0, '#7a4aa8'); g.addColorStop(1, '#2a1238');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, h); ctx.bezierCurveTo(0, h * 0.2, w * 0.3, 0, w / 2, 0); ctx.bezierCurveTo(w * 0.7, 0, w, h * 0.2, w, h); ctx.fill();
        ctx.strokeStyle = rgba('#7cffd4', 0.6); ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(w * (0.2 + i * 0.2), h); ctx.quadraticCurveTo(w * 0.5, h * 0.5, w * (0.3 + i * 0.12), h * 0.1); ctx.stroke(); }
        break;
      }
      default: ctx.fillStyle = p.stone; ctx.fillRect(0, 0, w, h);
    }
  }

  // מחסה מצוירת מראש עם גוון זמן יום. מחזירה קנבס
  A.renderCover = function (type, scale, pal, sky, seed, isInterior) {
    const d = COVERS[type] || COVERS.crate;
    const w = Math.max(4, Math.round(d.w * scale)), h = Math.max(4, Math.round(d.h * scale));
    const pad = 20;
    const can = mk(w + pad * 2, h + pad * 2 + 10), ctx = can.getContext('2d');
    ctx.translate(pad, pad);
    // צל קרקע
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(w / 2, h, w * 0.55, Math.max(4, h * 0.08), 0, 0, 7); ctx.fill();
    ctx.save(); ctx.scale(w / d.w, h / d.h);
    drawCoverShape(ctx, type, d.w, d.h, PALS[pal] || PALS.olive, rng(seed));
    ctx.restore();
    // תאורת שוליים עליונה
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, 'rgba(255,240,210,0.12)'], [0.3, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.25)']]); ctx.fillRect(-pad, -pad, w + pad * 2, h + pad * 2);
    const ta = isInterior ? sky.ta * 0.55 : sky.ta;
    if (ta > 0) { ctx.fillStyle = rgba(sky.tint, ta); ctx.fillRect(-pad, -pad, w + pad * 2, h + pad * 2 + 10); }
    ctx.globalCompositeOperation = 'source-over';
    return { canvas: can, w, h, pad, tall: !!d.tall };
  };

  // ---------- דמויות ----------
  const SKINS = ['#e0b08a', '#c8946c', '#a8744e', '#8a5a3a', '#f0c8a4'];
  const STYLES = {
    khaki: { uniform: '#7c6c48', dark: '#4e4430', skin: null, head: 'helmet', headCol: '#5a5638', gear: '#3a3222', boot: '#2a2218', gun: '#26221e' },
    black: { uniform: '#24262c', dark: '#121318', skin: null, head: 'beret', headCol: '#8a1414', gear: '#33343a', boot: '#0e0e10', gun: '#1a1a1c', armband: '#b01e1e' },
    blackHeavy: { uniform: '#1a1b20', dark: '#0a0b0e', skin: null, head: 'helmet', headCol: '#2a2a30', gear: '#44454c', boot: '#0e0e10', gun: '#1a1a1c', armband: '#b01e1e', heavy: true },
    khakiHeavy: { uniform: '#6a5c3c', dark: '#3e3626', skin: null, head: 'helmet', headCol: '#4a4630', gear: '#2a2418', boot: '#2a2218', gun: '#26221e', heavy: true },
    masked: { uniform: '#3a4656', dark: '#222a34', skin: null, head: 'balaclava', headCol: '#16161a', gear: '#26262a', boot: '#141414', gun: '#18181a' },
    maskedHeavy: { uniform: '#2a2e36', dark: '#16181c', skin: null, head: 'helmet', headCol: '#1a1c20', gear: '#3a3c42', boot: '#141414', gun: '#18181a', heavy: true },
    robot: { robot: true, metal: '#8c98aa', dark: '#3c4654', glow: '#ff3b5c' },
    robotHeavy: { robot: true, metal: '#6a5a4a', dark: '#2c2420', glow: '#ffa23b', heavy: true },
    alien: { alien: true, skin: '#6e5aa8', dark: '#3b2d66', glow: '#7cffd4', armor: '#2a3340' },
    target: { target: true, col: '#b8874a' },
    targetCiv: { target: true, col: '#ece6d8', civ: true },
  };
  A.STYLES = STYLES;

  A.makeCivilian = function (r) {
    const shirts = ['#d8433a', '#3a7ad8', '#e8c03a', '#3aa86a', '#e87ab8', '#f0f0f0', '#8a4ad8', '#e8823a'];
    const pants = ['#2a3a5a', '#3a3a3a', '#6a5a4a', '#1e2a44'];
    return { civ: true, uniform: shirts[Math.floor(r() * shirts.length)], dark: pants[Math.floor(r() * pants.length)], skin: SKINS[Math.floor(r() * SKINS.length)], head: r() < 0.5 ? 'hair' : 'longhair', headCol: ['#1a120a', '#3a2412', '#8a5a2a', '#c8a050', '#555'][Math.floor(r() * 5)], boot: '#2a2420' };
  };

  A.litStyle = function (st, sky, interior) {
    const ta = (interior ? sky.ta * 0.55 : sky.ta);
    if (!ta) return st;
    const o = {};
    for (const k in st) o[k] = (typeof st[k] === 'string' && st[k][0] === '#' && k !== 'glow') ? mix(st[k], sky.tint, ta) : st[k];
    return o;
  };

  function limb(ctx, pts, w, col) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke();
  }

  // מחזיר נקודת לוע בקואורדינטות מקומיות
  function drawHuman(ctx, st, pose, t, p) {
    const breathe = Math.sin(t * 3 + (p.seed || 0)) * 1.5;
    const skin = st.skin || p.skin || '#c8946c';
    const hv = st.heavy ? 1.18 : 1;
    // רגליים
    const legC = st.dark;
    const step = pose === 'run' ? Math.sin(t * 12) * 14 : 0;
    ctx.fillStyle = vgrad(ctx, -120, 0, [[0, shade(legC, 0.08)], [1, shade(legC, -0.2)]]);
    poly(ctx, [-21 * hv, -122, -3, -122, -6 + step, -8, -24 + step, -8]); ctx.fill();
    poly(ctx, [3, -122, 21 * hv, -122, 24 - step, -8, 6 - step, -8]); ctx.fill();
    ctx.fillStyle = st.boot || '#222';
    rr(ctx, -30 + step, -16, 25, 16, 5); ctx.fill(); rr(ctx, 5 - step, -16, 25, 16, 5); ctx.fill();
    // גו
    const ty = breathe;
    ctx.save(); ctx.translate(0, ty);
    const tw = 32 * hv;
    ctx.fillStyle = hgrad(ctx, -tw, tw, [[0, shade(st.uniform, 0.18)], [0.55, st.uniform], [1, shade(st.uniform, -0.28)]]);
    poly(ctx, [-tw, -228, tw, -228, 24 * hv, -116, -24 * hv, -116]); ctx.fill();
    if (!st.civ) {
      ctx.strokeStyle = st.gear; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-22, -226); ctx.lineTo(14, -130); ctx.moveTo(22, -226); ctx.lineTo(-14, -130); ctx.stroke();
      ctx.fillStyle = st.gear; ctx.fillRect(-25 * hv, -132, 50 * hv, 11);
      ctx.fillStyle = shade(st.gear, 0.15); ctx.fillRect(-24, -160, 14, 20); ctx.fillRect(10, -160, 14, 20);
      if (st.heavy) { ctx.fillStyle = shade(st.gear, -0.1); rr(ctx, -28, -222, 56, 70, 8); ctx.fill(); ctx.fillStyle = rgba('#ffffff', 0.08); ctx.fillRect(-26, -220, 52, 10); }
    } else {
      ctx.fillStyle = shade(st.uniform, -0.15); ctx.fillRect(-24, -128, 48, 8);
    }
    // צוואר וראש
    ctx.fillStyle = shade(skin, -0.15); ctx.fillRect(-7, -240, 14, 14);
    const hy = -256;
    ctx.fillStyle = hgrad(ctx, -18, 18, [[0, shade(skin, 0.12)], [1, shade(skin, -0.22)]]);
    ctx.beginPath(); ctx.ellipse(0, hy, 17, 20, 0, 0, 7); ctx.fill();
    // פנים
    const scared = p.scared;
    if (st.head !== 'balaclava') {
      ctx.fillStyle = '#1a1210';
      const ey = hy - 2; const squint = pose === 'aim' || pose === 'fire';
      ctx.beginPath(); ctx.ellipse(-6, ey, 2.4, squint ? 1.2 : scared ? 3 : 2.2, 0, 0, 7); ctx.ellipse(6, ey, 2.4, squint ? 1.2 : scared ? 3 : 2.2, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = shade(skin, -0.45); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, ey - 6 + (scared ? -3 : 0)); ctx.lineTo(-2, ey - (squint ? 4 : 6)); ctx.moveTo(10, ey - 6 + (scared ? -3 : 0)); ctx.lineTo(2, ey - (squint ? 4 : 6)); ctx.stroke();
      if (scared) { ctx.fillStyle = '#3a1210'; ctx.beginPath(); ctx.ellipse(0, hy + 10, 4, 5, 0, 0, 7); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(-5, hy + 10); ctx.lineTo(5, hy + 10); ctx.stroke(); }
    }
    // כיסוי ראש
    if (st.head === 'helmet') {
      ctx.fillStyle = hgrad(ctx, -24, 24, [[0, shade(st.headCol, 0.2)], [1, shade(st.headCol, -0.3)]]);
      ctx.beginPath(); ctx.arc(0, hy - 4, 23, Math.PI, 0); ctx.lineTo(25, hy - 1); ctx.lineTo(-25, hy - 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(st.headCol, -0.35); ctx.fillRect(-26, hy - 3, 52, 4);
      ctx.strokeStyle = rgba('#000000', 0.25); ctx.lineWidth = 1; for (let k = -18; k < 20; k += 7) { ctx.beginPath(); ctx.moveTo(k, hy - 24); ctx.lineTo(k + 4, hy - 3); ctx.stroke(); }
    } else if (st.head === 'beret') {
      ctx.fillStyle = st.headCol; ctx.beginPath(); ctx.ellipse(-4, hy - 17, 21, 9, -0.25, 0, 7); ctx.fill();
      ctx.fillStyle = '#d8b84a'; ctx.beginPath(); ctx.arc(-12, hy - 16, 3, 0, 7); ctx.fill();
    } else if (st.head === 'balaclava') {
      ctx.fillStyle = st.headCol; ctx.beginPath(); ctx.ellipse(0, hy, 18, 21, 0, 0, 7); ctx.fill();
      ctx.fillStyle = skin; rr(ctx, -13, hy - 8, 26, 10, 4); ctx.fill();
      ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(-6, hy - 3, 2.4, 0, 7); ctx.arc(6, hy - 3, 2.4, 0, 7); ctx.fill();
    } else if (st.head === 'hair' || st.head === 'longhair') {
      ctx.fillStyle = st.headCol; ctx.beginPath(); ctx.ellipse(0, hy - 10, 18, 13, 0, Math.PI, 0); ctx.fill();
      if (st.head === 'longhair') { ctx.fillRect(-19, hy - 10, 7, 34); ctx.fillRect(12, hy - 10, 7, 34); }
    }
    if (st.armband) { ctx.fillStyle = st.armband; }
    // ידיים ונשק
    let muzzle = null;
    const armC = st.uniform, handC = skin;
    const gun = st.gun || '#222';
    if (pose === 'hostage' || pose === 'surrender') {
      limb(ctx, [-28, -222, -46, -258, -38, -300], 14, armC); limb(ctx, [28, -222, 46, -258, 38, -300], 14, armC);
      ctx.fillStyle = handC; ctx.beginPath(); ctx.arc(-38, -304, 7, 0, 7); ctx.arc(38, -304, 7, 0, 7); ctx.fill();
    } else if (pose === 'aim' || pose === 'fire') {
      limb(ctx, [28, -222, 36, -190, 16, -200], 14, armC);
      limb(ctx, [-28, -222, -32, -186, -4, -194], 14, armC);
      if (st.armband) { ctx.strokeStyle = st.armband; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(-29, -210); ctx.lineTo(-30, -200); ctx.stroke(); }
      ctx.fillStyle = gun; rr(ctx, -10, -214, 34, 20, 4); ctx.fill();
      ctx.fillStyle = shade(gun, 0.25); ctx.beginPath(); ctx.arc(2, -200, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.arc(2, -200, 4.5, 0, 7); ctx.fill();
      ctx.fillStyle = shade(gun, 0.5); ctx.fillRect(0, -214, 4, 5);
      ctx.fillStyle = handC; ctx.beginPath(); ctx.arc(16, -200, 6.5, 0, 7); ctx.arc(-4, -194, 6.5, 0, 7); ctx.fill();
      muzzle = [2, -200 + ty];
    } else if (pose === 'none') {
      limb(ctx, [-28, -222, -34, -170, -30, -124], 13, armC); limb(ctx, [28, -222, 34, -170, 30, -124], 13, armC);
    } else {
      // נשק באלכסון
      limb(ctx, [-28, -222, -36, -172, -18, -150], 14, armC);
      limb(ctx, [28, -222, 38, -186, 24, -200], 14, armC);
      ctx.save(); ctx.translate(0, -175); ctx.rotate(-0.78);
      ctx.fillStyle = gun; rr(ctx, -50, -6, 100, 12, 3); ctx.fill(); ctx.fillRect(-6, 4, 9, 18); ctx.fillStyle = shade(gun, 0.2); ctx.fillRect(30, -3, 30, 5);
      ctx.restore();
      ctx.fillStyle = handC; ctx.beginPath(); ctx.arc(-18, -150, 6.5, 0, 7); ctx.arc(24, -200, 6.5, 0, 7); ctx.fill();
    }
    ctx.restore();
    return muzzle;
  }

  function drawRobot(ctx, st, pose, t, p) {
    const hv = st.heavy ? 1.25 : 1;
    const step = pose === 'run' ? Math.sin(t * 12) * 12 : 0;
    const M = st.metal, D = st.dark;
    ctx.fillStyle = D;
    rr(ctx, -24 * hv + step, -120, 16, 112, 6); ctx.fill(); rr(ctx, 8 * hv - step, -120, 16, 112, 6); ctx.fill();
    ctx.fillStyle = M; ctx.beginPath(); ctx.arc(-16 * hv + step, -62, 9, 0, 7); ctx.arc(16 * hv - step, -62, 9, 0, 7); ctx.fill();
    ctx.fillStyle = shade(D, -0.2); rr(ctx, -30 * hv + step, -14, 26, 14, 4); ctx.fill(); rr(ctx, 4 * hv - step, -14, 26, 14, 4); ctx.fill();
    const by = Math.sin(t * 4 + (p.seed || 0)) * 2;
    ctx.save(); ctx.translate(0, by);
    ctx.fillStyle = hgrad(ctx, -36 * hv, 36 * hv, [[0, shade(M, 0.3)], [0.5, M], [1, shade(M, -0.4)]]);
    rr(ctx, -36 * hv, -232, 72 * hv, 116, 14); ctx.fill();
    ctx.strokeStyle = rgba('#000000', 0.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-30, -190); ctx.lineTo(30, -190); ctx.moveTo(0, -232); ctx.lineTo(0, -150); ctx.stroke();
    const g = ctx.createRadialGradient(0, -170, 0, 0, -170, 16); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, st.glow); g.addColorStop(1, rgba(st.glow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -170, 16, 0, 7); ctx.fill();
    // ראש
    ctx.fillStyle = hgrad(ctx, -20, 20, [[0, shade(M, 0.25)], [1, shade(M, -0.35)]]); rr(ctx, -20, -276, 40, 38, 10); ctx.fill();
    ctx.fillStyle = '#05070a'; rr(ctx, -16, -264, 32, 11, 5); ctx.fill();
    ctx.fillStyle = st.glow; const blink = (Math.sin(t * 2 + (p.seed || 0)) > 0.97) ? 0.2 : 1; ctx.globalAlpha *= blink; rr(ctx, -13, -262, 26, 6, 3); ctx.fill(); ctx.globalAlpha /= blink;
    ctx.strokeStyle = D; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(12, -276); ctx.lineTo(16, -292); ctx.stroke(); ctx.fillStyle = st.glow; ctx.beginPath(); ctx.arc(16, -294, 3, 0, 7); ctx.fill();
    let muzzle = null;
    if (pose === 'aim' || pose === 'fire') {
      limb(ctx, [-36, -222, -44, -180, -40, -140], 14, D);
      limb(ctx, [36, -222, 34, -200, 10, -196], 16, D);
      ctx.fillStyle = M; ctx.beginPath(); ctx.arc(8, -196, 15, 0, 7); ctx.fill();
      ctx.fillStyle = '#05070a'; ctx.beginPath(); ctx.arc(8, -196, 8, 0, 7); ctx.fill();
      ctx.fillStyle = rgba(st.glow, 0.6 + 0.4 * Math.sin(t * 20)); ctx.beginPath(); ctx.arc(8, -196, 4, 0, 7); ctx.fill();
      muzzle = [8, -196 + by];
    } else {
      limb(ctx, [-36, -222, -46, -170, -40, -130], 14, D);
      limb(ctx, [36, -222, 46, -170, 44, -130], 16, D);
      ctx.fillStyle = M; rr(ctx, 34, -150, 20, 40, 6); ctx.fill();
    }
    ctx.restore();
    return muzzle;
  }

  function drawAlien(ctx, st, pose, t, p) {
    const step = pose === 'run' ? Math.sin(t * 12) * 14 : 0;
    ctx.fillStyle = st.dark;
    poly(ctx, [-16, -122, -4, -122, -10 + step, -60, -22 + step, -4, -30 + step, -4, -22 + step, -64]); ctx.fill();
    poly(ctx, [4, -122, 16, -122, 22 - step, -64, 30 - step, -4, 22 - step, -4, 10 - step, -60]); ctx.fill();
    const by = Math.sin(t * 3 + (p.seed || 0)) * 2;
    ctx.save(); ctx.translate(0, by);
    ctx.fillStyle = hgrad(ctx, -26, 26, [[0, shade(st.skin, 0.2)], [1, shade(st.skin, -0.35)]]);
    poly(ctx, [-26, -230, 26, -230, 16, -118, -16, -118]); ctx.fill();
    ctx.fillStyle = st.armor; poly(ctx, [-30, -232, 30, -232, 22, -170, -22, -170]); ctx.fill();
    ctx.strokeStyle = rgba(st.glow, 0.7); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, -200); ctx.lineTo(20, -200); ctx.stroke();
    ctx.fillStyle = st.skin; ctx.fillRect(-5, -246, 10, 18);
    ctx.fillStyle = hgrad(ctx, -18, 18, [[0, shade(st.skin, 0.25)], [1, shade(st.skin, -0.3)]]);
    ctx.beginPath(); ctx.ellipse(0, -268, 18, 28, -0.15, 0, 7); ctx.fill();
    ctx.fillStyle = st.glow; ctx.beginPath(); ctx.ellipse(-7, -268, 6, 3, -0.4, 0, 7); ctx.ellipse(7, -268, 6, 3, 0.4, 0, 7); ctx.fill();
    let muzzle = null;
    if (pose === 'aim' || pose === 'fire') {
      limb(ctx, [26, -224, 30, -196, 10, -198], 10, st.skin); limb(ctx, [-26, -224, -28, -190, -6, -194], 10, st.skin);
      ctx.fillStyle = st.armor; rr(ctx, -12, -212, 30, 22, 6); ctx.fill();
      ctx.fillStyle = st.glow; ctx.beginPath(); ctx.arc(2, -200, 7, 0, 7); ctx.fill();
      muzzle = [2, -200 + by];
    } else {
      limb(ctx, [-26, -224, -34, -176, -24, -150], 10, st.skin); limb(ctx, [26, -224, 34, -186, 24, -196], 10, st.skin);
      ctx.fillStyle = st.armor; ctx.save(); ctx.translate(0, -172); ctx.rotate(-0.7); rr(ctx, -40, -7, 80, 14, 6); ctx.fill(); ctx.fillStyle = st.glow; ctx.fillRect(30, -3, 12, 6); ctx.restore();
    }
    ctx.restore();
    return muzzle;
  }

  function drawTarget(ctx, st, p) {
    ctx.fillStyle = '#5a4026'; ctx.fillRect(-4, -120, 8, 120);
    ctx.fillStyle = st.col;
    ctx.beginPath(); ctx.ellipse(0, -250, 22, 25, 0, 0, 7); ctx.fill();
    poly(ctx, [-44, -224, 44, -224, 36, -110, -36, -110]); ctx.fill();
    ctx.strokeStyle = rgba('#000000', 0.35); ctx.lineWidth = 2; ctx.stroke();
    if (st.civ) {
      ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(-7, -254, 3, 0, 7); ctx.arc(7, -254, 3, 0, 7); ctx.fill();
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -246, 9, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.fillStyle = '#2a7ad8'; ctx.font = 'bold 22px Assistant, Arial'; ctx.textAlign = 'center'; ctx.fillText('אזרח', 0, -160);
    } else {
      ctx.strokeStyle = rgba('#000000', 0.5); ctx.lineWidth = 3;
      [12, 26, 40].forEach(rd => { ctx.beginPath(); ctx.arc(0, -170, rd, 0, 7); ctx.stroke(); });
      ctx.beginPath(); ctx.arc(0, -250, 12, 0, 7); ctx.stroke();
    }
    (p.holes || []).forEach(h => { ctx.fillStyle = '#1a1208'; ctx.beginPath(); ctx.arc(h[0], h[1], 3.5, 0, 7); ctx.fill(); });
  }

  // דמות מלאה בעולם
  A.drawPerson = function (ctx, p, t) {
    const st = p.style;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.deadT !== undefined && p.deadT > 0) {
      const k = Math.min(1, p.deadT / 0.45);
      ctx.rotate(k * 1.45 * (p.fallDir || 1) * (st.target ? 0.0 : 1));
      if (st.target) ctx.scale(1, 1 - k * 0.92);
      ctx.globalAlpha *= Math.max(0, 1 - Math.max(0, p.deadT - 1.1) / 0.6);
    }
    if (p.flip) ctx.scale(-1, 1);
    ctx.scale(p.s, p.s);
    // צל
    if (!p.deadT) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 40, 9, 0, 0, 7); ctx.fill(); }
    let m = null;
    if (st.target) drawTarget(ctx, st, p);
    else if (st.robot) m = drawRobot(ctx, st, p.pose, t, p);
    else if (st.alien) m = drawAlien(ctx, st, p.pose, t, p);
    else m = drawHuman(ctx, st, p.pose, t, p);
    if (p.hitFlash > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, p.hitFlash * 6)})`; ctx.fillRect(-80, -320, 160, 330);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    return m ? [p.x + m[0] * p.s * (p.flip ? -1 : 1), p.y + m[1] * p.s] : null;
  };

  // אזורי פגיעה (קואורדינטות מסך)
  A.zones = function (p) {
    const s = p.s, x = p.x, y = p.y;
    const big = (p.style.heavy ? 1.2 : 1);
    return {
      head: { x, y: y - (p.style.alien ? 268 : 256) * s, r: (p.style.alien ? 22 : 20) * s },
      torso: { x0: x - 32 * s * big, x1: x + 32 * s * big, y0: y - 232 * s, y1: y - 116 * s },
      legs: { x0: x - 28 * s, x1: x + 28 * s, y0: y - 120 * s, y1: y },
      arms: { x0: x - 50 * s, x1: x + 50 * s, y0: y - 232 * s, y1: y - 140 * s },
    };
  };

  // ---------- כלי רכב ----------
  A.drawVehicle = function (ctx, v, t) {
    ctx.save(); ctx.translate(v.x, v.y); ctx.scale(v.s * (v.dir < 0 ? -1 : 1), v.s);
    const k = v.kind, dmg = 1 - v.hp / v.maxhp;
    const shake = v.hitFlash > 0 ? (Math.random() - 0.5) * 6 : 0;
    ctx.translate(shake, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; if (k !== 'drone') { ctx.beginPath(); ctx.ellipse(0, 0, 190, 18, 0, 0, 7); ctx.fill(); }
    const lit = c => v.tint ? mix(c, v.tint[0], v.tint[1]) : c;
    if (k === 'jeep') {
      const c = lit('#6a6a42');
      ctx.fillStyle = vgrad(ctx, -120, -20, [[0, shade(c, 0.15)], [1, shade(c, -0.35)]]); ctx.fillRect(-170, -110, 340, 75);
      ctx.fillStyle = shade(c, -0.1); poly(ctx, [100, -110, 170, -110, 175, -70, 100, -70]); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 6; ctx.strokeRect(20, -180, 60, 70);
      ctx.fillStyle = '#121212'; [-110, 110].forEach(x => { ctx.beginPath(); ctx.arc(x, -30, 34, 0, 7); ctx.fill(); ctx.fillStyle = '#4a4a4a'; ctx.beginPath(); ctx.arc(x, -30, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#121212'; });
      ctx.fillStyle = lit('#2a2a22'); ctx.fillRect(-80, -190, 12, 80); ctx.fillRect(-120, -200, 90, 14);
    } else if (k === 'apc') {
      const c = lit('#26282e');
      ctx.fillStyle = vgrad(ctx, -170, -20, [[0, shade(c, 0.2)], [1, shade(c, -0.3)]]);
      poly(ctx, [-190, -40, -190, -140, -120, -170, 140, -170, 200, -110, 200, -40]); ctx.fill();
      ctx.fillStyle = shade(c, 0.1); rr(ctx, -60, -215, 120, 50, 12); ctx.fill(); ctx.fillStyle = '#111'; ctx.fillRect(40, -200, 110, 14);
      ctx.fillStyle = '#b01e1e'; ctx.fillRect(-150, -130, 60, 16);
      ctx.fillStyle = '#0c0c0c'; [-140, -50, 40, 130].forEach(x => { ctx.beginPath(); ctx.arc(x, -34, 32, 0, 7); ctx.fill(); });
    } else if (k === 'suv') {
      const c = lit('#1a1c22');
      ctx.fillStyle = vgrad(ctx, -170, -20, [[0, shade(c, 0.25)], [1, shade(c, -0.2)]]);
      rr(ctx, -190, -120, 380, 85, 18); ctx.fill(); poly(ctx, [-150, -120, -120, -190, 110, -190, 160, -120]); ctx.fill();
      ctx.fillStyle = '#3a4a5a'; poly(ctx, [-130, -126, -108, -180, -10, -180, -10, -126]); ctx.fill(); poly(ctx, [0, -126, 0, -180, 100, -180, 140, -126]); ctx.fill();
      ctx.fillStyle = '#0c0c0c'; [-120, 120].forEach(x => { ctx.beginPath(); ctx.arc(x, -34, 34, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#ffe9a0'; ctx.fillRect(176, -100, 12, 14);
    } else if (k === 'drone') {
      const bob = Math.sin(t * 5 + v.seed) * 8;
      ctx.translate(0, bob);
      ctx.fillStyle = hgrad(ctx, -90, 90, [[0, '#9aa8ba'], [1, '#3a4452']]); ctx.beginPath(); ctx.ellipse(0, -60, 90, 28, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a323e'; ctx.beginPath(); ctx.ellipse(0, -52, 60, 14, 0, 0, 7); ctx.fill();
      [-110, 110].forEach(x => { ctx.fillStyle = '#3a4452'; ctx.fillRect(x - 20, -68, 40, 8); ctx.fillStyle = rgba('#9fe8ff', 0.35 + 0.2 * Math.sin(t * 40)); ctx.beginPath(); ctx.ellipse(x, -72, 46, 6, 0, 0, 7); ctx.fill(); });
      const g = ctx.createRadialGradient(0, -48, 0, 0, -48, 20); g.addColorStop(0, '#fff'); g.addColorStop(0.3, '#ff3b5c'); g.addColorStop(1, 'rgba(255,59,92,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -48, 20, 0, 7); ctx.fill();
    }
    if (dmg > 0.4) { ctx.fillStyle = rgba('#000000', 0.25 * dmg); ctx.fillRect(-190, -200, 380, 170); }
    if (v.hitFlash > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, v.hitFlash * 5)})`; ctx.fillRect(-220, -240, 440, 240); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
  };

  // ---------- בוסים ----------
  function glowDot(ctx, x, y, r, col, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  A.glowDot = glowDot;

  A.drawBoss = function (ctx, b, t) {
    ctx.save(); ctx.translate(b.x, b.y);
    const s = b.s; ctx.scale(s, s);
    const shake = b.hitFlash > 0 ? (Math.random() - 0.5) * 5 : 0; ctx.translate(shake, 0);
    const k = b.kind;
    const lit = c => b.tint ? mix(c, b.tint[0], b.tint[1]) : c;
    if (k === 'tank') {
      const c = lit('#6a6440');
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 0, 320, 26, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#1e1c16'; rr(ctx, -300, -80, 600, 80, 40); ctx.fill();
      ctx.fillStyle = '#3a382c'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(-240 + i * 60, -40, 26, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#121210'; ctx.lineWidth = 4; for (let i = 0; i < 30; i++) { const x = -290 + ((i * 20 + t * 40 * b.vx) % 580 + 580) % 580; ctx.beginPath(); ctx.moveTo(x, -80); ctx.lineTo(x, -72); ctx.stroke(); }
      ctx.fillStyle = vgrad(ctx, -150, -70, [[0, shade(c, 0.2)], [1, shade(c, -0.3)]]); poly(ctx, [-310, -78, -270, -140, 280, -140, 320, -78]); ctx.fill();
      ctx.fillStyle = vgrad(ctx, -230, -140, [[0, shade(c, 0.25)], [1, shade(c, -0.15)]]); poly(ctx, [-150, -140, -110, -225, 110, -225, 150, -140]); ctx.fill();
      ctx.save(); ctx.translate(100, -190); ctx.rotate(b.aim || 0); ctx.fillStyle = shade(c, -0.2); ctx.fillRect(0, -11, 300, 22); ctx.fillStyle = shade(c, -0.35); ctx.fillRect(280, -15, 40, 30); ctx.restore();
      ctx.fillStyle = shade(c, -0.3); ctx.beginPath(); ctx.ellipse(-30, -228, 40, 12, 0, 0, 7); ctx.fill();
    } else if (k === 'bunker') {
      const c = lit('#8a8678');
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 0, 520, 30, 0, 0, 7); ctx.fill();
      ctx.fillStyle = vgrad(ctx, -300, 0, [[0, shade(c, 0.15)], [1, shade(c, -0.35)]]);
      poly(ctx, [-520, 0, -460, -230, 460, -230, 520, 0]); ctx.fill();
      ctx.fillStyle = shade(c, 0.1); poly(ctx, [-470, -230, -420, -290, 420, -290, 470, -230]); ctx.fill();
      ctx.strokeStyle = rgba('#000000', 0.2); ctx.lineWidth = 3; for (let y = -200; y < 0; y += 40) { ctx.beginPath(); ctx.moveTo(-480, y); ctx.lineTo(480, y); ctx.stroke(); }
      ctx.fillStyle = lit('#b8a070'); for (let x = -520; x < 520; x += 60) { rr(ctx, x, -34, 58, 34, 14); ctx.fill(); }
      ctx.fillStyle = shade(c, -0.25); rr(ctx, -90, -360, 180, 80, 14); ctx.fill();
      ctx.save(); ctx.translate(0, -330); ctx.rotate(-0.25 + Math.sin(t) * 0.1); ctx.fillStyle = shade(c, -0.4); ctx.fillRect(0, -12, 200, 24); ctx.restore();
    } else if (k === 'train') {
      const c = lit('#2a2c30');
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-640, -10, 1280, 20);
      ctx.fillStyle = vgrad(ctx, -300, 0, [[0, shade(c, 0.2)], [1, shade(c, -0.3)]]); ctx.fillRect(-640, -260, 1280, 220);
      ctx.fillStyle = shade(c, -0.2); for (let x = -620; x < 640; x += 80) ctx.fillRect(x, -250, 4, 200);
      ctx.fillStyle = '#b01e1e'; ctx.fillRect(-640, -150, 1280, 14);
      ctx.fillStyle = '#0c0c0c'; for (let x = -560; x < 640; x += 160) { ctx.beginPath(); ctx.arc(x, -30, 30, 0, 7); ctx.fill(); }
    } else if (k === 'heli') {
      const bob = Math.sin(t * 2) * 10; ctx.translate(0, bob);
      const c = lit('#2a2e26');
      ctx.fillStyle = vgrad(ctx, -260, -60, [[0, shade(c, 0.25)], [1, shade(c, -0.3)]]);
      ctx.beginPath(); ctx.ellipse(0, -150, 210, 90, 0, 0, 7); ctx.fill();
      poly(ctx, [150, -170, 520, -150, 520, -130, 150, -110]); ctx.fill();
      ctx.fillStyle = shade(c, -0.1); poly(ctx, [490, -220, 530, -220, 520, -130, 495, -130]); ctx.fill();
      ctx.fillStyle = '#1a2836'; ctx.beginPath(); ctx.ellipse(-120, -160, 80, 52, -0.2, 0, 7); ctx.fill();
      ctx.fillStyle = rgba('#9fd0ff', 0.25); ctx.beginPath(); ctx.ellipse(-140, -175, 40, 20, -0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#121410'; ctx.fillRect(-20, -255, 40, 20);
      ctx.fillStyle = rgba('#cccccc', 0.25); ctx.beginPath(); ctx.ellipse(0, -258, 420, 14, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 8; const a = t * 30; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * 420, -258); ctx.lineTo(Math.cos(a) * 420, -258); ctx.stroke();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-140, -60); ctx.lineTo(120, -60); ctx.moveTo(-100, -60); ctx.lineTo(-90, -80); ctx.moveTo(80, -60); ctx.lineTo(70, -80); ctx.stroke();
      ctx.fillStyle = '#b01e1e'; ctx.beginPath(); ctx.arc(60, -150, 18, 0, 7); ctx.fill();
    } else if (k === 'walker') {
      const c = lit('#5a6070');
      const sw = Math.sin(t * 1.6) * 30;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 0, 300, 24, 0, 0, 7); ctx.fill();
      [-1, 1].forEach(d => {
        const fx = d * 150 + (d > 0 ? sw : -sw);
        ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(d * 90, -380); ctx.lineTo(d * 210 + sw * 0.3, -200); ctx.lineTo(fx, -10); ctx.stroke();
        ctx.fillStyle = shade(c, -0.1); ctx.beginPath(); ctx.arc(d * 210 + sw * 0.3, -200, 26, 0, 7); ctx.fill();
        ctx.fillStyle = shade(c, -0.4); rr(ctx, fx - 50, -22, 100, 22, 8); ctx.fill();
      });
      ctx.lineCap = 'butt';
      ctx.fillStyle = vgrad(ctx, -560, -340, [[0, shade(c, 0.3)], [1, shade(c, -0.25)]]);
      poly(ctx, [-200, -360, -160, -540, 160, -540, 200, -360, 120, -320, -120, -320]); ctx.fill();
      ctx.fillStyle = shade(c, -0.15); rr(ctx, -80, -600, 160, 70, 18); ctx.fill();
      ctx.fillStyle = '#05070a'; rr(ctx, -60, -580, 120, 26, 10); ctx.fill();
      ctx.strokeStyle = rgba('#4fe3ff', 0.6); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-150, -440); ctx.lineTo(150, -440); ctx.stroke();
    } else if (k === 'mothership') {
      const c = lit('#3a2a58');
      ctx.fillStyle = vgrad(ctx, -200, 60, [[0, shade(c, 0.3)], [1, shade(c, -0.4)]]);
      ctx.beginPath(); ctx.ellipse(0, -60, 640, 130, 0, 0, 7); ctx.fill();
      ctx.fillStyle = shade(c, -0.2); ctx.beginPath(); ctx.ellipse(0, -10, 520, 70, 0, 0, Math.PI); ctx.fill();
      for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI; const x = Math.cos(a) * 560, y = -20 + Math.sin(a) * 60; glowDot(ctx, x, y, 18, '#7cffd4', 0.5 + 0.4 * Math.sin(t * 3 + i)); }
      ctx.fillStyle = shade(c, 0.15); ctx.beginPath(); ctx.ellipse(0, -150, 240, 70, 0, Math.PI, 0); ctx.fill();
    }
    ctx.restore();
  };

  // ---------- אפקטים לאחר עיבוד ----------
  A.postFX = function (ctx, grade, t, extra) {
    if (grade === 'film') {
      ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,190,110,0.35)'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.07; const ox = Math.random() * 256, oy = Math.random() * 256;
      const pat = ctx.createPattern(NOISE, 'repeat'); ctx.save(); ctx.translate(-ox, -oy); ctx.fillStyle = pat; ctx.fillRect(ox, oy, W, H); ctx.restore(); ctx.globalAlpha = 1;
      if (Math.random() < 0.3) { ctx.fillStyle = 'rgba(255,240,210,0.12)'; ctx.fillRect(Math.random() * W, 0, 1.5, H); }
      if (Math.random() < 0.05) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, 2 + Math.random() * 4, 0, 7); ctx.fill(); }
    } else if (grade === 'cold') {
      ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(90,120,160,0.35)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.04; const pat = ctx.createPattern(NOISE, 'repeat'); ctx.fillStyle = pat; ctx.save(); ctx.translate(-Math.random() * 200, -Math.random() * 200); ctx.fillRect(0, 0, W + 200, H + 200); ctx.restore(); ctx.globalAlpha = 1;
    } else if (grade === 'neon') {
      ctx.fillStyle = 'rgba(0,0,0,0.07)'; for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
      ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(60,30,140,0.3)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    } else if (grade === 'tactical') {
      ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(70,140,130,0.3)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    }
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${grade === 'film' ? 0.6 : 0.5})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };

  window.ART = A;
})();
