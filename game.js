/* קו האש: מנוע המשחק */
(function () {
  const { WEAPONS, THEMES, CAMPAIGNS, RANKS } = window.GAME_DATA;
  const A = window.ART, S = window.SFX;
  const W = 1280, H = 720;
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const rand = Math.random;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isTouch = matchMedia('(pointer: coarse)').matches;

  // ---------- שמירה ----------
  const SAVE_KEY = 'kav-haesh-v1';
  function defaultSave() {
    const prog = {}; CAMPAIGNS.forEach(c => prog[c.id] = { unlocked: 1, stars: [], best: [] });
    return { prog, settings: { diff: 'normal', sfx: true, music: true, voice: true, autoReload: isTouch } };
  }
  let save = defaultSave();
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.prog) { save = Object.assign(defaultSave(), s); CAMPAIGNS.forEach(c => { if (!save.prog[c.id]) save.prog[c.id] = { unlocked: 1, stars: [], best: [] }; }); save.settings = Object.assign(defaultSave().settings, s.settings || {}); } } catch (e) { }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }

  const DIFF = { easy: { lives: 7, aim: 1.35, name: 'קל' }, normal: { lives: 5, aim: 1, name: 'רגיל' }, hard: { lives: 4, aim: 0.78, name: 'קשה' } };

  const RADIO = {
    six: { start: ['קדימה, נע נע!', 'תנועה מקדימה, שים לב!', 'שמור על הראש, סמל!', 'אחריי!'], clear: ['נקי! ממשיכים!', 'יפה מאוד, זזים!', 'האזור בידינו!'], hurt: ['נפגעת? תחזיק מעמד!', 'חובש!'] },
    black: { start: ['הנץ, נכנסים.', 'שקט ומהר.', 'מגע מקדימה!', 'כסה אותי!'], clear: ['אזור נקי.', 'ממשיכים לנקודה הבאה.', 'עבודה טובה, הנץ.'], hurt: ['אתה בסדר? תמשיך!', 'תתכסה!'] },
    future: { start: ['זיהיתי חתימות אנרגיה מקדימה.', 'רמת איום: גבוהה.', 'מומלץ לכוון לראש המאיר.', 'תנועה בשלוש נקודות.'], clear: ['האזור נקי. מומלץ להתקדם.', 'יעילות מרשימה.', 'אין חתימות נוספות.'], hurt: ['נזק לשריון. ממשיכים.', 'הדופק שלך עולה. נשום.'] },
    rescue: { start: ['ברק, פורצים!', 'זהירות, יש בני ערובה!', 'דיוק לפני מהירות!', 'נכנסים בשלוש!'], clear: ['נקי! מתקדמים!', 'בני הערובה בטוחים.', 'ממשיכים, ברק.'], hurt: ['נפגעת! תחזיק!', 'תתכסה!'] },
  };
  const HELP = ['הצילו!', 'מישהו תעזור לי!', 'אמא!', 'תצילו אותי!'];
  const DONTSHOOT = ['אל תירו!', 'אני אזרח!', 'לא לירות!'];

  // ---------- תצוגה ----------
  let cssScale = 1, dpr = 1;
  function resize() {
    const stage = $('stage'); const bw = stage.clientWidth, bh = stage.clientHeight;
    cssScale = Math.min(bw / W, bh / H);
    const cw = Math.round(W * cssScale), ch = Math.round(H * cssScale);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  }
  window.addEventListener('resize', resize);

  // ---------- מצב ----------
  let G = { screen: 'menu', t: 0, mx: W / 2, my: H / 2, down: false, pressed: false, shake: 0, flash: 0, flashCol: '255,40,30' };
  let L = null; // שלב פעיל
  let SC = null; // סצנה פעילה

  const groundY = z => SC.HOR + (H + 30 - SC.HOR) * z;
  const scaleAt = z => 0.2 + 0.95 * z;

  function makeWeapon(key, base) {
    const d = WEAPONS[key];
    return { key, d, ammo: d.mag, reserve: base ? Infinity : (d.reserve || 0), reloading: false, reloadT: 0, last: 0, base, recoil: 0 };
  }

  // ---------- התחלת שלב ----------
  function startLevel(ci, li) {
    const camp = CAMPAIGNS[ci], lv = camp.levels[li];
    const diff = DIFF[save.settings.diff];
    L = {
      ci, li, camp, lv, theme: THEMES[lv.theme], diff,
      lives: diff.lives, maxLives: diff.lives, score: 0, shots: 0, hits: 0, kills: 0, heads: 0, neutral: 0,
      saved: 0, lost: 0, civHit: 0, dmg: 0, combo: 0, maxCombo: 0, time: 0, slowT: 0,
      weapon: makeWeapon(camp.weapons.base, true), baseKey: camp.weapons.base,
      sceneIdx: 0, radio: null, hint: null, popups: [], tracers: [],
    };
    buildScene(0);
    G.screen = 'play'; showScreen(null);
    S.startMusic(camp.id);
    if (lv.tutorial) L.hint = { text: isTouch ? 'הקש על המטרה כדי לירות. כפתור הטעינה בפינה' : 'קליק שמאלי יורה. קליק ימני או R טוען מחדש', t: 6 };
  }

  function buildScene(idx) {
    const lv = L.lv, theme = L.theme;
    const seed = (L.ci + 1) * 7919 + L.li * 613 + idx * 97 + 11;
    const bg = A.paintScene(lv.theme, theme, lv.time, seed);
    const r = A.rng(seed + 3);
    const isBoss = !!lv.boss && idx === lv.scenes - 1;
    SC = { idx, bg, HOR: bg.HOR, sky: bg.sky, covers: [], ents: [], parts: [], projs: [], items: [], spots: [], queue: [], phase: 'enter', t: 0, spawnT: 1.2, isBoss, boss: null, r, decal: A.mk(W, H), crate: false, interior: theme.type === 'in' };
    SC.decalCtx = SC.decal.getContext('2d');
    layoutCovers(theme, r, isBoss);
    makeSpots();
    makeWave(idx, isBoss);
    if (isBoss) SC.bossDelay = 2.2;
    const styleKey = L.camp.enemy;
    SC.styles = {};
    const base = A.STYLES;
    const map = { khaki: ['khaki', 'khakiHeavy'], black: ['black', 'blackHeavy'], robot: ['robot', 'robotHeavy'], masked: ['masked', 'maskedHeavy'] }[styleKey];
    SC.styles.normal = A.litStyle(base[map[0]], SC.sky, SC.interior);
    SC.styles.heavy = A.litStyle(base[map[1]], SC.sky, SC.interior);
    SC.styles.alien = A.litStyle(base.alien, SC.sky, SC.interior);
    SC.styles.target = base.target; SC.styles.targetCiv = base.targetCiv;
    SC.tint = SC.sky.ta ? [SC.sky.tint, SC.interior ? SC.sky.ta * 0.55 : SC.sky.ta] : null;
  }

  function layoutCovers(theme, r, isBoss) {
    const list = theme.covers;
    const bands = isBoss ? [[0.76, 0.8, 2]] : [[0.3, 0.38, 1 + Math.floor(r() * 2)], [0.48, 0.58, 1 + Math.floor(r() * 2)], [0.7, 0.8, 1 + Math.floor(r() * 2)]];
    bands.forEach(([z0, z1, n], bi) => {
      const segW = (W - 200) / n;
      for (let i = 0; i < n; i++) {
        let type = list[Math.floor(r() * list.length)];
        if (type === 'trench' && bi === 2 && !isBoss) type = 'sandbags';
        const z = z0 + r() * (z1 - z0);
        let x = 100 + segW * (i + 0.5) + (r() - 0.5) * segW * 0.5;
        if (isBoss) x = i === 0 ? 170 : W - 170;
        const s = scaleAt(z);
        const img = A.renderCover(type, s, theme.pal, SC.sky, Math.floor(r() * 1e6), theme.type === 'in');
        SC.covers.push({ type, x, z, s, img, w: img.w, h: img.h, tall: img.tall, marks: [] });
      }
    });
    SC.covers.forEach(c => { c.gy = groundY(c.z); c.x0 = c.x - c.w / 2; c.x1 = c.x + c.w / 2; c.y0 = c.gy - c.h; c.y1 = c.gy; });
  }

  function makeSpots() {
    const r = SC.r;
    SC.covers.forEach(c => {
      if (c.type === 'trench') [-0.3, 0, 0.3].forEach(k => SC.spots.push({ kind: 'pop', cover: c, x: c.x + k * c.w, z: c.z - 0.006, sink: 0.46 }));
      else if (c.tall) { SC.spots.push({ kind: 'side', cover: c, dir: -1, z: c.z - 0.008 }); SC.spots.push({ kind: 'side', cover: c, dir: 1, z: c.z - 0.008 }); }
      else { SC.spots.push({ kind: 'pop', cover: c, x: c.x + (r() - 0.5) * c.w * 0.35, z: c.z - 0.008, sink: 0 }); if (c.w > 200) SC.spots.push({ kind: 'pop', cover: c, x: c.x + (r() < 0.5 ? -1 : 1) * c.w * 0.3, z: c.z - 0.008, sink: 0 }); }
    });
    const wins = SC.bg.wins.slice().sort(() => r() - 0.5).slice(0, 6);
    wins.forEach(w => SC.spots.push({ kind: w.door ? 'door' : 'win', win: w, z: w.z }));
    for (let i = 0; i < 3; i++) SC.spots.push({ kind: 'far', x: 140 + r() * (W - 280), z: 0.12 + r() * 0.14 });
  }

  function makeWave(idx, isBoss) {
    const lv = L.lv, d = lv.diff, r = SC.r, q = [];
    if (lv.tutorial) {
      const n = 6 + idx * 2;
      for (let i = 0; i < n; i++) q.push({ type: r() < 0.22 + idx * 0.05 ? 'targetCiv' : 'target' });
      if (L.camp.hostages && idx > 0) q.push({ type: 'targetPair' }, { type: 'targetPair' });
      SC.queue = q; SC.maxActive = 2 + idx; return;
    }
    let n = Math.round(4 + d * 0.75 + idx * 0.9);
    if (isBoss) n = Math.round(3 + d * 0.4);
    const hostP = L.camp.hostages ? 0.2 : (['oldcity', 'village', 'neon', 'ruins'].includes(lv.theme) ? 0.08 : 0);
    const civP = L.camp.hostages || ['oldcity', 'village', 'neon', 'ruins', 'terminal', 'hotel', 'train'].includes(lv.theme) ? 0.13 : 0.04;
    let vehicleDone = isBoss;
    for (let i = 0; i < n; i++) {
      const x = r();
      let type = 'soldier';
      if (!vehicleDone && d >= 3 && i === Math.floor(n * 0.5) && r() < 0.6 && L.theme.type === 'out') { type = 'vehicle'; vehicleDone = true; }
      else if (x < hostP) type = 'taker';
      else if (x < hostP + 0.12 && d >= 2) type = 'grenadier';
      else if (x < hostP + 0.26 && d >= 3) type = 'heavy';
      else if (x < hostP + 0.38) type = 'runner';
      else if (x < hostP + 0.48 && d >= 4) type = 'sniper';
      if (L.camp.id === 'future' && type === 'soldier' && d >= 5 && r() < 0.35) type = 'alien';
      if (L.camp.id === 'future' && type === 'vehicle') type = 'drone';
      q.push({ type });
      if (r() < civP) q.push({ type: r() < 0.5 ? 'civRun' : 'civWin' });
    }
    if (L.camp.id === 'future' && d >= 3 && !isBoss) q.splice(Math.floor(q.length * 0.3), 0, { type: 'drone' });
    SC.queue = q;
    SC.maxActive = Math.min(5, 1 + Math.ceil(d / 3) + (idx > 0 ? 1 : 0));
  }

  // ---------- יצירת ישויות ----------
  function freeSpot(kinds) {
    const c = SC.spots.filter(s => !s.busy && kinds.includes(s.kind));
    if (!c.length) return null;
    return c[Math.floor(rand() * c.length)];
  }

  function calcAim(e) {
    let base = clamp(2.5 - L.lv.diff * 0.12, 1.15, 2.5);
    const mult = { sniper: 0.72, heavy: 1.1, taker: 1.05, leader: 0.75, alien: 0.9 }[e.type] || 1;
    return base * mult * L.diff.aim * (0.9 + rand() * 0.25);
  }

  function placeAtSpot(e, spot) {
    e.spot = spot; spot.busy = true; e.z = spot.z;
    if (spot.kind === 'pop' || spot.kind === 'far') { e.x = spot.x; e.s = scaleAt(e.z); e.y = groundY(e.z); e.clipY = e.y; e.sink = spot.sink || 0; }
    else if (spot.kind === 'side') { const c = spot.cover; e.s = scaleAt(e.z); e.y = groundY(e.z); e.x0 = c.x; e.x1 = c.x + spot.dir * (c.w / 2 + 34 * e.s); e.x = e.x0; e.flip = spot.dir > 0 ? false : true; }
    else if (spot.kind === 'win') { const w = spot.win; e.s = w.h / 95; e.x = w.x + w.w / 2; e.y = w.y + 4 + 282 * e.s; e.clip = [w.x, w.y, w.w, w.h]; e.z = 0.08; }
    else if (spot.kind === 'door') { const w = spot.win; e.s = w.h / 310; e.x = w.x + w.w / 2; e.y = w.y + w.h; e.clip = [w.x - 30, w.y - 60, w.w + 60, w.h + 60]; e.z = 0.1; e.fade = true; }
  }

  function newEnemy(type) {
    const e = { kind: 'enemy', type, hp: 2, maxhp: 2, state: 'wait', t: 0, delay: 0.1 + rand() * 0.4, k: 0, emergeDur: 0.35, pose: 'idle', shots: 0, maxShots: 2 + Math.floor(rand() * 2), seed: rand() * 100, hitFlash: 0, hostile: true, score: 100 };
    e.style = SC.styles.normal;
    if (type === 'heavy') { e.style = SC.styles.heavy; e.hp = e.maxhp = 5 + Math.floor(L.lv.diff / 3); e.score = 250; }
    if (type === 'alien') { e.style = SC.styles.alien; e.hp = e.maxhp = 3; e.score = 200; }
    if (type === 'sniper') { e.score = 200; e.maxShots = 1; }
    if (type === 'grenadier') { e.score = 150; }
    if (L.camp.enemy === 'robot' && type !== 'alien') e.hp = e.maxhp = e.hp + 1;
    return e;
  }

  function spawn(spec) {
    const t = spec.type;
    if (t === 'target' || t === 'targetCiv' || t === 'targetPair') {
      const sp = freeSpot(['pop', 'side', 'far', 'door']); if (!sp) return false;
      const e = { kind: 'enemy', type: 'target', style: t === 'targetCiv' ? SC.styles.targetCiv : SC.styles.target, hp: 1, maxhp: 1, state: 'wait', t: 0, delay: 0.1, k: 0, emergeDur: 0.25, pose: 'idle', seed: 0, hitFlash: 0, hostile: t !== 'targetCiv', civ: t === 'targetCiv', target: true, life: 2.6 + rand(), holes: [], score: 100 };
      placeAtSpot(e, sp); SC.ents.push(e);
      if (t === 'targetPair') { const c = Object.assign({}, e, { style: SC.styles.targetCiv, hostile: false, civ: true, holes: [], spot: null }); c.x = e.x - 34 * e.s; c.z = e.z + 0.002; e.x += 30 * e.s; SC.ents.push(c); e.partner = c; c.partner = e; }
      return true;
    }
    if (t === 'vehicle' || t === 'drone') {
      const kind = t === 'drone' ? 'drone' : L.camp.vehicle;
      const z = 0.36 + rand() * 0.12, dir = rand() < 0.5 ? 1 : -1, s = scaleAt(z) * (kind === 'drone' ? 0.8 : 0.85);
      const v = { kind: 'vehicle', vk: kind, z, s, dir, x: dir > 0 ? -260 : W + 260, y: groundY(z) - (kind === 'drone' ? 170 * s : 0), stopX: 300 + rand() * (W - 600), hp: 14 + L.lv.diff * 1.5, maxhp: 0, state: 'drive', t: 0, aimDur: 0, seed: rand() * 10, hitFlash: 0, hostile: true, score: 600 };
      v.maxhp = v.hp; if (kind === 'drone') { v.hp = v.maxhp = 6 + L.lv.diff; v.score = 300; }
      SC.ents.push(v); S.play('alert'); return true;
    }
    if (t === 'civRun') {
      const z = 0.35 + rand() * 0.3, dir = rand() < 0.5 ? 1 : -1;
      const e = { kind: 'enemy', type: 'civ', civ: true, hostile: false, style: A.litStyle(A.makeCivilian(rand), SC.sky, SC.interior), z, s: scaleAt(z), x: dir > 0 ? -60 : W + 60, y: groundY(z), dir, flip: dir < 0, state: 'run', pose: 'hostage', t: 0, k: 1, hp: 1, seed: rand() * 9, hitFlash: 0, speed: 260, scared: true };
      SC.ents.push(e); shout(e, DONTSHOOT[Math.floor(rand() * DONTSHOOT.length)], true); return true;
    }
    if (t === 'civWin') {
      const sp = freeSpot(['win', 'door', 'pop']); if (!sp) return false;
      const e = { kind: 'enemy', type: 'civ', civ: true, hostile: false, style: A.litStyle(A.makeCivilian(rand), SC.sky, SC.interior), state: 'wait', delay: 0.1, t: 0, k: 0, emergeDur: 0.3, pose: 'hostage', hp: 1, seed: rand() * 9, hitFlash: 0, life: 2.6, scared: true };
      placeAtSpot(e, sp); SC.ents.push(e); return true;
    }
    if (t === 'taker') {
      const sp = freeSpot(['far', 'door']) || { kind: 'far', x: 300 + rand() * 680, z: 0.4 };
      const e = newEnemy('taker'); e.score = 300; e.maxShots = 99;
      if (sp.kind === 'far') { sp.z = Math.max(sp.z, 0.36); }
      placeAtSpot(e, sp); e.clipY = null; e.sink = 0; e.fade = true; e.emergeDur = 0.5;
      const h = { kind: 'enemy', type: 'hostage', civ: true, hostile: false, style: A.litStyle(A.makeCivilian(rand), SC.sky, SC.interior), state: 'held', t: 0, k: 0, pose: 'hostage', hp: 1, seed: rand() * 9, hitFlash: 0, scared: true, z: e.z + 0.002, s: e.s, x: e.x - 12 * e.s, y: e.y, fade: true, clip: e.clip, taker: e };
      e.hostage = h; e.x += 26 * e.s; e.flip = false;
      SC.ents.push(e, h);
      setTimeout(() => shout(h, HELP[Math.floor(rand() * HELP.length)], true), 400);
      return true;
    }
    if (t === 'runner') {
      const z = 0.34 + rand() * 0.28, dir = rand() < 0.5 ? 1 : -1;
      const e = newEnemy('runner'); Object.assign(e, { z, s: scaleAt(z), y: groundY(z), x: dir > 0 ? -60 : W + 60, dir, flip: dir < 0, state: 'run', k: 1, speed: 300, stopX: 250 + rand() * (W - 500) });
      SC.ents.push(e); return true;
    }
    // חייל, כבד, רימונאי, צלף, חייזר
    const kinds = t === 'sniper' ? ['win', 'far'] : t === 'heavy' ? ['pop', 'side'] : ['pop', 'side', 'win', 'door', 'far'];
    const sp = freeSpot(kinds) || freeSpot(['pop', 'side', 'far', 'win', 'door']); if (!sp) return false;
    const e = newEnemy(t); placeAtSpot(e, sp);
    if (sp.kind === 'side') e.emergeDur = 0.3;
    SC.ents.push(e);
    if (rand() < 0.12 && !L.camp.enemy.includes('robot')) shout(e, ['יאללה!', 'הנה הוא!', 'אש!'][Math.floor(rand() * 3)], false);
    return true;
  }

  function shout(e, text, voice) {
    L.popups.push({ bubble: true, ent: e, text, t: 2.2 });
    if (voice && save.settings.voice) S.say(text, { pitch: 1.3 });
  }

  // ---------- בוסים ----------
  function makeBoss(kind) {
    const b = { kind, parts: [], t: 0, hitFlash: 0, dead: false, deadT: 0, tint: SC.tint, phase: 0 };
    const d = L.lv.diff;
    const P = (o) => Object.assign({ hp: 20, max: 20, r: 40, alive: true, t: rand() * 2, flash: 0, state: 'idle', aimT: 0 }, o, { max: o.hp });
    if (kind === 'tank') {
      Object.assign(b, { z: 0.42, x: 640, s: scaleAt(0.42) * 0.85, vx: 1, name: 'טנק כבד' });
      b.parts = [P({ id: 'turret', ox: -20, oy: -185, r: 60, hp: 40 + d * 3, core: true, fire: 'proj', every: 4.2, proj: 'shell' }), P({ id: 'mg', ox: 230, oy: -110, r: 30, hp: 14, fire: 'aim', every: 3.2 })];
    } else if (kind === 'bunker') {
      Object.assign(b, { z: 0.3, x: 640, s: scaleAt(0.3) * 1.25, name: 'הבונקר הגדול' });
      b.parts = [-300, 0, 300].map((ox, i) => P({ id: 'slit' + i, ox, oy: -150, r: 42, hp: 22 + d, core: true, fire: 'aim', every: 2.6 + i * 0.5, slit: true }));
      b.parts.push(P({ id: 'cannon', ox: 0, oy: -330, r: 52, hp: 34 + d * 2, core: true, fire: 'proj', every: 5, proj: 'shell', lockedBy: ['slit0', 'slit1', 'slit2'] }));
    } else if (kind === 'train') {
      Object.assign(b, { z: 0.34, x: 640, s: 1, vx: 0, name: 'הרכבת המשוריינת' });
      b.parts = [-420, 0, 420].map((ox, i) => P({ id: 't' + i, ox, oy: -285, r: 46, hp: 24 + d, core: true, fire: i === 1 ? 'proj' : 'aim', every: 3 + i * 0.6, proj: 'shell', turret: true }));
    } else if (kind === 'heli') {
      Object.assign(b, { z: 0.3, x: 640, s: 0.82, name: 'מסוק התקיפה של ואלק', fly: true });
      b.parts = [P({ id: 'podL', ox: -60, oy: -70, r: 34, hp: 22, fire: 'proj', every: 3.6, proj: 'rocket', pod: true }), P({ id: 'podR', ox: 100, oy: -70, r: 34, hp: 22, fire: 'proj', every: 4.1, proj: 'rocket', pod: true }), P({ id: 'cockpit', ox: -125, oy: -160, r: 58, hp: 50 + d * 2, core: true, fire: 'aim', every: 2.4, lockedBy: ['podL', 'podR'] })];
    } else if (kind === 'walker') {
      Object.assign(b, { z: 0.36, x: 640, s: scaleAt(0.36) * 0.95, vx: 1, name: 'מכונת ההליכה' });
      b.parts = [P({ id: 'armL', ox: -235, oy: -430, r: 48, hp: 30, fire: 'proj', every: 3.2, proj: 'plasma', cannon: true }), P({ id: 'armR', ox: 235, oy: -430, r: 48, hp: 30, fire: 'proj', every: 3.7, proj: 'plasma', cannon: true }), P({ id: 'cockpit', ox: 0, oy: -567, r: 56, hp: 55 + d * 2, core: true, fire: 'aim', every: 2.2, lockedBy: ['armL', 'armR'] })];
    } else if (kind === 'mothership') {
      Object.assign(b, { z: 0.05, x: 640, y: 200, s: 1, name: 'ספינת האם', fly: true, fixedY: true });
      b.parts = [-470, -220, 220, 470].map((ox, i) => P({ id: 'tur' + i, ox, oy: 20 + Math.abs(ox) * -0.05, r: 34, hp: 18 + d, fire: 'proj', every: 3.4 + i * 0.4, proj: 'plasma', cannon: true }));
      b.parts.push(P({ id: 'eye', ox: 0, oy: -40, r: 72, hp: 80 + d * 3, core: true, fire: 'aim', every: 2.6, eye: true }));
      b.droneT = 6;
    } else if (kind === 'leader' || kind === 'snake') {
      Object.assign(b, { name: kind === 'snake' ? 'הנחש' : 'ראש החוטפים', human: true });
      const e = newEnemy('leader');
      e.style = SC.styles.heavy; e.hp = e.maxhp = kind === 'snake' ? 46 + d * 2 : 30 + d * 2; e.score = 3000; e.maxShots = 99; e.isBoss = true;
      const z = 0.5; Object.assign(e, { z, s: scaleAt(z) * 1.05, y: groundY(z), x: 640, state: 'emerge', k: 0, emergeDur: 0.6, fade: true, moveT: 4, grenT: 3 });
      const h = { kind: 'enemy', type: 'hostage', civ: true, hostile: false, style: A.litStyle(A.makeCivilian(rand), SC.sky, SC.interior), state: 'held', t: 0, k: 0, pose: 'hostage', hp: 1, seed: 3, hitFlash: 0, scared: true, z: z + 0.002, s: e.s, x: e.x - 12 * e.s, y: e.y, fade: true, taker: e };
      e.hostage = h; e.x += 26 * e.s; e.type = 'taker'; e.leader = true;
      SC.ents.push(e, h); b.ent = e;
      setTimeout(() => shout(h, 'הצילו! תעזרו לי!', true), 700);
    }
    if (!b.fixedY && !b.human) b.y = groundY(b.z) - (b.fly ? 160 : 0);
    b.parts.forEach(p => p.timer = p.every * (0.6 + rand() * 0.5));
    return b;
  }

  function partPos(b, p) { return [b.x + p.ox * b.s, b.y + p.oy * b.s + (b.kind === 'heli' ? Math.sin(b.t * 2) * 10 * b.s : 0)]; }
  function partLocked(b, p) {
    if (p.lockedBy && p.lockedBy.some(id => b.parts.find(q => q.id === id && q.alive))) return true;
    if (p.eye && !b.eyeOpen) return true;
    return false;
  }

  function updateBoss(b, dt) {
    b.t += dt; if (b.hitFlash > 0) b.hitFlash -= dt;
    if (b.human) {
      if (b.ent.state === 'dead' || b.ent.state === 'surrender') { b.dead = true; }
      return;
    }
    if (b.dead) { b.deadT += dt; if (rand() < dt * 14) explosion(b.x + (rand() - 0.5) * 500 * b.s, b.y - rand() * 400 * b.s, 0.8 + rand()); return; }
    if (b.kind === 'tank' || b.kind === 'walker') {
      b.x += b.vx * dt * 45; if (b.x > 860) b.vx = -1; if (b.x < 420) b.vx = 1;
      b.aim = Math.atan2(G.my - (b.y - 190 * b.s), G.mx - (b.x + 100 * b.s)) * 0.3 - 0.08;
    }
    if (b.kind === 'heli') { b.x = 640 + Math.sin(b.t * 0.5) * 300; b.y = SC.HOR + 70 + Math.sin(b.t * 0.9) * 50; }
    if (b.kind === 'train') { b.x = 640 + Math.sin(b.t * 0.25) * 140; }
    if (b.kind === 'mothership') {
      b.y = 190 + Math.sin(b.t * 0.6) * 12;
      const cyc = b.t % 8; b.eyeOpen = cyc > 4.5;
      b.droneT -= dt; if (b.droneT <= 0) { b.droneT = 7 + rand() * 3; spawn({ type: 'drone' }); }
    }
    b.parts.forEach(p => {
      if (!p.alive) return;
      if (p.flash > 0) p.flash -= dt;
      if (partLocked(b, p)) { p.state = 'idle'; return; }
      p.timer -= dt;
      if (p.fire === 'aim') {
        if (p.state === 'idle' && p.timer <= 0) { p.state = 'aim'; p.aimT = 0; p.aimDur = calcAim({ type: 'boss' }) * 0.95; }
        if (p.state === 'aim') { p.aimT += dt; if (p.aimT >= p.aimDur) { const [x, y] = partPos(b, p); muzzle(x, y, 1.2); playerHit(); p.state = 'idle'; p.timer = p.every; } }
      } else if (p.timer <= 0) {
        const [x, y] = partPos(b, p); fireProj(p.proj, x, y); p.timer = p.every * (0.85 + rand() * 0.3);
      }
    });
    if (b.parts.filter(p => p.core).every(p => !p.alive)) { b.dead = true; b.deadT = 0; L.score += 5000; popup(b.x, b.y - 200 * b.s, '+5000', '#ffd85a', 1.4); S.play('explosion'); G.shake = 1.4; }
  }

  function drawBoss(b) {
    if (b.human) return;
    A.drawBoss(ctx, b, b.t);
    b.parts.forEach(p => {
      const [x, y] = partPos(b, p); const r = p.r * b.s;
      if (!p.alive) { ctx.fillStyle = 'rgba(20,14,10,0.85)'; ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, 7); ctx.fill(); if (rand() < 0.3) smoke(x, y - r * 0.5, 0.6); return; }
      const locked = partLocked(b, p);
      if (p.cannon) { ctx.fillStyle = A.mix('#5a6070', '#000', 0.2); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.fillRect(x - r * 0.3, y, r * 0.6, r * 1.3); }
      if (p.turret) { ctx.fillStyle = '#3a3c40'; ctx.beginPath(); ctx.arc(x, y + r * 0.3, r, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(x - r * 1.6, y, r * 1.6, r * 0.35); }
      if (p.pod) { ctx.fillStyle = '#2a2e26'; A.rr(ctx, x - r, y - r * 0.5, r * 2, r, r * 0.4); ctx.fill(); ctx.fillStyle = '#111'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - r * 0.6 + i * r * 0.6, y, r * 0.18, 0, 7); ctx.fill(); } }
      if (p.slit) { ctx.fillStyle = '#060606'; ctx.fillRect(x - r * 1.4, y - r * 0.35, r * 2.8, r * 0.7); }
      if (p.eye) {
        const open = b.eyeOpen ? 1 : 0.08;
        ctx.fillStyle = '#12081e'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r * open, 0, 0, 7); ctx.fill();
        if (b.eyeOpen) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#fff'); g.addColorStop(0.25, '#7cffd4'); g.addColorStop(0.6, '#3a1a6a'); g.addColorStop(1, 'rgba(58,26,106,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r * 0.9, 0, 0, 7); ctx.fill(); }
      }
      // נקודת תורפה
      if (!locked) {
        const pulse = 0.5 + 0.5 * Math.sin(G.t * 6);
        ctx.strokeStyle = `rgba(255,70,50,${0.5 + pulse * 0.4})`; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.arc(x, y, r + 6 + pulse * 4, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        const hpK = p.hp / p.max; ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpK); ctx.stroke();
      } else { ctx.strokeStyle = 'rgba(160,190,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 7); ctx.stroke(); }
      if (p.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${p.flash * 4})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
      if (p.state === 'aim') drawAimRing(x, y, r * 1.3, p.aimT / p.aimDur);
    });
  }

  // ---------- טילים, רימונים ופגזים ----------
  function fireProj(kind, x, y) {
    const tx = 260 + rand() * (W - 520), ty = 380 + rand() * 260;
    const dur = { shell: 1.5, rocket: 1.7, plasma: 1.6, grenade: 1.5 }[kind] || 1.5;
    SC.projs.push({ kind, x0: x, y0: y, x1: tx, y1: ty, t: 0, dur: dur * (L.diff.aim > 1 ? 1.2 : L.diff.aim < 1 ? 0.88 : 1), arc: kind === 'grenade' ? 180 : kind === 'shell' ? 60 : 20, hp: kind === 'shell' ? 2 : 1 });
    S.play(kind === 'plasma' ? 'enemyLaser' : kind === 'rocket' ? 'rocket' : kind === 'grenade' ? 'throw' : 'enemyShot', { vol: 0.8 });
    if (kind !== 'grenade') muzzle(x, y, 1.4);
  }
  function projPos(p) { const k = p.t; return [A.lerp(p.x0, p.x1, k), A.lerp(p.y0, p.y1, k) - Math.sin(k * Math.PI) * p.arc, 0.25 + k * k * 1.6]; }

  // ---------- חלקיקים ----------
  const PARTS = [];
  function part(o) { if (PARTS.length < 700) PARTS.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 0.5, t: 0, size: 3, col: '#fff', add: false, drag: 0.98 }, o)); }
  function sparks(x, y, n, col) { for (let i = 0; i < n; i++) { const a = rand() * 7, v = 120 + rand() * 380; part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 900, life: 0.25 + rand() * 0.3, size: 2 + rand() * 2, col: col || '#ffd27a', add: true, type: 'spark' }); } }
  function dust(x, y, n, col) { for (let i = 0; i < n; i++) part({ x: x + (rand() - 0.5) * 10, y, vx: (rand() - 0.5) * 120, vy: -rand() * 90, g: 60, life: 0.6 + rand() * 0.6, size: 6 + rand() * 10, col: col || 'rgba(180,160,130,0.5)', type: 'smoke', grow: 30 }); }
  function smoke(x, y, k) { part({ x, y, vx: (rand() - 0.5) * 30, vy: -40 - rand() * 40, life: 1.2 + rand(), size: 14 * k + rand() * 10, col: 'rgba(40,36,34,0.45)', type: 'smoke', grow: 40 }); }
  function muzzle(x, y, k) { part({ x, y, life: 0.07, size: 26 * k, col: '#fff2b0', add: true, type: 'flash' }); for (let i = 0; i < 3; i++) smoke(x, y, 0.4 * k); }
  function explosion(x, y, k) {
    for (let i = 0; i < 18 * k; i++) { const a = rand() * 7, v = rand() * 260 * k; part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: -40, life: 0.4 + rand() * 0.5, size: (16 + rand() * 26) * k, col: rand() < 0.5 ? '#ffb24a' : '#ff6a2a', add: true, type: 'fire', grow: 40 }); }
    for (let i = 0; i < 12 * k; i++) smoke(x + (rand() - 0.5) * 60 * k, y - rand() * 40 * k, 1.6 * k);
    sparks(x, y, 20 * k, '#ffcf6a');
    for (let i = 0; i < 8 * k; i++) { const a = -rand() * Math.PI, v = 200 + rand() * 400; part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1100, life: 0.8 + rand() * 0.5, size: 4 + rand() * 5, col: '#2a2420', type: 'debris', rot: rand() * 7 }); }
    part({ x, y, life: 0.18, size: 160 * k, col: '#fff0c0', add: true, type: 'flash' });
    G.shake = Math.max(G.shake, 0.5 * k);
  }
  function popup(x, y, text, col, size) { L.popups.push({ x, y, text, col: col || '#fff', t: 1.1, size: size || 1 }); }

  // ---------- פגיעה בשחקן ----------
  function playerHit() {
    if (G.screen !== 'play' || SC.phase === 'exit') return;
    L.lives--; L.dmg++; L.combo = 0;
    G.flash = 0.55; G.flashCol = '255,30,20'; G.shake = Math.max(G.shake, 0.6);
    S.play('hurt');
    if (rand() < 0.4) radio(RADIO[L.camp.id].hurt);
    if (L.lives <= 0) { L.lives = 0; setTimeout(gameOver, 700); G.screen = 'dying'; }
  }
  function radio(arr) { L.radio = { text: arr[Math.floor(rand() * arr.length)], t: 2.6 }; S.play('radio'); }

  // ---------- עדכון ישויות ----------
  function updateEnt(e, dt) {
    e.t += dt; if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.kind === 'vehicle') return updVehicle(e, dt);
    if (e.stun > 0) { e.stun -= dt; if (e.stun <= 0 && e.state === 'stunned') { e.state = 'aim'; e.t = 0; e.aimDur = calcAim(e); } }
    switch (e.state) {
      case 'wait': if (e.t >= e.delay) { e.state = 'emerge'; e.t = 0; } break;
      case 'emerge':
        e.k = Math.min(1, e.k + dt / e.emergeDur);
        if (e.spot && e.spot.kind === 'side') e.x = A.lerp(e.x0, e.x1, e.k);
        if (e.hostage) { e.hostage.k = e.k; }
        if (e.k >= 1) {
          e.t = 0;
          if (e.target || e.civ) e.state = 'idle';
          else if (e.type === 'grenadier' && !e.thrownOnce) e.state = 'throw';
          else { e.state = 'aim'; e.aimDur = calcAim(e) + (e.firstAim ? 0 : 0.35); e.firstAim = true; S.play('alert'); }
        }
        break;
      case 'idle':
        if (e.target || e.civ) { if (e.t >= e.life) { e.state = 'duck'; e.t = 0; if (e.target && e.hostile) L.combo = 0; } }
        break;
      case 'aim': e.pose = 'aim'; if (e.t >= e.aimDur) { enemyFire(e); e.state = 'fire'; e.t = 0; } break;
      case 'fire':
        e.pose = 'fire';
        if (e.t > 0.16) {
          e.pose = 'aim'; e.shots++;
          if (e.type === 'runner') { e.state = 'run'; e.t = 0; }
          else if (e.leader && e.t > 0) { e.state = 'aim'; e.t = 0; e.aimDur = calcAim(e); }
          else if (e.shots >= e.maxShots && e.spot && e.spot.kind !== 'far') { e.state = 'duck'; e.t = 0; }
          else { e.state = 'aim'; e.t = 0; e.aimDur = calcAim(e) * 0.85; }
        }
        break;
      case 'throw':
        e.pose = 'idle';
        if (e.t > 0.45 && !e.thrown) { e.thrown = true; e.thrownOnce = true; const [hx, hy] = [e.x + 30 * e.s, e.y - 230 * e.s]; fireProj('grenade', hx, hy); }
        if (e.t > 0.9) { e.thrown = false; e.state = 'aim'; e.t = 0; e.aimDur = calcAim(e); }
        break;
      case 'duck':
        e.k = Math.max(0, e.k - dt / 0.25); e.pose = e.civ || e.target ? e.pose : 'idle';
        if (e.spot && e.spot.kind === 'side') e.x = A.lerp(e.x0, e.x1, e.k);
        if (e.k <= 0) {
          if (e.target || e.civ) { e.state = 'gone'; }
          else { e.state = 'wait'; e.t = 0; e.delay = 0.7 + rand() * 1.4; e.shots = 0; e.maxShots = 1 + Math.floor(rand() * 3); if (e.type === 'grenadier' && rand() < 0.5) e.thrownOnce = false; }
        }
        break;
      case 'run': {
        e.pose = e.civ ? 'hostage' : 'run';
        e.x += e.dir * e.speed * e.s * dt;
        if (!e.civ && !e.stopped && ((e.dir > 0 && e.x > e.stopX) || (e.dir < 0 && e.x < e.stopX))) { e.stopped = true; e.state = 'aim'; e.t = 0; e.aimDur = calcAim(e) * 0.9; }
        if (e.x < -120 || e.x > W + 120) e.state = 'gone';
        break;
      }
      case 'held': {
        const tk = e.taker; e.k = tk.k; e.x = tk.x - 38 * tk.s; e.y = tk.y; e.s = tk.s;
        if (tk.state === 'dead' || tk.state === 'surrender' || tk.state === 'gone') { freeHostage(e); }
        break;
      }
      case 'surrender': e.pose = 'surrender'; if (e.t > 1.3) { e.fadeOut = (e.fadeOut || 0) + dt * 2; if (e.fadeOut >= 1) e.state = 'gone'; } break;
      case 'stunned': e.pose = 'surrender'; break;
      case 'dead': e.deadT += dt; if (e.deadT > 1.8) e.state = 'gone'; break;
    }
    // תנועת הבוס האנושי
    if (e.leader && e.state !== 'dead' && e.state !== 'surrender') {
      e.moveT -= dt; e.grenT -= dt;
      if (e.grenT <= 0 && e.state === 'aim') { e.grenT = 5 + rand() * 3; fireProj('grenade', e.x, e.y - 240 * e.s); }
      if (e.moveT <= 0) { e.moveT = 4 + rand() * 3; e.tx = 280 + rand() * (W - 560); }
      if (e.tx !== undefined) { const dx = e.tx - e.x; e.x += clamp(dx, -dt * 160, dt * 160); if (Math.abs(dx) < 2) e.tx = undefined; }
      if (e.hp < e.maxhp * 0.45 && e.hostage && e.hostage.state === 'held') { freeHostage(e.hostage); e.hostage = null; radio(['בן הערובה השתחרר! עכשיו!', 'הוא חשוף! אש!']); }
    }
    if (e.spot && (e.state === 'gone' || e.state === 'dead')) { e.spot.busy = false; e.spot = null; }
  }

  function freeHostage(h) {
    if (h.state !== 'held') return;
    h.state = 'run'; h.dir = h.x < W / 2 ? -1 : 1; h.flip = h.dir < 0; h.speed = 320; h.t = 0; h.clip = null;
    L.saved++; L.score += 500; popup(h.x, h.y - 300 * h.s, 'בן ערובה ניצל! +500', '#9be36a', 1.1); S.play('pickup');
    shout(h, 'תודה!', true);
  }

  function enemyFire(e) {
    const m = e._muzzle || [e.x, e.y - 200 * e.s];
    muzzle(m[0], m[1], 0.9 + e.s * 0.6);
    const energy = e.style.robot || e.style.alien;
    S.play(energy ? 'enemyLaser' : 'enemyShot');
    if (energy) part({ x: m[0], y: m[1], life: 0.15, size: 40 * e.s, col: e.style.glow || '#ff3b5c', add: true, type: 'flash' });
    playerHit();
  }

  function updVehicle(v, dt) {
    if (v.state === 'drive') {
      const dx = v.stopX - v.x; v.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 300);
      if (Math.abs(dx) < 2) { v.state = 'aim'; v.t = 0; v.aimDur = calcAim(v) * 1.1; }
      if (v.vk !== 'drone' && rand() < dt * 20) dust(v.x - v.dir * 150 * v.s, v.y, 1, 'rgba(160,140,110,0.4)');
    } else if (v.state === 'aim') {
      if (v.vk === 'drone') v.x += Math.sin(v.t * 1.5 + v.seed) * dt * 80;
      if (v.t >= v.aimDur) { const m = vehGun(v); muzzle(m[0], m[1], 1.2); S.play(v.vk === 'drone' ? 'enemyLaser' : 'enemyShot'); playerHit(); v.t = 0; v.aimDur = calcAim(v) * 0.9; }
    } else if (v.state === 'dead') {
      v.deadT += dt; if (rand() < dt * 8) smoke(v.x + (rand() - 0.5) * 200 * v.s, v.y - 100 * v.s, 1.5);
      if (v.vk === 'drone') { v.y += dt * 500; if (v.y > H + 100) v.state = 'gone'; }
      if (v.deadT > 6) v.state = 'gone';
    }
  }
  function vehGun(v) { if (v.vk === 'drone') return [v.x, v.y - 48 * v.s]; if (v.vk === 'jeep') return [v.x + v.dir * -40 * v.s, v.y - 195 * v.s]; if (v.vk === 'apc') return [v.x + v.dir * 140 * v.s, v.y - 193 * v.s]; return [v.x + v.dir * 60 * v.s, v.y - 150 * v.s]; }
  function vehBox(v) { if (v.vk === 'drone') return [v.x - 130 * v.s, v.y - 100 * v.s, v.x + 130 * v.s, v.y - 20 * v.s]; return [v.x - 195 * v.s, v.y - (v.vk === 'apc' ? 215 : 190) * v.s, v.x + 195 * v.s, v.y]; }

  // ---------- ירי שחקן ----------
  function tryFire() {
    const w = L.weapon, now = performance.now();
    if (w.reloading) return;
    if (now - w.last < w.d.rate) return;
    if (w.ammo <= 0) { if (G.pressed) { S.play('empty'); L.needReload = 1.2; if (save.settings.autoReload) startReload(); } return; }
    w.last = now; w.ammo--; L.shots++;
    w.recoil = 1;
    S.play(w.d.sound);
    const [gx, gy] = gunTip();
    if (w.d.throwArc) {
      SC.throws = SC.throws || [];
      SC.throws.push({ x0: gx, y0: gy, x1: G.mx, y1: G.my, t: 0, w: w.d });
      S.play('throw');
    } else {
      const pellets = w.d.pellets || 1;
      let anyHit = false;
      for (let i = 0; i < pellets; i++) {
        const a = rand() * 7, rr = (pellets > 1 ? Math.sqrt(rand()) : rand()) * (w.d.spread || 0) * (w.d.auto && G.heat ? 1 + G.heat : 1);
        const px = G.mx + Math.cos(a) * rr, py = G.my + Math.sin(a) * rr;
        if (resolveShot(px, py, w.d)) anyHit = true;
        L.tracers.push({ x0: gx, y0: gy, x1: px, y1: py, t: 0.06, col: w.d.tracer || '#ffd58a', energy: w.d.energy });
      }
      if (anyHit) L.hits++;
      else { L.combo = 0; }
      if (w.d.auto) G.heat = Math.min(1.2, (G.heat || 0) + 0.12);
    }
    if (w.ammo <= 0 && save.settings.autoReload) setTimeout(startReload, 120);
    if (w.ammo <= 0 && !w.base && w.reserve <= 0) { setTimeout(() => { if (L && L.weapon === w) { L.weapon = makeWeapon(L.baseKey, true); popup(W / 2, H - 140, 'חזרה ל' + L.weapon.d.name, '#fff', 0.9); } }, 300); }
  }

  function startReload() {
    const w = L.weapon; if (w.reloading || w.ammo === w.d.mag) return;
    if (!w.base && w.reserve <= 0) return;
    w.reloading = true; w.reloadT = 0; S.play('reload'); L.needReload = 0;
  }

  // ממיין את כל מה שאפשר לפגוע בו מהקרוב לרחוק
  function hittables() {
    const list = [];
    SC.covers.forEach(c => list.push({ z: c.z, cover: c }));
    SC.ents.forEach(e => { if (e.state !== 'gone' && e.state !== 'dead' && !(e.kind === 'vehicle' && e.state === 'dead')) list.push({ z: e.z, ent: e }); });
    return list.sort((a, b) => b.z - a.z);
  }

  function entHitZone(e, px, py) {
    if (e.kind === 'vehicle') { const b = vehBox(e); return (px > b[0] && px < b[2] && py > b[1] && py < b[3]) ? 'body' : null; }
    if (e.state === 'wait') return null;
    if (e.k < 0.35 && e.state !== 'held' && e.state !== 'run') return null;
    if (e.clip) { const c = e.clip; if (px < c[0] || px > c[0] + c[2] || py < c[1] || py > c[1] + c[3]) return null; }
    if (e.clipY && py > e.clipY) return null;
    const ex = drawOffset(e);
    const p = { x: e.x, y: e.y + ex, s: e.s, style: e.style };
    const z = A.zones(p);
    if (Math.hypot(px - z.head.x, py - z.head.y) < z.head.r) return 'head';
    if (px > z.torso.x0 && px < z.torso.x1 && py > z.torso.y0 && py < z.torso.y1) return 'torso';
    if (px > z.arms.x0 && px < z.arms.x1 && py > z.arms.y0 && py < z.arms.y1) return e.state === 'held' ? null : 'limb';
    if (px > z.legs.x0 && px < z.legs.x1 && py > z.legs.y0 && py < z.legs.y1) return 'limb';
    return null;
  }

  function resolveShot(px, py, wd) {
    // פגזים ורימונים באוויר
    for (const p of SC.projs) {
      const [x, y, sz] = projPos(p);
      if (Math.hypot(px - x, py - y) < 26 * sz + 8) {
        p.hp -= wd.dmg; sparks(x, y, 6);
        if (p.hp <= 0) { p.dead = true; explosion(x, y, 0.6 * sz); addScore(50, x, y, 'יירוט!'); }
        S.play('metal'); return true;
      }
    }
    // פריטים
    for (const it of SC.items) {
      if (Math.hypot(px - it.x, py - it.y) < 34) { collect(it); return true; }
    }
    // בוס
    if (SC.boss && !SC.boss.dead && !SC.boss.human) {
      const b = SC.boss;
      for (const p of b.parts) {
        if (!p.alive) continue;
        const [x, y] = partPos(b, p);
        if (Math.hypot(px - x, py - y) < p.r * b.s + 4) {
          if (partLocked(b, p)) { sparks(px, py, 5, '#cfe0ff'); S.play('metal'); popup(px, py - 20, 'משוריין', '#cfe0ff', 0.7); return true; }
          p.hp -= wd.dmg; p.flash = 0.08; b.hitFlash = 0.06; sparks(px, py, 8); S.play('hit');
          L.score += 10;
          if (p.hp <= 0) { p.alive = false; explosion(x, y, 1.3); addScore(800, x, y - 30, 'הושמד!'); S.play('explosion'); }
          return true;
        }
      }
      // גוף הבוס
      const bb = bossBody(b);
      if (bb && px > bb[0] && px < bb[2] && py > bb[1] && py < bb[3]) { sparks(px, py, 4, '#ffe0a0'); S.play('ricochet'); if (!L.bossHint) { L.bossHint = true; L.hint = { text: 'השריון עבה מדי. כוון לנקודות התורפה המסומנות באדום', t: 4 }; } return false; }
    }
    let hitAny = false;
    const list = hittables();
    for (const h of list) {
      if (h.cover) {
        const c = h.cover;
        if (px > c.x0 && px < c.x1 && py > c.y0 && py < c.y1 && !wd.pierce) {
          sparks(px, py, 5, '#ffd8a0'); dust(px, py, 2, 'rgba(160,140,120,0.5)');
          c.marks.push([px - c.x0, py - c.y0]); if (c.marks.length > 30) c.marks.shift();
          S.play('ricochet'); return false;
        }
        continue;
      }
      const e = h.ent; const zone = entHitZone(e, px, py);
      if (!zone) continue;
      hitEnt(e, zone, wd, px, py);
      hitAny = true;
      if (!wd.pierce) return true;
    }
    if (hitAny) return true;
    // פספוס: חור ברקע
    const dc = SC.decalCtx;
    dc.fillStyle = 'rgba(10,8,6,0.85)'; dc.beginPath(); dc.arc(px, py, 2.6, 0, 7); dc.fill();
    dc.strokeStyle = 'rgba(255,240,220,0.15)'; dc.lineWidth = 1; dc.beginPath(); dc.arc(px, py, 4, 0, 7); dc.stroke();
    if (py > SC.HOR || SC.interior) dust(px, py, 2); else sparks(px, py, 2, '#fff');
    return false;
  }

  function bossBody(b) {
    const s = b.s;
    switch (b.kind) {
      case 'tank': return [b.x - 320 * s, b.y - 230 * s, b.x + 420 * s, b.y];
      case 'bunker': return [b.x - 520 * s, b.y - 360 * s, b.x + 520 * s, b.y];
      case 'train': return [b.x - 640 * s, b.y - 300 * s, b.x + 640 * s, b.y];
      case 'heli': return [b.x - 220 * s, b.y - 260 * s, b.x + 520 * s, b.y - 50 * s];
      case 'walker': return [b.x - 260 * s, b.y - 610 * s, b.x + 260 * s, b.y];
      case 'mothership': return [b.x - 640, b.y - 220, b.x + 640, b.y + 70];
    }
    return null;
  }

  function addScore(base, x, y, label) {
    const mult = 1 + Math.min(3, Math.floor(L.combo / 5) * 0.5);
    const v = Math.round(base * mult);
    L.score += v;
    popup(x, y, (label ? label + ' ' : '') + '+' + v, mult > 1 ? '#ffd85a' : '#ffffff', label ? 1 : 0.8);
  }

  function hitEnt(e, zone, wd, px, py) {
    e.hitFlash = 0.08;
    if (e.kind === 'vehicle') {
      e.hp -= wd.dmg; sparks(px, py, 6); S.play('metal'); L.combo++;
      if (e.hp <= 0) { e.state = 'dead'; e.deadT = 0; e.hostile = false; explosion(e.x, e.y - 100 * e.s, 1.6); S.play('explosion'); L.kills++; addScore(e.score, e.x, e.y - 220 * e.s, 'רכב הושמד!'); dropItem(e.x, e.y - 160 * e.s, 0.6); }
      return;
    }
    if (e.target) {
      e.holes = e.holes || []; e.holes.push([(px - e.x) / e.s, (py - e.y) / e.s]);
      if (e.civ) { penalty(e, 'מטרת אזרח!'); e.state = 'dead'; e.deadT = 0; return; }
      L.combo++; L.maxCombo = Math.max(L.maxCombo, L.combo); L.kills++;
      if (zone === 'head') { L.heads++; addScore(200, px, py - 20, 'ראש!'); S.play('head'); } else addScore(100, px, py - 20); S.play('hit');
      e.state = 'dead'; e.deadT = 0; e.hostile = false; return;
    }
    if (e.civ) {
      e.hp = 0; e.state = 'dead'; e.deadT = 0; e.fallDir = rand() < 0.5 ? -1 : 1;
      dust(px, py, 3);
      penalty(e, e.type === 'hostage' ? 'פגעת בבן ערובה!' : 'פגעת באזרח!');
      if (e.type === 'hostage') { L.lost++; if (e.taker) e.taker.hostage = null; }
      return;
    }
    L.combo++; L.maxCombo = Math.max(L.maxCombo, L.combo);
    const robot = e.style.robot, alien = e.style.alien;
    let dmg = wd.dmg;
    if (zone === 'head') dmg *= 3;
    // ניטרול בפגיעה בגפיים
    if (zone === 'limb' && !e.style.heavy && !robot && !e.leader && e.hp <= 3 && wd.dmg < 5) {
      e.state = 'surrender'; e.t = 0; e.hostile = false; L.kills++; L.neutral++;
      addScore(e.score + 150, px, py - 30, 'ניטרול!'); S.play('hit');
      sparks(px, py, 4, '#fff');
      if (rand() < 0.15) dropItem(e.x, e.y - 200 * e.s, 1);
      return;
    }
    e.hp -= dmg;
    if (robot) sparks(px, py, 8, '#9fe8ff'); else if (alien) sparks(px, py, 6, '#7cffd4'); else { sparks(px, py, 3, '#ffcf9a'); dust(px, py, 2, 'rgba(120,90,70,0.5)'); }
    S.play(zone === 'head' ? 'head' : robot ? 'metal' : 'hit');
    if (e.hp <= 0) {
      e.state = 'dead'; e.deadT = 0; e.fallDir = px < e.x ? 1 : -1; e.hostile = false; L.kills++;
      if (zone === 'head') { L.heads++; addScore(e.score + 100, px, py - 30, 'ראש!'); } else addScore(e.score, px, py - 30);
      if (robot) { explosion(e.x, e.y - 180 * e.s, 0.5); }
      if (rand() < 0.12) dropItem(e.x, e.y - 200 * e.s, 1);
    } else if (e.state === 'aim' && !e.leader) { e.t = Math.max(0, e.t - 0.25); }
  }

  function penalty(e, text) {
    L.civHit++; L.score = Math.max(0, L.score - 800); L.combo = 0;
    popup(e.x, e.y - 300 * e.s, text + ' -800', '#ff5a4a', 1.1);
    S.play('bad'); G.flash = 0.35; G.flashCol = '255,255,255';
    if (!e.target) playerHit();
  }

  function splashAt(x, y, wd) {
    if (wd.stun) {
      part({ x, y, life: 0.3, size: 600, col: '#ffffff', add: true, type: 'flash' }); G.flash = 0.5; G.flashCol = '255,255,255';
      SC.ents.forEach(e => { if (e.hostile && e.kind !== 'vehicle' && e.state !== 'dead' && e.state !== 'gone') { const d = Math.hypot(e.x - x, (e.y - 170 * e.s) - y); if (d < wd.splash * 1.4) { e.stun = wd.stun; e.state = 'stunned'; e.t = 0; popup(e.x, e.y - 300 * e.s, 'מסונוור!', '#fff', 0.8); } } });
      if (SC.boss && !SC.boss.human) SC.boss.parts.forEach(p => { p.timer += 3; p.state = 'idle'; });
      return;
    }
    explosion(x, y, wd.splash / 110);
    if (wd.energy) { part({ x, y, life: 0.4, size: wd.splash * 2, col: '#69f5ff', add: true, type: 'flash' }); }
    SC.ents.slice().forEach(e => {
      if (e.state === 'dead' || e.state === 'gone') return;
      const cy = e.kind === 'vehicle' ? e.y - 100 * e.s : e.y - 170 * e.s;
      const d = Math.hypot(e.x - x, cy - y);
      if (d < wd.splash + 60 * e.s) { if (e.civ) { if (!e.target) hitEnt(e, 'torso', wd, e.x, cy); } else hitEnt(e, 'torso', Object.assign({}, wd, { dmg: wd.dmg * (1 - d / (wd.splash + 80)) + 1 }), e.x, cy); }
    });
    SC.projs.forEach(p => { const [px, py] = projPos(p); if (Math.hypot(px - x, py - y) < wd.splash) { p.dead = true; explosion(px, py, 0.5); } });
    if (SC.boss && !SC.boss.human && !SC.boss.dead) {
      const b = SC.boss;
      b.parts.forEach(p => { if (!p.alive || partLocked(b, p)) return; const [px, py] = partPos(b, p); if (Math.hypot(px - x, py - y) < wd.splash + p.r * b.s) { p.hp -= wd.dmg * 1.5; p.flash = 0.1; if (p.hp <= 0) { p.alive = false; explosion(px, py, 1.3); addScore(800, px, py, 'הושמד!'); } } });
    }
    L.hits++;
  }

  // ---------- פריטים ----------
  function dropItem(x, y, chanceMult) {
    const r = rand();
    let kind = r < 0.45 ? 'heal' : r < 0.7 ? 'slow' : 'weapon';
    if (kind === 'heal' && L.lives >= L.maxLives) kind = 'weapon';
    const pick = L.camp.weapons.pickups;
    SC.items.push({ kind, wkey: pick[Math.floor(rand() * pick.length)], x: clamp(x, 60, W - 60), y: clamp(y, 80, H - 120), t: 0, life: 6, vy: -60 });
  }
  function collect(it) {
    it.dead = true; S.play('pickup');
    if (it.kind === 'heal') { L.lives = Math.min(L.maxLives, L.lives + 1); popup(it.x, it.y, L.camp.items.heal + ' +1', '#9be36a', 1); }
    else if (it.kind === 'slow') { L.slowT = 6; popup(it.x, it.y, L.camp.items.slow + '! הזמן מאט', '#ffd85a', 1); }
    else { L.weapon = makeWeapon(it.wkey, false); popup(it.x, it.y, WEAPONS[it.wkey].name + '!', '#ffd85a', 1.1); }
    sparks(it.x, it.y, 14, '#fff6c0');
  }

  // ---------- לולאה ----------
  let last = performance.now();
  function frame(now) {
    const rdt = Math.min(0.05, (now - last) / 1000); last = now;
    G.t += rdt;
    if (G.screen === 'play' || G.screen === 'dying') { update(rdt); render(); }
    else if (G.screen === 'pause' && SC) render();
    requestAnimationFrame(frame);
  }

  function update(rdt) {
    const slow = L.slowT > 0 ? 0.38 : 1;
    if (L.slowT > 0) L.slowT -= rdt;
    const dt = rdt * slow;
    L.time += rdt;
    // נשק
    const w = L.weapon;
    w.recoil = Math.max(0, w.recoil - rdt * 8);
    G.heat = Math.max(0, (G.heat || 0) - rdt * (G.down ? 0.6 : 3));
    if (w.reloading) {
      w.reloadT += rdt * 1000;
      if (w.reloadT >= w.d.reload) {
        w.reloading = false;
        const need = w.d.mag - w.ammo;
        const take = w.base ? need : Math.min(need, w.reserve);
        w.ammo += take; if (!w.base) w.reserve -= take;
      }
    }
    if (G.screen === 'play' && SC.phase === 'fight' && (G.pressed || (G.down && w.d.auto))) tryFire();
    G.pressed = false;
    if (L.needReload > 0) L.needReload -= rdt;

    // זריקות שחקן
    if (SC.throws) SC.throws = SC.throws.filter(th => { th.t += rdt / 0.42; if (th.t >= 1) { splashAt(th.x1, th.y1, th.w); S.play(th.w.sound); return false; } return true; });

    // שלבי סצנה
    SC.t += rdt;
    if (SC.phase === 'enter' && SC.t > 0.9) {
      SC.phase = 'fight'; SC.t = 0;
      radio(RADIO[L.camp.id].start);
    } else if (SC.phase === 'fight') {
      if (SC.isBoss && !SC.boss) { SC.bossDelay -= rdt; if (SC.bossDelay <= 0) { SC.boss = makeBoss(L.lv.boss); S.play('alert'); L.hint = { text: SC.boss.name + '!', t: 2.5, big: true }; } }
      // הופעה
      SC.spawnT -= dt;
      const active = SC.ents.filter(e => e.hostile && e.state !== 'gone' && e.state !== 'dead').length;
      if (SC.queue.length && SC.spawnT <= 0 && active < SC.maxActive) {
        if (spawn(SC.queue[0])) SC.queue.shift(); else { const q = SC.queue.shift(); if (SC.queue.length < 20) SC.queue.push(q); }
        SC.spawnT = 0.45 + rand() * (L.lv.tutorial ? 0.5 : 1.1) - L.lv.diff * 0.03;
      }
      if (SC.isBoss && SC.boss && !SC.boss.dead && !SC.queue.length && rand() < dt * 0.25 && active < 2) SC.queue.push({ type: rand() < 0.3 ? 'grenadier' : 'soldier' });
      // ארגז נשק אחד בכל סצנה
      if (!SC.crate && SC.t > 6 && !L.lv.tutorial) { SC.crate = true; const c = SC.covers[Math.floor(rand() * SC.covers.length)]; if (c) SC.items.push({ kind: 'weapon', wkey: L.camp.weapons.pickups[Math.floor(rand() * 3)], x: c.x, y: c.y0 - 30, t: 0, life: 7, vy: 0 }); }
      // סיום
      const bossDone = !SC.isBoss || (SC.boss && SC.boss.dead && (SC.boss.human || SC.boss.deadT > 1.6));
      const left = SC.ents.filter(e => (e.hostile || e.state === 'held') && e.state !== 'gone' && e.state !== 'dead').length;
      if (bossDone && SC.isBoss && SC.boss && SC.boss.dead) { SC.queue = []; SC.ents.forEach(e => { if (e.hostile && e.kind !== 'vehicle' && e.state !== 'dead' && e.state !== 'gone') { e.state = 'surrender'; e.t = 0; e.hostile = false; } }); }
      if (bossDone && !SC.queue.length && left === 0) { SC.phase = 'clear'; SC.t = 0; S.play('clear'); radio(RADIO[L.camp.id].clear); }
    } else if (SC.phase === 'clear' && SC.t > 1.4) { SC.phase = 'exit'; SC.t = 0; }
    else if (SC.phase === 'exit' && SC.t > 0.7) {
      if (SC.idx + 1 < L.lv.scenes) { buildScene(SC.idx + 1); }
      else { levelComplete(); return; }
    }

    // ישויות
    SC.ents.forEach(e => updateEnt(e, dt));
    SC.ents = SC.ents.filter(e => e.state !== 'gone');
    if (SC.boss) updateBoss(SC.boss, dt);
    // פגזים
    SC.projs.forEach(p => {
      p.t += dt / p.dur;
      const [x, y, sz] = projPos(p);
      if (p.kind === 'rocket' && rand() < 0.8) smoke(x, y, 0.3 * sz);
      if (p.kind === 'grenade' && rand() < 0.5) part({ x, y: y - 8 * sz, life: 0.15, size: 3, col: '#ffcf6a', add: true, type: 'spark' });
      if (p.t >= 1 && !p.dead) { p.dead = true; explosion(x, y, 1.1); S.play('explosion'); playerHit(); }
    });
    SC.projs = SC.projs.filter(p => !p.dead);
    // פריטים
    SC.items.forEach(it => { it.t += dt; it.y += it.vy * dt; it.vy *= 0.94; if (it.t > it.life) it.dead = true; });
    SC.items = SC.items.filter(i => !i.dead);
    // חלקיקים
    for (let i = PARTS.length - 1; i >= 0; i--) {
      const p = PARTS[i]; p.t += dt; if (p.t >= p.life) { PARTS.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= p.drag; p.x += p.vx * dt; p.y += p.vy * dt; if (p.grow) p.size += p.grow * dt; if (p.rot !== undefined) p.rot += dt * 10;
    }
    // אווירה
    if (L.theme.dust && rand() < rdt * 8) part({ x: rand() * W, y: SC.HOR + rand() * 300, vx: 60 + rand() * 60, vy: -5, life: 3, size: 1.5, col: 'rgba(255,230,190,0.5)' });
    if (L.theme.smoke && rand() < rdt * 2) smoke(rand() * W, SC.HOR + 20 + rand() * 40, 2.5);
    L.popups.forEach(p => p.t -= rdt); L.popups = L.popups.filter(p => p.t > 0);
    L.tracers.forEach(t => t.t -= rdt); L.tracers = L.tracers.filter(t => t.t > 0);
    if (L.radio) { L.radio.t -= rdt; if (L.radio.t <= 0) L.radio = null; }
    if (L.hint) { L.hint.t -= rdt; if (L.hint.t <= 0) L.hint = null; }
    G.shake = Math.max(0, G.shake - rdt * 2.2);
    G.flash = Math.max(0, G.flash - rdt * 1.6);
  }

  // ---------- ציור ----------
  function drawOffset(e) {
    // היסוק אנכי לפי מצב הופעה
    if (!e.spot || e.fade) return 0;
    const k = e.k;
    if (e.spot.kind === 'pop' || e.spot.kind === 'far') return (1 - k) * 300 * e.s + (e.sink || 0) * 280 * e.s;
    if (e.spot.kind === 'win') return (1 - k) * 120 * e.s;
    return 0;
  }

  function drawEnt(e) {
    if (e.kind === 'vehicle') {
      e.tint = SC.tint;
      ctx.save(); if (e.state === 'dead' && e.vk !== 'drone') ctx.filter = 'brightness(0.35)';
      A.drawVehicle(ctx, { kind: e.vk, x: e.x, y: e.y, s: e.s, dir: e.dir, hp: Math.max(0, e.hp), maxhp: e.maxhp, hitFlash: e.hitFlash, tint: e.tint, seed: e.seed }, G.t);
      ctx.restore();
      if (e.state === 'dead' && e.vk !== 'drone' && rand() < 0.5) part({ x: e.x + (rand() - 0.5) * 160 * e.s, y: e.y - 120 * e.s, vx: 0, vy: -80, life: 0.5, size: 14 * e.s, col: '#ff8a3a', add: true, type: 'fire', grow: 20 });
      if (e.state === 'aim') { const m = vehGun(e); drawAimRing(m[0], m[1], 60 * e.s + 20, e.t / e.aimDur); }
      if (e.state !== 'dead') drawHpBar(e.x, vehBox(e)[1] - 14, 90, e.hp / e.maxhp);
      return;
    }
    if (e.state === 'wait') return;
    ctx.save();
    if (e.clip) { ctx.beginPath(); ctx.rect(e.clip[0], e.clip[1], e.clip[2], e.clip[3]); ctx.clip(); }
    else if (e.clipY) { ctx.beginPath(); ctx.rect(0, 0, W, e.clipY + 1); ctx.clip(); }
    if (e.fade) ctx.globalAlpha = Math.min(1, e.k * 1.4);
    if (e.fadeOut) ctx.globalAlpha *= Math.max(0, 1 - e.fadeOut);
    const p = { x: e.x, y: e.y + drawOffset(e), s: e.s, style: e.style, pose: e.state === 'dead' ? (e.pose === 'hostage' ? 'hostage' : 'idle') : e.pose, seed: e.seed, deadT: e.state === 'dead' ? e.deadT : 0, fallDir: e.fallDir, hitFlash: e.hitFlash, flip: e.flip, holes: e.holes, scared: e.scared };
    if (e.state === 'stunned') { p.pose = 'surrender'; p.scared = true; }
    const m = A.drawPerson(ctx, p, G.t);
    ctx.restore();
    if (m) e._muzzle = m;
    if (e.state === 'fire' && m) { A.glowDot(ctx, m[0], m[1], 50 * e.s, e.style.glow || '#ffe08a', 0.9); }
    if (e.state === 'aim' && m) drawAimRing(m[0], m[1] - 20 * e.s, 70 * e.s + 16, e.t / e.aimDur);
    if (e.state === 'stunned') { ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Assistant, Arial'; ctx.textAlign = 'center'; for (let i = 0; i < 3; i++) { const a = G.t * 4 + i * 2.1; ctx.fillText('✦', e.x + Math.cos(a) * 30 * e.s, e.y - 300 * e.s + Math.sin(a) * 8); } }
    if (e.maxhp > 3 && e.hostile && e.state !== 'dead') drawHpBar(e.x, e.y - 320 * e.s, 60, e.hp / e.maxhp);
  }

  function drawAimRing(x, y, r0, k) {
    k = clamp(k, 0, 1);
    const r = A.lerp(r0, 14, k);
    const col = k < 0.5 ? `rgb(${Math.round(80 + k * 340)},230,90)` : `rgb(255,${Math.round(230 - (k - 0.5) * 420)},60)`;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3 + k * 2; ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + G.t * 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4)); ctx.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12)); ctx.stroke(); }
    if (k > 0.75 && Math.floor(G.t * 12) % 2) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function drawHpBar(x, y, w, k) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 8); ctx.fillStyle = k > 0.5 ? '#9be36a' : k > 0.25 ? '#ffcf4a' : '#ff5a4a'; ctx.fillRect(x - w / 2, y, w * clamp(k, 0, 1), 4); }

  function drawCover(c) {
    ctx.drawImage(c.img.canvas, c.x0 - c.img.pad, c.y0 - c.img.pad);
    if (c.marks.length) { ctx.fillStyle = 'rgba(12,10,8,0.8)'; c.marks.forEach(m => { ctx.beginPath(); ctx.arc(c.x0 + m[0], c.y0 + m[1], 2.4 * c.s + 0.8, 0, 7); ctx.fill(); }); }
  }

  function drawItem(it) {
    const bob = Math.sin(it.t * 5) * 5, x = it.x, y = it.y + bob;
    const blink = it.life - it.t < 1.5 && Math.floor(it.t * 10) % 2;
    if (blink) return;
    A.glowDot(ctx, x, y, 46, it.kind === 'heal' ? '#9be36a' : it.kind === 'slow' ? '#ffcf4a' : '#ffffff', 0.35);
    ctx.save(); ctx.translate(x, y);
    if (it.kind === 'heal') {
      ctx.fillStyle = '#f4f0e8'; A.rr(ctx, -20, -16, 40, 32, 6); ctx.fill(); ctx.fillStyle = '#d83a2a'; ctx.fillRect(-4, -11, 8, 22); ctx.fillRect(-11, -4, 22, 8);
    } else if (it.kind === 'slow') {
      ctx.fillStyle = '#f4f0e8'; ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(14, -14); ctx.lineTo(10, 16); ctx.lineTo(-10, 16); ctx.fill();
      ctx.fillStyle = '#4a2a14'; ctx.fillRect(-12, -12, 24, 6); ctx.strokeStyle = '#f4f0e8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(15, 0, 6, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 6, -18); ctx.quadraticCurveTo(i * 6 + 5, -26 - Math.sin(it.t * 6 + i) * 3, i * 6, -34); ctx.stroke(); }
    } else {
      ctx.fillStyle = '#5a4a2a'; ctx.fillRect(-28, -18, 56, 36); ctx.strokeStyle = '#2a2010'; ctx.lineWidth = 3; ctx.strokeRect(-28, -18, 56, 36);
      ctx.fillStyle = '#ffd85a'; ctx.font = 'bold 12px Assistant, Arial'; ctx.textAlign = 'center'; ctx.fillText(WEAPONS[it.wkey].name, 0, 5);
    }
    ctx.restore();
  }

  function drawProj(p) {
    const [x, y, sz] = projPos(p);
    if (p.kind === 'grenade') {
      ctx.fillStyle = '#2a3020'; ctx.beginPath(); ctx.ellipse(x, y, 10 * sz, 13 * sz, p.t * 12, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ff5a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 26 * sz, 0, 7); ctx.stroke();
    } else if (p.kind === 'plasma') {
      A.glowDot(ctx, x, y, 34 * sz, '#ff4fd8', 0.9); A.glowDot(ctx, x, y, 14 * sz, '#ffffff', 1);
    } else if (p.kind === 'rocket') {
      A.glowDot(ctx, x, y, 30 * sz, '#ffb24a', 0.8); ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(x, y, 10 * sz, 0, 7); ctx.fill(); ctx.fillStyle = '#d83a2a'; ctx.beginPath(); ctx.arc(x, y, 5 * sz, 0, 7); ctx.fill();
    } else {
      A.glowDot(ctx, x, y, 30 * sz, '#ffcf6a', 0.7); ctx.fillStyle = '#4a4232'; ctx.beginPath(); ctx.arc(x, y, 12 * sz, 0, 7); ctx.fill();
    }
    const warn = p.t > 0.6 && Math.floor(G.t * 10) % 2;
    ctx.strokeStyle = warn ? '#ff3a2a' : 'rgba(255,90,60,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(x, y, 26 * sz + 8, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }

  function drawParticles(add) {
    for (const p of PARTS) {
      if (!!p.add !== add) continue;
      const k = p.t / p.life;
      if (p.type === 'flash') { A.glowDot(ctx, p.x, p.y, p.size * (1 - k * 0.5), p.col, 1 - k); continue; }
      if (p.type === 'fire') { A.glowDot(ctx, p.x, p.y, p.size, p.col, (1 - k) * 0.9); continue; }
      if (p.type === 'smoke') { ctx.globalAlpha = (1 - k) * 0.8; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); ctx.globalAlpha = 1; continue; }
      if (p.type === 'debris') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); ctx.restore(); continue; }
      if (p.type === 'spark') { ctx.strokeStyle = p.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = p.size * 0.7; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke(); ctx.globalAlpha = 1; continue; }
      ctx.globalAlpha = 1 - k; ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.size, p.size); ctx.globalAlpha = 1;
    }
  }

  const GUN_AX = W - 150, GUN_AY = H + 30, GUN_LEN = 300;
  function gunAngle() { return Math.atan2(G.my - GUN_AY, G.mx - GUN_AX); }
  function gunTip() { const a = gunAngle(); return [GUN_AX + Math.cos(a) * GUN_LEN, GUN_AY + Math.sin(a) * GUN_LEN]; }
  function drawGun() {
    const w = L.weapon, d = w.d, id = L.camp.id;
    const ang = gunAngle(), rec = w.recoil * 22;
    const energy = d.energy;
    const metal = energy ? '#2c3648' : '#1e1f22', furn = id === 'six' ? '#6a4628' : id === 'black' ? '#3a3a2c' : energy ? '#3a4a66' : '#2a2c2a';
    ctx.save(); ctx.translate(GUN_AX, GUN_AY); ctx.rotate(ang); ctx.translate(-rec, 0);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
    // קת
    ctx.fillStyle = furn; A.poly(ctx, [-170, -20, -40, -24, -40, 22, -170, 34]); ctx.fill();
    ctx.shadowColor = 'transparent';
    // גוף
    const gb = ctx.createLinearGradient(0, -26, 0, 26); gb.addColorStop(0, A.mix(metal, '#fff', 0.22)); gb.addColorStop(0.45, metal); gb.addColorStop(1, A.mix(metal, '#000', 0.4));
    ctx.fillStyle = gb; A.rr(ctx, -50, -26, 150, 50, 6); ctx.fill();
    ctx.fillStyle = A.mix(metal, '#000', 0.3); ctx.fillRect(-36, -34, 110, 9);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = A.mix(metal, '#fff', 0.12); ctx.fillRect(-32 + i * 12, -33, 6, 6); }
    // מחסנית
    ctx.fillStyle = A.mix(metal, '#000', 0.25); A.poly(ctx, [10, 20, 46, 20, 58, 84, 24, 88]); ctx.fill();
    // מגן יד וקנה
    ctx.fillStyle = furn; A.rr(ctx, 96, -20, 120, 38, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; for (let x = 108; x < 210; x += 14) { ctx.beginPath(); ctx.moveTo(x, -16); ctx.lineTo(x, 14); ctx.stroke(); }
    ctx.fillStyle = '#121212'; ctx.fillRect(214, -9, GUN_LEN - 214, 14);
    ctx.fillStyle = A.mix(metal, '#000', 0.2); ctx.fillRect(GUN_LEN - 26, -24, 8, 18); ctx.fillRect(-20, -46, 10, 14);
    if (energy) { ctx.fillStyle = A.rgba(d.tracer, 0.9); ctx.fillRect(-30, -4, 120, 5); ctx.fillRect(110, -6, 90, 3); A.glowDot(ctx, GUN_LEN, -2, 26, d.tracer, 0.5 + 0.3 * Math.sin(G.t * 8)); }
    if (w.reloading) { ctx.globalAlpha = 0.5; }
    // יד
    const sleeve = id === 'future' ? '#3a4458' : id === 'six' ? '#7a6e4a' : id === 'black' ? '#4a5038' : '#2a2e34';
    ctx.strokeStyle = sleeve; ctx.lineCap = 'round'; ctx.lineWidth = 50; ctx.beginPath(); ctx.moveTo(160, 24); ctx.lineTo(70, 230); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = '#c8946c'; ctx.beginPath(); ctx.ellipse(160, 14, 34, 22, 0.15, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(140 + i * 13, -2); ctx.lineTo(144 + i * 13, 22); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (w.recoil > 0.7 && !d.throwArc) { A.glowDot(ctx, GUN_LEN + 20, -2, 80, energy ? d.tracer : '#ffe08a', w.recoil); ctx.fillStyle = '#fff6d0'; A.poly(ctx, [GUN_LEN, -6, GUN_LEN + 60, -2, GUN_LEN, 2]); ctx.fill(); }
    ctx.restore();
  }

  function drawCrosshair() {
    const x = G.mx, y = G.my, w = L.weapon;
    const spread = (w.d.spread || 0) * (1 + (G.heat || 0)) + w.recoil * 10;
    const r = 14 + spread * 0.6;
    const col = L.camp.accent;
    ctx.save(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    const drawIt = () => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
      ctx.beginPath(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { ctx.moveTo(x + a * (r + 4), y + b * (r + 4)); ctx.lineTo(x + a * (r + 14), y + b * (r + 14)); }); ctx.stroke();
    };
    ctx.translate(1, 1); drawIt(); ctx.translate(-1, -1);
    ctx.strokeStyle = col; ctx.lineWidth = 2; drawIt();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill();
    if (w.reloading) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r + 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (w.reloadT / w.d.reload)); ctx.stroke(); }
    ctx.restore();
  }

  function txt(t, x, y, size, col, align, weight, font) {
    ctx.font = `${weight || 700} ${size}px ${font || '"Assistant", Arial, sans-serif'}`;
    ctx.textAlign = align || 'center'; ctx.direction = 'rtl';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(t, x + 2, y + 2);
    ctx.fillStyle = col || '#fff'; ctx.fillText(t, x, y);
  }

  function drawHUD() {
    const camp = L.camp;
    // לבבות
    for (let i = 0; i < L.maxLives; i++) {
      const x = W - 40 - i * 38, y = 38, on = i < L.lives;
      ctx.save(); ctx.translate(x, y); ctx.scale(1.1, 1.1);
      ctx.fillStyle = on ? '#e8443a' : 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-16, -4, -10, -16, 0, -8); ctx.bezierCurveTo(10, -16, 16, -4, 0, 8); ctx.fill();
      if (on) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-5, -6, 3, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    // ניקוד
    ctx.direction = 'ltr';
    ctx.font = '400 46px "Karantina", "Assistant", sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(String(L.score).padStart(7, '0'), 26, 54);
    ctx.fillStyle = '#fff'; ctx.fillText(String(L.score).padStart(7, '0'), 24, 52);
    if (L.combo >= 5) { const m = 1 + Math.min(3, Math.floor(L.combo / 5) * 0.5); ctx.font = '400 30px "Karantina", sans-serif'; ctx.fillStyle = '#ffd85a'; ctx.fillText(`קומבו ${L.combo}  x${m}`, 26, 84); }
    // שם שלב וסצנה
    txt(`${camp.title}  |  שלב ${L.li + 1}: ${L.lv.name}`, W / 2, 32, 20, 'rgba(255,255,255,0.85)');
    for (let i = 0; i < L.lv.scenes; i++) { const x = W / 2 + (i - (L.lv.scenes - 1) / 2) * 24; ctx.fillStyle = i < SC.idx ? camp.accent : i === SC.idx ? '#fff' : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(x, 50, i === SC.idx ? 6 : 4, 0, 7); ctx.fill(); }
    // בוס
    if (SC.boss && !SC.boss.dead) {
      const b = SC.boss; let k;
      if (b.human) k = b.ent.hp / b.ent.maxhp; else { const core = b.parts.filter(p => p.core), tot = b.parts.reduce((a, p) => a + p.max, 0), cur = b.parts.reduce((a, p) => a + Math.max(0, p.alive ? p.hp : 0), 0); k = cur / tot; }
      const bw = 520; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - bw / 2 - 3, 70, bw + 6, 18);
      ctx.fillStyle = '#d8423a'; ctx.fillRect(W / 2 - bw / 2, 73, bw * clamp(k, 0, 1), 12);
      txt(b.name, W / 2, 112, 22, '#ffcf9a');
    }
    // נשק ותחמושת
    const w = L.weapon;
    const bx = 24, by = H - 30;
    ctx.direction = 'rtl'; ctx.textAlign = 'left';
    txt(w.d.name + (w.base ? '' : `  (${w.reserve})`), bx + 4, by - 34, 22, w.base ? '#fff' : '#ffd85a', 'left');
    const n = w.d.mag, pw = Math.min(10, 380 / n);
    for (let i = 0; i < n; i++) { ctx.fillStyle = i < w.ammo ? (w.d.energy ? w.d.tracer : '#e8c070') : 'rgba(255,255,255,0.15)'; ctx.fillRect(bx + i * pw, by - 20, Math.max(2, pw - 2), 18); }
    if (w.reloading) txt('טוען...', bx + 200, by - 60, 22, '#fff');
    else if (w.ammo === 0 || L.needReload > 0) { if (Math.floor(G.t * 4) % 2) txt(isTouch ? 'טען! הקש על כפתור הטעינה' : 'טען! קליק ימני או R', W / 2, H - 150, 34, '#ff5a4a'); }
    // כפתור טעינה למגע
    if (isTouch) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(70, H - 120, 46, 0, 7); ctx.fill(); ctx.strokeStyle = camp.accent; ctx.lineWidth = 3; ctx.stroke(); txt('טען', 70, H - 112, 24, '#fff'); }
    if (L.slowT > 0) { txt('הזמן מאט', W / 2, 150, 28, '#ffd85a'); }
    // קשר
    if (L.radio) {
      const a = Math.min(1, L.radio.t * 2);
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(8,10,12,0.72)'; A.rr(ctx, W / 2 - 330, H - 104, 660, 52, 10); ctx.fill();
      ctx.fillStyle = camp.accent; ctx.fillRect(W / 2 + 318, H - 98, 4, 40);
      txt(camp.commander + ':', W / 2 + 306, H - 72, 17, camp.accent, 'right');
      txt(L.radio.text, W / 2 + 306, H - 58 + 10, 22, '#fff', 'right');
      ctx.globalAlpha = 1;
    }
    if (L.hint) { const a = Math.min(1, L.hint.t * 2); ctx.globalAlpha = a; txt(L.hint.text, W / 2, L.hint.big ? 260 : 190, L.hint.big ? 54 : 26, L.hint.big ? '#ffcf9a' : '#fff', 'center', 700, L.hint.big ? '"Karantina", sans-serif' : undefined); ctx.globalAlpha = 1; }
  }

  function render() {
    ctx.setTransform(dpr * cssScale, 0, 0, dpr * cssScale, 0, 0);
    ctx.save();
    if (G.shake > 0) ctx.translate((rand() - 0.5) * 22 * G.shake, (rand() - 0.5) * 22 * G.shake);
    // מעבר בין סצנות
    let zoom = 1, fade = 0;
    if (SC.phase === 'enter') { const k = Math.min(1, SC.t / 0.9); zoom = 1.12 - 0.12 * easeOut(k); fade = 1 - k; }
    if (SC.phase === 'exit') { const k = Math.min(1, SC.t / 0.7); zoom = 1 + 0.25 * k * k; fade = k; }
    const par = (G.mx - W / 2) / W, parY = (G.my - H / 2) / H;
    ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2 - par * 14, -H / 2 - parY * 8);
    ctx.drawImage(SC.bg.canvas, -10, -10, W + 20, H + 20);
    ctx.drawImage(SC.decal, 0, 0);
    // זרקורים בלילה
    if (L.lv.time === 'night' && L.theme.type === 'out') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) { const a = Math.sin(G.t * 0.4 + i * 2) * 0.5 - Math.PI / 2, x = 300 + i * 700, y = SC.HOR; const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * 600, y + Math.sin(a) * 600); g.addColorStop(0, 'rgba(200,220,255,0.12)'); g.addColorStop(1, 'rgba(200,220,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a - 0.06) * 700, y + Math.sin(a - 0.06) * 700); ctx.lineTo(x + Math.cos(a + 0.06) * 700, y + Math.sin(a + 0.06) * 700); ctx.fill(); }
      ctx.restore();
    }
    // חלונות ראשונים
    const all = [];
    SC.covers.forEach(c => all.push({ z: c.z, c }));
    SC.ents.forEach(e => all.push({ z: e.z, e }));
    if (SC.boss && !SC.boss.human) all.push({ z: SC.boss.z, b: SC.boss });
    all.sort((a, b) => a.z - b.z);
    for (const o of all) { if (o.c) drawCover(o.c); else if (o.e) drawEnt(o.e); else drawBoss(o.b); }
    SC.items.forEach(drawItem);
    SC.projs.forEach(drawProj);
    drawParticles(false);
    ctx.globalCompositeOperation = 'lighter'; drawParticles(true); ctx.globalCompositeOperation = 'source-over';
    // קווי ירי
    L.tracers.forEach(t => { ctx.strokeStyle = A.rgba(t.col, t.t / 0.06 * (t.energy ? 0.9 : 0.5)); ctx.lineWidth = t.energy ? 4 : 2; ctx.beginPath(); ctx.moveTo(t.x0, t.y0); ctx.lineTo(t.x1, t.y1); ctx.stroke(); });
    // זריקות
    if (SC.throws) SC.throws.forEach(th => { const x = A.lerp(th.x0, th.x1, th.t), y = A.lerp(th.y0, th.y1, th.t) - Math.sin(th.t * Math.PI) * 160, s = 1.4 - th.t; ctx.fillStyle = th.w.energy ? '#69f5ff' : '#2a3020'; ctx.beginPath(); ctx.arc(x, y, 12 * s, 0, 7); ctx.fill(); });
    // גשם
    if (L.theme.rain) { ctx.strokeStyle = 'rgba(180,200,230,0.25)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i < 90; i++) { const x = (i * 137 + G.t * 300) % (W + 100) - 50, y = (i * 263 + G.t * 900) % H; ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 22); } ctx.stroke(); }
    ctx.restore();
    // בועות דיבור ונקודות
    ctx.setTransform(dpr * cssScale, 0, 0, dpr * cssScale, 0, 0);
    L.popups.forEach(p => {
      const a = Math.min(1, p.t * 3);
      ctx.globalAlpha = a;
      if (p.bubble) {
        const e = p.ent; if (!e || e.state === 'gone') { ctx.globalAlpha = 1; return; }
        const x = e.x, y = e.y + drawOffset(e) - 330 * e.s - 20;
        ctx.font = '700 22px "Assistant", Arial'; const tw = ctx.measureText(p.text).width + 26;
        ctx.fillStyle = e.hostile ? '#2a2420' : '#fff'; A.rr(ctx, x - tw / 2, y - 30, tw, 38, 12); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 8, y + 7); ctx.lineTo(x, y + 20); ctx.lineTo(x + 8, y + 7); ctx.fill();
        ctx.fillStyle = e.hostile ? '#ffcf9a' : '#1a1a1a'; ctx.textAlign = 'center'; ctx.direction = 'rtl'; ctx.fillText(p.text, x, y - 4);
      } else {
        txt(p.text, p.x, p.y - (1.1 - p.t) * 50, Math.round(22 * p.size), p.col);
      }
      ctx.globalAlpha = 1;
    });
    A.postFX(ctx, L.camp.grade, G.t);
    if (L.slowT > 0) { ctx.fillStyle = 'rgba(255,200,80,0.08)'; ctx.fillRect(0, 0, W, H); }
    if (G.flash > 0) { ctx.fillStyle = `rgba(${G.flashCol},${G.flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
    if (L.lives === 1 && G.screen === 'play') { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${0.25 + 0.15 * Math.sin(G.t * 5)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    drawGun();
    drawHUD();
    if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
    if (SC.phase === 'enter' && SC.idx === 0) { ctx.globalAlpha = 1 - Math.min(1, SC.t / 0.9) * 0.3; txt(`שלב ${L.li + 1}`, W / 2, H / 2 - 30, 34, L.camp.accent, 'center', 400, '"Karantina", sans-serif'); txt(L.lv.name, W / 2, H / 2 + 40, 76, '#fff', 'center', 400, '"Karantina", sans-serif'); ctx.globalAlpha = 1; }
    if (SC.phase === 'clear') txt('האזור נקי!', W / 2, H / 2, 80, L.camp.accent, 'center', 400, '"Karantina", sans-serif');
    if (G.screen === 'play' || G.screen === 'pause') drawCrosshair();
  }
  const easeOut = k => 1 - Math.pow(1 - k, 3);

  // ---------- סיום שלב ----------
  function levelComplete() {
    G.screen = 'debrief';
    const acc = L.shots ? L.hits / L.shots : 0;
    const lifeBonus = L.lives * 300, accBonus = Math.round(acc * 2000), hostBonus = L.saved * 200;
    L.score += lifeBonus + accBonus + hostBonus;
    let stars = 1; if (acc >= 0.55) stars++; if (L.dmg <= 1 && L.civHit === 0 && L.lost === 0) stars++;
    const rank = RANKS[Math.min(RANKS.length - 1, Math.floor(L.score / (900 + L.lv.diff * 260)))];
    const pr = save.prog[L.camp.id];
    pr.stars[L.li] = Math.max(pr.stars[L.li] || 0, stars);
    pr.best[L.li] = Math.max(pr.best[L.li] || 0, L.score);
    if (pr.unlocked < L.li + 2) pr.unlocked = Math.min(L.camp.levels.length, L.li + 2);
    persist();
    S.stopMusic();
    const last = L.li === L.camp.levels.length - 1;
    $('db-title').textContent = last ? 'המערכה הושלמה!' : 'השלב הושלם';
    $('db-level').textContent = `שלב ${L.li + 1}: ${L.lv.name}`;
    $('db-stars').innerHTML = [0, 1, 2].map(i => `<span class="star ${i < stars ? 'on' : ''}">★</span>`).join('');
    $('db-stats').innerHTML = [
      ['ניקוד', L.score.toLocaleString('he-IL')], ['דיוק', Math.round(acc * 100) + '%'], ['נוטרלו', L.kills], ['פגיעות ראש', L.heads],
      ['ניטרולים בגפיים', L.neutral], ['בני ערובה שניצלו', L.saved], ['אזרחים שנפגעו', L.civHit], ['קומבו שיא', L.maxCombo], ['דרגה', rank],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    $('db-story').textContent = L.lv.debrief + (last ? '\n\n' + L.camp.outro : '');
    $('db-next').hidden = last;
    $('db-next').textContent = 'לשלב הבא';
    showScreen('debrief');
    S.play('clear');
  }

  function gameOver() {
    G.screen = 'over'; S.stopMusic();
    $('go-text').textContent = `${L.lv.name}. ניקוד: ${L.score.toLocaleString('he-IL')}`;
    showScreen('over');
  }

  // ---------- מסכים ----------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== id);
    canvas.classList.toggle('playing', !id);
    $('play-btns').hidden = !!id;
  }

  let selCamp = 0;
  function renderMenu() {
    const box = $('camps'); box.innerHTML = '';
    CAMPAIGNS.forEach((c, i) => {
      const pr = save.prog[c.id]; const done = pr.stars.filter(Boolean).length; const stars = pr.stars.reduce((a, b) => a + (b || 0), 0);
      const b = document.createElement('button'); b.className = 'camp'; b.style.setProperty('--ca', c.accent); b.id = 'camp-' + c.id;
      b.innerHTML = `<canvas class="thumb" width="320" height="180"></canvas><div class="camp-body"><div class="camp-year">${c.year}</div><div class="camp-title">${c.title}</div><div class="camp-tag">${c.tag}</div><div class="camp-prog"><span>${done}/10 שלבים</span><span>★ ${stars}/30</span></div></div>`;
      b.onclick = () => { S.init(); S.play('ui'); selCamp = i; renderLevels(); showScreen('levels'); };
      box.appendChild(b);
      setTimeout(() => { const lv = c.levels[1], th = THEMES[lv.theme]; const sc = A.paintScene(lv.theme, th, lv.time, 4242 + i); const tc = b.querySelector('canvas').getContext('2d'); tc.drawImage(sc.canvas, 0, 0, 320, 180); }, 30 + i * 60);
    });
    $('opt-diff').value = save.settings.diff;
    $('opt-sfx').checked = save.settings.sfx; $('opt-music').checked = save.settings.music; $('opt-voice').checked = save.settings.voice; $('opt-auto').checked = save.settings.autoReload;
  }

  function renderLevels() {
    const c = CAMPAIGNS[selCamp], pr = save.prog[c.id];
    document.documentElement.style.setProperty('--camp', c.accent);
    $('lv-title').textContent = c.title; $('lv-year').textContent = c.year + ' · ' + c.tag;
    $('lv-intro').textContent = c.intro;
    const box = $('lvlist'); box.innerHTML = '';
    c.levels.forEach((lv, i) => {
      const locked = i >= pr.unlocked; const st = pr.stars[i] || 0;
      const b = document.createElement('button'); b.className = 'lv' + (locked ? ' locked' : '') + (lv.boss ? ' boss' : ''); b.disabled = locked; b.id = `lv-${c.id}-${i}`;
      b.innerHTML = `<span class="lv-num">${i + 1}</span><span class="lv-name">${lv.name}</span><span class="lv-place">${locked ? 'נעול' : lv.place}${lv.boss ? ' · בוס' : ''}</span><span class="lv-stars">${[0, 1, 2].map(k => `<i class="${k < st ? 'on' : ''}">★</i>`).join('')}</span>`;
      b.onclick = () => { S.play('ui'); openBrief(selCamp, i); };
      box.appendChild(b);
    });
  }

  let briefSel = null, typeTimer = null;
  function openBrief(ci, li) {
    briefSel = [ci, li];
    const c = CAMPAIGNS[ci], lv = c.levels[li];
    $('br-level').textContent = `שלב ${li + 1} מתוך 10`;
    $('br-name').textContent = lv.name;
    $('br-place').textContent = lv.place + ' · ' + { day: 'יום', dawn: 'שחר', dusk: 'בין ערביים', night: 'לילה' }[lv.time];
    $('br-from').textContent = c.commander;
    const w = c.weapons;
    $('br-arms').textContent = `נשק: ${WEAPONS[w.base].name}. בשטח: ${w.pickups.map(k => WEAPONS[k].name).join(', ')}`;
    const tc = $('br-thumb').getContext('2d'); const sc = A.paintScene(lv.theme, THEMES[lv.theme], lv.time, (ci + 1) * 7919 + li * 613 + 11); tc.drawImage(sc.canvas, 0, 0, 640, 360);
    const t = lv.brief; const el = $('br-text'); el.textContent = ''; let n = 0;
    clearInterval(typeTimer); typeTimer = setInterval(() => { n += 2; el.textContent = t.slice(0, n); if (n >= t.length) clearInterval(typeTimer); }, 18);
    showScreen('brief'); S.play('radio');
  }

  // ---------- כפתורים ----------
  $('br-go').onclick = () => { clearInterval(typeTimer); S.init(); startLevel(briefSel[0], briefSel[1]); };
  $('br-back').onclick = () => { clearInterval(typeTimer); showScreen('levels'); };
  $('lv-back').onclick = () => { renderMenu(); showScreen('menu'); S.startMusic('menu'); };
  $('db-next').onclick = () => openBrief(L.ci, L.li + 1);
  $('db-retry').onclick = () => startLevel(L.ci, L.li);
  $('db-menu').onclick = () => { renderLevels(); showScreen('levels'); S.startMusic('menu'); };
  $('go-retry').onclick = () => startLevel(L.ci, L.li);
  $('go-menu').onclick = () => { renderLevels(); showScreen('levels'); S.startMusic('menu'); };
  $('pa-resume').onclick = () => resume();
  $('pa-quit').onclick = () => { renderLevels(); showScreen('levels'); G.screen = 'levels'; S.startMusic('menu'); };
  $('pause-btn').onclick = () => pause();
  $('fs-btn').onclick = () => { try { if (!document.fullscreenElement) $('app').requestFullscreen().catch(() => { }); else document.exitFullscreen(); } catch (e) { } };
  $('start-btn').onclick = () => { S.init(); S.play('ui'); S.startMusic('menu'); $('camps').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const opt = (id, key, fn) => $(id).onchange = e => { save.settings[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; persist(); fn && fn(); };
  opt('opt-diff', 'diff'); opt('opt-sfx', 'sfx', () => S.sfxOn = save.settings.sfx); opt('opt-music', 'music', () => { S.musicOn = save.settings.music; if (S.musicOn) { S.init(); S.startMusic('menu'); } else S.stopMusic(); });
  opt('opt-voice', 'voice', () => S.voiceOn = save.settings.voice); opt('opt-auto', 'autoReload');
  S.sfxOn = save.settings.sfx; S.musicOn = save.settings.music; S.voiceOn = save.settings.voice;

  function pause() { if (G.screen !== 'play') return; G.screen = 'pause'; showScreen('pause'); S.stopMusic(); }
  function resume() { if (G.screen !== 'pause') return; G.screen = 'play'; showScreen(null); last = performance.now(); S.startMusic(L.camp.id); }

  // ---------- קלט ----------
  function toGame(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
  canvas.addEventListener('pointerdown', e => {
    S.init();
    const [x, y] = toGame(e); G.mx = x; G.my = y;
    if (G.screen !== 'play') return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (er) { }
    if (e.button === 2) { startReload(); return; }
    if (isTouch && Math.hypot(x - 70, y - (H - 120)) < 56) { startReload(); return; }
    G.down = true; G.pressed = true;
  });
  canvas.addEventListener('pointermove', e => { const [x, y] = toGame(e); G.mx = x; G.my = y; });
  window.addEventListener('pointerup', () => { G.down = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    if (G.screen === 'play') {
      if (e.code === 'KeyR' || e.code === 'Space') { e.preventDefault(); startReload(); }
      if (e.code === 'Escape' || e.code === 'KeyP') pause();
    } else if (G.screen === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) resume();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  // ---------- אתחול ----------
  resize();
  renderMenu();
  showScreen('menu');
  requestAnimationFrame(frame);
  window.__game = { G, get L() { return L; }, get SC() { return SC; }, startLevel, buildScene, save };
})();
