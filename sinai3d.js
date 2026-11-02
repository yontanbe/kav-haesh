/* קו האש 3D: שלב הפריצה בסיני. מנוע Three.js עם אמנות מצוירת */
(function () {
  const T = window.THREE, S = window.SFX;
  const W = 1280, H = 720;
  const $ = id => document.getElementById(id);
  const rand = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const NSC = 6;
  const PF = window.PROFILE ? PROFILE.load() : null;
  const NAME = window.PROFILE ? PROFILE.displayName(PF) : 'דני';
  const LOW = PF && PF.settings.quality === 'low';
  const LV = 'sinai';
  if (PF) { S.sfxOn = PF.settings.sound; S.musicOn = PF.settings.music; S.voiceOn = PF.settings.sound; }

  // ---------- נכסים ----------
  // head ו-muzzle בשברים של התמונה (0,0 = פינה שמאלית עליונה)
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
    truck: { f: 'truck', h: 3.1 },
    jeep: { f: 'jeep', h: 2.6, muzzle: [0.44, 0.06], head: [0.18, 0, 0.32, 0.12] },
    tank: { f: 'tank', h: 4.6, muzzle: [0.995, 0.17] },
    bunker: { f: 'bunker', h: 3.3, slit: [0.2, 0.2, 0.85, 0.36], muzzle: [0.5, 0.28] },
    wire: { f: 'wire', h: 1.15 },
    tent: { f: 'tent', h: 2.6 },
  };
  const FP = {
    uzi: { img: 'fp_uzi', w: 470, muzzle: [0.3, 0.06], dx: 10 },
    fal: { img: 'fp_fal', w: 540, muzzle: [0.22, 0.08], dx: 20 },
    mag: { img: 'fp_mag', w: 520, muzzle: [0.47, 0.03], dx: 10 },
    grenade: { img: 'fp_grenade', w: 400, dx: 60 },
  };
  const TEX = {}, MASK = {};

  function loadAll(onProgress) {
    const loader = new T.TextureLoader();
    const list = [...new Set(['sky', 'sand', 'burlap', 'rock', 'crate', 'explosion', ...Object.values(SPRITES).map(s => s.f)])];
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

  // ---------- רעש וקרקע ----------
  function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); }
  function fbm(x, y) { let a = 0, f = 1, s = 0.5; for (let i = 0; i < 4; i++) { a += vnoise(x * f, y * f) * s; f *= 2; s *= 0.5; } return a; }

  // תחנות המצלמה. כל סצנה נבנית בקואורדינטות מקומיות: x ימינה, d קדימה
  const STOPS = [
    { pos: [0, -4.5], yaw: 0 }, { pos: [5.5, -46], yaw: 0 }, { pos: [2, -88], yaw: 0 },
    { pos: [-3, -128], yaw: 0 }, { pos: [4, -168], yaw: 0 }, { pos: [-1, -208], yaw: 0 },
  ];
  const LW = (i, x, d) => [STOPS[i].pos[0] + x, STOPS[i].pos[1] - d];
  function flatK(x, z) {
    let d = 1e9;
    STOPS.forEach((s, i) => { const r = i === 5 ? 40 : 27; d = Math.min(d, Math.max(0, Math.hypot(x - s.pos[0], z - (s.pos[1] - 15)) - r)); });
    for (let i = 0; i < STOPS.length - 1; i++) { const a = STOPS[i].pos, b = STOPS[i + 1].pos; const vx = b[0] - a[0], vz = b[1] - a[1], t = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz), 0, 1); d = Math.min(d, Math.hypot(x - (a[0] + vx * t), z - (a[1] + vz * t))); }
    return clamp((d - 2) / 30, 0, 1);
  }
  function groundH(x, z) {
    const big = (fbm(x * 0.012 + 3, z * 0.012) - 0.45) * 22, mid = (fbm(x * 0.05, z * 0.05 + 7) - 0.5) * 2.2, k = flatK(x, z);
    return big * k * k + mid * (0.25 + k * 0.75) + Math.sin(x * 0.35 + z * 0.12) * 0.06;
  }

  let renderer, scene, camera, composer, finalPass, sun, hemi, ground, raycaster, boomLight;
  const COVERS = [], DECALS = [], PARTS = [], TRACERS = [], SMOKERS = [], DEBRIS = [], FALLING = [];
  const partTex = {};

  function canvasTex(size, fn) { const c = document.createElement('canvas'); c.width = c.height = size; fn(c.getContext('2d'), size); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; }
  const lin = c => new T.Color(c).convertSRGBToLinear();

  function initGL() {
    renderer = new T.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = LOW ? T.PCFShadowMap : T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.fog = new T.Fog(lin('#d8a585'), 45, 340);
    scene.background = lin('#e9b98c');
    camera = new T.PerspectiveCamera(37, W / H, 0.1, 1200);
    raycaster = new T.Raycaster();

    // שמיים מצוירים על גליל
    const skyTex = TEX.sky; skyTex.wrapS = T.ClampToEdgeWrapping; skyTex.repeat.x = -1; skyTex.offset.x = 1;
    const R = 520, arc = 2.9, hgt = R * arc / (skyTex.image.width / skyTex.image.height);
    const sky = new T.Mesh(new T.CylinderGeometry(R, R, hgt, 64, 1, true, Math.PI - arc / 2, arc), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false, depthWrite: false }));
    sky.position.y = 0.23 * hgt + 2; sky.renderOrder = -10; scene.add(sky); scene.userData.sky = sky;

    hemi = new T.HemisphereLight(lin('#b9c9e8'), lin('#a8784a'), 0.55); scene.add(hemi);
    sun = new T.DirectionalLight(lin('#ffc590'), 3.2); sun.castShadow = true;
    sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    boomLight = new T.PointLight(lin('#ff9a40'), 0, 30, 2); scene.add(boomLight);

    const g = new T.PlaneGeometry(900, 900, LOW ? 150 : 260, LOW ? 150 : 260); g.rotateX(-Math.PI / 2); g.translate(0, 0, -120);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, groundH(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const st = TEX.sand; st.wrapS = st.wrapT = T.RepeatWrapping; st.repeat.set(140, 140);
    ground = new T.Mesh(g, new T.MeshStandardMaterial({ map: st, roughness: 0.95, color: new T.Color('#d9b893') }));
    ground.receiveShadow = true; scene.add(ground);

    partTex.soft = canvasTex(64, (x, s) => { const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, s, s); });
    partTex.smoke = canvasTex(128, (x, s) => { for (let i = 0; i < 26; i++) { const px = s / 2 + (rand() - 0.5) * s * 0.45, py = s / 2 + (rand() - 0.5) * s * 0.45, r = s * (0.15 + rand() * 0.2); const gr = x.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, s, s); } });
    partTex.flash = canvasTex(128, (x, s) => { x.translate(s / 2, s / 2); for (let i = 0; i < 7; i++) { x.rotate(Math.PI * 2 / 7 + rand() * 0.3); const gr = x.createLinearGradient(0, 0, s / 2, 0); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = gr; x.beginPath(); x.moveTo(0, -s * 0.05); x.lineTo(s * (0.3 + rand() * 0.2), 0); x.lineTo(0, s * 0.05); x.fill(); } const gr = x.createRadialGradient(0, 0, 0, 0, 0, s * 0.22); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(1, 'rgba(255,190,90,0)'); x.fillStyle = gr; x.fillRect(-s / 2, -s / 2, s, s); });
    partTex.decal = canvasTex(64, (x, s) => { const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(20,14,8,0.95)'); gr.addColorStop(0.35, 'rgba(40,28,16,0.6)'); gr.addColorStop(1, 'rgba(60,40,20,0)'); x.fillStyle = gr; x.fillRect(0, 0, s, s); });

    const dg = new T.BufferGeometry(), N = LOW ? 500 : 1400, arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { arr[i * 3] = (rand() - 0.5) * 120; arr[i * 3 + 1] = rand() * 14; arr[i * 3 + 2] = -rand() * 260 + 10; }
    dg.setAttribute('position', new T.BufferAttribute(arr, 3));
    const dust = new T.Points(dg, new T.PointsMaterial({ size: 0.07, map: partTex.soft, transparent: true, opacity: 0.55, depthWrite: false, color: lin('#ffe2b8'), blending: T.AdditiveBlending }));
    scene.add(dust); scene.userData.dust = dust;

    buildWorld();

    const rt = new T.WebGLRenderTarget(W, H, { type: T.HalfFloatType });
    composer = new T.EffectComposer(renderer, rt);
    composer.addPass(new T.RenderPass(scene, camera));
    if (!LOW) composer.addPass(new T.UnrealBloomPass(new T.Vector2(W, H), 0.55, 0.6, 0.9));
    finalPass = new T.ShaderPass({
      uniforms: { tDiffuse: { value: null }, time: { value: 0 }, dmg: { value: 0 }, slow: { value: 0 }, flash: { value: 0 }, exposure: { value: 0.82 }, duck: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float time, dmg, slow, flash, exposure, duck; varying vec2 vUv;
        float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
        void main(){
          vec2 uv = vUv; vec2 d = uv - 0.5; float r = length(d);
          float ca = 0.0012 + dmg * 0.008;
          vec3 c = vec3(texture2D(tDiffuse, uv + d*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d*ca).b);
          c = aces(c * exposure);
          c = pow(c, vec3(1.0/2.2));
          c *= vec3(1.04, 1.0, 0.93);
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

  let burlapMat, crateMat, rockMat, barrelMat, debrisGeo;
  function sandbags(i, x, d, len, rows, rotY, decor) {
    if (!burlapMat) { const t = TEX.burlap; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1.5, 1); burlapMat = new T.MeshStandardMaterial({ map: t, roughness: 1, color: new T.Color('#f4e2c0') }); }
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
  function rock(i, x, d, s, seed) {
    if (!rockMat) { const t = TEX.rock; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2.5, 1.6); rockMat = new T.MeshStandardMaterial({ map: t, roughness: 0.9, color: new T.Color('#b89a78') }); }
    const [wx, wz] = LW(i, x, d);
    const g = new T.SphereGeometry(1, 40, 28); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const v = new T.Vector3(p.getX(k), p.getY(k), p.getZ(k)); const n = 0.7 + fbm(v.x * 1.3 + seed, v.y * 1.3 + v.z * 0.9) * 0.6 + vnoise(v.x * 6 + seed, v.z * 6 + v.y) * 0.06; v.multiplyScalar(n); if (v.y < -0.15) v.y = -0.15; v.y *= v.y > 0 ? 0.85 + vnoise(seed, v.x) * 0.3 : 1; p.setXYZ(k, v.x, v.y, v.z); }
    g.computeVertexNormals();
    g.computeBoundingBox();
    const m = new T.Mesh(g, rockMat); const b = at(wx, wz); m.position.set(wx, b.y + 0.1 * s, wz); m.scale.set(s * 1.3, s * 0.85, s); m.rotation.y = seed;
    return addCover(m, { top: m.position.y + g.boundingBox.max.y * s * 0.85 });
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
  function card(key, wx, wz, scale, rotY, asCover) {
    const sp = SPRITES[key];
    const geo = new T.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: TEX[sp.f], alphaTest: 0.45, side: T.DoubleSide, color: new T.Color('#f3dcc4') }));
    const h = sp.h * (scale || 1); m.scale.set(h * sp.aspect, h, 1); m.position.set(wx, groundH(wx, wz) - 0.15, wz); m.rotation.y = rotY || 0;
    m.castShadow = true; m.userData.sprite = sp;
    if (asCover) { m.userData.cover = { top: m.position.y + h * 0.75 }; COVERS.push(m); }
    scene.add(m); return m;
  }
  const cardL = (i, key, x, d, scale, rotY, asCover) => { const [wx, wz] = LW(i, x, d); return card(key, wx, wz, scale, rotY, asCover); };

  function buildWorld() {
    // שקי חול מול השחקן בכל תחנה, להתכופפות
    STOPS.forEach((s, i) => sandbags(i, 0.2, 1.75, 3.6, 3, 0, true));
    // 1: הדיונות
    sandbags(0, -5, 9.5, 5.2, 4, 0.08); sandbags(0, 4.5, 13.5, 6, 4, -0.1);
    const c0 = crate(0, -1.4, 6, 1.0, 0.2); crate(0, -1.4, 6, 0.9, -0.15, c0); crate(0, -0.3, 6.3, 0.9, 0.05);
    rock(0, 9, 8.5, 1.4, 1.3); rock(0, -9.5, 18.5, 1.8, 2.2); rock(0, 12, 22.5, 2.4, 4.1);
    barrel(0, 2.4, 5.1); barrel(0, 3.1, 5.6);
    cardL(0, 'truck', -3.5, 25.5, 1, 0.25, true);
    // 2: השיירה
    sandbags(1, -6.5, 10, 7, 4, 0.25); sandbags(1, 6.5, 14, 5, 4, 0.1);
    rock(1, 3.7, 8.5, 1.2, 5.5); rock(1, -11.5, 18, 1.7, 6.6); rock(1, 12.5, 24, 2.6, 7.7);
    crate(1, 4, 5, 1.0, 0.4); crate(1, 4.9, 5.2, 0.85, 0.1);
    barrel(1, -4, 4); barrel(1, -3.4, 4.6); barrel(1, -3.8, 5.2);
    cardL(1, 'truck', 10.5, 28, 0.9, -0.5, true);
    // 3: הגדר והבונקר
    cardL(2, 'wire', -6, 9, 1, 0.05); cardL(2, 'wire', 6, 9.5, 1, -0.05);
    sandbags(2, -7, 14, 5, 4, 0.1); sandbags(2, 7.5, 15, 5, 4, -0.1);
    const c2 = crate(2, -3, 7, 1.0, 0.1); crate(2, -3, 7, 0.9, 0.3, c2); crate(2, -2.1, 7.3, 0.9, -0.1);
    barrel(2, 5, 7.5); barrel(2, 5.6, 7.9); barrel(2, 4.6, 8.2);
    rock(2, -13, 16, 2.0, 3.3); rock(2, 13, 19, 2.2, 8.1);
    // 4: מחנה האספקה
    cardL(3, 'tent', -7, 16, 1, 0.3, true); cardL(3, 'tent', 7, 19, 1, -0.3, true);
    const c3a = crate(3, -2, 7, 1.0, 0.1); crate(3, -2, 7, 0.9, -0.2, c3a);
    const c3b = crate(3, 2, 9, 1.0, -0.2); crate(3, 2, 9, 0.85, 0.15, c3b); crate(3, -5, 10, 1.0, 0.5); crate(3, 0.5, 13, 0.9, 0);
    barrel(3, 4, 7); barrel(3, 4.6, 7.4); barrel(3, 3.4, 7.6); barrel(3, -8, 11); barrel(3, -7.3, 11.4); barrel(3, -7.7, 12);
    sandbags(3, 0, 15.5, 4.5, 4, 0); cardL(3, 'truck', 10, 25, 1, -0.4, true);
    // 5: הרכס
    rock(4, -8, 15, 2.6, 2.7); rock(4, -1, 16, 2.2, 3.9); rock(4, 6, 15, 2.8, 5.1); rock(4, 13, 18, 2.4, 6.3);
    sandbags(4, -3, 8, 4.5, 4, 0.05); crate(4, 4, 7, 1.0, 0.3); barrel(4, -7, 6.5); barrel(4, -6.4, 6.9);
    // 6: השריון
    sandbags(5, -6, 7, 5, 4, -0.2); sandbags(5, 6, 6, 4, 4, 0.15);
    rock(5, -13, 18, 2.2, 8.8); rock(5, 11, 21, 1.8, 9.9);
    barrel(5, 9, 12); barrel(5, 9.6, 12.4);
    cardL(5, 'truck', -11, 35, 1, 0.5, true);
    // רקע: הריסות ועשן
    [[-45, -60], [42, -120], [-50, -190], [48, -250], [12, -300]].forEach(([x, z]) => { const c = card('truck', x, z, 1.2, rand()); c.material.color.set('#7a6a5a'); SMOKERS.push({ pos: new T.Vector3(x, groundH(x, z) + 2.5, z), rate: 5 }); });
  }

  // ---------- נקודות הופעה (מקומיות) ----------
  const P = (x, d, top) => ({ k: 'pop', x, d, top: top || 1.1 }), SD = (x, d, dx) => ({ k: 'side', x, d, dx }), O = (x, d) => ({ k: 'open', x, d }), RN = (d, x0, x1) => ({ k: 'run', d, x0, x1 }), PR = (x, d, top) => ({ k: 'prone', x, d, top });
  const SPOTS = [
    [P(-5.2, 10.3), P(-3.6, 10.1), P(4.0, 14.3), P(6.2, 14.5), SD(-1.5, 7.1, -1.7), SD(-3.2, 26.7, 3.9), P(9, 9.8, 1.2), P(-9.5, 20.1, 1.5), O(2.5, 20.5), O(-7.5, 22.5), RN(19.5, -18, 18)],
    [P(-7.9, 10.9), P(-4.7, 10.3), P(6, 14.8), P(8, 14.9), SD(4.5, 6, 1.7), SD(9.7, 29.4, -3.6), P(3.7, 9.6, 1.0), P(-11.5, 19.6, 1.4), O(1.5, 24), O(-7.5, 23), RN(22, -20, 18)],
    [P(-8.2, 14.8), P(-6, 14.6), P(6.3, 15.8), P(8.6, 15.9), SD(-3.1, 8.1, -1.7), P(-13, 17.7, 1.7), O(-4, 25), O(5, 26), RN(12, -16, 16)],
    [SD(-7, 17.2, 3.4), SD(-7, 17.6, -4.4), SD(7, 20.2, -3.2), SD(-2, 7.9, -1.6), SD(2, 9.9, 1.6), P(-1, 16.3), P(1.2, 16.4), O(-1, 23), O(5, 27), RN(19, -16, 16)],
    [PR(-8, 16.9, 2.2), PR(-1, 17.6, 1.9), PR(6, 16.9, 2.4), PR(13, 19.8, 2.0), P(-4, 8.8), P(-2, 8.7), SD(4.2, 7.9, 1.6), SD(-8, 16.8, -6), SD(13, 19.8, 5.6), RN(11, -16, 16)],
    [P(-7, 7.7), P(6.5, 6.7), P(-13, 19.7, 1.7), P(11, 22.5, 1.4), SD(-10.5, 36.3, 3.4), RN(15, -16, 16)],
  ];
  const WAVES = [
    ['soldier', 'soldier', 'grenadier', 'runner', 'soldier', 'soldier', 'heavy', 'soldier'],
    ['soldier', 'officer', 'soldier', 'heavy', 'jeep', 'grenadier', 'runner', 'soldier', 'soldier', 'heavy'],
    ['bunker', 'soldier', 'soldier', 'grenadier', 'soldier', 'officer', 'heavy', 'soldier'],
    ['soldier', 'soldier', 'officer', 'grenadier', 'runner', 'soldier', 'heavy', 'soldier', 'grenadier', 'soldier'],
    ['prone', 'soldier', 'prone', 'runner', 'officer', 'prone', 'heavy', 'soldier', 'grenadier', 'prone'],
    ['soldier', 'soldier', 'heavy', 'soldier', 'soldier'],
  ];
  const SCENE_NAMES = ['הדיונות', 'השיירה השרופה', 'הגדר והבונקר', 'מחנה האספקה', 'הרכס', 'השריון'];
  const SCENE_RADIO = [
    NAME + ', השחר עולה. נקה את העמדות מאחורי שקי החול!',
    'שיירה שרופה לפנינו. היזהר מג׳יפים!',
    'גדר תיל ובונקר. זרוק רימון לתוך החרך!',
    'מחנה אספקה. החביות מלאות דלק, תירה בהן!',
    'הם שוכבים על הרכס. חפש ראשים מעל הסלעים!',
    'טנק! כוון לצריח ולמקלע. את הפגזים אפשר ליירט!',
  ];

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

  // ---------- מצב משחק ----------
  const G = { mx: W / 2, my: H / 2, down: false, pressed: false, duck: false, t: 0, screen: 'loading', shake: 0, dmg: 0, flash: 0 };
  let L = null;
  const ENTS = [], PROJS = [], ITEMS = [], POPS = [], MYNADES = [];

  function startGame(cp) {
    L = { scene: -1, lives: 5, max: 5, score: 0, shots: 0, hits: 0, kills: 0, heads: 0, neutral: 0, combo: 0, maxCombo: 0, dmgTaken: 0, blocked: 0,
      inv: { uzi: weapon('uzi', true) }, cur: 'uzi', swapT: 0, duckK: 0, slowT: 0, radio: null, hint: null, phase: 'move', pt: 0, time: 0 };
    ENTS.length = 0; PROJS.length = 0; ITEMS.length = 0;
    G.screen = 'play'; showScreen(null);
    S.init(); S.startMusic('six');
    if (cp) {
      Object.assign(L, cp.stats || {}); L.score = cp.score; L.lives = Math.max(2, cp.lives); L.inv = {};
      Object.keys(cp.inv || {}).forEach(k => { if (!WEAPONS[k]) return; const w = weapon(k, k === 'uzi'); w.ammo = cp.inv[k].ammo; if (k !== 'uzi') w.reserve = cp.inv[k].reserve; L.inv[k] = w; });
      if (!L.inv.uzi) L.inv.uzi = weapon('uzi', true);
      L.cur = L.inv[cp.cur] ? cp.cur : 'uzi'; L.fromCp = true;
    }
    const tgt = cp ? cp.scene : 0;
    L.cam = { a: cp ? stopPos(tgt).add(new T.Vector3(-6, 7, 14)) : new T.Vector3(-14, 16, 34), ay: cp ? 0.3 : 0.5, b: stopPos(tgt), by: STOPS[tgt].yaw, t: 0, dur: cp ? 2.4 : 3.6, intro: true }; L.next = tgt;
    if (PF) { PROFILE.level(PF, LV).plays++; PROFILE.save(PF); }
  }
  // נקודת ביקורת בתחילת כל אזור
  function saveCheckpoint() {
    if (!PF || L.scene < 0) return;
    const inv = {}; Object.keys(L.inv).forEach(k => { const w = L.inv[k]; if (w) inv[k] = { ammo: w.ammo, reserve: w.base ? null : w.reserve }; });
    PROFILE.level(PF, LV).checkpoint = { scene: L.scene, score: L.score, lives: L.lives, inv, cur: L.cur, at: Date.now(),
      stats: { shots: L.shots, hits: L.hits, kills: L.kills, heads: L.heads, neutral: L.neutral, dmgTaken: L.dmgTaken, blocked: L.blocked, maxCombo: L.maxCombo } };
    PROFILE.save(PF);
  }
  function checkpoint() { return PF ? PROFILE.level(PF, LV).checkpoint : null; }
  function reloadInto(mode) { try { sessionStorage.setItem('kav-start', mode); } catch (e) { } location.reload(); }
  function pause() {
    if (G.screen !== 'play' || !L) return;
    G.screen = 'pause'; G.duck = false; G.down = false; S.stopMusic();
    $('pause-text').textContent = L.scene >= 0 ? `${NAME}, אתה באזור ${L.scene + 1} מתוך ${NSC} עם ${L.score.toLocaleString('he-IL')} נקודות. אם תצא עכשיו, תחזור לתחילת האזור הזה עם הניקוד והנשקים שהיו לך בו.` : `${NAME}, השלב עוד לא התחיל.`;
    showScreen('pause');
  }
  function resumeGame() { if (G.screen !== 'pause') return; G.screen = 'play'; showScreen(null); last = performance.now(); S.startMusic('six'); }
  function stopPos(i) { const p = STOPS[i].pos; return new T.Vector3(p[0], groundH(p[0], p[1]) + 1.65, p[1]); }

  function beginScene(i) {
    L.scene = i; L.phase = 'fight'; L.pt = 0;
    saveCheckpoint();
    L.queue = WAVES[i].slice(); L.spawnT = 0.8; L.maxActive = Math.min(5, 2 + Math.ceil(i / 2)); L.crate = false;
    SPOTS[i].forEach(s => { s.busy = false; if (s.k === 'pop' || s.k === 'prone') s.top = coverTopAt(i, s); });
    if (i === 5) L.bossT = 2.5;
    hint(`אזור ${i + 1} מתוך ${NSC}: ${SCENE_NAMES[i]}`);
    radio(SCENE_RADIO[i]);
    if (i === 0) setTimeout(() => { if (L && L.scene === 0) hint(isTouch ? 'החזק את כפתור המחסה כדי להתכופף' : 'החזק רווח כדי להתכופף מאחורי שקי החול'); }, 3000);
  }
  // גובה המחסה האמיתי מול נקודת הופעה, יחסית לקרקע שלה
  function coverTopAt(i, s) {
    if (s.top0 === undefined) s.top0 = s.top;
    const [x, z] = LW(i, s.x, s.d), gy = groundH(x, z), cam = STOPS[i].pos;
    let best = -1;
    COVERS.forEach(o => {
      const c = o.userData.cover; if (!c.top || c.dead) return;
      const dx = o.position.x - x, dz = o.position.z - z;
      if (Math.hypot(dx, dz) > 2.8) return;
      if (Math.hypot(o.position.x - cam[0], o.position.z - cam[1]) > Math.hypot(x - cam[0], z - cam[1]) + 0.3) return;
      best = Math.max(best, c.top - gy);
    });
    return best > 0 ? best : s.top0;
  }
  function radio(text) { L.radio = { text, t: 3.6 }; S.play('radio'); }
  function hint(text, big) { L.hint = { text, t: 2.8, big }; }
  function pop(text, pos3, col, size) { POPS.push({ text, p: pos3.clone(), col: col || '#fff', t: 1.1, size: size || 1 }); }

  // ---------- אויבים ----------
  function freeSpot(kinds) { const c = SPOTS[L.scene].filter(s => !s.busy && kinds.includes(s.k)); return c.length ? c[Math.floor(rand() * c.length)] : null; }
  function aimTime(e) { const m = { heavy: 1.15, jeep: 1.3, officer: 0.8, prone: 0.9, bunker: 1.1 }[e.type] || 1; return 2.0 * m * (0.9 + rand() * 0.3); }

  function makeCard() {
    const geo = new T.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ alphaTest: 0.5, side: T.DoubleSide, color: new T.Color('#f6e0c8') }));
    m.castShadow = true; scene.add(m); return m;
  }
  const SHOW = { aim: 0.98, gunner: 1.05, throw: 1.2, surrender: 1.25, idle: 1.2, kneel: 0.95, officer: 1.2, prone: 0.62 };
  function setPose(e, key) {
    const sp = SPRITES[key]; e.pose = key; e.sp = sp;
    e.mesh.material.map = TEX[sp.f]; e.mesh.material.needsUpdate = true;
    const h = sp.h * (e.scale || 1); e.mesh.scale.set(h * sp.aspect * (e.flipX ? -1 : 1), h, 1); e.h = h;
    if (e.spot && (e.spot.k === 'pop' || e.spot.k === 'prone')) { const gy = e.base.y; e.upY = gy + e.spot.top - h + (SHOW[key] || 1); e.downY = gy + Math.min(e.spot.top, 1) - h - 0.15; }
    else if (e.base) { e.upY = e.base.y - 0.05; e.downY = e.base.y - h - 0.1; }
  }

  function spawn(type) {
    const i = L.scene;
    if (type === 'jeep') {
      const dir = rand() < 0.5 ? 1 : -1, [lx, z] = LW(i, 0, 18 + rand() * 1.5);
      const e = { type: 'jeep', hp: 16, max: 16, state: 'drive', t: 0, dir, z, x: lx + (dir > 0 ? -30 : 34), stopX: lx - 3 + rand() * 8, hostile: true, flash: 0 };
      e.mesh = makeCard(); e.flipX = dir < 0; setPose(e, 'jeep');
      e.mesh.position.set(e.x, groundH(e.x, z), z); ENTS.push(e); S.play('alert'); radio('ג׳יפ עם מקלע! השמד אותו!'); return true;
    }
    if (type === 'bunker') {
      const [x, z] = LW(i, 0, 21);
      const e = { type: 'bunker', hp: 40, max: 40, state: 'fight', t: 0, timer: 2, aim: 0, aimDur: 0, hostile: true, flash: 0 };
      e.mesh = makeCard(); setPose(e, 'bunker'); e.mesh.position.set(x, groundH(x, z) - 0.2, z);
      ENTS.push(e); return true;
    }
    let sp;
    if (type === 'runner') sp = freeSpot(['run']);
    else if (type === 'prone') sp = freeSpot(['prone']);
    else if (type === 'officer') sp = freeSpot(['open']) || freeSpot(['side']);
    else if (type === 'heavy') sp = freeSpot(['open', 'pop']);
    else if (type === 'grenadier') sp = freeSpot(['pop', 'open']);
    else sp = freeSpot(['pop', 'side', 'open', 'prone']);
    if (!sp) sp = freeSpot(['pop', 'side', 'open', 'prone']);
    if (!sp) return false;
    sp.busy = true;
    const e = { type, spot: sp, hp: type === 'heavy' ? 6 : 2, max: type === 'heavy' ? 6 : 2, state: 'wait', t: 0, delay: 0.1 + rand() * 0.4, k: 0, shots: 0, maxShots: 2 + Math.floor(rand() * 2), hostile: true, flash: 0, scale: 0.97 + rand() * 0.08 };
    if (sp.k === 'prone') e.type = 'prone';
    if (sp.k === 'run' && type !== 'runner') e.type = 'runner';
    e.mesh = makeCard();
    if (sp.k === 'run') { const [x0] = LW(i, sp.x0, sp.d), [x1, z] = LW(i, sp.x1, sp.d); e.dir = rand() < 0.5 ? 1 : -1; e.rx0 = x0; e.rx1 = x1; e.z = z; e.x = e.dir > 0 ? x0 : x1; e.stopX = lerp(x0, x1, 0.3 + rand() * 0.4); e.state = 'run'; e.k = 1; e.base = at(e.x, z); e.flipX = e.dir < 0; setPose(e, 'run'); }
    else {
      const [x, z] = LW(i, sp.x, sp.d); e.base = at(x, z);
      if (sp.k === 'side') { e.x0 = x; e.x1 = x + sp.dx; }
      const pose = e.type === 'prone' ? 'prone' : e.type === 'heavy' ? 'gunner' : e.type === 'grenadier' ? 'throw' : e.type === 'officer' ? 'officer' : sp.k === 'pop' ? 'aim' : sp.k === 'side' ? 'kneel' : 'idle';
      setPose(e, pose);
    }
    placeEnt(e); ENTS.push(e); return true;
  }

  function placeEnt(e) {
    const m = e.mesh, sp = e.spot;
    if (e.type === 'jeep') { m.position.set(e.x, groundH(e.x, e.z) - 0.1, e.z); return; }
    if (sp && sp.k === 'side') { const x = lerp(e.x0, e.x1, ease(e.k)); m.position.set(x, groundH(x, e.base.z) - 0.05, e.base.z); }
    else if (sp && sp.k === 'run') { m.position.set(e.x, groundH(e.x, e.z) - 0.05 + (e.pose === 'run' ? Math.abs(Math.sin(G.t * 11)) * 0.07 : 0), e.z); }
    else { m.position.set(e.base.x, lerp(e.downY, e.upY, ease(e.k)), e.base.z); }
  }
  function localPt(e, uv) { return e.mesh.localToWorld(new T.Vector3(uv[0] - 0.5, 1 - uv[1], 0.05)); }
  function muzzleWorld(e) { return e.sp.muzzle ? localPt(e, e.sp.muzzle) : e.mesh.localToWorld(new T.Vector3(0, 0.7, 0)); }
  function headWorld(e) { const hb = e.sp.head || [0.4, 0, 0.6, 0.15]; return localPt(e, [(hb[0] + hb[2]) / 2, (hb[1] + hb[3]) / 2]); }
  function face(m, k) { m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z) * (k || 1); }

  function updEnt(e, dt) {
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    const m = e.mesh; face(m);
    const f = Math.max(0, e.flash) * 8; if (e.state !== 'dead' || e.type === 'jeep' || e.type === 'bunker') { if (!(e.state === 'dead' && (e.type === 'jeep' || e.type === 'bunker'))) m.material.color.setRGB(1 + f, 0.94 + f, 0.86 + f); }
    if (e.type === 'jeep') return updJeep(e, dt);
    if (e.type === 'bunker') return updBunker(e, dt);
    switch (e.state) {
      case 'wait': if (e.t > e.delay) { e.state = 'emerge'; e.t = 0; } break;
      case 'emerge': e.k = Math.min(1, e.k + dt / 0.38); if (e.k >= 1) { e.state = 'pre'; e.t = 0; } break;
      case 'pre':
        if (e.t > 0.25) {
          if (e.type === 'grenadier' && !e.thrown) { e.state = 'throw'; e.t = 0; break; }
          if (e.spot.k === 'open' && e.pose === 'idle') setPose(e, 'kneel');
          if (e.pose === 'throw') setPose(e, e.spot.k === 'pop' ? 'aim' : 'kneel');
          e.state = 'aim'; e.t = 0; e.aim = aimTime(e) + (e.first ? 0 : 0.3); e.first = true; S.play('alert');
        }
        break;
      case 'throw': if (e.t > 0.55 && !e.thrown) { e.thrown = true; throwGrenadeAtPlayer(muzzleWorld(e)); } if (e.t > 0.9) { e.state = 'duck'; e.t = 0; } break;
      case 'aim': if (e.t >= e.aim) { enemyFire(e); e.state = 'fire'; e.t = 0; } break;
      case 'fire':
        if (e.t > 0.15) {
          e.shots++;
          if (e.spot.k === 'run') { e.state = 'run2'; }
          else if (e.shots >= e.maxShots && e.spot.k !== 'open') { e.state = 'duck'; e.t = 0; }
          else { e.state = 'aim'; e.t = 0; e.aim = aimTime(e) * 0.85; }
        }
        break;
      case 'duck': e.k = Math.max(0, e.k - dt / 0.28); if (e.k <= 0) { e.state = 'wait'; e.t = 0; e.delay = 0.8 + rand() * 1.4; e.shots = 0; e.maxShots = 1 + Math.floor(rand() * 3); if (e.type === 'grenadier') { e.thrown = rand() < 0.5; setPose(e, e.thrown ? (e.spot.k === 'pop' ? 'aim' : 'kneel') : 'throw'); } } break;
      case 'run': case 'run2': {
        e.x += e.dir * 4.4 * dt;
        if (e.state === 'run' && ((e.dir > 0 && e.x > e.stopX) || (e.dir < 0 && e.x < e.stopX))) { e.flipX = false; setPose(e, 'kneel'); e.state = 'aim'; e.t = 0; e.aim = aimTime(e) * 0.9; }
        if (e.state === 'run2' && e.pose !== 'run') { e.flipX = e.dir < 0; setPose(e, 'run'); }
        if (e.x < Math.min(e.rx0, e.rx1) - 2 || e.x > Math.max(e.rx0, e.rx1) + 2) e.state = 'gone';
        if (rand() < dt * 6) sandPuff(m.position.clone(), 0.4);
        break;
      }
      case 'surrender': e.t2 = (e.t2 || 0) + dt; if (e.t2 > 1.3) { e.k = Math.max(0, e.k - dt * 2); if (!e.spot || e.spot.k === 'run' || e.spot.k === 'open' || e.spot.k === 'side') { m.material.transparent = true; m.material.opacity = e.k; } if (e.k <= 0) e.state = 'gone'; } break;
      case 'dead': {
        e.vel.y -= 9 * dt; m.position.addScaledVector(e.vel, dt);
        const gy = groundH(m.position.x, m.position.z) - 0.2;
        if (m.position.y < gy) { m.position.y = gy; if (!e.landed) { e.landed = true; sandPuff(m.position.clone(), 1); } e.vel.set(0, 0, 0); }
        e.rot = Math.min(1.45, (e.rot || 0) + dt * 4); m.rotation.z = e.rot * e.fall;
        e.fade += dt; if (e.fade > 1.4) { m.material.transparent = true; m.material.opacity = Math.max(0, 1 - (e.fade - 1.4) / 0.6); if (e.fade > 2) e.state = 'gone'; }
        return;
      }
    }
    if (e.state === 'surrender' && e.spot && (e.spot.k === 'run' || e.spot.k === 'open' || e.spot.k === 'side')) return;
    if (e.state !== 'dead' && e.state !== 'gone') placeEnt(e);
  }

  function updJeep(e, dt) {
    if (e.state === 'drive') { const dx = e.stopX - e.x; e.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 9); if (Math.abs(dx) < 0.05) { e.state = 'aim'; e.t = 0; e.aim = aimTime(e); } if (rand() < dt * 30) sandPuff(e.mesh.position.clone().add(new T.Vector3(-e.dir * 1.6, 0.2, 0)), 1.2); }
    else if (e.state === 'aim') { if (e.t >= e.aim) { enemyFire(e); e.t = 0; e.aim = aimTime(e) * 0.85; } }
    else if (e.state === 'dead') { burn(e.mesh.position, dt, 2); return; }
    placeEnt(e);
  }
  function updBunker(e, dt) {
    if (e.state === 'dead') { burn(e.mesh.position.clone().add(new T.Vector3(0, 1.2, 0)), dt, 2.5); return; }
    e.timer -= dt;
    if (e.timer <= 0 && !e.aimDur) { e.aimDur = aimTime(e); e.aim = 0; }
    if (e.aimDur) { e.aim += dt; if (e.aim >= e.aimDur) { enemyFire(e); e.aimDur = 0; e.timer = 1.4 + rand(); } }
  }
  function burn(p, dt, k) { if (rand() < dt * 10) smoke(p.clone().add(new T.Vector3((rand() - 0.5) * k, 1.5, 0)), 1.4 * k / 2, true); if (rand() < dt * 14) fire(p.clone().add(new T.Vector3((rand() - 0.5) * k, 0.8 + rand(), 0.2)), 0.8); }

  function enemyFire(e) {
    const p = muzzleWorld(e);
    flashAt(p, e.type === 'jeep' || e.type === 'bunker' ? 1.6 : e.type === 'officer' ? 0.8 : 1.1);
    S.play(e.type === 'heavy' || e.type === 'bunker' ? 'mg' : 'enemyShot');
    tracer3(p, camera.position.clone().add(new T.Vector3((rand() - 0.5) * 0.6, -0.3, 0)), '#ffcf80');
    playerHit(p);
  }

  function ducked() { return L && L.duckK > 0.55; }
  function playerHit() {
    if (G.screen !== 'play' || L.phase !== 'fight') return;
    if (ducked()) {
      L.blocked++; const sb = camera.position.clone().add(new T.Vector3((rand() - 0.5) * 1.6, -0.1 + rand() * 0.3, -1.6)); sandPuff(sb, 0.5); sparks(sb, 4);
      if (rand() < 0.4) S.play('ricochet'); return;
    }
    L.lives--; L.dmgTaken++; L.combo = 0; G.dmg = 1; G.shake = Math.max(G.shake, 0.6); S.play('hurt');
    if (rand() < 0.35) radio(['נפגעת! תתכופף!', 'חובש! לפה!', 'תמשיך לירות, ' + NAME + '!'][Math.floor(rand() * 3)]);
    if (L.lives <= 0) { L.lives = 0; G.screen = 'dying'; setTimeout(gameOver, 900); }
  }

  // ---------- בוס ----------
  function makeTank() {
    const [x, z] = LW(5, 18, 55), [tx, tz] = LW(5, 3, 22);
    const e = { type: 'tank', state: 'drive', t: 0, x, z, tx, tz, hostile: true, flash: 0, parts: [
      { id: 'turret', u: 0.47, v: 0.22, r: 0.075, hp: 55, max: 55, core: true, alive: true },
      { id: 'mg', u: 0.84, v: 0.55, r: 0.05, hp: 14, max: 14, alive: true, aim: 0, aimDur: 0, timer: 3 },
    ], shellT: 4.5 };
    e.mesh = makeCard(); e.scale = 1.3; setPose(e, 'tank'); e.mesh.position.set(x, groundH(x, z), z);
    ENTS.push(e); L.boss = e; S.play('alert'); hint('טנק כבד!', true);
    return e;
  }
  function partWorld(e, p) { return localPt(e, [p.u, p.v]); }
  function updTank(e, dt) {
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    const m = e.mesh; face(m, 0.6);
    const f = Math.max(0, e.flash) * 6; if (e.state !== 'dead') m.material.color.setRGB(1 + f, 0.94 + f, 0.86 + f);
    if (e.state === 'dead') { const tp = partWorld(e, e.parts[0]); burn(tp, dt, 3); e.dt2 = (e.dt2 || 0) + dt; if (e.dt2 < 2 && rand() < dt * 6) explode(tp.add(new T.Vector3((rand() - 0.5) * 4, rand() * 2, 0)), 1.3); return; }
    if (e.state === 'drive') { e.x = lerp(e.x, e.tx, dt * 0.35); e.z = lerp(e.z, e.tz, dt * 0.35); if (Math.hypot(e.x - e.tx, e.z - e.tz) < 0.6) e.state = 'fight'; if (rand() < dt * 20) sandPuff(m.position.clone().add(new T.Vector3((rand() - 0.5) * 6, 0.3, 1)), 2); }
    else e.x = e.tx + Math.sin(e.t * 0.35) * 4;
    m.position.set(e.x, groundH(e.x, e.z) - 0.25, e.z);
    e.shellT -= dt;
    if (e.shellT <= 0 && e.parts[0].alive) { e.shellT = 4 + rand() * 1.5; const mp = muzzleWorld(e); flashAt(mp, 4); S.play('explosion', { vol: 0.6 }); smoke(mp, 2.5); fireProj('shell', mp); G.shake = Math.max(G.shake, 0.4); }
    const mg = e.parts[1];
    if (mg.alive) { mg.timer -= dt; if (mg.timer <= 0 && !mg.aimDur) { mg.aimDur = 2.2; mg.aim = 0; } if (mg.aimDur) { mg.aim += dt; if (mg.aim >= mg.aimDur) { const p = partWorld(e, mg); flashAt(p, 1.3); S.play('mg'); playerHit(); mg.aimDur = 0; mg.timer = 2.6; } } }
  }

  // ---------- פגזים ורימונים ----------
  let grenadeGeo, grenadeMat;
  function nadeMesh() { if (!grenadeGeo) { grenadeGeo = new T.SphereGeometry(0.09, 10, 8); grenadeMat = new T.MeshStandardMaterial({ color: lin('#3a4228'), roughness: 0.6 }); } const m = new T.Mesh(grenadeGeo, grenadeMat); m.castShadow = true; scene.add(m); return m; }
  function fireProj(kind, from) {
    const to = camera.position.clone().add(new T.Vector3((rand() - 0.5) * 1.2, -0.5 + rand() * 0.3, -1.4));
    let mesh;
    if (kind === 'grenade') mesh = nadeMesh();
    else { mesh = new T.Sprite(new T.SpriteMaterial({ map: partTex.soft, color: lin('#ffb040'), blending: T.AdditiveBlending, depthWrite: false })); mesh.scale.setScalar(1.4); scene.add(mesh); }
    PROJS.push({ kind, from, to, t: 0, dur: kind === 'grenade' ? 1.7 : 2.0, arc: kind === 'grenade' ? 3.2 : 3, mesh, hp: kind === 'grenade' ? 1 : 2, r: kind === 'grenade' ? 0.7 : 0.9 });
  }
  function throwGrenadeAtPlayer(from) { S.play('throw'); fireProj('grenade', from); }
  function throwMine(target) { const m = nadeMesh(); const from = camera.position.clone().add(new T.Vector3(0.3, -0.4, -0.5)); MYNADES.push({ m, from, to: target, t: 0, dur: clamp(from.distanceTo(target) / 22, 0.35, 1.1) }); }

  // ---------- אפקטים ----------
  function sprite(tex, col, blend, size) { const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: lin(col), blending: blend || T.NormalBlending, depthWrite: false, transparent: true })); s.scale.setScalar(size); scene.add(s); return s; }
  function addPart(o) { if (PARTS.length > 450) { const x = PARTS.shift(); scene.remove(x.s); x.s.material.dispose(); } PARTS.push(o); }
  function flashAt(p, k) { const s = sprite(partTex.flash, '#fff2c8', T.AdditiveBlending, 1.1 * k); s.position.copy(p); s.material.rotation = rand() * 6; addPart({ s, life: 0.06, t: 0, v: new T.Vector3(), fade: true }); const l = sprite(partTex.soft, '#ffb060', T.AdditiveBlending, 3 * k); l.position.copy(p); addPart({ s: l, life: 0.08, t: 0, v: new T.Vector3(), fade: true }); }
  function sandPuff(p, k) { for (let i = 0; i < 3; i++) { const s = sprite(partTex.smoke, '#d9b48a', T.NormalBlending, (0.5 + rand() * 0.5) * k); s.position.copy(p).add(new T.Vector3((rand() - 0.5) * 0.4 * k, 0.1, (rand() - 0.5) * 0.4)); s.material.opacity = 0.6; addPart({ s, life: 0.9 + rand() * 0.6, t: 0, v: new T.Vector3((rand() - 0.5) * 1.2, 0.6 + rand() * 0.8, (rand() - 0.5) * 0.6), grow: 1.4 * k, fade: true, op: 0.6 }); } }
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
  function tracer3(a, b, col) {
    const l = new T.Line(new T.BufferGeometry().setFromPoints([a, b]), new T.LineBasicMaterial({ color: lin(col), transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
    scene.add(l); TRACERS.push({ l, t: 0.07 });
  }
  function decal(point, normal) {
    const m = new T.Mesh(new T.PlaneGeometry(0.16, 0.16), new T.MeshBasicMaterial({ map: partTex.decal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.position.copy(point).addScaledVector(normal, 0.01); m.lookAt(point.clone().add(normal)); scene.add(m);
    DECALS.push(m); if (DECALS.length > 90) { const d = DECALS.shift(); scene.remove(d); d.geometry.dispose(); d.material.dispose(); }
  }

  // ---------- מחסות שנהרסות ----------
  function damageCover(o, dmg, point) {
    const c = o.userData.cover; if (!c.hp || c.dead) return false;
    c.hp -= dmg;
    if (c.hp > 0) { if (c.kind === 'crate' && point) debris(point, 0.35); return false; }
    destroyCover(o); return true;
  }
  function destroyCover(o) {
    const c = o.userData.cover; if (c.dead) return; c.dead = true;
    scene.remove(o); const idx = COVERS.indexOf(o); if (idx >= 0) COVERS.splice(idx, 1);
    const p = o.position.clone();
    if (c.kind === 'crate') {
      for (let i = 0; i < 12; i++) debris(p.clone().add(new T.Vector3((rand() - 0.5) * c.size, (rand() - 0.5) * c.size * 0.6, 0)), 1);
      sandPuff(p, 1.4); S.play('metal'); score(50, p, 'ארגז!');
      if (c.above && !c.above.userData.cover.dead) { c.above.userData.cover.on = null; FALLING.push({ m: c.above, vy: 0, floor: groundH(c.above.position.x, c.above.position.z) + c.above.userData.cover.size * 0.4 }); }
    } else if (c.kind === 'barrel') {
      explode(p.clone().add(new T.Vector3(0, 0.5, 0)), 1.5); score(100, p, 'בום!');
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
    ENTS.forEach(e => {
      if (e.state === 'dead' || e.state === 'gone' || e.state === 'wait') return;
      if (e.type === 'tank') { e.parts.forEach(pt => { if (!pt.alive) return; const w = partWorld(e, pt), d = w.distanceTo(p); if (d < r + 1.5) hitPart(e, pt, dmg * (1 - d / (r + 2)), w); }); return; }
      const c = e.mesh.position.clone().add(new T.Vector3(0, (e.h || 1.5) * 0.5, 0)); const d = c.distanceTo(p);
      if (e.type === 'bunker') { if (d < r + 2.5) bunkerDmg(e, dmg * 2, c); return; }
      if (d < r) hitEnt(e, 0.5, 0.5, c, { dmg: dmg * (1.2 - d / r) + 2, splash: true });
    });
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
    const hit = resolve(G.mx + (rand() - 0.5) * spr, G.my + (rand() - 0.5) * spr, w.d);
    if (hit) L.hits++; else L.combo = 0;
    if (w.d.auto) G.heat = Math.min(1.5, (G.heat || 0) + 0.1);
    gunFlash = 0.06;
    if (w.ammo === 0 && !w.base && w.reserve <= 0) setTimeout(() => { if (L.inv[w.k] === w) { delete L.inv[w.k]; if (L.cur === w.k) { L.cur = 'uzi'; L.swapT = 0.35; } hint('חזרה לעוזי'); } }, 300);
    else if (w.ammo === 0 && isTouch) setTimeout(reload, 150);
  }
  function reload() { const w = curW(); if (w.d.thrown || w.reloading || w.ammo === w.d.mag || (!w.base && w.reserve <= 0)) return; w.reloading = true; w.rt = 0; S.play('reload'); L.needReload = 0; }

  function resolve(px, py, wd) {
    ndc.set(px / W * 2 - 1, -(py / H * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const ray = raycaster.ray;
    const from = camera.position.clone().add(new T.Vector3(0, -0.25, 0)).addScaledVector(ray.direction, 0.9);
    for (const p of PROJS) { if (ray.distanceToPoint(p.mesh.position) < p.r) { p.hp -= wd.dmg; sparks(p.mesh.position, 6); if (p.hp <= 0) { p.dead = true; explode(p.mesh.position.clone(), p.kind === 'grenade' ? 0.7 : 0.9); score(150, p.mesh.position, 'יירוט!'); } return true; } }
    for (const it of ITEMS) { if (ray.distanceToPoint(it.pos) < 0.75) { collect(it); return true; } }
    const objs = [ground, ...COVERS];
    ENTS.forEach(e => { if (e.state !== 'dead' && e.state !== 'gone' && e.state !== 'wait') objs.push(e.mesh); });
    const hits = raycaster.intersectObjects(objs, false);
    let any = false;
    for (const h of hits) {
      const o = h.object, ent = ENTS.find(e => e.mesh === o);
      if (ent) {
        if (alphaAt(ent.sp.f, h.uv.x, h.uv.y) < 110) continue;
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
      if (e.hp <= 0) { e.state = 'dead'; e.hostile = false; explode(e.mesh.position.clone().add(new T.Vector3(0, 1.2, 0.3)), 1.6); e.mesh.material.color.setRGB(0.3, 0.28, 0.26); L.kills++; score(800, point, 'ג׳יפ הושמד!'); dropItem(e.mesh.position.clone().add(new T.Vector3(0, 2.4, 1))); }
      return;
    }
    if (e.state === 'surrender' || e.state === 'dead') return;
    const hb = e.sp.head || [0, 0, 0, 0], iy = 1 - v;
    const head = !wd.splash && u > hb[0] - 0.04 && u < hb[2] + 0.04 && iy > hb[1] && iy < hb[3] + 0.03;
    const legs = !wd.splash && ['idle', 'kneel', 'officer', 'run', 'throw'].includes(e.pose) && iy > 0.62;
    if (legs && e.type !== 'heavy' && e.hp <= 2 && wd.dmg < 3) {
      e.state = 'surrender'; e.hostile = false; L.kills++; L.neutral++; score(250, point, 'ניטרול!'); S.play('hit'); sparks(point, 4, '#fff');
      e.flipX = false; setPose(e, 'surrender'); e.k = 1; e.t2 = 0; if (e.spot) e.spot.busy = false;
      if (e.spot && (e.spot.k === 'run' || e.spot.k === 'open' || e.spot.k === 'side')) e.mesh.position.y = groundH(e.mesh.position.x, e.mesh.position.z) - 0.05;
      return;
    }
    e.hp -= wd.dmg * (head ? 3 : 1); sandPuff(point, 0.2); sparks(point, 3, '#ffcf9a');
    if (!wd.splash) S.play(head ? 'head' : 'hit');
    if (e.hp <= 0) kill(e, head, point);
    else if (e.state === 'aim') e.t = Math.max(0, e.t - 0.3);
  }
  function kill(e, head, point) {
    e.state = 'dead'; e.hostile = false; L.kills++; if (e.spot) e.spot.busy = false;
    const base = { heavy: 300, officer: 300, prone: 200, grenadier: 150 }[e.type] || 100;
    if (head) { L.heads++; score(base + 150, point, 'ראש!'); } else score(base, point);
    const pos = e.mesh.position.clone();
    e.flipX = false; setPose(e, 'hit'); e.mesh.position.copy(pos);
    const away = new T.Vector3().subVectors(pos, camera.position).setY(0).normalize();
    e.vel = away.multiplyScalar(2.2).add(new T.Vector3(0, 2.4, 0)); e.fall = rand() < 0.5 ? 1 : -1; e.fade = 0;
    if (rand() < 0.2) dropItem(headWorld(e).add(new T.Vector3(0, 0.6, 0)));
  }
  function hitPart(e, p, dmg, point) {
    if (!p.alive || e.state === 'dead') return;
    p.hp -= dmg; e.flash = 0.05; sparks(point, 8); L.score += 10;
    if (p.hp <= 0) { p.alive = false; explode(partWorld(e, p), p.core ? 2.4 : 1.2); score(p.core ? 5000 : 800, point, p.core ? 'הטנק הושמד!' : 'המקלע הושמד!'); if (p.core) { e.state = 'dead'; e.hostile = false; e.mesh.material.color.setRGB(0.32, 0.3, 0.28); L.kills++; } }
  }
  function tankHit(e, u, v, point, wd) {
    for (const p of e.parts) {
      if (!p.alive) continue;
      const du = (u - p.u) * e.mesh.scale.x / e.mesh.scale.y, dv = (1 - v) - p.v;
      if (Math.hypot(du, dv) < p.r * 1.25) { hitPart(e, p, wd.dmg, point); S.play('hit'); L.combo++; return; }
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
    if (e.hp <= 0) { e.state = 'dead'; e.hostile = false; explode(e.mesh.position.clone().add(new T.Vector3(0, 1.5, 0.5)), 2.4); e.mesh.material.color.setRGB(0.35, 0.32, 0.3); L.kills++; score(2000, point, 'הבונקר הושמד!'); }
  }

  // ---------- פריטים ----------
  function dropItem(pos) {
    const r = rand(); const kind = r < 0.35 && L.lives < L.max ? 'heal' : r < 0.55 ? 'slow' : 'weapon';
    ITEMS.push({ kind, wk: ['fal', 'mag', 'grenade'][Math.floor(rand() * 3)], pos, t: 0, life: 7.5 });
  }
  function collect(it) {
    it.dead = true; S.play('pickup');
    if (it.kind === 'heal') { L.lives = Math.min(L.max, L.lives + 1); pop('מימייה +1', it.pos, '#9be36a'); }
    else if (it.kind === 'slow') { L.slowT = 6; pop('קפה שחור! הזמן מאט', it.pos, '#ffd85a'); }
    else { giveWeapon(it.wk); pop(WEAPONS[it.wk].name + '!', it.pos, '#ffd85a', 1.1); }
    sparks(it.pos, 14, '#fff6c0');
  }

  // ---------- לולאה ----------
  let last = performance.now(), gunFlash = 0;
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

    if (L.phase === 'move') {
      const c = L.cam; c.t += rdt / c.dur; const k = ease(Math.min(1, c.t));
      L.camPos = new T.Vector3().lerpVectors(c.a, c.b, k); L.camPos.y += Math.sin(k * Math.PI) * (c.intro ? 2 : 0.6);
      if (!c.intro) L.camPos.y += Math.abs(Math.sin(c.t * c.dur * 7)) * 0.07;
      L.yaw = lerp(c.ay, c.by, k); L.pitch = c.intro ? lerp(-0.35, 0, k) : 0;
      if (c.t >= 1) beginScene(L.next);
    }
    if (L.phase === 'fight') {
      L.pt += rdt; L.spawnT -= dt;
      const active = ENTS.filter(e => e.hostile && e.state !== 'gone' && e.state !== 'dead' && e.type !== 'tank' && e.type !== 'bunker').length;
      if (L.queue.length && L.spawnT <= 0 && active < L.maxActive) { if (spawn(L.queue[0])) L.queue.shift(); else L.queue.push(L.queue.shift()); L.spawnT = 0.5 + rand() * 0.9; }
      if (L.scene === 5) { if (!L.boss) { L.bossT -= rdt; if (L.bossT <= 0) makeTank(); } else if (L.boss.state !== 'dead' && !L.queue.length && active < 2 && rand() < dt * 0.3) L.queue.push(rand() < 0.3 ? 'grenadier' : 'soldier'); }
      if (!L.crate && L.pt > (L.scene === 2 ? 3 : 7)) {
        L.crate = true; const c = COVERS.filter(o => !o.userData.sprite && o.position.distanceTo(camera.position) < 22 && o.position.distanceTo(camera.position) > 5); const o = c[Math.floor(rand() * c.length)];
        if (o) ITEMS.push({ kind: 'weapon', wk: L.scene === 2 ? 'grenade' : ['fal', 'mag', 'grenade'][Math.floor(rand() * 3)], pos: o.position.clone().add(new T.Vector3(0, 1.7, 0)), t: 0, life: 9 });
      }
      const left = ENTS.filter(e => e.hostile && e.state !== 'gone' && e.state !== 'dead').length;
      const bossOk = L.scene < 5 || (L.boss && L.boss.state === 'dead' && (L.boss.dt2 || 0) > 1.8);
      if (bossOk && L.scene === 5) { L.queue = []; ENTS.forEach(e => { if (e.hostile && e.type !== 'tank') { e.hostile = false; if (e.spot) { e.state = 'surrender'; e.t2 = 0; e.flipX = false; setPose(e, 'surrender'); e.k = 1; } else e.state = 'gone'; } }); }
      if (bossOk && !L.queue.length && left === 0) { L.phase = 'clear'; L.pt = 0; S.play('clear'); radio(L.scene < 5 ? ['האזור נקי! ממשיכים!', 'יפה מאוד, זזים קדימה!', 'הבונקר שותק. קדימה!', 'המחנה בידינו!', 'הרכס נקי. שמעתם את זה? שרשראות.'][L.scene] : 'הטנק עולה באש! הדרך לתעלה פתוחה!'); }
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
      if (p.kind === 'grenade') { p.mesh.rotation.x += dt * 12; if (rand() < 0.5) sparks(p.mesh.position, 1, '#ffcf6a'); }
      if (p.t >= 1 && !p.dead) { p.dead = true; G.flash = 0.25; S.play('explosion'); if (!ducked()) { playerHit(); G.shake = 1; } else { L.blocked++; explode(camera.position.clone().add(new T.Vector3(0, -0.4, -2.2)), 0.6); } }
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
    if (!L) { yaw = 0.4 + Math.sin(G.t * 0.1) * 0.2; cp = new T.Vector3(-10 + Math.sin(G.t * 0.08) * 8, 6, 20); pitch = -0.08; }
    else { cp = (L.camPos || new T.Vector3(-14, 16, 34)).clone(); yaw = L.yaw || 0; pitch = L.pitch || 0; }
    const dk = L ? ease(L.duckK) : 0;
    const sway = L && L.phase === 'fight' ? [(G.mx / W - 0.5) * 0.12, (G.my / H - 0.5) * 0.06] : [0, 0];
    camera.position.copy(cp); camera.position.y -= dk * 0.95; camera.position.x += dk * 0.15;
    if (G.shake > 0) { camera.position.x += (rand() - 0.5) * 0.12 * G.shake; camera.position.y += (rand() - 0.5) * 0.12 * G.shake; G.shake = Math.max(0, G.shake - rdt * 2); }
    camera.rotation.order = 'YXZ'; camera.rotation.set(pitch - sway[1] * (1 - dk) - dk * 0.12 + Math.sin(G.t * 1.3) * 0.004, yaw - sway[0] * (1 - dk), dk * 0.04);
    sun.position.copy(camera.position).add(new T.Vector3(-60, 26, -70)); sun.target.position.copy(camera.position).add(new T.Vector3(0, 0, -18));
    scene.userData.sky.position.x = camera.position.x; scene.userData.sky.position.z = camera.position.z;
    scene.userData.dust.rotation.y = G.t * 0.01;
    boomLight.intensity = Math.max(0, boomLight.intensity - rdt * 160);
    G.dmg = Math.max(0, G.dmg - rdt * 1.6); G.flash = Math.max(0, G.flash - rdt * 2);
    const u = finalPass.uniforms; u.time.value = G.t % 100; u.dmg.value = G.dmg; u.slow.value = L && L.slowT > 0 ? 1 : 0; u.flash.value = G.flash; u.duck.value = dk;
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
        e.parts.forEach(p => { if (!p.alive) return; const [x, y] = toScreen(partWorld(e, p)); const pulse = 0.5 + 0.5 * Math.sin(G.t * 6); hc.strokeStyle = `rgba(255,70,50,${0.55 + pulse * 0.4})`; hc.lineWidth = 3; hc.setLineDash([8, 6]); hc.beginPath(); hc.arc(x, y, 30 + pulse * 5, 0, 7); hc.stroke(); hc.setLineDash([]); hc.strokeStyle = '#ffcf4a'; hc.lineWidth = 4; hc.beginPath(); hc.arc(x, y, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.hp / p.max); hc.stroke(); if (p.aimDur) ring(x, y, 70, p.aim / p.aimDur); });
        return;
      }
      if (e.type === 'bunker') {
        const [x, y] = toScreen(muzzleWorld(e)); const pulse = 0.5 + 0.5 * Math.sin(G.t * 6);
        hc.strokeStyle = `rgba(255,70,50,${0.5 + pulse * 0.4})`; hc.lineWidth = 3; hc.setLineDash([8, 6]); hc.beginPath(); hc.ellipse(x, y, 70, 24, 0, 0, 7); hc.stroke(); hc.setLineDash([]);
        if (e.aimDur) ring(x, y, 80, e.aim / e.aimDur);
        const [bx, by] = toScreen(e.mesh.position.clone().add(new T.Vector3(0, e.h + 0.3, 0))); hc.fillStyle = 'rgba(0,0,0,0.6)'; hc.fillRect(bx - 52, by - 2, 104, 10); hc.fillStyle = '#d8423a'; hc.fillRect(bx - 50, by, 100 * Math.max(0, e.hp / e.max), 6);
        return;
      }
      if (e.state === 'aim') { const [x, y, z] = toScreen(e.type === 'jeep' ? muzzleWorld(e) : headWorld(e)); if (z < 1) ring(x, y + 10, 64, e.t / e.aim); }
      if (e.state === 'throw' && !e.thrown) { const [x, y] = toScreen(muzzleWorld(e)); txt('רימון!', x, y - 30, 22, '#ff6a4a'); }
      if ((e.type === 'heavy' || e.type === 'jeep') && e.hostile && e.state !== 'wait') { const [x, y] = toScreen(e.mesh.position.clone().add(new T.Vector3(0, e.h + 0.25, 0))); hc.fillStyle = 'rgba(0,0,0,0.6)'; hc.fillRect(x - 32, y - 2, 64, 8); hc.fillStyle = '#ffcf4a'; hc.fillRect(x - 30, y, 60 * Math.max(0, e.hp / e.max), 4); }
    });
    PROJS.forEach(p => { const [x, y] = toScreen(p.mesh.position); hc.strokeStyle = p.t > 0.6 && Math.floor(G.t * 10) % 2 ? '#ff3a2a' : 'rgba(255,90,60,0.7)'; hc.lineWidth = 2.5; hc.setLineDash([5, 5]); hc.beginPath(); hc.arc(x, y, 18 + p.t * 46, 0, 7); hc.stroke(); hc.setLineDash([]); });
    ITEMS.forEach(it => {
      const [x, y, z] = toScreen(it.pos); if (z > 1) return; const b = Math.sin(it.t * 5) * 5;
      if (it.life - it.t < 1.5 && Math.floor(it.t * 10) % 2) return;
      const g = hc.createRadialGradient(x, y + b, 0, x, y + b, 46); g.addColorStop(0, it.kind === 'heal' ? 'rgba(155,227,106,0.6)' : 'rgba(255,216,90,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); hc.fillStyle = g; hc.fillRect(x - 46, y + b - 46, 92, 92);
      hc.save(); hc.translate(x, y + b);
      if (it.kind === 'heal') { hc.fillStyle = '#5a6a3a'; hc.beginPath(); hc.ellipse(0, 4, 16, 20, 0, 0, 7); hc.fill(); hc.fillStyle = '#c8c0a0'; hc.fillRect(-5, -22, 10, 8); hc.fillStyle = '#e8443a'; hc.fillRect(-3, -4, 6, 16); hc.fillRect(-8, 1, 16, 6); }
      else if (it.kind === 'slow') { hc.fillStyle = '#f4f0e8'; hc.beginPath(); hc.moveTo(-13, -12); hc.lineTo(13, -12); hc.lineTo(10, 16); hc.lineTo(-10, 16); hc.fill(); hc.fillStyle = '#4a2a14'; hc.fillRect(-11, -10, 22, 5); }
      else { hc.fillStyle = '#5a4a2a'; hc.fillRect(-34, -18, 68, 36); hc.strokeStyle = '#2a2010'; hc.lineWidth = 3; hc.strokeRect(-34, -18, 68, 36); hc.fillStyle = '#ffd85a'; hc.font = '800 13px Assistant, Arial'; hc.textAlign = 'center'; hc.direction = 'rtl'; hc.fillText(WEAPONS[it.wk].name, 0, 5); }
      hc.restore();
    });
    POPS.forEach(p => { const [x, y, z] = toScreen(p.p); if (z > 1) return; hc.globalAlpha = Math.min(1, p.t * 3); txt(p.text, x, y - (1.1 - p.t) * 60, Math.round(24 * p.size), p.col); hc.globalAlpha = 1; });
    drawGun(dk);
    for (let i = 0; i < L.max; i++) { const x = W - 40 - i * 38, y = 40, on = i < L.lives; hc.save(); hc.translate(x, y); hc.scale(1.15, 1.15); hc.fillStyle = on ? '#e8443a' : 'rgba(255,255,255,0.18)'; hc.beginPath(); hc.moveTo(0, 8); hc.bezierCurveTo(-16, -4, -10, -16, 0, -8); hc.bezierCurveTo(10, -16, 16, -4, 0, 8); hc.fill(); hc.restore(); }
    hc.direction = 'ltr'; hc.font = '400 50px "Karantina", "Assistant", sans-serif'; hc.textAlign = 'left';
    hc.fillStyle = 'rgba(0,0,0,0.5)'; hc.fillText(String(L.score).padStart(7, '0'), 26, 56); hc.fillStyle = '#fff'; hc.fillText(String(L.score).padStart(7, '0'), 24, 54);
    txt(`${PF ? PROFILE.rank(PF) : 'סמל'} ${NAME}`, 26, 82, 17, 'rgba(255,255,255,0.75)', 'left');
    if (L.combo >= 5) txt(`קומבו ${L.combo}  x${1 + Math.min(3, Math.floor(L.combo / 5) * 0.5)}`, 30, 110, 24, '#ffd85a', 'left');
    txt('ששת הימים  |  הפריצה בסיני', W / 2, 32, 20, 'rgba(255,255,255,0.85)');
    for (let i = 0; i < NSC; i++) { hc.fillStyle = i < L.scene ? '#e0a84a' : i === L.scene ? '#fff' : 'rgba(255,255,255,0.3)'; hc.beginPath(); hc.arc(W / 2 + (i - (NSC - 1) / 2) * 22, 50, i === L.scene ? 6 : 4, 0, 7); hc.fill(); }
    if (L.boss && L.boss.state !== 'dead') { const tot = L.boss.parts.reduce((a, p) => a + p.max, 0), cur = L.boss.parts.reduce((a, p) => a + (p.alive ? p.hp : 0), 0); hc.fillStyle = 'rgba(0,0,0,0.6)'; hc.fillRect(W / 2 - 263, 70, 526, 18); hc.fillStyle = '#d8423a'; hc.fillRect(W / 2 - 260, 73, 520 * cur / tot, 12); txt('טנק כבד', W / 2, 112, 22, '#ffcf9a'); }
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
    if (isTouch) {
      [['duck', G.duck ? 'במחסה' : 'מחסה'], ['reload', 'טען']].forEach(([k, label]) => { const b = BTN[k]; hc.fillStyle = k === 'duck' && G.duck ? 'rgba(155,227,106,0.55)' : 'rgba(0,0,0,0.45)'; hc.beginPath(); hc.arc(b.x, b.y, b.r, 0, 7); hc.fill(); hc.strokeStyle = '#e0a84a'; hc.lineWidth = 3; hc.stroke(); txt(label, b.x, b.y + 8, 24, '#fff'); });
    }
    if (L.slowT > 0) txt('הזמן מאט', W / 2, 150, 30, '#ffd85a');
    if (L.radio) {
      const a = Math.min(1, L.radio.t * 2); hc.globalAlpha = a;
      const rx = W / 2 - 360, ry = 128; hc.fillStyle = 'rgba(8,10,8,0.78)'; rbox(rx, ry, 720, 78, 10); hc.fill();
      if (TEX.commanderImg) { hc.save(); hc.beginPath(); hc.rect(rx + 640, ry + 6, 66, 66); hc.clip(); hc.drawImage(TEX.commanderImg, rx + 640, ry + 6, 66, 66); hc.restore(); hc.strokeStyle = '#e0a84a'; hc.lineWidth = 2; hc.strokeRect(rx + 640, ry + 6, 66, 66); }
      txt('המג״ד רפי:', rx + 628, ry + 28, 17, '#e0a84a', 'right'); txt(L.radio.text, rx + 628, ry + 60, 23, '#fff', 'right');
      hc.globalAlpha = 1;
    }
    if (L.hint) { hc.globalAlpha = Math.min(1, L.hint.t * 2); txt(L.hint.text, W / 2, L.hint.big ? 300 : 250, L.hint.big ? 64 : 28, L.hint.big ? '#ffcf9a' : '#fff', 'center', L.hint.big ? '"Karantina", sans-serif' : undefined); hc.globalAlpha = 1; }
    if (L.phase === 'clear') txt(L.scene < NSC - 1 ? 'האזור נקי!' : 'ניצחון!', W / 2, H / 2, 96, '#e0a84a', 'center', '"Karantina", sans-serif');
    if (L.phase === 'move' && L.cam.intro && L.cam.t < 0.9) { hc.globalAlpha = 1 - Math.max(0, L.cam.t - 0.6) / 0.3; txt(L.fromCp ? 'ממשיכים מנקודת הביקורת' : 'שלב 2', W / 2, H / 2 - 40, 36, '#e0a84a', 'center', '"Karantina", sans-serif'); txt(L.fromCp ? `אזור ${L.next + 1}: ${SCENE_NAMES[L.next]}` : 'הפריצה בסיני', W / 2, H / 2 + 40, L.fromCp ? 80 : 96, '#fff', 'center', '"Karantina", sans-serif'); hc.globalAlpha = 1; }
    if (L.lives === 1 && G.screen === 'play') { const g = hc.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${0.25 + 0.15 * Math.sin(G.t * 5)})`); hc.fillStyle = g; hc.fillRect(0, 0, W, H); }
    if (G.screen === 'play' && dk < 0.5) drawCross();
  }

  function drawGun(dk) {
    const w = curW(), fp = FP[w.k], img = TEX[fp.img + 'Img']; if (!img) return;
    const rec = w.recoil, gw = fp.w, gh = gw * img.height / img.width;
    const drop = (L.swapT > 0 ? Math.sin(L.swapT / 0.35 * Math.PI) * 260 : 0) + dk * 330 + (w.reloading ? 140 : 0);
    const gx = W / 2 - gw / 2 + fp.dx + (G.mx - W / 2) * 0.1 + rec * 6, gy = H - gh + 70 + (G.my - H / 2) * 0.05 + rec * 20 + drop;
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
    if (PF) { const lv = PROFILE.level(PF, LV); isBest = L.score > lv.best; lv.best = Math.max(lv.best, L.score); lv.stars = Math.max(lv.stars, stars); lv.completed = true; lv.checkpoint = null; lv.last = L.score; PROFILE.save(PF); }
    $('retry-cp').hidden = true; $('again').textContent = 'שחק שוב';
    $('end-title').textContent = isBest ? 'שיא חדש!' : 'השלב הושלם';
    $('end-stars').innerHTML = [0, 1, 2].map(i => `<span class="star ${i < stars ? 'on' : ''}">★</span>`).join('');
    $('end-stats').innerHTML = [['ניקוד', L.score.toLocaleString('he-IL')], ['דיוק', Math.round(acc * 100) + '%'], ['נוטרלו', L.kills], ['פגיעות ראש', L.heads], ['ניטרולים', L.neutral], ['כדורים שנבלמו במחסה', L.blocked]].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    $('end-story').textContent = `הטנק עולה באש והעמדות נוקו. השמש כבר גבוהה מעל החולות. רפי לוחץ לך את היד: כל הכבוד, ${NAME}. ההתקדמות נשמרה.`;
    showScreen('end');
  }
  function gameOver() { G.screen = 'end'; S.stopMusic(); $('retry-cp').hidden = !checkpoint(); $('retry-cp').textContent = `נסה שוב מאזור ${L.scene + 1}`; $('end-title').textContent = 'נפגעת'; $('end-stars').innerHTML = ''; $('end-stats').innerHTML = `<div class="stat"><span>ניקוד</span><b>${L.score.toLocaleString('he-IL')}</b></div><div class="stat"><span>אזור</span><b>${L.scene + 1} מתוך ${NSC}</b></div>`; $('end-story').textContent = `רפי גורר אותך מאחורי שק חול. אל תדאג, ${NAME}, ההתקדמות שמורה מתחילת האזור. טיפ: התכופף כשהטבעת על האויב נהיית אדומה.`; showScreen('end'); }

  // ---------- קלט ----------
  function toGame(e) { const r = hud.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
  const touchDuck = new Set();
  hud.addEventListener('pointerdown', e => {
    S.init(); const [x, y] = toGame(e);
    if (G.screen !== 'play') return; e.preventDefault();
    try { hud.setPointerCapture(e.pointerId); } catch (er) { }
    if (e.button === 2) { reload(); return; }
    for (let i = 0; i < ORDER.length; i++) { const s = SLOT(i); if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) { switchTo(ORDER[i]); return; } }
    if (isTouch) {
      if (Math.hypot(x - BTN.duck.x, y - BTN.duck.y) < BTN.duck.r + 8) { touchDuck.add(e.pointerId); G.duck = true; return; }
      if (Math.hypot(x - BTN.reload.x, y - BTN.reload.y) < BTN.reload.r + 8) { reload(); return; }
    }
    G.mx = x; G.my = y; G.down = true; G.pressed = true;
  });
  hud.addEventListener('pointermove', e => { if (touchDuck.has(e.pointerId)) return; const [x, y] = toGame(e); G.mx = x; G.my = y; });
  window.addEventListener('pointerup', e => { if (touchDuck.has(e.pointerId)) { touchDuck.delete(e.pointerId); if (!touchDuck.size) G.duck = false; return; } G.down = false; });
  window.addEventListener('pointercancel', e => { touchDuck.delete(e.pointerId); if (!touchDuck.size) G.duck = false; G.down = false; });
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
  function typeBrief() {
    const t = 'חמישה ביוני, שחר, ' + NAME + '. הטנקים כבר פרצו קדימה, ועכשיו תורנו לנקות את מה שנשאר מאחור: עמדות בדיונות, שיירה שרופה, בונקר, מחנה אספקה ורכס. ובסוף מחכה טנק. כשהטבעת על האויב נהיית אדומה, תתכופף.';
    const el = $('brief-text'); el.textContent = ''; let n = 0; const iv = setInterval(() => { n += 2; el.textContent = t.slice(0, n); if (n >= t.length) clearInterval(iv); }, 16);
  }
  $('go').onclick = () => { S.init(); if (PF) { PROFILE.level(PF, LV).checkpoint = null; PROFILE.save(PF); } startGame(); };
  $('resume').onclick = () => { S.init(); startGame(checkpoint()); };
  $('again').onclick = () => reloadInto('new');
  $('retry-cp').onclick = () => reloadInto('checkpoint');
  $('p-resume').onclick = () => resumeGame();
  $('p-save').onclick = () => { location.href = 'index.html'; };
  $('p-restart').onclick = () => reloadInto(checkpoint() ? 'checkpoint' : 'new');
  $('pause-btn').onclick = () => pause();
  resize();
  loadAll(k => { $('bar').style.width = Math.round(k * 100) + '%'; }).then(() => {
    initGL(); resize(); G.screen = 'menu'; showScreen('brief'); typeBrief();
    $('brief-face').src = TEX.commanderImg.src;
    const cp = checkpoint();
    if (cp) {
      $('resume').hidden = false; $('resume').textContent = `המשך מאזור ${cp.scene + 1}: ${SCENE_NAMES[cp.scene]}`; $('go').textContent = 'מההתחלה'; $('go').classList.add('ghost');
      $('saveinfo').hidden = false; $('saveinfo').textContent = `שמור עבור ${NAME}: אזור ${cp.scene + 1} מתוך ${NSC}, ${cp.score.toLocaleString('he-IL')} נקודות, ${cp.lives} חיים. נשמר ${new Date(cp.at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}.`;
    }
    let mode = null; try { mode = sessionStorage.getItem('kav-start'); sessionStorage.removeItem('kav-start'); } catch (e) { }
    if (mode === 'checkpoint' && cp) startGame(cp); else if (mode === 'new') { if (PF) { PROFILE.level(PF, LV).checkpoint = null; PROFILE.save(PF); } startGame(); }
  }).catch(err => { $('load-text').textContent = 'טעינת הגרפיקה נכשלה. צריך לפתוח את המשחק דרך שרת (ראה README).'; console.error(err); });
  requestAnimationFrame(frame);

  // כלי בדיקה
  window.__g3 = {
    G, get L() { return L; }, get scene() { return scene; }, ENTS, COVERS, SPOTS, STOPS, ITEMS, startGame,
    tick(n) { for (let i = 0; i < n; i++) update(0.05); },
    jump(i) { L.camPos = stopPos(i); L.yaw = STOPS[i].yaw; L.pitch = 0; ENTS.forEach(e => e.state = 'gone'); beginScene(i); },
    LW, groundH, SPRITES,
  };
  Object.defineProperty(window, '__cam', { get: () => camera });
})();
