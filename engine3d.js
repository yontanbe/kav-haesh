/* קו האש 3D: מנוע השלבים. כל שלב מוגדר ב-levels67.js */
(function () {
  const T = window.THREE, S = window.SFX;
  const W = 1280, H = 720;
  const $ = id => document.getElementById(id);
  const rand = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  let isTouch = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches);

  // ---------- שלב, פרופיל, קושי ----------
  const LEVELS = window.LEVELS67;
  const qs = new URLSearchParams(location.search);
  const LEVEL_NO = clamp(parseInt(qs.get('l') || '2', 10) || 2, 1, LEVELS.length);
  const LD = LEVELS[LEVEL_NO - 1];
  const LV = '67-' + LEVEL_NO;
  const PF = window.PROFILE ? PROFILE.load() : null;
  const NAME = window.PROFILE ? PROFILE.displayName(PF) : 'דני';
  const LOW = PF && PF.settings.quality === 'low';
  const DIFFS = { easy: { lives: 7, aim: 1.35, extra: -1, name: 'קל', carry: 0.16, every: 7, bonus: 3 }, normal: { lives: 5, aim: 1, extra: 0, name: 'רגיל', carry: 0.1, every: 11, bonus: 2 }, hard: { lives: 4, aim: 0.75, extra: 1, name: 'קשה', carry: 0.05, every: 16, bonus: 1 } };
  let DKEY = DIFFS[(PF && PF.settings.difficulty)] ? PF.settings.difficulty : 'normal';
  let DIFF = DIFFS[DKEY];
  if (PF) { S.sfxOn = PF.settings.sound; S.musicOn = PF.settings.music; S.voiceOn = false; }
  const NSC = LD.scenes.length;
  const fill = s => (s || '').replace(/\{name\}/g, NAME);

  // ---------- נכסים ----------
  const SPRITES = {
    idle: { f: 'soldier_idle', h: 1.85, head: [0.3, 0, 0.56, 0.13], muzzle: [0.95, 0.47] },
    aim: { f: 'soldier_aim', h: 1.75, head: [0.3, 0, 0.68, 0.2], muzzle: [0.62, 0.33] },
    kneel: { f: 'soldier_aim2', h: 1.38, head: [0.38, 0, 0.7, 0.17], muzzle: [0.6, 0.2] },
    gunner: { f: 'gunner', h: 1.95, head: [0.38, 0, 0.62, 0.12], muzzle: [0.97, 0.3] },
    officer: { f: 'en_officer', h: 1.85, head: [0.12, 0, 0.62, 0.1], muzzle: [0.03, 0.05] },
    prone: { f: 'en_prone', h: 0.78, head: [0.38, 0, 0.6, 0.3], muzzle: [0.53, 0.27] },
    run: { f: 'en_run', h: 1.85, head: [0.36, 0, 0.62, 0.11] },
    surrender: { f: 'en_surrender', h: 1.85, head: [0.36, 0.02, 0.62, 0.13] },
    throw: { f: 'en_throw', h: 1.85, head: [0.22, 0, 0.5, 0.11], muzzle: [0.04, 0.27] },
    hit: { f: 'soldier_hit', h: 1.7 },
    target: { f: 'target_enemy', h: 1.75, head: [0.2, 0, 0.8, 0.2] },
    targetCiv: { f: 'target_civ', h: 1.75, head: [0.1, 0, 0.6, 0.22] },
    civMan: { f: 'civ_man', h: 1.8, head: [0.36, 0, 0.62, 0.13] },
    civWoman: { f: 'civ_woman', h: 1.72, head: [0.3, 0.02, 0.7, 0.16] },
    truck: { f: 'truck', h: 3.1 },
    jeep: { f: 'jeep', h: 2.6, muzzle: [0.44, 0.06] },
    tank: { f: 'tank', h: 4.6, muzzle: [0.995, 0.17] },
    bunker: { f: 'bunker', h: 3.3, slit: [0.2, 0.2, 0.85, 0.36], muzzle: [0.5, 0.28] },
    bunkerB: { f: 'bunker_basalt', h: 3.0, slit: [0.5, 0.41, 0.8, 0.54], muzzle: [0.63, 0.48] },
    fort: { f: 'fort', h: 6.2, muzzle: [0.3, 0.02] },
    wire: { f: 'wire', h: 1.15 }, tent: { f: 'tent', h: 2.6 }, arch: { f: 'arch', h: 5.2 }, house: { f: 'house', h: 6.4 },
    hedgehog: { f: 'hedgehog', h: 1.5 }, watchtower: { f: 'watchtower', h: 6 },
  };
  const FP = {
    uzi: { img: 'fp_uzi', w: 470, muzzle: [0.3, 0.06], dx: 10 },
    fal: { img: 'fp_fal', w: 540, muzzle: [0.22, 0.08], dx: 20 },
    mag: { img: 'fp_mag', w: 520, muzzle: [0.47, 0.03], dx: 10 },
    grenade: { img: 'fp_grenade', w: 400, dx: 60 },
  };
  const TEX = {}, MASK = {}, VOICE = {};

  function loadAll(onProgress) {
    const loader = new T.TextureLoader();
    const list = [...new Set([LD.sky, LD.ground || 'sand', 'burlap', 'rock', 'crate', 'explosion', 't_wall', ...Object.values(SPRITES).map(s => s.f)])];
    const imgs = ['commander', 'fp_uzi', 'fp_fal', 'fp_mag', 'fp_grenade'];
    const total = list.length + imgs.length; let done = 0;
    const tick = () => onProgress(++done / total);
    return Promise.all([
      ...list.map(n => new Promise((res, rej) => loader.load('assets/' + n + '.webp', t => { t.encoding = T.sRGBEncoding; t.anisotropy = 8; TEX[n] = t; tick(); res(); }, undefined, rej))),
      ...imgs.map(n => new Promise((res, rej) => { const i = new Image(); i.onload = () => { TEX[n + 'Img'] = i; tick(); res(); }; i.onerror = rej; i.src = 'assets/' + n + '.webp'; })),
    ]).then(() => {
      Object.values(SPRITES).forEach(s => {
        const img = TEX[s.f].image; s.aspect = img.width / img.height;
        if (MASK[s.f]) return;
        const mh = 160, mw = Math.round(160 * s.aspect), c = document.createElement('canvas'); c.width = mw; c.height = mh;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0, mw, mh);
        const d = x.getImageData(0, 0, mw, mh).data, a = new Uint8Array(mw * mh);
        for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
        MASK[s.f] = { w: mw, h: mh, a };
      });
    });
  }
  function alphaAt(f, u, v) { const m = MASK[f]; const x = clamp(Math.floor(u * m.w), 0, m.w - 1), y = clamp(Math.floor((1 - v) * m.h), 0, m.h - 1); return m.a[y * m.w + x]; }

  // ---------- קולות ----------
  function loadVoices() {
    if (!PF || !PF.settings.sound || !window.VOICES) return;
    const keys = new Set(['go1', 'go2', 'clear1', 'clear2', 'hurt1', 'hurt2', 'grenade', 'jeep', 'tank', 'win', 'civ', 'cover', 'help_f', 'help_m', 'dontshoot_m', 'dontshoot_f']);
    LD.scenes.forEach((s, i) => keys.add(`l${LEVEL_NO}s${i}`));
    if (LD.bossVoice) keys.add(LD.bossVoice);
    keys.forEach(k => { if (!window.VOICES.includes(k)) return; fetch('assets/voice/' + k + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(b => { if (b) VOICE[k] = { raw: b }; }).catch(() => { }); });
  }
  let voiceSrc = null;
  function playVoice(k, radioFx) {
    const v = VOICE[k]; if (!v || !S.ctx || !S.sfxOn) return false;
    const go = buf => {
      try { if (voiceSrc) voiceSrc.stop(); } catch (e) { }
      const src = S.ctx.createBufferSource(); src.buffer = buf;
      const g = S.ctx.createGain(); g.gain.value = 1.15;
      if (radioFx) { const bp = S.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.7; const ws = S.ctx.createWaveShaper(); const cu = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cu[i] = Math.tanh(x * 2.2); } ws.curve = cu; src.connect(bp); bp.connect(ws); ws.connect(g); }
      else src.connect(g);
      g.connect(S.ctx.destination); src.start(); voiceSrc = src;
    };
    if (v.buf) go(v.buf); else if (!v.decoding) { v.decoding = true; S.ctx.decodeAudioData(v.raw.slice(0), b => { v.buf = b; go(b); }, () => { }); }
    return true;
  }

  // ---------- רעש וקרקע ----------
  function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); }
  function fbm(x, y) { let a = 0, f = 1, s = 0.5; for (let i = 0; i < 4; i++) { a += vnoise(x * f, y * f) * s; f *= 2; s *= 0.5; } return a; }

  const STOPS = LD.scenes.map(s => ({ pos: s.pos, yaw: s.yaw || 0 }));
  const LW = (i, x, d) => [STOPS[i].pos[0] + x, STOPS[i].pos[1] - d];
  const HILLS = LD.hills || 22;
  function flatK(x, z) {
    let d = 1e9;
    STOPS.forEach((s, i) => { const r = LD.boss && LD.boss.scene === i ? 40 : 27; d = Math.min(d, Math.max(0, Math.hypot(x - s.pos[0], z - (s.pos[1] - 15)) - r)); });
    for (let i = 0; i < STOPS.length - 1; i++) { const a = STOPS[i].pos, b = STOPS[i + 1].pos; const vx = b[0] - a[0], vz = b[1] - a[1], t = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz), 0, 1); d = Math.min(d, Math.hypot(x - (a[0] + vx * t), z - (a[1] + vz * t))); }
    return clamp((d - 2) / 30, 0, 1);
  }
  function groundH(x, z) {
    const big = (fbm(x * 0.012 + 3, z * 0.012) - 0.45) * HILLS, mid = (fbm(x * 0.05, z * 0.05 + 7) - 0.5) * 2.2, k = flatK(x, z);
    return big * k * k + mid * (0.25 + k * 0.75) + Math.sin(x * 0.35 + z * 0.12) * 0.06;
  }

  let renderer, scene, camera, composer, finalPass, sun, hemi, ground, raycaster, boomLight, flareLight;
  const COVERS = [], DECALS = [], PARTS = [], TRACERS = [], SMOKERS = [], DEBRIS = [], FALLING = [];
  const partTex = {};
  const CARD_TINT = new T.Color(LD.cardTint || '#f6e0c8');

  function canvasTex(size, fn) { const c = document.createElement('canvas'); c.width = c.height = size; fn(c.getContext('2d'), size); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; }
  const lin = c => new T.Color(c).convertSRGBToLinear();

  function initGL() {
    renderer = new T.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = LOW ? T.PCFShadowMap : T.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    scene = new T.Scene();
    scene.fog = new T.Fog(lin(LD.fog || '#d8a585'), LD.fogNear || 45, LD.fogFar || 340);
    scene.background = lin(LD.bg || '#e9b98c');
    camera = new T.PerspectiveCamera(37, W / H, 0.1, 1200);
    raycaster = new T.Raycaster();

    const skyTex = TEX[LD.sky]; skyTex.wrapS = T.ClampToEdgeWrapping; skyTex.repeat.x = -1; skyTex.offset.x = 1;
    const R = 520, arc = 2.9, hgt = R * arc / (skyTex.image.width / skyTex.image.height);
    const sky = new T.Mesh(new T.CylinderGeometry(R, R, hgt, 64, 1, true, Math.PI - arc / 2, arc), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false, depthWrite: false }));
    sky.position.y = (LD.skyY !== undefined ? LD.skyY : 0.23) * hgt + 2; sky.renderOrder = -10; scene.add(sky); scene.userData.sky = sky;

    const hm = LD.hemi || ['#b9c9e8', '#a8784a', 0.55];
    hemi = new T.HemisphereLight(lin(hm[0]), lin(hm[1]), hm[2]); scene.add(hemi);
    const sn = LD.sun || ['#ffc590', 3.2, [-60, 26, -70]];
    sun = new T.DirectionalLight(lin(sn[0]), sn[1]); sun.castShadow = true; sun.userData.off = sn[2];
    sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    boomLight = new T.PointLight(lin('#ff9a40'), 0, 30, 2); scene.add(boomLight);
    flareLight = new T.PointLight(lin('#fff2d0'), 0, 70, 1.6); scene.add(flareLight);

    const zs = STOPS.map(s => s.pos[1]), cz = (Math.min(...zs) + Math.max(...zs)) / 2 - 20, cx = STOPS.reduce((a, s) => a + s.pos[0], 0) / NSC;
    const g = new T.PlaneGeometry(900, 900, LOW ? 150 : 260, LOW ? 150 : 260); g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, groundH(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const st = TEX[LD.ground || 'sand']; st.wrapS = st.wrapT = T.RepeatWrapping; st.repeat.set(LD.groundRepeat || 140, LD.groundRepeat || 140);
    ground = new T.Mesh(g, new T.MeshStandardMaterial({ map: st, roughness: 0.95, color: new T.Color(LD.groundTint || '#d9b893') }));
    ground.receiveShadow = true; scene.add(ground);

    partTex.soft = canvasTex(64, (x, s) => { const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, s, s); });
    partTex.smoke = canvasTex(128, (x, s) => { for (let i = 0; i < 26; i++) { const px = s / 2 + (rand() - 0.5) * s * 0.45, py = s / 2 + (rand() - 0.5) * s * 0.45, r = s * (0.15 + rand() * 0.2); const gr = x.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, s, s); } });
    partTex.flash = canvasTex(128, (x, s) => { x.translate(s / 2, s / 2); for (let i = 0; i < 7; i++) { x.rotate(Math.PI * 2 / 7 + rand() * 0.3); const gr = x.createLinearGradient(0, 0, s / 2, 0); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = gr; x.beginPath(); x.moveTo(0, -s * 0.05); x.lineTo(s * (0.3 + rand() * 0.2), 0); x.lineTo(0, s * 0.05); x.fill(); } const gr = x.createRadialGradient(0, 0, 0, 0, 0, s * 0.22); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(1, 'rgba(255,190,90,0)'); x.fillStyle = gr; x.fillRect(-s / 2, -s / 2, s, s); });
    partTex.decal = canvasTex(64, (x, s) => { const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(20,14,8,0.95)'); gr.addColorStop(0.35, 'rgba(40,28,16,0.6)'); gr.addColorStop(1, 'rgba(60,40,20,0)'); x.fillStyle = gr; x.fillRect(0, 0, s, s); });

    const dg = new T.BufferGeometry(), N = LOW ? 500 : 1400, arr = new Float32Array(N * 3), z0 = Math.max(...zs) + 10, zl = z0 - Math.min(...zs) + 80;
    for (let i = 0; i < N; i++) { arr[i * 3] = cx + (rand() - 0.5) * 120; arr[i * 3 + 1] = rand() * 14; arr[i * 3 + 2] = z0 - rand() * zl; }
    dg.setAttribute('position', new T.BufferAttribute(arr, 3));
    const dust = new T.Points(dg, new T.PointsMaterial({ size: 0.07, map: partTex.soft, transparent: true, opacity: LD.night ? 0.25 : 0.55, depthWrite: false, color: lin(LD.dust || '#ffe2b8'), blending: T.AdditiveBlending }));
    scene.add(dust); scene.userData.dust = dust;

    buildWorld();

    const rt = new T.WebGLRenderTarget(W, H, { type: T.HalfFloatType });
    composer = new T.EffectComposer(renderer, rt);
    composer.addPass(new T.RenderPass(scene, camera));
    if (!LOW) composer.addPass(new T.UnrealBloomPass(new T.Vector2(W, H), LD.night ? 0.8 : 0.55, 0.6, LD.night ? 0.7 : 0.9));
    finalPass = new T.ShaderPass({
      uniforms: { tDiffuse: { value: null }, time: { value: 0 }, dmg: { value: 0 }, slow: { value: 0 }, flash: { value: 0 }, exposure: { value: LD.exposure || 0.82 }, duck: { value: 0 }, grade: { value: new T.Vector3(...(LD.grade || [1.04, 1.0, 0.93])) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float time, dmg, slow, flash, exposure, duck; uniform vec3 grade; varying vec2 vUv;
        float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
        void main(){
          vec2 uv = vUv; vec2 d = uv - 0.5; float r = length(d);
          float ca = 0.0012 + dmg * 0.008;
          vec3 c = vec3(texture2D(tDiffuse, uv + d*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d*ca).b);
          c = aces(c * exposure);
          c = pow(c, vec3(1.0/2.2));
          c *= grade;
          float l = dot(c, vec3(0.299,0.587,0.114));
          c = mix(vec3(l), c, 1.1 - slow*0.55 - duck*0.35);
          c = mix(c, c*vec3(1.1,0.95,0.75), slow*0.5);
          c += (rnd(uv*vec2(1280.0,720.0) + time) - 0.5) * 0.05;
          c *= mix(1.0, smoothstep(0.9, 0.3, r), 0.55 + duck*0.3);
          c = mix(c, vec3(0.75,0.05,0.02), dmg * 0.45 * smoothstep(0.15, 0.75, r));
          c += flash;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    composer.addPass(finalPass);
  }

  // ---------- אובייקטים בעולם ----------
  function at(x, z) { return new T.Vector3(x, groundH(x, z), z); }
  function addCover(mesh, opts) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.cover = opts || {}; scene.add(mesh); COVERS.push(mesh); return mesh; }
  let burlapMat, crateMat, rockMat, barrelMat, wallMat, debrisGeo;
  function sandbags(i, x, d, len, rows, rotY, decor) {
    if (!burlapMat) { const t = TEX.burlap; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1.5, 1); burlapMat = new T.MeshStandardMaterial({ map: t, roughness: 1, color: new T.Color(LD.bagTint || '#f4e2c0') }); }
    const [wx, wz] = LW(i, x, d);
    const geo = new T.SphereGeometry(0.5, 16, 10); geo.scale(0.62, 0.3, 0.4);
    const per = Math.round(len / 0.58), im = new T.InstancedMesh(geo, burlapMat, per * rows);
    const m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), pos = new T.Vector3(), col = new T.Color();
    let k = 0; const base = at(wx, wz);
    for (let r = 0; r < rows; r++) for (let j = 0; j < per; j++) {
      const off = (r % 2) * 0.29, lx = -len / 2 + j * 0.58 + off + 0.29;
      if (r % 2 && j === per - 1) s.set(0, 0, 0); else s.set(1 + rand() * 0.12, 1 + rand() * 0.25, 1 + rand() * 0.15);
      pos.set(lx, 0.13 + r * 0.25, (rand() - 0.5) * 0.06);
      q.setFromEuler(new T.Euler((rand() - 0.5) * 0.12, (rand() - 0.5) * 0.18, (rand() - 0.5) * 0.1));
      m.compose(pos, q, s); im.setMatrixAt(k, m); im.setColorAt(k, col.setHSL(0.1, 0.22 + rand() * 0.1, 0.8 + rand() * 0.12)); k++;
    }
    im.position.copy(base); im.rotation.y = rotY || 0;
    if (decor) { im.castShadow = im.receiveShadow = true; scene.add(im); return im; }
    return addCover(im, { top: base.y + rows * 0.25 + 0.1 });
  }
  function crate(i, x, d, size, rotY, onTop) {
    if (!crateMat) crateMat = new T.MeshStandardMaterial({ map: TEX.crate, roughness: 0.85 });
    const [wx, wz] = LW(i, x, d);
    const m = new T.Mesh(new T.BoxGeometry(size, size * 0.8, size * 0.8), crateMat);
    const y0 = onTop ? onTop.position.y + onTop.userData.cover.size * 0.4 : groundH(wx, wz);
    m.position.set(wx, y0 + size * 0.4, wz); m.rotation.y = rotY || 0;
    addCover(m, { kind: 'crate', hp: 5, size, top: m.position.y + size * 0.4 });
    if (onTop) { onTop.userData.cover.above = m; m.userData.cover.on = onTop; }
    return m;
  }
  function rock(i, x, d, s, seed, sy) {
    if (!rockMat) { const t = TEX.rock; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2.5, 1.6); rockMat = new T.MeshStandardMaterial({ map: t, roughness: 0.9, color: new T.Color(LD.rockTint || '#b89a78') }); }
    const [wx, wz] = LW(i, x, d);
    const g = new T.SphereGeometry(1, 40, 28); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const v = new T.Vector3(p.getX(k), p.getY(k), p.getZ(k)); const n = 0.7 + fbm(v.x * 1.3 + seed, v.y * 1.3 + v.z * 0.9) * 0.6 + vnoise(v.x * 6 + seed, v.z * 6 + v.y) * 0.06; v.multiplyScalar(n); if (v.y < -0.15) v.y = -0.15; v.y *= v.y > 0 ? 0.85 + vnoise(seed, v.x) * 0.3 : 1; p.setXYZ(k, v.x, v.y, v.z); }
    g.computeVertexNormals(); g.computeBoundingBox();
    const m = new T.Mesh(g, rockMat); const b = at(wx, wz); m.position.set(wx, b.y + 0.1 * s, wz); m.scale.set(s * 1.3, s * 0.85 * (sy || 1), s); m.rotation.y = seed;
    return addCover(m, { top: m.position.y + g.boundingBox.max.y * s * 0.85 * (sy || 1) });
  }
  function barrel(i, x, d) {
    if (!barrelMat) {
      const t = canvasTex(256, (c, s) => { c.fillStyle = '#8a2a1e'; c.fillRect(0, 0, s, s); for (let k = 0; k < 160; k++) { c.fillStyle = `rgba(${90 + rand() * 60},${50 + rand() * 30},20,${rand() * 0.4})`; c.fillRect(rand() * s, rand() * s, 2 + rand() * 8, 6 + rand() * 30); } c.fillStyle = 'rgba(0,0,0,0.35)'; [0.22, 0.5, 0.78].forEach(y => c.fillRect(0, y * s, s, 8)); c.fillStyle = 'rgba(240,220,160,0.9)'; c.font = 'bold 44px Arial'; c.fillText('FUEL', 64, 150); c.fillStyle = 'rgba(255,200,40,0.9)'; c.beginPath(); c.moveTo(200, 100); c.lineTo(230, 160); c.lineTo(170, 160); c.fill(); });
      barrelMat = new T.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.45 });
    }
    const [wx, wz] = LW(i, x, d);
    const m = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.92, 20), barrelMat); const b = at(wx, wz); m.position.set(wx, b.y + 0.46, wz); m.rotation.y = rand() * 6;
    return addCover(m, { kind: 'barrel', hp: 3, top: b.y + 0.92 });
  }
  function wall(i, x, d, w, h, rotY, depth) {
    if (!wallMat) { const t = TEX.t_wall; t.wrapS = t.wrapT = T.RepeatWrapping; wallMat = new T.MeshStandardMaterial({ map: t, roughness: 0.9, color: new T.Color(LD.wallTint || '#f2e4cc') }); }
    const [wx, wz] = LW(i, x, d); const dp = depth || 0.7;
    const g = new T.BoxGeometry(w, h, dp); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 2.2, uv.getY(k) * h / 2.2);
    const m = new T.Mesh(g, wallMat); m.position.set(wx, groundH(wx, wz) + h / 2 - 0.1, wz); m.rotation.y = rotY || 0;
    return addCover(m, { top: m.position.y + h / 2 });
  }
  function card(key, wx, wz, scale, rotY, asCover, tint) {
    const sp = SPRITES[key];
    const geo = new T.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: TEX[sp.f], alphaTest: 0.45, side: T.DoubleSide, color: tint ? new T.Color(tint) : CARD_TINT.clone() }));
    const h = sp.h * (scale || 1); m.scale.set(h * sp.aspect, h, 1); m.position.set(wx, groundH(wx, wz) - 0.15, wz); m.rotation.y = rotY || 0;
    m.castShadow = true; m.userData.sprite = sp; m.userData.h = h;
    if (asCover) { m.userData.cover = { top: m.position.y + h * 0.75 }; COVERS.push(m); }
    scene.add(m); return m;
  }
  function buildWorld() {
    STOPS.forEach((s, i) => { if (!LD.scenes[i].noPlayerCover) sandbags(i, 0.2, 1.75, 3.6, 3, 0, true); });
    LD.scenes.forEach((sc, i) => {
      const A = {
        sb: (x, d, len, rows, rot) => sandbags(i, x, d, len, rows || 4, rot || 0),
        crate: (x, d, size, rot, on) => crate(i, x, d, size || 1, rot || 0, on),
        rock: (x, d, s, seed, sy) => rock(i, x, d, s, seed || (x * 1.7 + d), sy),
        barrel: (x, d) => barrel(i, x, d),
        wall: (x, d, w, h, rot, depth) => wall(i, x, d, w, h, rot, depth),
        card: (key, x, d, scale, rot, cover, tint) => { const [wx, wz] = LW(i, x, d); return card(key, wx, wz, scale, rot, cover, tint); },
        smoke: (x, d, rate) => { const [wx, wz] = LW(i, x, d); SMOKERS.push({ pos: new T.Vector3(wx, groundH(wx, wz) + 2, wz), rate: rate || 4 }); },
      };
      sc.build(A);
    });
    (LD.far || []).forEach(([key, x, z, sc, smoke]) => { const c = card(key, x, z, sc || 1.2, rand(), false, '#7a6a5a'); if (smoke) SMOKERS.push({ pos: new T.Vector3(x, groundH(x, z) + 2.5, z), rate: 5 }); });
  }

  // ---------- נשקים ----------
  const WEAPONS = {
    uzi: { name: 'עוזי', mag: 32, rate: 95, auto: true, dmg: 1, spread: 0.012, sound: 'smg', reload: 1100 },
    fal: { name: 'FN FAL', mag: 20, rate: 230, auto: false, dmg: 3.2, spread: 0, sound: 'rifle', reload: 1500, reserve: 40, pierce: true },
    mag: { name: 'מקלע MAG', mag: 100, rate: 70, auto: true, dmg: 1.7, spread: 0.02, sound: 'mg', reload: 2300, reserve: 100 },
    grenade: { name: 'רימונים', mag: 6, rate: 650, auto: false, dmg: 12, sound: 'throw', reload: 0, reserve: 0, thrown: true },
  };
  const ORDER = ['uzi', 'fal', 'mag', 'grenade'];
  function weapon(k, base) { const d = WEAPONS[k]; return { k, d, ammo: k === 'grenade' ? 3 : d.mag, reserve: base ? Infinity : (d.reserve || 0), reloading: false, rt: 0, last: 0, base, recoil: 0 }; }
  const curW = () => L.inv[L.cur] || L.inv.uzi;
  function switchTo(k) { if (!L.inv[k] || L.cur === k) return; const w = curW(); w.reloading = false; L.cur = k; L.swapT = 0.35; S.play('reload'); }
  function cycle(dir) { const own = ORDER.filter(k => L.inv[k]); const i = own.indexOf(L.cur); switchTo(own[(i + dir + own.length) % own.length]); }
  function giveWeapon(k) {
    if (L.inv[k]) { const w = L.inv[k]; if (k === 'grenade') w.ammo = Math.min(w.d.mag, w.ammo + 3); else w.reserve += WEAPONS[k].reserve; }
    else L.inv[k] = weapon(k, false);
    switchTo(k);
  }

  // ---------- הישגים ----------
  function stat(k, n) { if (!PF) return; PF.totals = PF.totals || {}; PF.totals[k] = (PF.totals[k] || 0) + (n || 1); }
  function achieve(id) { if (!PF || !window.PROFILE) return; if (PROFILE.unlock(PF, id)) { const a = PROFILE.ACH.find(x => x.id === id); L.toasts.push({ t: 3.4, title: a.name, desc: a.desc }); S.play('clear'); PROFILE.save(PF); } }
  function checkTotals() { if (!PF) return; const t = PF.totals || {}; if ((t.heads || 0) >= 25) achieve('headhunter'); if ((t.barrels || 0) >= 10) achieve('demolition'); if ((t.intercepts || 0) >= 5) achieve('interceptor'); if ((t.kills || 0) >= 1) achieve('first_blood'); }

  // ---------- מצב משחק ----------
  const G = { mx: W / 2, my: H / 2, down: false, pressed: false, duck: false, t: 0, screen: 'loading', shake: 0, dmg: 0, flash: 0 };
  let L = null;
  const ENTS = [], PROJS = [], ITEMS = [], POPS = [], MYNADES = [];

  function startGame(cp) {
    L = { scene: -1, lives: DIFF.lives, max: DIFF.lives, score: 0, shots: 0, hits: 0, kills: 0, heads: 0, neutral: 0, combo: 0, maxCombo: 0, dmgTaken: 0, blocked: 0, civHit: 0, multi: 0,
      inv: { uzi: weapon('uzi', true) }, cur: 'uzi', swapT: 0, duckK: 0, slowT: 0, radio: null, hint: null, phase: 'move', pt: 0, time: 0, toasts: [], flareT: 4, hitDirs: [], nadeWarned: false };
    ENTS.length = 0; PROJS.length = 0; ITEMS.length = 0;
    G.screen = 'play'; showScreen(null);
    S.init(); S.startMusic('six');
    if (cp) {
      Object.assign(L, cp.stats || {}); L.score = cp.score; L.lives = Math.max(2, cp.lives); L.max = Math.max(L.max, L.lives); L.inv = {};
      Object.keys(cp.inv || {}).forEach(k => { if (!WEAPONS[k]) return; const w = weapon(k, k === 'uzi'); w.ammo = cp.inv[k].ammo; if (k !== 'uzi') w.reserve = cp.inv[k].reserve; L.inv[k] = w; });
      if (!L.inv.uzi) L.inv.uzi = weapon('uzi', true);
      L.cur = L.inv[cp.cur] ? cp.cur : 'uzi'; L.fromCp = true;
    }
    (LD.startWeapons || []).forEach(k => { if (!L.inv[k]) L.inv[k] = weapon(k, false); });
    const tgt = cp ? cp.scene : 0;
    L.cam = { a: cp ? stopPos(tgt).add(new T.Vector3(-6, 7, 14)) : stopPos(0).add(new T.Vector3(-14, 14, 38)), ay: cp ? 0.3 : 0.5, b: stopPos(tgt), by: STOPS[tgt].yaw, t: 0, dur: cp ? 2.4 : 3.6, intro: true }; L.next = tgt;
    if (PF) { PROFILE.level(PF, LV).plays++; PROFILE.save(PF); }
  }
  function stopPos(i) { const p = STOPS[i].pos; return new T.Vector3(p[0], groundH(p[0], p[1]) + 1.65, p[1]); }
  function saveCheckpoint() {
    if (!PF || L.scene < 0) return;
    const inv = {}; Object.keys(L.inv).forEach(k => { const w = L.inv[k]; if (w) inv[k] = { ammo: w.ammo, reserve: w.base ? null : w.reserve }; });
    PROFILE.level(PF, LV).checkpoint = { scene: L.scene, score: L.score, lives: L.lives, inv, cur: L.cur, at: Date.now(), diff: DKEY,
      stats: { shots: L.shots, hits: L.hits, kills: L.kills, heads: L.heads, neutral: L.neutral, dmgTaken: L.dmgTaken, blocked: L.blocked, maxCombo: L.maxCombo, civHit: L.civHit } };
    PROFILE.save(PF);
  }
  function checkpoint() { return PF ? PROFILE.level(PF, LV).checkpoint : null; }
  function reloadInto(mode) { try { sessionStorage.setItem('kav-start', mode); } catch (e) { } location.reload(); }
  function pause() {
    if (G.screen !== 'play' || !L) return;
    G.screen = 'pause'; G.duck = false; G.duckLock = false; G.down = false; S.stopMusic();
    $('pause-text').textContent = L.scene >= 0 ? `${NAME}, אתה באזור ${L.scene + 1} מתוך ${NSC} עם ${L.score.toLocaleString('he-IL')} נקודות. אם תצא עכשיו, תחזור לתחילת האזור הזה עם הניקוד והנשקים שהיו לך בו.` : `${NAME}, השלב עוד לא התחיל.`;
    showScreen('pause');
  }
  function resumeGame() { if (G.screen !== 'pause') return; G.screen = 'play'; showScreen(null); last = performance.now(); S.startMusic('six'); }

  function beginScene(i) { if (G.duckLock) { G.duckLock = false; G.duck = false; }
    const sc = LD.scenes[i];
    L.scene = i; L.phase = 'fight'; L.pt = 0;
    saveCheckpoint();
    L.queue = sc.wave.slice(); L.spawnT = 0.8; L.maxActive = clamp(Math.min(5, 2 + Math.ceil(i / 2)) + DIFF.extra + (sc.maxActiveAdd || 0), 1, 6); L.crate = false;
    sc.spots.forEach(s => { s.busy = false; if (s.k === 'pop' || s.k === 'prone') s.top = coverTopAt(i, s); });
    markVisible(i);
    if (LD.boss && LD.boss.scene === i) L.bossT = 2.5;
    hint(`אזור ${i + 1} מתוך ${NSC}: ${sc.name}`);
    radio(fill(sc.radio), `l${LEVEL_NO}s${i}`);
    if (sc.tip) setTimeout(() => { if (L && L.scene === i) hint(isTouch ? (sc.tipTouch || sc.tip) : sc.tip); }, 3200);
  }
  // מסמן אילו נקודות הופעה נמצאות בתוך המסך מעמדת המצלמה, כדי שאף אחד לא יירה מחוץ לתמונה
  const visCam = new T.PerspectiveCamera(37, W / H, 0.1, 1200), visV = new T.Vector3();
  function inView(x, y, z) { visV.set(x, y, z).project(visCam); return visV.z < 1 && Math.abs(visV.x) < 0.86 && visV.y > -0.72 && visV.y < 0.88; }
  function markVisible(i) {
    visCam.position.copy(stopPos(i)); visCam.rotation.set(0, STOPS[i].yaw, 0, 'YXZ'); visCam.updateMatrixWorld(); visCam.updateProjectionMatrix();
    LD.scenes[i].spots.forEach(s => {
      if (s.k === 'run') {
        const xs = []; for (let k = 0; k <= 40; k++) { const lx = lerp(s.x0, s.x1, k / 40), [x, z] = LW(i, lx, s.d); if (inView(x, groundH(x, z) + 1.3, z)) xs.push(x); }
        s.visX = xs.length > 3 ? [Math.min(...xs), Math.max(...xs)] : null; s.vis = !!s.visX; return;
      }
      const [x, z] = LW(i, s.k === 'side' ? s.x + s.dx : s.x, s.d), gy = groundH(x, z);
      const hy = s.k === 'pop' ? gy + (s.top || 1.1) + 0.8 : s.k === 'prone' ? gy + (s.top || 1.5) + 0.5 : s.k === 'win' ? gy + s.sill + 0.6 : gy + 1.2;
      s.vis = inView(x, hy, z);
    });
  }
  function coverTopAt(i, s) {
    if (s.top0 === undefined) s.top0 = s.top;
    const [x, z] = LW(i, s.x, s.d), gy = groundH(x, z), cam = STOPS[i].pos;
    let best = -1;
    COVERS.forEach(o => {
      const c = o.userData.cover; if (!c.top || c.dead) return;
      if (Math.hypot(o.position.x - x, o.position.z - z) > 2.8) return;
      if (Math.hypot(o.position.x - cam[0], o.position.z - cam[1]) > Math.hypot(x - cam[0], z - cam[1]) + 0.3) return;
      best = Math.max(best, c.top - gy);
    });
    return best > 0 ? best : s.top0;
  }
  function radio(text, voiceKey) { L.radio = { text, t: 3.8 }; S.play('radio'); if (voiceKey) setTimeout(() => playVoice(voiceKey, true), 180); }
  function hint(text, big) { L.hint = { text, t: 2.8, big }; }
  function pop(text, pos3, col, size) { POPS.push({ text, p: pos3.clone(), col: col || '#fff', t: 1.1, size: size || 1 }); }

  // ---------- אויבים ----------
  const spotsOf = () => LD.scenes[L.scene].spots;
  function freeSpot(kinds) { const c = spotsOf().filter(s => !s.busy && s.vis !== false && kinds.includes(s.k)); return c.length ? c[Math.floor(rand() * c.length)] : null; }
  function aimTime(e) { const m = { heavy: 1.15, jeep: 1.3, officer: 0.8, prone: 0.9, bunker: 1.1, win: 0.95 }[e.type] || 1; return 2.0 * m * DIFF.aim * (LD.aimMult || 1) * (0.9 + rand() * 0.3); }
  function makeCard() {
    const geo = new T.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ alphaTest: 0.5, side: T.DoubleSide, color: CARD_TINT.clone() }));
    m.castShadow = true; scene.add(m); return m;
  }
  const SHOW = { aim: 0.98, gunner: 1.05, throw: 1.2, surrender: 1.25, idle: 1.2, kneel: 0.95, officer: 1.2, prone: 0.62, target: 1.25, targetCiv: 1.25, civMan: 1.2, civWoman: 1.2 };
  function setPose(e, key) {
    const sp = SPRITES[key]; e.pose = key; e.sp = sp;
    e.mesh.material.map = TEX[sp.f]; e.mesh.material.needsUpdate = true;
    const h = sp.h * (e.scale || 1); e.mesh.scale.set(h * sp.aspect * (e.flipX ? -1 : 1), h, 1); e.h = h; e.sx = e.mesh.scale.x;
    const k = e.spot && e.spot.k;
    if (k === 'pop' || k === 'prone') { const gy = e.base.y; e.upY = gy + e.spot.top - h + (SHOW[key] || 1); e.downY = gy + Math.min(e.spot.top, 1) - h - 0.15; }
    else if (k === 'win') { e.upY = e.clipY - h + (SHOW[key] || 1) + 0.05; e.downY = e.clipY - h - 0.1; }
    else if (e.base) { e.upY = e.base.y - 0.05; e.downY = e.base.y - h - 0.1; }
  }
  function specOf(s) { return typeof s === 'string' ? { t: s } : s; }

  function spawn(raw) {
    const sp0 = specOf(raw), type = sp0.t, i = L.scene, sc = LD.scenes[i];
    if (type === 'jeep') {
      const dir = rand() < 0.5 ? 1 : -1, [lx, z] = LW(i, 0, (sc.jeepD || 18) + rand() * 1.5);
      // הג'יפ עוצר רק במקום שרואים אותו
      const xs = []; for (let k = -12; k <= 12; k++) { const x = lx + k; if (inView(x - 1.6, groundH(x, z) + 2.4, z) && inView(x + 1.6, groundH(x, z) + 2.4, z)) xs.push(x); }
      const stopX = xs.length ? lerp(Math.min(...xs), Math.max(...xs), 0.3 + rand() * 0.4) : lx;
      const e = { type: 'jeep', hp: 16, max: 16, state: 'drive', t: 0, dir, z, x: lx + (dir > 0 ? -30 : 34), stopX, hostile: true, flash: 0 };
      e.mesh = makeCard(); e.flipX = dir < 0; setPose(e, 'jeep');
      e.mesh.position.set(e.x, groundH(e.x, z), z); ENTS.push(e); S.play('alert'); radio('ג׳יפ עם מקלע! השמד אותו!', 'jeep'); return true;
    }
    if (type === 'bunker') {
      const [x, z] = LW(i, sp0.x || 0, sp0.d || 21);
      const e = { type: 'bunker', hp: sp0.hp || 40, max: sp0.hp || 40, state: 'fight', t: 0, timer: 2, aim: 0, aimDur: 0, hostile: true, flash: 0, scale: sp0.scale || 1 };
      e.mesh = makeCard(); setPose(e, sp0.sprite || 'bunker'); e.mesh.position.set(x, groundH(x, z) - 0.2, z);
      ENTS.push(e); return true;
    }
    let sp;
    const civ = type === 'civ' || type === 'targetCiv', target = type === 'target' || type === 'targetCiv';
    if (type === 'runner' || (type === 'civ' && sp0.run)) sp = freeSpot(['run']);
    else if (type === 'prone') sp = freeSpot(['prone']);
    else if (type === 'win') sp = freeSpot(['win']);
    else if (type === 'officer') sp = freeSpot(['open']) || freeSpot(['side']);
    else if (type === 'heavy') sp = freeSpot(['open', 'pop']);
    else if (type === 'grenadier') sp = freeSpot(['pop', 'open']);
    else if (target) sp = freeSpot(['pop', 'side', 'open']);
    else if (type === 'civ') sp = freeSpot(['open', 'side', 'win']);
    else sp = freeSpot(['pop', 'side', 'open', 'prone', 'win']);
    if (!sp && !civ) sp = freeSpot(['pop', 'side', 'open', 'prone', 'win']);
    if (!sp) return false;
    sp.busy = true;
    const e = { type, spot: sp, hp: type === 'heavy' ? 6 : 2, max: type === 'heavy' ? 6 : 2, state: 'wait', t: 0, delay: 0.1 + rand() * 0.4, k: 0, shots: 0, maxShots: 2 + Math.floor(rand() * 2), hostile: !civ, civ, target, flash: 0, scale: 0.97 + rand() * 0.08, seed: rand() * 10, life: target ? 2.4 + rand() * 0.8 : 3.2 };
    if (!civ && !target) { if (sp.k === 'prone') e.type = 'prone'; if (sp.k === 'run') e.type = 'runner'; if (sp.k === 'win') e.type = 'win'; }
    e.mesh = makeCard();
    if (sp.k === 'win') {
      const [x, z] = LW(i, sp.x, sp.d); const gy = groundH(x, z); e.base = new T.Vector3(x, gy, z); e.clipY = gy + sp.sill;
      e.mesh.material.clippingPlanes = [new T.Plane(new T.Vector3(0, 1, 0), -e.clipY), new T.Plane(new T.Vector3(1, 0, 0), -(x - sp.w / 2)), new T.Plane(new T.Vector3(-1, 0, 0), x + sp.w / 2)];
    }
    if (sp.k === 'run') { const [x0] = LW(i, sp.x0, sp.d), [x1, z] = LW(i, sp.x1, sp.d); e.dir = rand() < 0.5 ? 1 : -1; e.rx0 = x0; e.rx1 = x1; e.z = z; e.x = e.dir > 0 ? x0 : x1; e.stopX = sp.visX ? lerp(sp.visX[0], sp.visX[1], 0.25 + rand() * 0.5) : lerp(x0, x1, 0.3 + rand() * 0.4); e.state = 'run'; e.k = 1; e.base = at(e.x, z); e.flipX = e.dir < 0 && !civ; setPose(e, civ ? (rand() < 0.5 ? 'civMan' : 'civWoman') : 'run'); }
    else {
      if (!e.base) { const [x, z] = LW(i, sp.x, sp.d); e.base = at(x, z); }
      if (sp.k === 'side') { e.x0 = e.base.x; e.x1 = e.base.x + sp.dx; }
      const pose = type === 'target' ? 'target' : type === 'targetCiv' ? 'targetCiv' : type === 'civ' ? (rand() < 0.5 ? 'civMan' : 'civWoman') : e.type === 'prone' ? 'prone' : e.type === 'heavy' ? 'gunner' : e.type === 'grenadier' ? 'throw' : e.type === 'officer' ? 'officer' : sp.k === 'pop' || sp.k === 'win' ? 'aim' : sp.k === 'side' ? 'kneel' : 'idle';
      setPose(e, pose);
    }
    if (e.hostile && !target && (L.lifeDue || rand() < DIFF.carry * (e.type === 'officer' || e.type === 'heavy' ? 2.5 : 1))) { e.carry = true; L.lifeDue = false; }
    placeEnt(e); ENTS.push(e);
    if (type === 'civ') { const fem = e.pose === 'civWoman'; setTimeout(() => { if (e.state !== 'gone' && e.state !== 'dead') playVoice(rand() < 0.5 ? (fem ? 'help_f' : 'help_m') : (fem ? 'dontshoot_f' : 'dontshoot_m')); }, 300); }
    return true;
  }

  function placeEnt(e) {
    const m = e.mesh, sp = e.spot;
    if (e.type === 'jeep') { m.position.set(e.x, groundH(e.x, e.z) - 0.1, e.z); return; }
    if (sp && sp.k === 'side') { const x = lerp(e.x0, e.x1, ease(e.k)); m.position.set(x, groundH(x, e.base.z) - 0.05, e.base.z); }
    else if (sp && sp.k === 'run') { m.position.set(e.x, groundH(e.x, e.z) - 0.05 + (e.pose === 'run' || e.civ ? Math.abs(Math.sin(G.t * 11)) * 0.07 : 0), e.z); }
    else m.position.set(e.base.x, lerp(e.downY, e.upY, ease(e.k)), e.base.z);
  }
  function localPt(e, uv) { return e.mesh.localToWorld(new T.Vector3(uv[0] - 0.5, 1 - uv[1], 0.05)); }
  function muzzleWorld(e) { return e.sp.muzzle ? localPt(e, e.sp.muzzle) : e.mesh.localToWorld(new T.Vector3(0, 0.7, 0)); }
  function headWorld(e) { const hb = e.sp.head || [0.4, 0, 0.6, 0.15]; return localPt(e, [(hb[0] + hb[2]) / 2, (hb[1] + hb[3]) / 2]); }
  function face(m, k) { m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z) * (k || 1); }

  // אנימציה: נשימה, רתע, רעד מפגיעה והטיה ביציאה מהמחסה
  function animate(e, dt) {
    const m = e.mesh; e.kick = Math.max(0, (e.kick || 0) - dt * 7); e.flinch = Math.max(0, (e.flinch || 0) - dt * 5);
    const breathe = 1 + Math.sin(G.t * 2.3 + (e.seed || 0)) * 0.012;
    m.scale.y = e.h * breathe * (1 - e.kick * 0.03); m.scale.x = e.sx * (1 + e.kick * 0.02);
    let rz = Math.sin(G.t * 1.1 + (e.seed || 0)) * 0.012 + (e.flinchDir || 1) * e.flinch * 0.16 + e.kick * 0.04;
    if (e.spot && e.spot.k === 'side' && (e.state === 'emerge' || e.state === 'duck')) rz += Math.sin(e.k * Math.PI) * 0.12 * -Math.sign(e.spot.dx);
    if (e.pose === 'run') rz += Math.sin(G.t * 11) * 0.05;
    m.rotation.z = rz;
    if (e.kick > 0) { const back = new T.Vector3().subVectors(m.position, camera.position).setY(0).normalize().multiplyScalar(e.kick * 0.05); m.position.add(back); }
  }

  function updEnt(e, dt) {
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    const m = e.mesh; face(m);
    const f = Math.max(0, e.flash) * 8;
    if (!(e.state === 'dead' && (e.type === 'jeep' || e.type === 'bunker'))) m.material.color.setRGB(CARD_TINT.r * (1 + flareK * 0.6) + f, CARD_TINT.g * (1 + flareK * 0.6) + f, CARD_TINT.b * (1 + flareK * 0.5) + f);
    if (e.type === 'jeep') return updJeep(e, dt);
    if (e.type === 'bunker') return updBunker(e, dt);
    switch (e.state) {
      case 'wait': if (e.t > e.delay) { e.state = 'emerge'; e.t = 0; } break;
      case 'emerge': e.k = Math.min(1, e.k + dt / (e.target ? 0.22 : 0.38)); if (e.k >= 1) { e.state = e.civ || e.target ? 'idle' : 'pre'; e.t = 0; } break;
      case 'idle': if (e.t > e.life) { e.state = 'duck'; e.t = 0; } break;
      case 'pre':
        if (e.t > 0.25) {
          if (e.type === 'grenadier' && !e.thrown) { e.state = 'throw'; e.t = 0; break; }
          if (e.spot.k === 'open' && e.pose === 'idle') setPose(e, 'kneel');
          if (e.pose === 'throw') setPose(e, e.spot.k === 'pop' ? 'aim' : 'kneel');
          e.state = 'aim'; e.t = 0; e.aim = aimTime(e) + (e.first ? 0 : 0.3); e.first = true; S.play('alert');
        }
        break;
      case 'throw': if (e.t > 0.55 && !e.thrown) { e.thrown = true; e.kick = 1; throwGrenadeAtPlayer(muzzleWorld(e)); } if (e.t > 0.9) { e.state = 'duck'; e.t = 0; } break;
      case 'aim': if (e.t >= e.aim) { enemyFire(e); e.state = 'fire'; e.t = 0; } break;
      case 'fire':
        if (e.t > 0.15) {
          e.shots++;
          if (e.spot.k === 'run') e.state = 'run2';
          else if (e.shots >= e.maxShots && e.spot.k !== 'open') { e.state = 'duck'; e.t = 0; }
          else { e.state = 'aim'; e.t = 0; e.aim = aimTime(e) * 0.85; }
        }
        break;
      case 'duck': e.k = Math.max(0, e.k - dt / 0.28); if (e.k <= 0) {
        if (e.civ || e.target) { e.state = 'gone'; if (e.spot) e.spot.busy = false; break; }
        e.state = 'wait'; e.t = 0; e.delay = 0.8 + rand() * 1.4; e.shots = 0; e.maxShots = 1 + Math.floor(rand() * 3); if (e.type === 'grenadier') { e.thrown = rand() < 0.5; setPose(e, e.thrown ? (e.spot.k === 'pop' ? 'aim' : 'kneel') : 'throw'); }
      } break;
      case 'run': case 'run2': {
        e.x += e.dir * (e.civ ? 3.2 : 4.4) * dt;
        if (!e.civ && e.state === 'run' && ((e.dir > 0 && e.x > e.stopX) || (e.dir < 0 && e.x < e.stopX))) { e.flipX = false; setPose(e, 'kneel'); e.state = 'aim'; e.t = 0; e.aim = aimTime(e) * 0.9; }
        if (e.state === 'run2' && e.pose !== 'run') { e.flipX = e.dir < 0; setPose(e, 'run'); }
        if (e.x < Math.min(e.rx0, e.rx1) - 2 || e.x > Math.max(e.rx0, e.rx1) + 2) { e.state = 'gone'; e.spot.busy = false; }
        if (rand() < dt * 6) sandPuff(m.position.clone(), 0.4);
        break;
      }
      case 'surrender': e.t2 = (e.t2 || 0) + dt; if (e.t2 > 1.3) { e.k = Math.max(0, e.k - dt * 2); if (!e.spot || ['run', 'open', 'side'].includes(e.spot.k)) { m.material.transparent = true; m.material.opacity = e.k; } if (e.k <= 0) e.state = 'gone'; } break;
      case 'dead': {
        e.vel.y -= 9 * dt; m.position.addScaledVector(e.vel, dt);
        const gy = groundH(m.position.x, m.position.z) - 0.2;
        if (m.position.y < gy) { m.position.y = gy; if (!e.landed) { e.landed = true; sandPuff(m.position.clone(), 1); } e.vel.set(0, 0, 0); }
        e.rot = Math.min(1.45, (e.rot || 0) + dt * 4); m.rotation.z = e.rot * e.fall;
        e.fade += dt; if (e.fade > 1.4) { m.material.transparent = true; m.material.opacity = Math.max(0, 1 - (e.fade - 1.4) / 0.6); if (e.fade > 2) e.state = 'gone'; }
        return;
      }
    }
    if (e.state === 'surrender' && e.spot && ['run', 'open', 'side'].includes(e.spot.k)) { animate(e, dt); return; }
    if (e.state !== 'dead' && e.state !== 'gone') { placeEnt(e); animate(e, dt); }
  }

  function updJeep(e, dt) {
    if (e.state === 'drive') { const dx = e.stopX - e.x; e.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 9); if (Math.abs(dx) < 0.05) { e.state = 'aim'; e.t = 0; e.aim = aimTime(e); } if (rand() < dt * 30) sandPuff(e.mesh.position.clone().add(new T.Vector3(-e.dir * 1.6, 0.2, 0)), 1.2); }
    else if (e.state === 'aim') { if (e.t >= e.aim) { enemyFire(e); e.t = 0; e.aim = aimTime(e) * 0.85; } }
    else if (e.state === 'dead') { burn(e.mesh.position, dt, 2); return; }
    placeEnt(e); e.mesh.position.y += Math.sin(G.t * 18) * (e.state === 'drive' ? 0.03 : 0.005);
  }
  function updBunker(e, dt) {
    if (e.state === 'dead') { burn(e.mesh.position.clone().add(new T.Vector3(0, 1.2, 0)), dt, 2.5); return; }
    e.timer -= dt;
    if (e.timer <= 0 && !e.aimDur) { e.aimDur = aimTime(e); e.aim = 0; }
    if (e.aimDur) { e.aim += dt; if (e.aim >= e.aimDur) { enemyFire(e); e.aimDur = 0; e.timer = 1.4 + rand(); } }
  }
  function burn(p, dt, k) { if (rand() < dt * 10) smoke(p.clone().add(new T.Vector3((rand() - 0.5) * k, 1.5, 0)), 1.4 * k / 2, true); if (rand() < dt * 14) fire(p.clone().add(new T.Vector3((rand() - 0.5) * k, 0.8 + rand(), 0.2)), 0.8); }

  function enemyFire(e) {
    const p = muzzleWorld(e); e.kick = 1;
    flashAt(p, e.type === 'jeep' || e.type === 'bunker' ? 1.6 : e.type === 'officer' ? 0.8 : 1.1);
    S.play(e.type === 'heavy' || e.type === 'bunker' ? 'mg' : 'enemyShot');
    tracer3(p, camera.position.clone().add(new T.Vector3((rand() - 0.5) * 0.6, -0.3, 0)), '#ffcf80');
    playerHit(false, p);
  }
  function ducked() { return L && L.duckK > 0.55; }
  // כיוון ביחס למצלמה: 0 קדימה, חיובי ימינה
  const camQ = new T.Quaternion();
  function dirAngle(pos) { camQ.copy(camera.quaternion).invert(); const v = pos.clone().sub(camera.position).applyQuaternion(camQ); return Math.atan2(v.x, -v.z); }
  function playerHit(isPenalty, from) {
    if (G.screen !== 'play' || (L.phase !== 'fight' && !isPenalty)) return;
    if (from) L.hitDirs.push({ a: dirAngle(from), t: 1.4, blocked: ducked() });
    if (from && !ducked() && !L.dirTip) { L.dirTip = true; setTimeout(() => { if (L) hint('הקשת האדומה מראה מאיפה ירו. חץ בקצה המסך מראה איום שלא רואים'); }, 400); }
    if (ducked() && !isPenalty) {
      L.blocked++; const sb = camera.position.clone().add(new T.Vector3((rand() - 0.5) * 1.6, -0.1 + rand() * 0.3, -1.6)); sandPuff(sb, 0.5); sparks(sb, 4);
      if (rand() < 0.4) S.play('ricochet'); return;
    }
    L.lives--; L.dmgTaken++; L.combo = 0; G.dmg = 1; G.shake = Math.max(G.shake, 0.6); S.play('hurt');
    if (!isPenalty && rand() < 0.35) { const k = rand() < 0.5; radio(k ? 'נפגעת! תתכופף!' : 'חובש! לפה!', k ? 'hurt1' : 'hurt2'); }
    if (L.lives <= 0) { L.lives = 0; G.screen = 'dying'; setTimeout(gameOver, 900); }
  }

  // ---------- בוסים: טנק ומבצר ----------
  function makeBoss() {
    const B = LD.boss, i = B.scene;
    if (B.type === 'tank') {
      const [x, z] = LW(i, B.from[0], B.from[1]), [tx, tz] = LW(i, B.to[0], B.to[1]);
      const e = { type: 'tank', name: 'טנק כבד', state: 'drive', t: 0, x, z, tx, tz, hostile: true, flash: 0, sway: 4, parts: [
        { id: 'turret', u: 0.47, v: 0.22, r: 0.075, hp: 55 + (B.hpAdd || 0), core: true, alive: true },
        { id: 'mg', u: 0.84, v: 0.55, r: 0.05, hp: 14, alive: true, aim: 0, aimDur: 0, timer: 3, fire: 'aim' },
      ], shellT: 4.5, shellPart: 'turret' };
      e.parts.forEach(p => p.max = p.hp);
      e.mesh = makeCard(); e.scale = 1.3; setPose(e, 'tank'); e.mesh.position.set(x, groundH(x, z), z);
      ENTS.push(e); L.boss = e; S.play('alert'); hint('טנק כבד!', true); radio('טנק! כוון לצריח ולמקלע. את הפגזים אפשר ליירט!', 'tank');
    } else {
      const [x, z] = LW(i, B.at[0], B.at[1]);
      const e = { type: 'tank', name: 'המוצב האחרון', fort: true, state: 'fight', t: 0, x, z, tx: x, tz: z, hostile: true, flash: 0, sway: 0, parts: [
        { id: 's1', u: 0.2, v: 0.6, r: 0.05, hp: 22, alive: true, aim: 0, aimDur: 0, timer: 2.5, fire: 'aim' },
        { id: 's2', u: 0.345, v: 0.6, r: 0.05, hp: 22, alive: true, aim: 0, aimDur: 0, timer: 3.4, fire: 'aim' },
        { id: 's3', u: 0.5, v: 0.6, r: 0.05, hp: 22, alive: true, aim: 0, aimDur: 0, timer: 4.1, fire: 'aim' },
        { id: 'cannon', u: 0.43, v: 0.13, r: 0.07, hp: 50, core: true, alive: true, lockedBy: ['s1', 's2', 's3'] },
      ], shellT: 5.5, shellPart: 'cannon' };
      e.parts.forEach(p => p.max = p.hp);
      e.mesh = makeCard(); e.scale = B.scale || 1.2; setPose(e, 'fort'); e.mesh.position.set(x, groundH(x, z) - 0.3, z);
      ENTS.push(e); L.boss = e; S.play('alert'); hint('המוצב האחרון!', true); radio(fill(B.radio || 'שלושה חרכים ותותח. קודם החרכים!'), LD.bossVoice);
    }
  }
  function partWorld(e, p) { return localPt(e, [p.u, p.v]); }
  function partLocked(e, p) { return p.lockedBy && p.lockedBy.some(id => e.parts.find(q => q.id === id && q.alive)); }
  function updTank(e, dt) {
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    const m = e.mesh; face(m, e.fort ? 0.3 : 0.6);
    const f = Math.max(0, e.flash) * 6; if (e.state !== 'dead') m.material.color.setRGB(CARD_TINT.r + f, CARD_TINT.g + f, CARD_TINT.b + f);
    const core = e.parts.find(p => p.core);
    if (e.state === 'dead') { const tp = partWorld(e, core); burn(tp, dt, 3); e.dt2 = (e.dt2 || 0) + dt; if (e.dt2 < 2 && rand() < dt * 6) explode(tp.add(new T.Vector3((rand() - 0.5) * 4, rand() * 2, 0)), 1.3); return; }
    if (e.state === 'drive') { e.x = lerp(e.x, e.tx, dt * 0.35); e.z = lerp(e.z, e.tz, dt * 0.35); if (Math.hypot(e.x - e.tx, e.z - e.tz) < 0.6) e.state = 'fight'; if (rand() < dt * 20) sandPuff(m.position.clone().add(new T.Vector3((rand() - 0.5) * 6, 0.3, 1)), 2); }
    else if (e.sway) e.x = e.tx + Math.sin(e.t * 0.35) * e.sway;
    m.position.set(e.x, groundH(e.x, e.z) - (e.fort ? 0.3 : 0.25), e.z);
    if (!e.fort) m.position.y += Math.sin(G.t * 14) * (e.state === 'drive' ? 0.04 : 0.01);
    if (e.state !== 'fight') return;
    e.shellT -= dt;
    const sp = e.parts.find(p => p.id === e.shellPart);
    if (e.shellT <= 0 && sp.alive && !partLocked(e, sp) || (e.shellT <= 0 && e.fort && sp.alive)) { e.shellT = (e.fort ? 5 : 4) + rand() * 1.5; const mp = muzzleWorld(e); flashAt(mp, 4); S.play('explosion', { vol: 0.6 }); smoke(mp, 2.5); fireProj('shell', mp); G.shake = Math.max(G.shake, 0.4); }
    e.parts.forEach(p => {
      if (!p.alive || p.fire !== 'aim') return;
      p.timer -= dt; if (p.timer <= 0 && !p.aimDur) { p.aimDur = (e.fort ? 2.0 : 2.2) * DIFF.aim; p.aim = 0; }
      if (p.aimDur) { p.aim += dt; if (p.aim >= p.aimDur) { const w = partWorld(e, p); flashAt(w, 1.3); S.play('mg'); playerHit(false, w); p.aimDur = 0; p.timer = 2.4 + rand(); } }
    });
  }

  // ---------- פגזים ורימונים ----------
  let grenadeGeo, grenadeMat;
  function nadeMesh() { if (!grenadeGeo) { grenadeGeo = new T.SphereGeometry(0.09, 10, 8); grenadeMat = new T.MeshStandardMaterial({ color: lin('#3a4228'), roughness: 0.6 }); } const m = new T.Mesh(grenadeGeo, grenadeMat); m.castShadow = true; scene.add(m); return m; }
  function fireProj(kind, from) {
    const to = camera.position.clone().add(new T.Vector3((rand() - 0.5) * 1.2, -0.5 + rand() * 0.3, -1.4));
    let mesh;
    if (kind === 'grenade') { mesh = nadeMesh(); mesh.scale.setScalar(1.6); const gl = new T.Sprite(new T.SpriteMaterial({ map: partTex.soft, color: lin('#ff3a20'), blending: T.AdditiveBlending, depthWrite: false })); gl.scale.setScalar(0.55); mesh.add(gl); mesh.userData.glow = gl; }
    else { mesh = new T.Sprite(new T.SpriteMaterial({ map: partTex.soft, color: lin('#ffb040'), blending: T.AdditiveBlending, depthWrite: false })); mesh.scale.setScalar(1.4); scene.add(mesh); }
    PROJS.push({ kind, from, to, t: 0, dur: (kind === 'grenade' ? 1.7 : 2.0) * Math.max(0.85, DIFF.aim), arc: kind === 'grenade' ? 3.2 : 3, mesh, hp: kind === 'grenade' ? 1 : 2, r: kind === 'grenade' ? 0.7 : 0.9 });
  }
  function throwGrenadeAtPlayer(from) { S.play('throw'); fireProj('grenade', from); if (!L.nadeWarned || rand() < 0.35) { L.nadeWarned = true; radio('רימון! תפיל אותו באוויר!', 'grenade'); } }
  function throwMine(target) { const m = nadeMesh(); const from = camera.position.clone().add(new T.Vector3(0.3, -0.4, -0.5)); MYNADES.push({ m, from, to: target, t: 0, dur: clamp(from.distanceTo(target) / 22, 0.35, 1.1) }); }

  // ---------- אפקטים ----------
  function sprite(tex, col, blend, size) { const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: lin(col), blending: blend || T.NormalBlending, depthWrite: false, transparent: true })); s.scale.setScalar(size); scene.add(s); return s; }
  function addPart(o) { if (PARTS.length > 450) { const x = PARTS.shift(); scene.remove(x.s); x.s.material.dispose(); } PARTS.push(o); }
  function flashAt(p, k) { const s = sprite(partTex.flash, '#fff2c8', T.AdditiveBlending, 1.1 * k); s.position.copy(p); s.material.rotation = rand() * 6; addPart({ s, life: 0.06, t: 0, v: new T.Vector3(), fade: true }); const l = sprite(partTex.soft, '#ffb060', T.AdditiveBlending, 3 * k); l.position.copy(p); addPart({ s: l, life: 0.08, t: 0, v: new T.Vector3(), fade: true }); }
  function sandPuff(p, k) { for (let i = 0; i < 3; i++) { const s = sprite(partTex.smoke, LD.puff || '#d9b48a', T.NormalBlending, (0.5 + rand() * 0.5) * k); s.position.copy(p).add(new T.Vector3((rand() - 0.5) * 0.4 * k, 0.1, (rand() - 0.5) * 0.4)); s.material.opacity = 0.6; addPart({ s, life: 0.9 + rand() * 0.6, t: 0, v: new T.Vector3((rand() - 0.5) * 1.2, 0.6 + rand() * 0.8, (rand() - 0.5) * 0.6), grow: 1.4 * k, fade: true, op: 0.6 }); } }
  function smoke(p, k, dark) { const s = sprite(partTex.smoke, dark ? '#2a2420' : '#8a7a6a', T.NormalBlending, k * (1 + rand())); s.position.copy(p); s.material.rotation = rand() * 6; addPart({ s, life: 2.5 + rand() * 1.5, t: 0, v: new T.Vector3((rand() - 0.2) * 0.8, 1.2 + rand(), 0), grow: k * 1.2, fade: true, op: dark ? 0.7 : 0.5 }); }
  function fire(p, k) { const s = sprite(partTex.soft, rand() < 0.5 ? '#ff9a30' : '#ff5a20', T.AdditiveBlending, k * (0.6 + rand() * 0.6)); s.position.copy(p); addPart({ s, life: 0.5 + rand() * 0.4, t: 0, v: new T.Vector3((rand() - 0.5) * 0.5, 1.5 + rand(), 0), grow: -k * 0.6, fade: true }); }
  function sparks(p, n, col) { for (let i = 0; i < n; i++) { const s = sprite(partTex.soft, col || '#ffd27a', T.AdditiveBlending, 0.12); s.position.copy(p); addPart({ s, life: 0.3 + rand() * 0.3, t: 0, v: new T.Vector3((rand() - 0.5) * 7, rand() * 6, (rand() - 0.5) * 7), g: 14, fade: true }); } }
  function explode(p, k) {
    const ex = sprite(TEX.explosion, '#ffffff', T.AdditiveBlending, 2.5 * k); ex.position.copy(p); ex.material.rotation = rand() * 6;
    addPart({ s: ex, life: 0.7, t: 0, v: new T.Vector3(0, 1, 0), grow: 7 * k, fade: true });
    for (let i = 0; i < 10 * k; i++) smoke(p.clone().add(new T.Vector3((rand() - 0.5) * 2 * k, rand() * k, (rand() - 0.5) * k)), 1.6 * k, true);
    for (let i = 0; i < 8 * k; i++) fire(p.clone().add(new T.Vector3((rand() - 0.5) * 1.5 * k, rand() * k, 0)), 1.6 * k);
    sparks(p, 24 * k, '#ffcf6a'); sandPuff(p, 2.5 * k);
    boomLight.position.copy(p); boomLight.intensity = 60 * k; boomLight.distance = 30 * k;
    G.shake = Math.max(G.shake, 0.45 * k); S.play('explosion');
  }
  function tracer3(a, b, col) { const l = new T.Line(new T.BufferGeometry().setFromPoints([a, b]), new T.LineBasicMaterial({ color: lin(col), transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })); scene.add(l); TRACERS.push({ l, t: 0.07 }); }
  function decal(point, normal) {
    const m = new T.Mesh(new T.PlaneGeometry(0.16, 0.16), new T.MeshBasicMaterial({ map: partTex.decal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.position.copy(point).addScaledVector(normal, 0.01); m.lookAt(point.clone().add(normal)); scene.add(m);
    DECALS.push(m); if (DECALS.length > 90) { const d = DECALS.shift(); scene.remove(d); d.geometry.dispose(); d.material.dispose(); }
  }

  // ---------- מחסות שנהרסות ----------
  function damageCover(o, dmg, point) { const c = o.userData.cover; if (!c.hp || c.dead) return false; c.hp -= dmg; if (c.hp > 0) { if (c.kind === 'crate' && point) debris(point, 0.35); return false; } destroyCover(o); return true; }
  function destroyCover(o) {
    const c = o.userData.cover; if (c.dead) return; c.dead = true;
    scene.remove(o); const idx = COVERS.indexOf(o); if (idx >= 0) COVERS.splice(idx, 1);
    const p = o.position.clone();
    if (c.kind === 'crate') {
      for (let i = 0; i < 12; i++) debris(p.clone().add(new T.Vector3((rand() - 0.5) * c.size, (rand() - 0.5) * c.size * 0.6, 0)), 1);
      sandPuff(p, 1.4); S.play('metal'); score(50, p, 'ארגז!');
      if (c.above && !c.above.userData.cover.dead) { c.above.userData.cover.on = null; FALLING.push({ m: c.above, vy: 0, floor: groundH(c.above.position.x, c.above.position.z) + c.above.userData.cover.size * 0.4 }); }
    } else if (c.kind === 'barrel') {
      explode(p.clone().add(new T.Vector3(0, 0.5, 0)), 1.5); score(100, p, 'בום!'); stat('barrels'); checkTotals();
      setTimeout(() => splash(p, 4.6, 14), 60);
    }
  }
  function debris(p, k) {
    if (!debrisGeo) debrisGeo = new T.BoxGeometry(0.22, 0.05, 0.45);
    const m = new T.Mesh(debrisGeo, crateMat); m.position.copy(p); m.scale.setScalar(0.5 + rand() * 0.7 * k); m.castShadow = true; scene.add(m);
    const v = new T.Vector3().subVectors(p, camera.position).setY(0).normalize().multiplyScalar(2 + rand() * 3 * k).add(new T.Vector3((rand() - 0.5) * 4 * k, 2 + rand() * 4 * k, 0));
    DEBRIS.push({ m, v, rv: new T.Vector3(rand() * 10, rand() * 10, rand() * 10), t: 0 });
    if (DEBRIS.length > 120) { const d = DEBRIS.shift(); scene.remove(d.m); }
  }
  function splash(p, r, dmg) {
    const before = L.kills;
    ENTS.forEach(e => {
      if (e.state === 'dead' || e.state === 'gone' || e.state === 'wait') return;
      if (e.type === 'tank') { e.parts.forEach(pt => { if (!pt.alive || partLocked(e, pt)) return; const w = partWorld(e, pt), d = w.distanceTo(p); if (d < r + 1.5) hitPart(e, pt, dmg * (1 - d / (r + 2)), w); }); return; }
      const c = e.mesh.position.clone().add(new T.Vector3(0, (e.h || 1.5) * 0.5, 0)); const d = c.distanceTo(p);
      if (e.type === 'bunker') { if (d < r + 2.5) bunkerDmg(e, dmg * 2, c); return; }
      if (d < r) hitEnt(e, 0.5, 0.5, c, { dmg: dmg * (1.2 - d / r) + 2, splash: true });
    });
    if (L.kills - before >= 3) achieve('multi');
    COVERS.slice().forEach(o => { if (o.userData.cover.hp && o.position.distanceTo(p) < r * 0.8) damageCover(o, 99); });
    PROJS.forEach(pr => { if (pr.mesh.position.distanceTo(p) < r) pr.dead = true; });
  }

  // ---------- ירי ----------
  const ndc = new T.Vector2();
  function shoot() {
    const w = curW(), now = performance.now();
    if (w.reloading || L.swapT > 0 || now - w.last < w.d.rate || L.duckK > 0.3) return;
    if (w.ammo <= 0) { if (G.pressed) { S.play('empty'); L.needReload = 1.2; if (isTouch) reload(); } return; }
    w.last = now; w.ammo--; w.recoil = 1; L.shots++;
    if (w.d.thrown) {
      S.play('throw'); ndc.set(G.mx / W * 2 - 1, -(G.my / H * 2 - 1)); raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([ground, ...COVERS, ...ENTS.filter(e => e.state !== 'dead' && e.state !== 'gone').map(e => e.mesh)], false);
      throwMine(hits.length ? hits[0].point.clone() : raycaster.ray.at(25, new T.Vector3())); L.hits++;
      if (w.ammo === 0) setTimeout(() => { if (L.inv.grenade && L.inv.grenade.ammo === 0) { delete L.inv.grenade; L.cur = 'uzi'; L.swapT = 0.35; } }, 450);
      return;
    }
    S.play(w.d.sound);
    const spr = w.d.spread * W * (1 + (G.heat || 0));
    const [ax, ay] = isTouch ? touchAssist(G.mx, G.my) : [G.mx, G.my];
    const hit = resolve(ax + (rand() - 0.5) * spr, ay + (rand() - 0.5) * spr, w.d);
    if (hit) L.hits++; else L.combo = 0;
    if (w.d.auto) G.heat = Math.min(1.5, (G.heat || 0) + 0.1);
    gunFlash = 0.06;
    if (w.ammo === 0 && !w.base && w.reserve <= 0) setTimeout(() => { if (L.inv[w.k] === w) { delete L.inv[w.k]; if (L.cur === w.k) { L.cur = 'uzi'; L.swapT = 0.35; } hint('חזרה לעוזי'); } }, 300);
    else if (w.ammo === 0 && isTouch) setTimeout(reload, 150);
  }
  // בטלפון: הקשה קרובה לאויב נצמדת אליו
  function touchAssist(x, y) {
    for (const pr of PROJS) { const [sx, sy, sz] = toScreen(pr.mesh.position); if (sz < 1 && Math.hypot(sx - x, sy - y) < 50) return [sx, sy]; }
    let best = null, bd = 46;
    ENTS.forEach(e => {
      if (!e.hostile || e.state === 'dead' || e.state === 'gone' || e.state === 'wait' || e.type === 'tank' || e.type === 'bunker' || e.civ) return;
      if (e.k !== undefined && e.k < 0.6 && e.state !== 'run' && e.state !== 'run2') return;
      const c = e.mesh.localToWorld(new T.Vector3(0, e.type === 'jeep' ? 0.5 : 0.7, 0)); const [sx, sy, sz] = toScreen(c); if (sz >= 1) return;
      const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = [sx, sy]; }
    });
    return best || [x, y];
  }
  function reload() { const w = curW(); if (w.d.thrown || w.reloading || w.ammo === w.d.mag || (!w.base && w.reserve <= 0)) return; w.reloading = true; w.rt = 0; S.play('reload'); L.needReload = 0; }

  function resolve(px, py, wd) {
    ndc.set(px / W * 2 - 1, -(py / H * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const ray = raycaster.ray;
    const from = camera.position.clone().add(new T.Vector3(0, -0.25, 0)).addScaledVector(ray.direction, 0.9);
    for (const p of PROJS) { if (ray.distanceToPoint(p.mesh.position) < p.r) { p.hp -= wd.dmg; sparks(p.mesh.position, 6); if (p.hp <= 0) { p.dead = true; explode(p.mesh.position.clone(), p.kind === 'grenade' ? 0.7 : 0.9); score(150, p.mesh.position, 'יירוט!'); stat('intercepts'); checkTotals(); } return true; } }
    for (const it of ITEMS) { if (ray.distanceToPoint(it.pos) < 0.75) { collect(it); return true; } }
    const objs = [ground, ...COVERS];
    ENTS.forEach(e => { if (e.state !== 'dead' && e.state !== 'gone' && e.state !== 'wait') objs.push(e.mesh); });
    const hits = raycaster.intersectObjects(objs, false);
    let any = false;
    for (const h of hits) {
      const o = h.object, ent = ENTS.find(e => e.mesh === o);
      if (ent) {
        if (alphaAt(ent.sp.f, h.uv.x, h.uv.y) < 110) continue;
        if (ent.clipY !== undefined && h.point.y < ent.clipY) continue;
        tracer3(from, h.point, '#ffe0a0');
        if (ent.type === 'tank') { tankHit(ent, h.uv.x, h.uv.y, h.point, wd); return true; }
        if (ent.type === 'bunker') { bunkerHit(ent, h.uv.x, h.uv.y, h.point, wd); return true; }
        hitEnt(ent, h.uv.x, h.uv.y, h.point, wd); any = true;
        if (!wd.pierce) return true;
        continue;
      }
      if (o.userData.sprite && alphaAt(o.userData.sprite.f, h.uv.x, h.uv.y) < 110) continue;
      const c = o.userData.cover;
      if (wd.pierce && o !== ground && !(c && c.hp)) continue;
      tracer3(from, h.point, '#ffe0a0');
      const n = h.face ? h.face.normal.clone().transformDirection(o.matrixWorld) : new T.Vector3(0, 1, 0);
      if (o === ground) { sandPuff(h.point, 0.5); decal(h.point, n); return any; }
      sparks(h.point, 5, c.kind === 'barrel' ? '#ffe0a0' : '#ffd8a0'); sandPuff(h.point, 0.25);
      if (!o.userData.sprite && c.kind !== 'crate') decal(h.point, n);
      S.play(c.kind === 'barrel' ? 'metal' : c.kind === 'crate' ? 'hit' : 'ricochet');
      if (c.hp) { damageCover(o, wd.dmg, h.point); if (wd.pierce || c.dead) continue; }
      return any;
    }
    return any;
  }

  function score(base, p3, label) {
    const mult = 1 + Math.min(3, Math.floor(L.combo / 5) * 0.5), v = Math.round(base * mult); L.score += v;
    pop((label ? label + ' ' : '') + '+' + v, p3, mult > 1 ? '#ffd85a' : '#ffffff', label ? 1.05 : 0.85);
  }
  function hitEnt(e, u, v, point, wd) {
    e.flash = 0.06; if (!wd.splash) { L.combo++; L.maxCombo = Math.max(L.maxCombo, L.combo); }
    if (e.type === 'jeep') {
      if (e.state === 'dead') return;
      e.hp -= wd.dmg; sparks(point, 7); S.play('metal');
      if (e.hp <= 0) { e.state = 'dead'; e.hostile = false; explode(e.mesh.position.clone().add(new T.Vector3(0, 1.2, 0.3)), 1.6); e.mesh.material.color.setRGB(0.3, 0.28, 0.26); L.kills++; stat('kills'); score(800, point, 'ג׳יפ הושמד!'); dropItem(e.mesh.position.clone().add(new T.Vector3(0, 2.4, 1))); }
      return;
    }
    if (e.state === 'surrender' || e.state === 'dead') return;
    if (e.civ) {
      e.state = 'dead'; e.hostile = false; if (e.spot) e.spot.busy = false; L.combo = 0; L.civHit++;
      const pos = e.mesh.position.clone(); e.vel = new T.Vector3(0, 1.5, 0); e.fall = 1; e.fade = 0.8;
      if (e.target) { L.score = Math.max(0, L.score - 500); pop('מטרת אזרח! -500', point, '#ff5a4a', 1.1); S.play('bad'); return; }
      L.score = Math.max(0, L.score - 800); pop('פגעת באזרח! -800', point, '#ff5a4a', 1.2); S.play('bad'); radio('אל תירה באזרחים!', 'civ'); playerHit(true); return;
    }
    if (e.target) {
      e.state = 'dead'; e.hostile = false; if (e.spot) e.spot.busy = false; L.kills++;
      const hb = e.sp.head, iy = 1 - v, head = u > hb[0] && u < hb[2] && iy < hb[3];
      if (head) { L.heads++; score(200, point, 'ראש!'); } else score(100, point);
      S.play(head ? 'head' : 'hit'); e.vel = new T.Vector3(0, 0, 0); e.fall = 0; e.fade = 0.9; return;
    }
    const hb = e.sp.head || [0, 0, 0, 0], iy = 1 - v;
    const head = !wd.splash && u > hb[0] - 0.04 && u < hb[2] + 0.04 && iy > hb[1] && iy < hb[3] + 0.03;
    const legs = !wd.splash && ['idle', 'kneel', 'officer', 'run', 'throw'].includes(e.pose) && iy > 0.62;
    if (legs && e.type !== 'heavy' && e.hp <= 2 && wd.dmg < 3) {
      e.state = 'surrender'; e.hostile = false; L.kills++; L.neutral++; stat('kills'); score(250, point, 'ניטרול!'); if (e.carry) dropLife(e); lifeCount(); S.play('hit'); sparks(point, 4, '#fff');
      e.flipX = false; setPose(e, 'surrender'); e.k = 1; e.t2 = 0; if (e.spot) e.spot.busy = false;
      if (e.spot && ['run', 'open', 'side'].includes(e.spot.k)) e.mesh.position.y = groundH(e.mesh.position.x, e.mesh.position.z) - 0.05;
      if (L.neutral >= 5) achieve('merciful');
      return;
    }
    e.hp -= wd.dmg * (head ? 3 : 1); sandPuff(point, 0.2); sparks(point, 3, '#ffcf9a');
    if (!wd.splash) S.play(head ? 'head' : 'hit');
    if (e.hp <= 0) kill(e, head, point);
    else { e.flinch = 1; e.flinchDir = rand() < 0.5 ? -1 : 1; if (e.state === 'aim') e.t = Math.max(0, e.t - 0.3); }
  }
  function kill(e, head, point) {
    e.state = 'dead'; e.hostile = false; L.kills++; stat('kills'); if (e.spot) e.spot.busy = false;
    const base = { heavy: 300, officer: 300, prone: 200, grenadier: 150, win: 200 }[e.type] || 100;
    if (head) { L.heads++; stat('heads'); score(base + 150, point, 'ראש!'); } else score(base, point);
    checkTotals();
    const pos = e.mesh.position.clone();
    e.flipX = false; e.mesh.material.clippingPlanes = null; setPose(e, 'hit'); e.mesh.position.copy(pos);
    const away = new T.Vector3().subVectors(pos, camera.position).setY(0).normalize();
    e.vel = away.multiplyScalar(2.2).add(new T.Vector3(0, 2.4, 0)); e.fall = rand() < 0.5 ? 1 : -1; e.fade = 0;
    if (e.carry) dropLife(e); else if (rand() < 0.2) dropItem(headWorld(e).add(new T.Vector3(0, 0.6, 0)));
    lifeCount();
  }
  function hitPart(e, p, dmg, point) {
    if (!p.alive || e.state === 'dead') return;
    p.hp -= dmg; e.flash = 0.05; sparks(point, 8); L.score += 10;
    if (p.hp <= 0) {
      p.alive = false; explode(partWorld(e, p), p.core ? 2.4 : 1.2);
      score(p.core ? 5000 : 800, point, p.core ? (e.fort ? 'המוצב הושמד!' : 'הטנק הושמד!') : 'נקודה הושמדה!');
      if (p.core) { e.state = 'dead'; e.hostile = false; e.mesh.material.color.setRGB(0.32, 0.3, 0.28); L.kills++; achieve(e.fort ? 'bunker_buster' : 'tank_buster'); }
    }
  }
  function tankHit(e, u, v, point, wd) {
    for (const p of e.parts) {
      if (!p.alive) continue;
      const du = (u - p.u) * e.mesh.scale.x / e.mesh.scale.y, dv = (1 - v) - p.v;
      if (Math.hypot(du, dv) < p.r * 1.25) {
        if (partLocked(e, p)) { sparks(point, 5, '#cfe0ff'); S.play('metal'); pop('משוריין', point, '#cfe0ff', 0.8); return; }
        hitPart(e, p, wd.dmg, point); S.play('hit'); L.combo++; return;
      }
    }
    sparks(point, 5, '#ffe8b0'); S.play('ricochet');
    if (!L.tankHint) { L.tankHint = true; hint('השריון עבה מדי. כוון לנקודות המסומנות'); }
  }
  function bunkerHit(e, u, v, point, wd) {
    const s = e.sp.slit, iy = 1 - v;
    if (u > s[0] && u < s[2] && iy > s[1] && iy < s[3]) { bunkerDmg(e, wd.dmg, point); S.play('hit'); L.combo++; return; }
    sparks(point, 5, '#ffe8b0'); S.play('ricochet'); decal(point, new T.Vector3().subVectors(camera.position, point).normalize());
    if (!L.bunkerHint) { L.bunkerHint = true; hint('ירה לתוך החרך, או זרוק רימון'); }
  }
  function bunkerDmg(e, dmg, point) {
    if (e.state === 'dead') return;
    e.hp -= dmg; e.flash = 0.06; sparks(point, 6);
    if (e.hp <= 0) { e.state = 'dead'; e.hostile = false; explode(e.mesh.position.clone().add(new T.Vector3(0, 1.5, 0.5)), 2.4); e.mesh.material.color.setRGB(0.35, 0.32, 0.3); L.kills++; score(2000, point, 'הבונקר הושמד!'); achieve('bunker_buster'); }
  }

  function heartPath() { hc.beginPath(); hc.moveTo(0, 8); hc.bezierCurveTo(-16, -4, -10, -16, 0, -8); hc.bezierCurveTo(10, -16, 16, -4, 0, 8); hc.closePath(); }
  // ---------- פריטים ----------
  function dropItem(pos) { const r = rand(); const kind = r < 0.35 && L.lives < L.max ? 'heal' : r < 0.55 ? 'slow' : 'weapon'; ITEMS.push({ kind, wk: ['fal', 'mag', 'grenade'][Math.floor(rand() * 3)], pos, t: 0, life: 7.5 }); }
  function lifeCount() { L.sinceLife = (L.sinceLife || 0) + 1; if (L.sinceLife >= DIFF.every) { L.sinceLife = 0; L.lifeDue = true; } }
  function dropLife(e) { e.carry = false; L.sinceLife = 0; ITEMS.push({ kind: 'life', pos: headWorld(e).add(new T.Vector3(0, 0.7, 0)), t: 0, life: 9 }); if (!L.lifeTip) { L.lifeTip = true; hint('לב! ירה בו כדי לקבל חיים'); } }
  function collect(it) {
    it.dead = true; S.play('pickup');
    if (it.kind === 'heal') { L.lives = Math.min(L.max, L.lives + 1); pop('מימייה +1', it.pos, '#9be36a'); }
    else if (it.kind === 'life') {
      const cap = DIFF.lives + DIFF.bonus;
      if (L.lives < L.max) { L.lives++; pop('עוד חיים!', it.pos, '#ff7a8a', 1.2); }
      else if (L.max < cap) { L.max++; L.lives++; pop('לב נוסף!', it.pos, '#ff7a8a', 1.3); }
      else score(500, it.pos, 'חיים מלאים, בונוס');
    }
    else if (it.kind === 'slow') { L.slowT = 6; pop('קפה שחור! הזמן מאט', it.pos, '#ffd85a'); }
    else { giveWeapon(it.wk); pop(WEAPONS[it.wk].name + '!', it.pos, '#ffd85a', 1.1); }
    sparks(it.pos, 14, '#fff6c0');
  }

  // ---------- לולאה ----------
  let last = performance.now(), gunFlash = 0, flareK = 0;
  function frame(now) {
    const rdt = Math.min(0.05, (now - last) / 1000); last = now; G.t += rdt;
    if (G.screen === 'play' || G.screen === 'dying') update(rdt);
    if (G.screen !== 'loading') render(G.screen === 'pause' ? 0 : rdt);
    requestAnimationFrame(frame);
  }

  function update(rdt) {
    const slow = L.slowT > 0 ? 0.35 : 1; if (L.slowT > 0) L.slowT -= rdt;
    const dt = rdt * slow; L.time += rdt;
    const wantDuck = G.duck && L.phase !== 'move';
    L.duckK = clamp(L.duckK + (wantDuck ? 1 : -1) * rdt * 6, 0, 1);
    const w = curW();
    if (ducked() && !w.reloading && !w.d.thrown && w.ammo < w.d.mag && (w.base || w.reserve > 0)) reload();
    if (L.swapT > 0) L.swapT -= rdt;
    w.recoil = Math.max(0, w.recoil - rdt * 9); G.heat = Math.max(0, (G.heat || 0) - rdt * (G.down ? 0.5 : 3));
    if (w.reloading) { w.rt += rdt * 1000 * (ducked() ? 1.3 : 1); if (w.rt >= w.d.reload) { w.reloading = false; const need = w.d.mag - w.ammo, take = w.base ? need : Math.min(need, w.reserve); w.ammo += take; if (!w.base) w.reserve -= take; } }
    if (G.screen === 'play' && L.phase === 'fight' && (G.pressed || (G.down && w.d.auto))) shoot();
    G.pressed = false; if (L.needReload > 0) L.needReload -= rdt;

    // זיקוקי תאורה בלילה
    if (LD.night) {
      L.flareT -= rdt;
      if (L.flareT <= 0 && L.phase === 'fight') { L.flareT = 7 + rand() * 5; L.flare = { t: 0, life: 6, pos: camera.position.clone().add(new T.Vector3((rand() - 0.5) * 20, 26, -18 - rand() * 10)) }; S.play('throw'); }
      if (L.flare) { const fl = L.flare; fl.t += rdt; fl.pos.y -= rdt * 2.2; fl.pos.x += Math.sin(fl.t) * rdt; flareK = clamp(Math.min(fl.t * 2, (fl.life - fl.t) / 1.5), 0, 1) * (0.85 + Math.sin(fl.t * 23) * 0.15); flareLight.position.copy(fl.pos); flareLight.intensity = flareK * 900; if (rand() < rdt * 20) { const s = sprite(partTex.soft, '#fff4d0', T.AdditiveBlending, 3 * flareK + 0.5); s.position.copy(fl.pos); addPart({ s, life: 0.15, t: 0, v: new T.Vector3(), fade: true }); } if (fl.t > fl.life) { L.flare = null; flareK = 0; flareLight.intensity = 0; } }
    }

    if (L.phase === 'move') {
      const c = L.cam; c.t += rdt / c.dur; const k = ease(Math.min(1, c.t));
      L.camPos = new T.Vector3().lerpVectors(c.a, c.b, k); L.camPos.y += Math.sin(k * Math.PI) * (c.intro ? 2 : 0.6);
      if (!c.intro) L.camPos.y += Math.abs(Math.sin(c.t * c.dur * 7)) * 0.07;
      L.yaw = lerp(c.ay, c.by, k); L.pitch = c.intro ? lerp(-0.35, 0, k) : 0;
      if (c.t >= 1) beginScene(L.next);
    }
    if (L.phase === 'fight') {
      const sc = LD.scenes[L.scene];
      L.pt += rdt; L.spawnT -= dt;
      const active = ENTS.filter(e => (e.hostile || e.target) && e.state !== 'gone' && e.state !== 'dead' && e.type !== 'tank' && e.type !== 'bunker').length;
      if (L.queue.length && L.spawnT <= 0 && active < L.maxActive) { if (spawn(L.queue[0])) L.queue.shift(); else L.queue.push(L.queue.shift()); L.spawnT = (sc.spawnGap || 0.5) + rand() * 0.9; }
      const isBoss = LD.boss && LD.boss.scene === L.scene;
      if (isBoss) { if (!L.boss) { L.bossT -= rdt; if (L.bossT <= 0) makeBoss(); } else if (L.boss.state !== 'dead' && !L.queue.length && active < 2 && rand() < dt * 0.3) L.queue.push(rand() < 0.3 ? 'grenadier' : 'soldier'); }
      if (!L.crate && !sc.noCrate && L.pt > (sc.crateAt || 7)) {
        L.crate = true; const c = COVERS.filter(o => !o.userData.sprite && o.position.distanceTo(camera.position) < 22 && o.position.distanceTo(camera.position) > 5); const o = c[Math.floor(rand() * c.length)];
        if (o) ITEMS.push({ kind: 'weapon', wk: sc.crate || ['fal', 'mag', 'grenade'][Math.floor(rand() * 3)], pos: o.position.clone().add(new T.Vector3(0, 1.7, 0)), t: 0, life: 9 });
      }
      const left = ENTS.filter(e => (e.hostile || e.target) && e.state !== 'gone' && e.state !== 'dead').length;
      const bossOk = !isBoss || (L.boss && L.boss.state === 'dead' && (L.boss.dt2 || 0) > 1.8);
      if (bossOk && isBoss) { L.queue = []; ENTS.forEach(e => { if (e.hostile && e.type !== 'tank') { e.hostile = false; if (e.spot) { e.state = 'surrender'; e.t2 = 0; e.flipX = false; e.mesh.material.clippingPlanes = null; setPose(e, 'surrender'); e.k = 1; } else e.state = 'gone'; } }); }
      if (bossOk && !L.queue.length && left === 0) { L.phase = 'clear'; L.pt = 0; S.play('clear'); const k = rand() < 0.5; if (L.scene < NSC - 1) radio(fill(sc.clear || (k ? 'האזור נקי! ממשיכים!' : 'יפה מאוד, זזים קדימה!')), sc.clear ? null : (k ? 'clear1' : 'clear2')); else radio(fill(LD.winLine || 'כל הכבוד, חייל. המשימה הושלמה.'), 'win'); }
    } else if (L.phase === 'clear') {
      L.pt += rdt;
      if (L.pt > 1.6) {
        if (L.scene < NSC - 1) { L.phase = 'move'; L.next = L.scene + 1; L.cam = { a: L.camPos.clone(), ay: L.yaw, b: stopPos(L.next), by: STOPS[L.next].yaw, t: 0, dur: 3.2 }; S.play('radio'); }
        else { L.phase = 'done'; setTimeout(levelComplete, 1200); }
      }
    }

    ENTS.forEach(e => e.type === 'tank' ? updTank(e, dt) : updEnt(e, dt));
    for (let i = ENTS.length - 1; i >= 0; i--) if (ENTS[i].state === 'gone') { scene.remove(ENTS[i].mesh); ENTS[i].mesh.material.dispose(); ENTS.splice(i, 1); }
    PROJS.forEach(p => {
      p.t += dt / p.dur; const k = Math.min(1, p.t);
      p.mesh.position.lerpVectors(p.from, p.to, k); p.mesh.position.y += Math.sin(k * Math.PI) * p.arc;
      if (p.kind === 'shell' && rand() < 0.9) smoke(p.mesh.position.clone(), 0.5, false);
      if (p.kind === 'grenade') { p.mesh.rotation.x += dt * 12; if (rand() < 0.9) sparks(p.mesh.position, 2, '#ffb050'); const gl = p.mesh.userData.glow; if (gl) { const on = Math.floor(G.t * 12) % 2; gl.scale.setScalar(on ? 0.75 : 0.4); } }
      if (p.t >= 1 && !p.dead) { p.dead = true; G.flash = 0.25; S.play('explosion'); if (!ducked()) { playerHit(false, p.from); G.shake = 1; } else { L.blocked++; explode(camera.position.clone().add(new T.Vector3(0, -0.4, -2.2)), 0.6); } }
    });
    for (let i = PROJS.length - 1; i >= 0; i--) if (PROJS[i].dead) { scene.remove(PROJS[i].mesh); if (PROJS[i].mesh.isSprite) PROJS[i].mesh.material.dispose(); PROJS.splice(i, 1); }
    MYNADES.forEach(n => { n.t += dt / n.dur; const k = Math.min(1, n.t); n.m.position.lerpVectors(n.from, n.to, k); n.m.position.y += Math.sin(k * Math.PI) * 1.6; n.m.rotation.x += dt * 14; if (k >= 1 && !n.done) { n.done = true; scene.remove(n.m); explode(n.to.clone().add(new T.Vector3(0, 0.4, 0)), 1.3); splash(n.to, 4.5, 12); } });
    for (let i = MYNADES.length - 1; i >= 0; i--) if (MYNADES[i].done) MYNADES.splice(i, 1);
    FALLING.forEach(f => { f.vy -= 14 * dt; f.m.position.y += f.vy * dt; if (f.m.position.y <= f.floor) { f.m.position.y = f.floor; f.done = true; sandPuff(f.m.position.clone(), 0.8); f.m.userData.cover.top = f.floor + f.m.userData.cover.size * 0.4; } });
    for (let i = FALLING.length - 1; i >= 0; i--) if (FALLING[i].done) FALLING.splice(i, 1);
    DEBRIS.forEach(d => { d.t += dt; if (d.t < 2.2) { d.v.y -= 12 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.rv.x * dt; d.m.rotation.y += d.rv.y * dt; const gy = groundH(d.m.position.x, d.m.position.z) + 0.02; if (d.m.position.y < gy) { d.m.position.y = gy; d.v.multiplyScalar(0.3); d.v.y = Math.abs(d.v.y) * 0.3; d.rv.multiplyScalar(0.5); } } else d.m.position.y -= dt * 0.1; });
    for (let i = DEBRIS.length - 1; i >= 0; i--) if (DEBRIS[i].t > 4) { scene.remove(DEBRIS[i].m); DEBRIS.splice(i, 1); }
    ITEMS.forEach(it => { it.t += dt; if (it.t > it.life) it.dead = true; });
    for (let i = ITEMS.length - 1; i >= 0; i--) if (ITEMS[i].dead) ITEMS.splice(i, 1);
    SMOKERS.forEach(s => { if (rand() < rdt * s.rate) smoke(s.pos.clone().add(new T.Vector3((rand() - 0.5) * 2, 0, 0)), 4, true); });
    POPS.forEach(p => p.t -= rdt); for (let i = POPS.length - 1; i >= 0; i--) if (POPS[i].t <= 0) POPS.splice(i, 1);
    L.toasts.forEach(t => t.t -= rdt); L.toasts = L.toasts.filter(t => t.t > 0);
    L.hitDirs.forEach(h => h.t -= rdt); L.hitDirs = L.hitDirs.filter(h => h.t > 0);
    if (L.radio) { L.radio.t -= rdt; if (L.radio.t <= 0) L.radio = null; }
    if (L.hint) { L.hint.t -= rdt; if (L.hint.t <= 0) L.hint = null; }
  }

  function updParts(dt) {
    for (let i = PARTS.length - 1; i >= 0; i--) {
      const p = PARTS[i]; p.t += dt;
      if (p.t >= p.life) { scene.remove(p.s); p.s.material.dispose(); PARTS.splice(i, 1); continue; }
      const k = p.t / p.life;
      if (p.g) p.v.y -= p.g * dt;
      p.s.position.addScaledVector(p.v, dt);
      if (p.grow) p.s.scale.setScalar(Math.max(0.01, p.s.scale.x + p.grow * dt));
      if (p.fade) p.s.material.opacity = (p.op || 1) * (1 - k);
    }
    for (let i = TRACERS.length - 1; i >= 0; i--) { const t = TRACERS[i]; t.t -= dt; t.l.material.opacity = Math.max(0, t.t / 0.07); if (t.t <= 0) { scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); TRACERS.splice(i, 1); } }
  }

  // ---------- ציור ----------
  const hud = $('hud'), hc = hud.getContext('2d');
  let cssScale = 1, dpr = 1;
  function resize() {
    const box = $('stage'); cssScale = Math.min(box.clientWidth / W, box.clientHeight / H);
    const cw = Math.round(W * cssScale), ch = Math.round(H * cssScale);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    [$('gl'), hud].forEach(c => { c.style.width = cw + 'px'; c.style.height = ch + 'px'; });
    hud.width = Math.round(cw * dpr); hud.height = Math.round(ch * dpr);
    if (renderer) { const pr = LOW ? 1 : Math.min(1.6, dpr); renderer.setPixelRatio(pr); renderer.setSize(cw, ch, false); composer.setPixelRatio(pr); composer.setSize(cw, ch); }
  }
  window.addEventListener('resize', resize);
  const tmpV = new T.Vector3();
  function toScreen(v) { tmpV.copy(v).project(camera); return [(tmpV.x + 1) / 2 * W, (1 - tmpV.y) / 2 * H, tmpV.z]; }

  function render(rdt) {
    updParts(rdt * (L && L.slowT > 0 ? 0.35 : 1));
    let cp, yaw, pitch;
    if (!L) { const s0 = stopPos(0); yaw = 0.4 + Math.sin(G.t * 0.1) * 0.2; cp = s0.add(new T.Vector3(-10 + Math.sin(G.t * 0.08) * 8, 4.5, 24)); pitch = -0.08; }
    else { cp = (L.camPos || stopPos(0).add(new T.Vector3(-14, 14, 38))).clone(); yaw = L.yaw || 0; pitch = L.pitch || 0; }
    const dk = L ? ease(L.duckK) : 0;
    const sway = L && L.phase === 'fight' ? [(G.mx / W - 0.5) * 0.12, (G.my / H - 0.5) * 0.06] : [0, 0];
    camera.position.copy(cp); camera.position.y -= dk * 0.95; camera.position.x += dk * 0.15;
    if (G.shake > 0) { camera.position.x += (rand() - 0.5) * 0.12 * G.shake; camera.position.y += (rand() - 0.5) * 0.12 * G.shake; G.shake = Math.max(0, G.shake - rdt * 2); }
    camera.rotation.order = 'YXZ'; camera.rotation.set(pitch - sway[1] * (1 - dk) - dk * 0.12 + Math.sin(G.t * 1.3) * 0.004, yaw - sway[0] * (1 - dk), dk * 0.04);
    const so = sun.userData.off; sun.position.copy(camera.position).add(new T.Vector3(so[0], so[1], so[2])); sun.target.position.copy(camera.position).add(new T.Vector3(0, 0, -18));
    scene.userData.sky.position.x = camera.position.x; scene.userData.sky.position.z = camera.position.z;
    scene.userData.dust.rotation.y = G.t * 0.004;
    boomLight.intensity = Math.max(0, boomLight.intensity - rdt * 160);
    G.dmg = Math.max(0, G.dmg - rdt * 1.6); G.flash = Math.max(0, G.flash - rdt * 2);
    const u = finalPass.uniforms; u.time.value = G.t % 100; u.dmg.value = G.dmg; u.slow.value = L && L.slowT > 0 ? 1 : 0; u.flash.value = G.flash; u.duck.value = dk;
    if (LD.night) u.exposure.value = (LD.exposure || 0.82) * (1 + flareK * 0.35);
    PROJS.forEach(p => { if (p.mesh.isSprite) p.mesh.material.rotation += rdt * 8; });
    composer.render();
    drawHUD();
  }

  function txt(t, x, y, size, col, align, font) {
    hc.font = `${font ? 400 : 800} ${size}px ${font || '"Assistant", Arial, sans-serif'}`; hc.textAlign = align || 'center'; hc.direction = 'rtl';
    hc.fillStyle = 'rgba(0,0,0,0.6)'; hc.fillText(t, x + 2, y + 2); hc.fillStyle = col || '#fff'; hc.fillText(t, x, y);
  }
  function ring(x, y, r0, k) {
    k = clamp(k, 0, 1); const r = lerp(r0, 14, k);
    const col = k < 0.5 ? `rgb(${Math.round(80 + k * 340)},230,90)` : `rgb(255,${Math.round(230 - (k - 0.5) * 420)},60)`;
    hc.save(); hc.strokeStyle = col; hc.lineWidth = 3 + k * 2; hc.shadowColor = col; hc.shadowBlur = 12;
    hc.beginPath(); hc.arc(x, y, r, 0, 7); hc.stroke();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + G.t * 2; hc.beginPath(); hc.moveTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4)); hc.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12)); hc.stroke(); }
    hc.restore();
  }
  function rbox(x, y, w, h, r) { hc.beginPath(); if (hc.roundRect) hc.roundRect(x, y, w, h, r); else hc.rect(x, y, w, h); }
  const BTN = { duck: { x: 92, y: H - 150, r: 64 }, reload: { x: W - 92, y: H - 120, r: 48 } };
  const SLOT = i => ({ x: 24 + i * 112, y: H - 62, w: 104, h: 46 });

  function drawHUD() {
    hc.setTransform(dpr * cssScale, 0, 0, dpr * cssScale, 0, 0); hc.clearRect(0, 0, W, H);
    if (!L || G.screen === 'loading') return;
    const dk = L.duckK;
    ENTS.forEach(e => {
      if (e.state === 'dead' || e.state === 'gone') return;
      if (e.type === 'tank') {
        e.parts.forEach(p => {
          if (!p.alive) return; const [x, y] = toScreen(partWorld(e, p)); const locked = partLocked(e, p);
          const pulse = 0.5 + 0.5 * Math.sin(G.t * 6);
          if (locked) { hc.strokeStyle = 'rgba(170,200,255,0.5)'; hc.lineWidth = 2; hc.beginPath(); hc.arc(x, y, 30, 0, 7); hc.stroke(); return; }
          hc.strokeStyle = `rgba(255,70,50,${0.55 + pulse * 0.4})`; hc.lineWidth = 3; hc.setLineDash([8, 6]); hc.beginPath(); hc.arc(x, y, 30 + pulse * 5, 0, 7); hc.stroke(); hc.setLineDash([]);
          hc.strokeStyle = '#ffcf4a'; hc.lineWidth = 4; hc.beginPath(); hc.arc(x, y, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.hp / p.max); hc.stroke();
          if (p.aimDur) ring(x, y, 70, p.aim / p.aimDur);
        });
        return;
      }
      if (e.type === 'bunker') {
        const [x, y] = toScreen(muzzleWorld(e)); const pulse = 0.5 + 0.5 * Math.sin(G.t * 6);
        hc.strokeStyle = `rgba(255,70,50,${0.5 + pulse * 0.4})`; hc.lineWidth = 3; hc.setLineDash([8, 6]); hc.beginPath(); hc.ellipse(x, y, 60, 22, 0, 0, 7); hc.stroke(); hc.setLineDash([]);
        if (e.aimDur) ring(x, y, 80, e.aim / e.aimDur);
        const [bx, by] = toScreen(e.mesh.position.clone().add(new T.Vector3(0, e.h + 0.3, 0))); hc.fillStyle = 'rgba(0,0,0,0.6)'; hc.fillRect(bx - 52, by - 2, 104, 10); hc.fillStyle = '#d8423a'; hc.fillRect(bx - 50, by, 100 * Math.max(0, e.hp / e.max), 6);
        return;
      }
      if (e.carry && e.hostile && e.state !== 'wait' && e.k > 0.5) { const [x, y, z] = toScreen(headWorld(e)); if (z < 1) { hc.save(); hc.translate(x, y - 38 + Math.sin(G.t * 5) * 3); hc.scale(1.4, 1.4); heartPath(); hc.fillStyle = '#5be06a'; hc.fill(); hc.strokeStyle = 'rgba(0,0,0,0.6)'; hc.lineWidth = 2; hc.stroke(); hc.restore(); } }
      if (e.civ && e.state === 'idle' && !e.target) { const [x, y] = toScreen(headWorld(e)); txt('אל תירו!', x, y - 40, 20, '#9fd8ff'); }
      if (e.state === 'aim') { const [x, y, z] = toScreen(e.type === 'jeep' ? muzzleWorld(e) : headWorld(e)); if (z < 1) ring(x, y + 10, 64, e.t / e.aim); }
      if (e.state === 'throw' && !e.thrown) { const [x, y] = toScreen(muzzleWorld(e)); txt('רימון!', x, y - 30, 22, '#ff6a4a'); }
      if ((e.type === 'heavy' || e.type === 'jeep') && e.hostile && e.state !== 'wait') { const [x, y] = toScreen(e.mesh.position.clone().add(new T.Vector3(0, e.h + 0.25, 0))); hc.fillStyle = 'rgba(0,0,0,0.6)'; hc.fillRect(x - 32, y - 2, 64, 8); hc.fillStyle = '#ffcf4a'; hc.fillRect(x - 30, y, 60 * Math.max(0, e.hp / e.max), 4); }
    });
    PROJS.forEach(p => { if (p.kind === 'grenade') { const [gx, gy, gz] = toScreen(p.mesh.position); if (gz < 1 && gx > 0 && gx < W && gy > 0 && gy < H) txt(ducked() ? 'רימון!' : 'רימון! ירה בו או התכופף', gx, gy - 34 - p.t * 30, 22, '#ff6a4a'); } });
    PROJS.forEach(p => { const [x, y] = toScreen(p.mesh.position); hc.strokeStyle = p.t > 0.6 && Math.floor(G.t * 10) % 2 ? '#ff3a2a' : 'rgba(255,90,60,0.7)'; hc.lineWidth = 2.5; hc.setLineDash([5, 5]); hc.beginPath(); hc.arc(x, y, 18 + p.t * 46, 0, 7); hc.stroke(); hc.setLineDash([]); });
    ITEMS.forEach(it => {
      const [x, y, z] = toScreen(it.pos); if (z > 1) return; const b = Math.sin(it.t * 5) * 5;
      if (it.life - it.t < 1.5 && Math.floor(it.t * 10) % 2) return;
      const g = hc.createRadialGradient(x, y + b, 0, x, y + b, 46); g.addColorStop(0, it.kind === 'heal' ? 'rgba(155,227,106,0.6)' : it.kind === 'life' ? 'rgba(255,90,110,0.75)' : 'rgba(255,216,90,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); hc.fillStyle = g; hc.fillRect(x - 46, y + b - 46, 92, 92);
      hc.save(); hc.translate(x, y + b);
      if (it.kind === 'heal') { hc.fillStyle = '#5a6a3a'; hc.beginPath(); hc.ellipse(0, 4, 16, 20, 0, 0, 7); hc.fill(); hc.fillStyle = '#c8c0a0'; hc.fillRect(-5, -22, 10, 8); hc.fillStyle = '#e8443a'; hc.fillRect(-3, -4, 6, 16); hc.fillRect(-8, 1, 16, 6); }
      else if (it.kind === 'life') { const k = 1.7 + Math.sin(it.t * 8) * 0.12; hc.scale(k, k); heartPath(); hc.fillStyle = '#e8443a'; hc.fill(); hc.strokeStyle = '#fff'; hc.lineWidth = 1.6; hc.stroke(); }
      else if (it.kind === 'slow') { hc.fillStyle = '#f4f0e8'; hc.beginPath(); hc.moveTo(-13, -12); hc.lineTo(13, -12); hc.lineTo(10, 16); hc.lineTo(-10, 16); hc.fill(); hc.fillStyle = '#4a2a14'; hc.fillRect(-11, -10, 22, 5); }
      else { hc.fillStyle = '#5a4a2a'; hc.fillRect(-34, -18, 68, 36); hc.strokeStyle = '#2a2010'; hc.lineWidth = 3; hc.strokeRect(-34, -18, 68, 36); hc.fillStyle = '#ffd85a'; hc.font = '800 13px Assistant, Arial'; hc.textAlign = 'center'; hc.direction = 'rtl'; hc.fillText(WEAPONS[it.wk].name, 0, 5); }
      hc.restore();
    });
    POPS.forEach(p => { const [x, y, z] = toScreen(p.p); if (z > 1) return; hc.globalAlpha = Math.min(1, p.t * 3); txt(p.text, x, y - (1.1 - p.t) * 60, Math.round(24 * p.size), p.col); hc.globalAlpha = 1; });
    drawGun(dk);
    for (let i = 0; i < L.max; i++) { const x = W - 40 - i * 38, y = 40, on = i < L.lives; hc.save(); hc.translate(x, y); hc.scale(1.15, 1.15); hc.fillStyle = on ? '#e8443a' : 'rgba(255,255,255,0.18)'; hc.beginPath(); hc.moveTo(0, 8); hc.bezierCurveTo(-16, -4, -10, -16, 0, -8); hc.bezierCurveTo(10, -16, 16, -4, 0, 8); hc.fill(); hc.restore(); }
    hc.direction = 'ltr'; hc.font = '400 50px "Karantina", "Assistant", sans-serif'; hc.textAlign = 'left';
    hc.fillStyle = 'rgba(0,0,0,0.5)'; hc.fillText(String(L.score).padStart(7, '0'), 26, 56); hc.fillStyle = '#fff'; hc.fillText(String(L.score).padStart(7, '0'), 24, 54);
    txt(`${PF ? PROFILE.rank(PF) : 'סמל'} ${NAME} · ${DIFF.name}`, 26, 82, 17, 'rgba(255,255,255,0.75)', 'left');
    if (L.combo >= 5) txt(`קומבו ${L.combo}  x${1 + Math.min(3, Math.floor(L.combo / 5) * 0.5)}`, 30, 110, 24, '#ffd85a', 'left');
    txt(`ששת הימים  |  שלב ${LEVEL_NO}: ${LD.name}`, W / 2, 32, 20, 'rgba(255,255,255,0.85)');
    for (let i = 0; i < NSC; i++) { hc.fillStyle = i < L.scene ? '#e0a84a' : i === L.scene ? '#fff' : 'rgba(255,255,255,0.3)'; hc.beginPath(); hc.arc(W / 2 + (i - (NSC - 1) / 2) * 22, 50, i === L.scene ? 6 : 4, 0, 7); hc.fill(); }
    if (L.boss && L.boss.state !== 'dead') { const tot = L.boss.parts.reduce((a, p) => a + p.max, 0), cur = L.boss.parts.reduce((a, p) => a + (p.alive ? p.hp : 0), 0); hc.fillStyle = 'rgba(0,0,0,0.6)'; hc.fillRect(W / 2 - 263, 70, 526, 18); hc.fillStyle = '#d8423a'; hc.fillRect(W / 2 - 260, 73, 520 * cur / tot, 12); txt(L.boss.name, W / 2, 112, 22, '#ffcf9a'); }
    ORDER.forEach((k, i) => {
      const s = SLOT(i), w = L.inv[k], on = L.cur === k;
      hc.fillStyle = on ? 'rgba(224,168,74,0.92)' : w ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.22)'; rbox(s.x, s.y, s.w, s.h, 6); hc.fill();
      if (!on && w) { hc.strokeStyle = 'rgba(255,255,255,0.25)'; hc.lineWidth = 1; hc.stroke(); }
      const col = on ? '#15110a' : w ? '#fff' : 'rgba(255,255,255,0.3)';
      hc.direction = 'ltr'; hc.font = '800 12px Assistant, Arial'; hc.textAlign = 'left'; hc.fillStyle = col; hc.fillText(String(i + 1), s.x + 7, s.y + 15);
      txt(WEAPONS[k].name, s.x + s.w - 8, s.y + 19, 15, col, 'right');
      if (w) { const am = k === 'grenade' ? `x${w.ammo}` : w.base ? `${w.ammo}` : `${w.ammo}/${w.reserve}`; hc.direction = 'ltr'; hc.font = '800 14px Assistant, Arial'; hc.textAlign = 'right'; hc.fillStyle = col; hc.fillText(am, s.x + s.w - 8, s.y + 38); }
    });
    const w = curW();
    if (!w.d.thrown) { const pw = Math.min(8, 300 / w.d.mag); for (let i = 0; i < w.d.mag; i++) { hc.fillStyle = i < w.ammo ? '#e8c070' : 'rgba(255,255,255,0.15)'; hc.fillRect(24 + i * pw, H - 80, Math.max(2, pw - 2), 12); } }
    if (w.reloading) txt(ducked() ? 'במחסה, טוען...' : 'טוען...', W / 2, H - 250, 26, '#fff');
    else if (dk > 0.5) txt('במחסה', W / 2, H - 250, 30, '#9be36a');
    else if ((w.ammo === 0 || L.needReload > 0) && Math.floor(G.t * 4) % 2) txt(isTouch ? 'טען! או התכופף למחסה' : 'טען! R, קליק ימני, או התכופף עם רווח', W / 2, H - 250, 32, '#ff5a4a');
    if (isTouch) [['duck', G.duckLock ? 'קום' : G.duck ? 'במחסה' : 'מחסה'], ['reload', 'טען']].forEach(([k, label]) => { const b = BTN[k]; hc.fillStyle = k === 'duck' && G.duck ? 'rgba(155,227,106,0.55)' : 'rgba(0,0,0,0.45)'; hc.beginPath(); hc.arc(b.x, b.y, b.r, 0, 7); hc.fill(); hc.strokeStyle = '#e0a84a'; hc.lineWidth = 3; hc.stroke(); txt(label, b.x, b.y + 8, 24, '#fff'); });
    drawThreats();
    if (L.slowT > 0) txt('הזמן מאט', W / 2, 150, 30, '#ffd85a');
    if (L.radio) {
      const a = Math.min(1, L.radio.t * 2); hc.globalAlpha = a;
      const rx = W / 2 - 360, ry = 128; hc.fillStyle = 'rgba(8,10,8,0.78)'; rbox(rx, ry, 720, 78, 10); hc.fill();
      if (TEX.commanderImg) { hc.save(); hc.beginPath(); hc.rect(rx + 640, ry + 6, 66, 66); hc.clip(); hc.drawImage(TEX.commanderImg, rx + 640, ry + 6, 66, 66); hc.restore(); hc.strokeStyle = '#e0a84a'; hc.lineWidth = 2; hc.strokeRect(rx + 640, ry + 6, 66, 66); }
      txt('המג״ד רפי:', rx + 628, ry + 28, 17, '#e0a84a', 'right'); txt(L.radio.text, rx + 628, ry + 60, 23, '#fff', 'right');
      hc.globalAlpha = 1;
    }
    L.toasts.forEach((t, i) => { const a = Math.min(1, t.t * 2, (3.4 - t.t) * 4); hc.globalAlpha = a; const y = 220 + i * 74; hc.fillStyle = 'rgba(20,18,8,0.88)'; rbox(W - 380, y, 356, 64, 8); hc.fill(); hc.strokeStyle = '#ffd85a'; hc.lineWidth = 2; hc.stroke(); txt('הישג חדש: ' + t.title, W - 40, y + 26, 19, '#ffd85a', 'right'); txt(t.desc, W - 40, y + 50, 15, 'rgba(255,255,255,0.85)', 'right'); hc.globalAlpha = 1; });
    if (L.hint) { hc.globalAlpha = Math.min(1, L.hint.t * 2); txt(L.hint.text, W / 2, L.hint.big ? 300 : 250, L.hint.big ? 64 : 28, L.hint.big ? '#ffcf9a' : '#fff', 'center', L.hint.big ? '"Karantina", sans-serif' : undefined); hc.globalAlpha = 1; }
    if (L.phase === 'clear') txt(L.scene < NSC - 1 ? 'האזור נקי!' : 'ניצחון!', W / 2, H / 2, 96, '#e0a84a', 'center', '"Karantina", sans-serif');
    if (L.phase === 'move' && L.cam.intro && L.cam.t < 0.9) { hc.globalAlpha = 1 - Math.max(0, L.cam.t - 0.6) / 0.3; txt(L.fromCp ? 'ממשיכים מנקודת הביקורת' : `שלב ${LEVEL_NO}`, W / 2, H / 2 - 40, 36, '#e0a84a', 'center', '"Karantina", sans-serif'); txt(L.fromCp ? `אזור ${L.next + 1}: ${LD.scenes[L.next].name}` : LD.name, W / 2, H / 2 + 40, L.fromCp ? 80 : 96, '#fff', 'center', '"Karantina", sans-serif'); hc.globalAlpha = 1; }
    if (L.lives === 1 && G.screen === 'play') { const g = hc.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${0.25 + 0.15 * Math.sin(G.t * 5)})`); hc.fillStyle = g; hc.fillRect(0, 0, W, H); }
    if (G.screen === 'play' && dk < 0.5) drawCross();
  }
  // חץ בקצה המסך לכל איום שלא רואים, וקשת אדומה לכיוון שממנו פגעו
  function edgeArrow(ang, col, label, pulse) {
    const cx = W / 2, cy = H / 2 + 10, rx = W / 2 - 80, ry = H / 2 - 110;
    const x = cx + Math.sin(ang) * rx, y = cy - Math.cos(ang) * ry;
    hc.save(); hc.translate(x, y); hc.rotate(ang);
    hc.fillStyle = col; hc.shadowColor = col; hc.shadowBlur = 22; const s = 1.7 + pulse * 0.35; hc.strokeStyle = 'rgba(0,0,0,0.6)'; hc.lineWidth = 3;
    hc.beginPath(); hc.moveTo(0, -26 * s); hc.lineTo(20 * s, 10 * s); hc.lineTo(0, 2 * s); hc.lineTo(-20 * s, 10 * s); hc.closePath(); hc.stroke(); hc.fill();
    hc.restore();
    if (label) txt(label, x - Math.sin(ang) * 30, y + Math.cos(ang) * 50 + 8, 22, col);
  }
  function offscreen(pos) { const [x, y, z] = toScreen(pos); return z >= 1 || x < 30 || x > W - 30 || y < 30 || y > H - 30; }
  function drawThreats() {
    const pulse = 0.5 + 0.5 * Math.sin(G.t * 10);
    ENTS.forEach(e => {
      if (e.state === 'dead' || e.state === 'gone' || !e.hostile) return;
      let pos = null, k = 0, label = '';
      if (e.type === 'tank') { const p = e.parts.find(q => q.alive && q.aimDur); if (p) { pos = partWorld(e, p); k = p.aim / p.aimDur; } }
      else if (e.type === 'bunker') { if (e.aimDur) { pos = muzzleWorld(e); k = e.aim / e.aimDur; } }
      else if (e.state === 'aim') { pos = e.type === 'jeep' ? muzzleWorld(e) : headWorld(e); k = e.t / e.aim; }
      else if (e.state === 'throw') { pos = muzzleWorld(e); k = 0.8; label = 'רימון'; }
      if (!pos || !offscreen(pos)) return;
      const col = k < 0.5 ? 'rgba(255,210,80,0.95)' : 'rgba(255,60,40,0.95)';
      edgeArrow(dirAngle(pos), col, label || (k > 0.6 ? 'יורה!' : ''), k > 0.6 ? pulse : 0);
    });
    PROJS.forEach(p => { if (offscreen(p.mesh.position)) edgeArrow(dirAngle(p.mesh.position), 'rgba(255,90,40,0.95)', p.kind === 'grenade' ? 'רימון' : 'פגז', pulse); });
    L.hitDirs.forEach(h => {
      const a = Math.min(1, h.t / 0.6), cx = W / 2, cy = H / 2, r = 230;
      hc.save(); hc.translate(cx, cy); hc.rotate(h.a); hc.strokeStyle = h.blocked ? `rgba(200,220,255,${a * 0.7})` : `rgba(255,40,30,${a})`; hc.lineWidth = 14; hc.shadowColor = '#ff2010'; hc.shadowBlur = h.blocked ? 0 : 18;
      hc.beginPath(); hc.arc(0, 0, r, -Math.PI / 2 - 0.32, -Math.PI / 2 + 0.32); hc.stroke(); hc.restore();
    });
  }
  function drawGun(dk) {
    const w = curW(), fp = FP[w.k], img = TEX[fp.img + 'Img']; if (!img) return;
    const rec = w.recoil, gw = fp.w, gh = gw * img.height / img.width;
    const drop = (L.swapT > 0 ? Math.sin(L.swapT / 0.35 * Math.PI) * 260 : 0) + dk * 330 + (w.reloading ? 140 : 0);
    const bob = Math.sin(G.t * 1.8) * 3;
    const gx = W / 2 - gw / 2 + fp.dx + (G.mx - W / 2) * 0.1 + rec * 6, gy = H - gh + 70 + (G.my - H / 2) * 0.05 + rec * 20 + drop + bob;
    hc.save(); hc.translate(gx + gw / 2, gy + gh); hc.rotate((G.mx - W / 2) * 0.0002 - rec * 0.035); hc.drawImage(img, -gw / 2, -gh, gw, gh); hc.restore();
    if (gunFlash > 0 && fp.muzzle) { gunFlash -= 0.016; const mx = gx + gw * fp.muzzle[0], my = gy + gh * fp.muzzle[1]; const g = hc.createRadialGradient(mx, my, 0, mx, my, 80); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.3, 'rgba(255,190,90,0.8)'); g.addColorStop(1, 'rgba(255,140,40,0)'); hc.fillStyle = g; hc.fillRect(mx - 80, my - 80, 160, 160); }
  }
  function drawCross() {
    const x = G.mx, y = G.my, w = curW(); const r = 14 + (w.d.spread || 0) * 600 * (1 + (G.heat || 0)) + w.recoil * 8;
    hc.save(); const draw = (c, lw) => { hc.strokeStyle = c; hc.lineWidth = lw; hc.beginPath(); hc.arc(x, y, r, 0, 7); hc.stroke(); hc.beginPath(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { hc.moveTo(x + a * (r + 4), y + b * (r + 4)); hc.lineTo(x + a * (r + 14), y + b * (r + 14)); }); hc.stroke(); };
    const col = w.d.thrown ? '#ff8a5a' : '#ffd27a';
    draw('rgba(0,0,0,0.6)', 4); draw(col, 2); hc.fillStyle = col; hc.beginPath(); hc.arc(x, y, 2, 0, 7); hc.fill();
    if (w.reloading) { hc.strokeStyle = '#fff'; hc.lineWidth = 4; hc.beginPath(); hc.arc(x, y, r + 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * w.rt / w.d.reload); hc.stroke(); }
    hc.restore();
  }

  // ---------- מסכים ----------
  function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== id); hud.classList.toggle('playing', !id); const pb = $('pause-btn'); if (pb) pb.hidden = !!id; }
  function levelComplete() {
    G.screen = 'end'; S.stopMusic(); S.play('clear');
    const acc = L.shots ? L.hits / L.shots : 0; L.score += L.lives * 300 + Math.round(acc * 2000);
    let stars = 1; if (acc >= 0.5) stars++; if (L.dmgTaken <= 2) stars++;
    let isBest = false;
    if (PF) {
      const lv = PROFILE.level(PF, LV); isBest = L.score > lv.best; lv.best = Math.max(lv.best, L.score); lv.stars = Math.max(lv.stars, stars); lv.completed = true; lv.checkpoint = null; lv.last = L.score;
      if (L.dmgTaken === 0) achieve('untouchable');
      if (acc >= 0.7 && L.shots >= 20) achieve('sharpshooter');
      if (DKEY === 'hard') achieve('hard_mode');
      if (LD.civilians && L.civHit === 0) achieve('no_civ');
      if (LEVELS.every((l, i) => PROFILE.level(PF, '67-' + (i + 1)).completed)) achieve('campaign');
      PROFILE.save(PF);
      window.dispatchEvent(new CustomEvent('kav-level-complete', { detail: { level: LEVEL_NO, name: NAME, score: L.score, stars, diff: DKEY } }));
    }
    $('retry-cp').hidden = true; $('again').textContent = 'שחק שוב';
    $('next').hidden = LEVEL_NO >= LEVELS.length; $('next').textContent = `לשלב ${LEVEL_NO + 1}: ${LEVELS[LEVEL_NO] ? LEVELS[LEVEL_NO].name : ''}`;
    $('end-title').textContent = isBest ? 'שיא חדש!' : 'השלב הושלם';
    $('end-stars').innerHTML = [0, 1, 2].map(i => `<span class="star ${i < stars ? 'on' : ''}">★</span>`).join('');
    $('end-stats').innerHTML = [['ניקוד', L.score.toLocaleString('he-IL')], ['דיוק', Math.round(acc * 100) + '%'], ['נוטרלו', L.kills], ['פגיעות ראש', L.heads], ['ניטרולים', L.neutral], ['כדורים שנבלמו במחסה', L.blocked]].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    shareText = `סיימתי את שלב ${LEVEL_NO}, ${LD.name}, בקו האש עם ${L.score.toLocaleString('he-IL')} נקודות ו${['כוכב אחד', 'שני כוכבים', 'שלושה כוכבים'][stars - 1]} ברמה ${DIFF.name}. נראה אותך עושה יותר:`;
    $('end-story').textContent = fill(LD.debrief) + (LEVEL_NO === LEVELS.length ? '\n\n' + fill(window.CAMPAIGN67.outro) : '');
    showScreen('end');
  }
  function gameOver() { shareText = `הגעתי לאזור ${L.scene + 1} בשלב ${LEVEL_NO}, ${LD.name}, בקו האש עם ${L.score.toLocaleString('he-IL')} נקודות. נראה אותך מגיע רחוק יותר:`; G.screen = 'end'; S.stopMusic(); $('next').hidden = true; $('retry-cp').hidden = !checkpoint(); $('retry-cp').textContent = `נסה שוב מאזור ${L.scene + 1}`; $('end-title').textContent = 'נפגעת'; $('end-stars').innerHTML = ''; $('end-stats').innerHTML = `<div class="stat"><span>ניקוד</span><b>${L.score.toLocaleString('he-IL')}</b></div><div class="stat"><span>אזור</span><b>${L.scene + 1} מתוך ${NSC}</b></div>`; $('end-story').textContent = `רפי גורר אותך מאחורי שק חול. אל תדאג, ${NAME}, ההתקדמות שמורה מתחילת האזור. טיפ: התכופף כשהטבעת על האויב נהיית אדומה.`; showScreen('end'); }

  // ---------- קלט ----------
  function toGame(e) { const r = hud.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
  const touchDuck = new Set(); let duckDownAt = 0;
  hud.addEventListener('pointerdown', e => {
    S.init(); const [x, y] = toGame(e);
    if (G.screen !== 'play') return; e.preventDefault();
    try { hud.setPointerCapture(e.pointerId); } catch (er) { }
    if (e.button === 2) { reload(); return; }
    for (let i = 0; i < ORDER.length; i++) { const s = SLOT(i); if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) { switchTo(ORDER[i]); return; } }
    if (e.pointerType === 'touch') isTouch = true;
    if (isTouch) {
      if (Math.hypot(x - BTN.duck.x, y - BTN.duck.y) < BTN.duck.r + 14) {
        if (G.duckLock) { G.duckLock = false; G.duck = false; return; }
        touchDuck.add(e.pointerId); duckDownAt = performance.now(); G.duck = true; return;
      }
      if (Math.hypot(x - BTN.reload.x, y - BTN.reload.y) < BTN.reload.r + 8) { reload(); return; }
    }
    G.mx = x; G.my = y; G.down = true; G.pressed = true;
  });
  hud.addEventListener('pointermove', e => { if (touchDuck.has(e.pointerId)) return; const [x, y] = toGame(e); G.mx = x; G.my = y; });
  window.addEventListener('pointerup', e => { if (touchDuck.has(e.pointerId)) { touchDuck.delete(e.pointerId); if (!touchDuck.size) { if (performance.now() - duckDownAt < 260) { G.duckLock = true; if (!L.lockTip) { L.lockTip = true; hint('נעול במחסה. הקשה נוספת על הכפתור כדי לקום'); } } else G.duck = false; } return; } G.down = false; });
  window.addEventListener('pointercancel', e => { touchDuck.delete(e.pointerId); if (!touchDuck.size && !G.duckLock) G.duck = false; G.down = false; });
  hud.addEventListener('contextmenu', e => e.preventDefault());
  hud.addEventListener('wheel', e => { if (G.screen === 'play') { e.preventDefault(); cycle(e.deltaY > 0 ? 1 : -1); } }, { passive: false });
  const DUCK_KEYS = ['Space', 'ShiftLeft', 'ShiftRight', 'KeyC'];
  window.addEventListener('keydown', e => {
    if ((e.code === 'Escape' || e.code === 'KeyP') && (G.screen === 'play' || G.screen === 'pause')) { G.screen === 'play' ? pause() : resumeGame(); return; }
    if (G.screen !== 'play') return;
    if (DUCK_KEYS.includes(e.code)) { e.preventDefault(); G.duck = true; }
    if (e.code === 'KeyR') reload();
    if (e.code === 'KeyQ') cycle(1);
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code]; if (n !== undefined) switchTo(ORDER[n]);
  });
  window.addEventListener('keyup', e => { if (DUCK_KEYS.includes(e.code)) G.duck = false; });
  window.addEventListener('blur', () => { G.duck = false; G.down = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  // ---------- אתחול ----------
  function typeBrief() { const t = fill(LD.brief); const el = $('brief-text'); el.textContent = ''; let n = 0; const iv = setInterval(() => { n += 2; el.textContent = t.slice(0, n); if (n >= t.length) clearInterval(iv); }, 16); }
  document.title = `קו האש: ${LD.name}`;
  $('brief-level').textContent = `ששת הימים · שלב ${LEVEL_NO} מתוך ${LEVELS.length} · ${LD.place} · ${DIFF.name}`;
  $('brief-name').textContent = LD.name;
  $('load-text').textContent = LD.loading || 'טוען...';
  function setDiff(k) {
    if (!DIFFS[k]) return; DKEY = k; DIFF = DIFFS[k];
    if (PF) { PF.settings.difficulty = k; PROFILE.save(PF); }
    document.querySelectorAll('#diffpick button').forEach(b => b.setAttribute('aria-checked', b.dataset.d === k ? 'true' : 'false'));
    $('brief-level').textContent = `ששת הימים · שלב ${LEVEL_NO} מתוך ${LEVELS.length} · ${LD.place}`;
  }
  document.querySelectorAll('#diffpick button').forEach(b => b.onclick = () => { setDiff(b.dataset.d); S.init(); S.play('ui'); });
  setDiff(DKEY);
  $('go').onclick = () => { S.init(); if (PF) { PROFILE.level(PF, LV).checkpoint = null; PROFILE.save(PF); } startGame(); };
  $('resume').onclick = () => { S.init(); startGame(checkpoint()); };
  $('again').onclick = () => reloadInto('new');
  let shareText = '';
  const SHARE_URL = 'https://yontanbe.github.io/kav-haesh/';
  $('share').onclick = async () => {
    const b = $('share');
    if (navigator.share) { try { await navigator.share({ title: 'קו האש', text: shareText, url: SHARE_URL }); } catch (e) { } return; }
    try { await navigator.clipboard.writeText(shareText + ' ' + SHARE_URL); b.textContent = 'הועתק, אפשר להדביק'; }
    catch (e) { b.textContent = 'לא הצלחתי להעתיק'; }
    setTimeout(() => { b.textContent = 'שתף'; }, 2500);
  };
  $('retry-cp').onclick = () => reloadInto('checkpoint');
  $('next').onclick = () => { location.href = 'play.html?l=' + (LEVEL_NO + 1); };
  $('p-resume').onclick = () => resumeGame();
  $('p-save').onclick = () => { location.href = 'index.html'; };
  $('p-restart').onclick = () => reloadInto(checkpoint() ? 'checkpoint' : 'new');
  $('pause-btn').onclick = () => pause();
  resize();
  loadVoices();
  loadAll(k => { $('bar').style.width = Math.round(k * 100) + '%'; }).then(() => {
    initGL(); resize(); G.screen = 'menu'; showScreen('brief'); typeBrief();
    $('brief-face').src = TEX.commanderImg.src;
    const cp = checkpoint();
    if (cp) {
      $('resume').hidden = false; $('resume').textContent = `המשך מאזור ${cp.scene + 1}: ${LD.scenes[cp.scene].name}`; $('go').textContent = 'מההתחלה'; $('go').classList.add('ghost');
      $('saveinfo').hidden = false; $('saveinfo').textContent = `שמור עבור ${NAME}: אזור ${cp.scene + 1} מתוך ${NSC}, ${cp.score.toLocaleString('he-IL')} נקודות, ${cp.lives} חיים. נשמר ${new Date(cp.at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}.`;
    }
    let mode = null; try { mode = sessionStorage.getItem('kav-start'); sessionStorage.removeItem('kav-start'); } catch (e) { }
    if (mode === 'checkpoint' && cp) startGame(cp); else if (mode === 'new') { if (PF) { PROFILE.level(PF, LV).checkpoint = null; PROFILE.save(PF); } startGame(); }
  }).catch(err => { $('load-text').textContent = 'טעינת הגרפיקה נכשלה. צריך לפתוח את המשחק דרך שרת (ראה README).'; console.error(err); });
  requestAnimationFrame(frame);

  // כלי בדיקה
  window.__g3 = {
    G, get L() { return L; }, get scene() { return scene; }, ENTS, COVERS, ITEMS, STOPS, LD, LEVEL_NO, startGame,
    tick(n) { for (let i = 0; i < n; i++) update(0.05); },
    jump(i) { L.camPos = stopPos(i); L.yaw = STOPS[i].yaw; L.pitch = 0; ENTS.forEach(e => e.state = 'gone'); beginScene(i); },
    LW, groundH, SPRITES,
  };
  Object.defineProperty(window, '__cam', { get: () => camera });
})();
