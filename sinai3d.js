/* קו האש 3D: שלב הפריצה בסיני. מנוע Three.js עם אמנות מצוירת */
(function () {
  const T = window.THREE, S = window.SFX;
  const W = 1280, H = 720;
  const $ = id => document.getElementById(id);
  const rand = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const isTouch = matchMedia('(pointer: coarse)').matches;

  // ---------- נכסים ----------
  const SPRITES = {
    idle: { f: 'soldier_idle', h: 1.85, head: [0.3, 0, 0.56, 0.13], muzzle: [0.95, 0.47] },
    aim: { f: 'soldier_aim', h: 1.75, head: [0.3, 0, 0.68, 0.2], muzzle: [0.62, 0.33] },
    kneel: { f: 'soldier_aim2', h: 1.38, head: [0.38, 0, 0.7, 0.17], muzzle: [0.6, 0.2] },
    gunner: { f: 'gunner', h: 1.95, head: [0.38, 0, 0.62, 0.12], muzzle: [0.97, 0.3] },
    hit: { f: 'soldier_hit', h: 1.7 },
    truck: { f: 'truck', h: 3.1 },
    jeep: { f: 'jeep', h: 2.6, muzzle: [0.44, 0.06], head: [0.18, 0, 0.32, 0.12] },
    tank: { f: 'tank', h: 4.6, muzzle: [0.995, 0.17] },
  };
  const TEX = {};
  const MASK = {};

  function loadAll(onProgress) {
    const loader = new T.TextureLoader();
    const list = ['sky', 'sand', 'burlap', 'rock', 'crate', 'explosion', ...Object.values(SPRITES).map(s => s.f)];
    const uniq = [...new Set(list)];
    let done = 0;
    return Promise.all(uniq.map(n => new Promise((res, rej) => {
      loader.load('assets/' + n + '.webp', t => {
        t.encoding = T.sRGBEncoding; t.anisotropy = 8; TEX[n] = t; done++; onProgress(done / (uniq.length + 2)); res();
      }, undefined, rej);
    }))).then(() => {
      const imgs = ['commander', 'uzi'];
      return Promise.all(imgs.map(n => new Promise(res => { const i = new Image(); i.onload = () => { TEX[n + 'Img'] = i; done++; onProgress(done / (uniq.length + 2)); res(); }; i.src = 'assets/' + n + '.webp'; })));
    }).then(() => {
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

  // ---------- רעש ----------
  function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); }
  function fbm(x, y) { let a = 0, f = 1, s = 0.5; for (let i = 0; i < 4; i++) { a += vnoise(x * f, y * f) * s; f *= 2; s *= 0.5; } return a; }

  // ---------- עולם ----------
  // תחנות המצלמה: כל סצנה עומדת בנקודה ומסתכלת קדימה
  const STOPS = [
    { pos: [0, 0, -4.5], yaw: 0 },
    { pos: [5.5, 0, -46], yaw: 0.16 },
    { pos: [-1, 0, -97], yaw: -0.06 },
  ];
  const ZONES = [[0, -20, 26], [3, -62, 26], [0, -125, 40]];
  function flatK(x, z) {
    let d = 1e9;
    ZONES.forEach(([zx, zz, r]) => { d = Math.min(d, Math.max(0, Math.hypot(x - zx, z - zz) - r)); });
    for (let i = 0; i < STOPS.length - 1; i++) { const a = STOPS[i].pos, b = STOPS[i + 1].pos; const vx = b[0] - a[0], vz = b[2] - a[2], t = clamp(((x - a[0]) * vx + (z - a[2]) * vz) / (vx * vx + vz * vz), 0, 1); d = Math.min(d, Math.hypot(x - (a[0] + vx * t), z - (a[2] + vz * t))); }
    return clamp((d - 2) / 30, 0, 1);
  }
  function groundH(x, z) {
    const big = (fbm(x * 0.012 + 3, z * 0.012) - 0.45) * 22;
    const mid = (fbm(x * 0.05, z * 0.05 + 7) - 0.5) * 2.2;
    const k = flatK(x, z);
    return big * k * k + mid * (0.25 + k * 0.75) + Math.sin(x * 0.35 + z * 0.12) * 0.06;
  }

  let boomLight, renderer, scene, camera, composer, finalPass, sun, hemi, ground, raycaster;
  const COVERS = [], DECALS = [], PARTS = [], TRACERS = [];
  let partTex = {};

  function canvasTex(size, fn) { const c = document.createElement('canvas'); c.width = c.height = size; fn(c.getContext('2d'), size); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; }

  function initGL() {
    const cv = $('gl');
    renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.LinearEncoding;
    scene = new T.Scene();
    const fogCol = new T.Color('#d8a585').convertSRGBToLinear();
    scene.fog = new T.Fog(fogCol, 45, 340);
    camera = new T.PerspectiveCamera(37, W / H, 0.1, 1200);
    raycaster = new T.Raycaster();

    // שמיים: גליל מצויר
    const skyTex = TEX.sky; skyTex.wrapS = T.ClampToEdgeWrapping; skyTex.repeat.x = -1; skyTex.offset.x = 1;
    const R = 520, arc = 2.9, hgt = R * arc / (skyTex.image.width / skyTex.image.height);
    const skyGeo = new T.CylinderGeometry(R, R, hgt, 64, 1, true, Math.PI - arc / 2, arc);
    const sky = new T.Mesh(skyGeo, new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false, depthWrite: false }));
    sky.position.y = 0.23 * hgt + 2; sky.renderOrder = -10; scene.add(sky);
    scene.userData.sky = sky;
    const bgCol = new T.Color('#e9b98c').convertSRGBToLinear(); scene.background = bgCol;

    // אור
    hemi = new T.HemisphereLight(new T.Color('#b9c9e8').convertSRGBToLinear(), new T.Color('#a8784a').convertSRGBToLinear(), 0.55); scene.add(hemi);
    sun = new T.DirectionalLight(new T.Color('#ffc590').convertSRGBToLinear(), 3.2);
    sun.position.set(-60, 24, -80); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    boomLight = new T.PointLight(new T.Color('#ff9a40').convertSRGBToLinear(), 0, 30, 2); scene.add(boomLight);

    // קרקע
    const g = new T.PlaneGeometry(900, 900, 260, 260); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, groundH(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const st = TEX.sand; st.wrapS = st.wrapT = T.RepeatWrapping; st.repeat.set(140, 140);
    ground = new T.Mesh(g, new T.MeshStandardMaterial({ map: st, roughness: 0.95, metalness: 0, color: new T.Color('#d9b893') }));
    ground.receiveShadow = true; ground.userData.ground = true; scene.add(ground);

    // טקסטורות חלקיקים
    partTex.soft = canvasTex(64, (x, s) => { const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, s, s); });
    partTex.smoke = canvasTex(128, (x, s) => { for (let i = 0; i < 26; i++) { const px = s / 2 + (rand() - 0.5) * s * 0.45, py = s / 2 + (rand() - 0.5) * s * 0.45, r = s * (0.15 + rand() * 0.2); const gr = x.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, s, s); } });
    partTex.flash = canvasTex(128, (x, s) => { x.translate(s / 2, s / 2); for (let i = 0; i < 7; i++) { x.rotate(Math.PI * 2 / 7 + rand() * 0.3); const gr = x.createLinearGradient(0, 0, s / 2, 0); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = gr; x.beginPath(); x.moveTo(0, -s * 0.05); x.lineTo(s * (0.3 + rand() * 0.2), 0); x.lineTo(0, s * 0.05); x.fill(); } const gr = x.createRadialGradient(0, 0, 0, 0, 0, s * 0.22); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(1, 'rgba(255,190,90,0)'); x.fillStyle = gr; x.fillRect(-s / 2, -s / 2, s, s); });
    partTex.decal = canvasTex(64, (x, s) => { const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(20,14,8,0.95)'); gr.addColorStop(0.35, 'rgba(40,28,16,0.6)'); gr.addColorStop(1, 'rgba(60,40,20,0)'); x.fillStyle = gr; x.fillRect(0, 0, s, s); });

    // אבק באוויר
    const dg = new T.BufferGeometry(), N = 900, arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { arr[i * 3] = (rand() - 0.5) * 120; arr[i * 3 + 1] = rand() * 14; arr[i * 3 + 2] = -rand() * 170 + 10; }
    dg.setAttribute('position', new T.BufferAttribute(arr, 3));
    const dust = new T.Points(dg, new T.PointsMaterial({ size: 0.07, map: partTex.soft, transparent: true, opacity: 0.55, depthWrite: false, color: new T.Color('#ffe2b8').convertSRGBToLinear(), blending: T.AdditiveBlending }));
    scene.add(dust); scene.userData.dust = dust;

    buildWorld();

    // עיבוד לאחר
    const rt = new T.WebGLRenderTarget(W, H, { type: T.HalfFloatType });
    composer = new T.EffectComposer(renderer, rt);
    composer.addPass(new T.RenderPass(scene, camera));
    const bloom = new T.UnrealBloomPass(new T.Vector2(W, H), 0.55, 0.6, 0.9);
    composer.addPass(bloom);
    finalPass = new T.ShaderPass({
      uniforms: { tDiffuse: { value: null }, time: { value: 0 }, dmg: { value: 0 }, slow: { value: 0 }, flash: { value: 0 }, exposure: { value: 0.82 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float time, dmg, slow, flash, exposure; varying vec2 vUv;
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
          c = mix(vec3(l), c, 1.1 - slow*0.55);
          c = mix(c, c*vec3(1.1,0.95,0.75), slow*0.5);
          c += (rnd(uv*vec2(1280.0,720.0) + time) - 0.5) * 0.05;
          c *= mix(1.0, smoothstep(0.9, 0.3, r), 0.55);
          c = mix(c, vec3(0.75,0.05,0.02), dmg * 0.45 * smoothstep(0.15, 0.75, r));
          c += flash;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    composer.addPass(finalPass);
  }

  // ---------- מחסות תלת מימד ----------
  function at(x, z) { return new T.Vector3(x, groundH(x, z), z); }
  function addCover(mesh, opts) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.cover = opts || true; scene.add(mesh); COVERS.push(mesh); return mesh; }

  let burlapMat, crateMat, rockMat, barrelMat;
  function sandbags(x, z, len, rows, rotY) {
    if (!burlapMat) { const t = TEX.burlap; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1.5, 1); burlapMat = new T.MeshStandardMaterial({ map: t, roughness: 1, color: new T.Color('#f4e2c0') }); }
    const geo = new T.SphereGeometry(0.5, 16, 10); geo.scale(0.62, 0.3, 0.4);
    const per = Math.round(len / 0.58), count = per * rows;
    const im = new T.InstancedMesh(geo, burlapMat, count);
    const m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), pos = new T.Vector3(), col = new T.Color();
    let i = 0; const base = at(x, z);
    for (let r = 0; r < rows; r++) for (let k = 0; k < per; k++) {
      const off = (r % 2) * 0.29, lx = -len / 2 + k * 0.58 + off + 0.29;
      if (r % 2 && k === per - 1) { s.set(0, 0, 0); } else s.set(1 + rand() * 0.12, 1 + rand() * 0.25, 1 + rand() * 0.15);
      pos.set(lx, 0.13 + r * 0.25, (rand() - 0.5) * 0.06);
      q.setFromEuler(new T.Euler((rand() - 0.5) * 0.12, (rand() - 0.5) * 0.18, (rand() - 0.5) * 0.1));
      m.compose(pos, q, s); im.setMatrixAt(i, m); im.setColorAt(i, col.setHSL(0.1, 0.22 + rand() * 0.1, 0.8 + rand() * 0.12)); i++;
    }
    im.position.copy(base); im.rotation.y = rotY || 0;
    addCover(im, { top: base.y + rows * 0.25 + 0.1 });
    return im;
  }
  function crate(x, z, size, rotY, y0) {
    if (!crateMat) crateMat = new T.MeshStandardMaterial({ map: TEX.crate, roughness: 0.85 });
    const m = new T.Mesh(new T.BoxGeometry(size, size * 0.8, size * 0.8), crateMat);
    const b = at(x, z); m.position.set(x, (y0 !== undefined ? y0 : b.y) + size * 0.4, z); m.rotation.y = rotY || 0;
    return addCover(m, { top: m.position.y + size * 0.4 });
  }
  function rock(x, z, s, seed) {
    if (!rockMat) { const t = TEX.rock; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2.5, 1.6); rockMat = new T.MeshStandardMaterial({ map: t, roughness: 0.9, color: new T.Color('#b89a78') }); }
    const g = new T.SphereGeometry(1, 40, 28); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = new T.Vector3(p.getX(i), p.getY(i), p.getZ(i)); const n = 0.7 + fbm(v.x * 1.3 + seed, v.y * 1.3 + v.z * 0.9) * 0.6 + vnoise(v.x * 6 + seed, v.z * 6 + v.y) * 0.06; v.multiplyScalar(n); if (v.y < -0.15) v.y = -0.15; v.y *= v.y > 0 ? 0.85 + vnoise(seed, v.x) * 0.3 : 1; p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    const m = new T.Mesh(g, rockMat); const b = at(x, z); m.position.set(x, b.y + 0.1 * s, z); m.scale.set(s * 1.3, s * 0.85, s); m.rotation.y = seed;
    return addCover(m, { top: b.y + s * 0.85 });
  }
  function barrel(x, z) {
    if (!barrelMat) {
      const t = canvasTex(256, (c, s) => { c.fillStyle = '#4a5233'; c.fillRect(0, 0, s, s); for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(${120 + rand() * 60},${60 + rand() * 30},20,${rand() * 0.35})`; c.fillRect(rand() * s, rand() * s, 2 + rand() * 8, 6 + rand() * 30); } c.fillStyle = 'rgba(0,0,0,0.35)'; [0.22, 0.5, 0.78].forEach(y => c.fillRect(0, y * s, s, 8)); c.fillStyle = 'rgba(230,220,180,0.8)'; c.font = 'bold 40px Arial'; c.fillText('FUEL', 70, 150); });
      barrelMat = new T.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.45 });
    }
    const m = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.92, 20), barrelMat); const b = at(x, z); m.position.set(x, b.y + 0.46, z); m.rotation.y = rand() * 6;
    return addCover(m, { top: b.y + 0.92, barrel: true });
  }
  function card(spriteKey, x, z, scale, rotY) {
    const sp = SPRITES[spriteKey];
    const geo = new T.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
    const mat = new T.MeshBasicMaterial({ map: TEX[sp.f], alphaTest: 0.45, side: T.DoubleSide, color: new T.Color('#f3dcc4') });
    const m = new T.Mesh(geo, mat); const h = sp.h * (scale || 1);
    m.scale.set(h * sp.aspect, h, 1); const b = at(x, z); m.position.set(x, b.y - 0.15, z); m.rotation.y = rotY || 0;
    m.castShadow = true; m.userData.sprite = sp; return m;
  }

  function buildWorld() {
    // סצנה 1
    sandbags(-5, -14, 5.2, 4, 0.08); sandbags(4.5, -18, 6, 4, -0.1);
    crate(-1.4, -10.5, 1.0, 0.2); crate(-1.4, -10.5, 0.9, -0.15, groundH(-1.4, -10.5) + 0.8); crate(-0.3, -10.8, 0.9, 0.05);
    rock(9, -13, 1.4, 1.3); rock(-9.5, -23, 1.8, 2.2); rock(12, -27, 2.4, 4.1);
    barrel(2.4, -9.6); barrel(3.1, -10.1);
    const tr = card('truck', -3.5, -30, 1, 0.25); tr.userData.cover = { top: tr.position.y + 2.2, tall: true }; scene.add(tr); COVERS.push(tr);
    // סצנה 2
    sandbags(-1, -56, 7, 4, 0.25); sandbags(12, -60, 5, 4, 0.1);
    rock(9.2, -54.5, 1.2, 5.5); rock(-6, -64, 1.7, 6.6); rock(18, -70, 2.6, 7.7);
    crate(9.5, -51, 1.0, 0.4); crate(10.4, -51.2, 0.85, 0.1);
    barrel(1.5, -50); barrel(2.1, -49.4); barrel(1.7, -48.8);
    const tr2 = card('truck', 16, -74, 0.9, -0.5); tr2.userData.cover = { top: tr2.position.y + 2, tall: true }; scene.add(tr2); COVERS.push(tr2);
    // סצנה 3 (הבוס)
    sandbags(-7, -104, 5, 4, -0.2); sandbags(5, -103, 4, 4, 0.15);
    rock(-14, -115, 2.2, 8.8); rock(10, -118, 1.8, 9.9);
    const tr3 = card('truck', -12, -132, 1, 0.5); tr3.userData.cover = { top: tr3.position.y + 2, tall: true }; scene.add(tr3); COVERS.push(tr3);
    // רקע: הריסות רחוקות ועשן
    [[-40, -170], [35, -200], [60, -150]].forEach(([x, z], i) => { const c = card('truck', x, z, 1.2, rand()); c.material = c.material.clone(); c.material.color.set('#7a6a5a'); scene.add(c); SMOKERS.push({ pos: new T.Vector3(x, groundH(x, z) + 2.5, z), rate: 6, big: true }); });
  }
  const SMOKERS = [];

  // ---------- נקודות הופעה לכל סצנה ----------
  const SPOTS = [
    [
      { k: "pop", x: -5.2, z: -14.8, top: 1.1 }, { k: "pop", x: -3.6, z: -14.6, top: 1.1 }, { k: "pop", x: 4.0, z: -18.8, top: 1.1 }, { k: "pop", x: 6.2, z: -19, top: 1.1 },
      { k: 'side', x: -1.5, z: -11.6, dx: -1.6 }, { k: 'side', x: -3.2, z: -31.2, dx: 3.9 }, { k: 'pop', x: 9, z: -14.3, top: 1.1 },
      { k: 'open', x: 2.5, z: -25 }, { k: 'open', x: -7.5, z: -27 }, { k: 'run', z: -24, x0: -18, x1: 18 }, { k: 'pop', x: -9.5, z: -24.6, top: 1.4 },
    ],
    [
      { k: "pop", x: -2.4, z: -56.9, top: 1.1 }, { k: "pop", x: 0.8, z: -56.3, top: 1.1 }, { k: "pop", x: 11.5, z: -60.8, top: 1.1 }, { k: "pop", x: 13.5, z: -60.9, top: 1.1 },
      { k: 'side', x: 10, z: -52, dx: 1.5 }, { k: 'side', x: 15.2, z: -75.4, dx: -3.6 }, { k: 'pop', x: 9.2, z: -55.6, top: 1.0 }, { k: 'pop', x: -6, z: -65.6, top: 1.3 },
      { k: 'open', x: 7, z: -70 }, { k: 'open', x: -2, z: -69 }, { k: 'run', z: -68, x0: -14, x1: 24 },
    ],
    [
      { k: "pop", x: -8, z: -104.7, top: 1.1 }, { k: "pop", x: 5.5, z: -103.7, top: 1.1 }, { k: 'pop', x: -14, z: -117, top: 1.7 }, { k: 'pop', x: 10, z: -119.5, top: 1.4 },
      { k: 'side', x: -11.5, z: -133.3, dx: 3.4 }, { k: 'run', z: -112, x0: -16, x1: 16 },
    ],
  ];
  const WAVES = [
    ['soldier', 'soldier', 'soldier', 'runner', 'soldier', 'heavy', 'soldier', 'soldier'],
    ['soldier', 'soldier', 'heavy', 'soldier', 'jeep', 'soldier', 'runner', 'soldier', 'heavy', 'soldier'],
    ['soldier', 'soldier', 'heavy', 'soldier', 'soldier'],
  ];

  // ---------- מצב משחק ----------
  const G = { mx: W / 2, my: H / 2, down: false, pressed: false, t: 0, screen: 'loading', shake: 0, dmg: 0, flash: 0 };
  let L = null;
  const ENTS = [], PROJS = [], ITEMS = [], POPS = [];
  const WEAPONS = {
    uzi: { name: 'עוזי', mag: 32, rate: 95, auto: true, dmg: 1, spread: 0.012, sound: 'smg', reload: 1100 },
    fal: { name: 'רובה FN FAL', mag: 20, rate: 230, auto: false, dmg: 3.2, spread: 0, sound: 'rifle', reload: 1500, reserve: 40, pierce: true },
    mag: { name: 'מקלע MAG', mag: 100, rate: 70, auto: true, dmg: 1.7, spread: 0.02, sound: 'mg', reload: 2300, reserve: 100 },
  };
  function weapon(k, base) { const d = WEAPONS[k]; return { k, d, ammo: d.mag, reserve: base ? Infinity : d.reserve, reloading: false, rt: 0, last: 0, base, recoil: 0 }; }

  function startGame() {
    L = { scene: -1, lives: 5, max: 5, score: 0, shots: 0, hits: 0, kills: 0, heads: 0, neutral: 0, combo: 0, maxCombo: 0, dmgTaken: 0, w: weapon('uzi', true), slowT: 0, radio: null, hint: null, cam: { from: null, t: 1 }, phase: 'intro', pt: 0, time: 0 };
    ENTS.length = 0; PROJS.length = 0; ITEMS.length = 0;
    G.screen = 'play'; showScreen(null);
    S.init(); S.startMusic('six');
    // כניסה קולנועית
    L.cam = { a: new T.Vector3(-14, 16, 34), ay: 0.5, b: stopPos(0), by: STOPS[0].yaw, t: 0, dur: 3.6, intro: true };
    L.phase = 'move'; L.next = 0;
    radio('סמל, השחר עולה. נקה את העמדות מאחורי שקי החול!');
  }
  function stopPos(i) { const p = STOPS[i].pos; return new T.Vector3(p[0], groundH(p[0], p[2]) + 1.65, p[2]); }

  function beginScene(i) {
    L.scene = i; L.phase = 'fight'; L.pt = 0;
    L.queue = WAVES[i].slice(); L.spawnT = 0.8; L.maxActive = 2 + i; L.crate = false;
    SPOTS[i].forEach(s => s.busy = false);
    if (i === 2) { L.bossT = 2.5; }
    hint(['אזור 1 מתוך 3', 'אזור 2 מתוך 3', 'אזור 3: השריון'][i]);
  }

  function radio(text) { L.radio = { text, t: 3.4 }; S.play('radio'); }
  function hint(text, big) { L.hint = { text, t: 2.6, big }; }
  function pop(text, pos3, col, size) { POPS.push({ text, p: pos3.clone(), col: col || '#fff', t: 1.1, size: size || 1 }); }

  // ---------- אויבים ----------
  function freeSpot(kinds) { const c = SPOTS[L.scene].filter(s => !s.busy && kinds.includes(s.k)); return c.length ? c[Math.floor(rand() * c.length)] : null; }
  function aimTime(e) { return (e.type === 'heavy' ? 2.3 : e.type === 'jeep' ? 2.6 : 2.0) * (0.9 + rand() * 0.3); }

  function makeCard(key) {
    const sp = SPRITES[key];
    const geo = new T.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
    const mat = new T.MeshBasicMaterial({ map: TEX[sp.f], alphaTest: 0.5, side: T.DoubleSide, color: new T.Color('#f6e0c8'), transparent: false });
    const m = new T.Mesh(geo, mat); m.castShadow = true; scene.add(m); return m;
  }
  function setPose(e, key) {
    const sp = SPRITES[key]; e.pose = key; e.sp = sp;
    e.mesh.material.map = TEX[sp.f]; e.mesh.material.needsUpdate = true;
    const h = sp.h * (e.scale || 1); e.mesh.scale.set(h * sp.aspect, h, 1); e.h = h;
  }

  function spawn(type) {
    if (type === 'jeep') {
      const dir = rand() < 0.5 ? 1 : -1, z = -64 + rand() * 1.5;
      const e = { type: 'jeep', hp: 16, max: 16, state: 'drive', t: 0, dir, z, x: dir > 0 ? -30 : 34, stopX: 2 + rand() * 8, hostile: true, flash: 0 };
      e.mesh = makeCard('jeep'); setPose(e, 'jeep'); if (dir < 0) e.mesh.scale.x *= -1;
      e.mesh.position.set(e.x, groundH(e.x, z), z); ENTS.push(e); S.play('alert'); radio('ג׳יפ עם מקלע! השמד אותו!'); return true;
    }
    let sp;
    if (type === 'runner') sp = freeSpot(['run']);
    else if (type === 'heavy') sp = freeSpot(['open', 'pop']);
    else sp = freeSpot(['pop', 'side', 'open']);
    if (!sp) sp = freeSpot(['pop', 'side', 'open']);
    if (!sp) return false;
    sp.busy = true;
    const e = { type, spot: sp, hp: type === 'heavy' ? 6 : 2, max: type === 'heavy' ? 6 : 2, state: 'wait', t: 0, delay: 0.1 + rand() * 0.4, k: 0, shots: 0, maxShots: 2 + Math.floor(rand() * 2), hostile: true, flash: 0, scale: 0.97 + rand() * 0.08 };
    e.mesh = makeCard('idle');
    const gy = groundH(sp.x || 0, sp.z);
    if (sp.k === 'pop') { setPose(e, 'aim'); e.base = new T.Vector3(sp.x, gy, sp.z); e.upY = gy + sp.top - e.h + 0.98; e.downY = gy - e.h - 0.1; }
    else if (sp.k === 'side') { setPose(e, 'kneel'); e.base = new T.Vector3(sp.x, gy, sp.z); e.x0 = sp.x; e.x1 = sp.x + sp.dx; }
    else if (sp.k === 'open') { setPose(e, type === 'heavy' ? 'gunner' : 'idle'); e.base = new T.Vector3(sp.x, gy, sp.z); e.upY = gy; e.downY = gy - e.h - 0.1; }
    else if (sp.k === 'run') { setPose(e, 'idle'); e.dir = rand() < 0.5 ? 1 : -1; e.x = e.dir > 0 ? sp.x0 : sp.x1; e.stopX = lerp(sp.x0, sp.x1, 0.3 + rand() * 0.4); e.state = 'run'; e.k = 1; e.base = new T.Vector3(e.x, groundH(e.x, sp.z), sp.z); }
    if (type === 'heavy' && sp.k !== 'open') { setPose(e, 'gunner'); if (sp.k === 'pop') { e.upY = gy + sp.top - e.h + 1.05; e.downY = gy - e.h - 0.1; } }
    placeEnt(e); ENTS.push(e); return true;
  }

  function placeEnt(e) {
    const m = e.mesh, sp = e.spot;
    if (e.type === 'jeep') { m.position.set(e.x, groundH(e.x, e.z) - 0.1, e.z); return; }
    if (e.state === 'dead') return;
    if (sp && sp.k === 'side') { const x = lerp(e.x0, e.x1, ease(e.k)); m.position.set(x, groundH(x, sp.z) - 0.05, sp.z); }
    else if (sp && sp.k === 'run') { m.position.set(e.x, groundH(e.x, sp.z) - 0.05 + Math.abs(Math.sin(G.t * 11)) * 0.06, sp.z); }
    else { m.position.set(e.base.x, lerp(e.downY, e.upY, ease(e.k)), e.base.z); }
  }

  function muzzleWorld(e) {
    const sp = e.sp; if (!sp.muzzle) return e.mesh.position.clone().add(new T.Vector3(0, e.h * 0.7, 0));
    const u = sp.muzzle[0];
    const v = new T.Vector3((u - 0.5), 1 - sp.muzzle[1], 0.05); return e.mesh.localToWorld(v);
  }
  function headWorld(e) {
    const sp = e.sp; const hb = sp.head || [0.4, 0, 0.6, 0.15];
    const u = (hb[0] + hb[2]) / 2;
    return e.mesh.localToWorld(new T.Vector3(u - 0.5, 1 - (hb[1] + hb[3]) / 2, 0));
  }

  function updEnt(e, dt) {
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    const m = e.mesh;
    // מול המצלמה
    m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
    m.material.color.setRGB(1 + e.flash * 8, 0.94 + e.flash * 8, 0.86 + e.flash * 8);
    if (e.type === 'jeep') return updJeep(e, dt);
    if (e.stun > 0) e.stun -= dt;
    switch (e.state) {
      case 'wait': if (e.t > e.delay) { e.state = 'emerge'; e.t = 0; } break;
      case 'emerge': e.k = Math.min(1, e.k + dt / 0.38); if (e.k >= 1) { e.state = 'pre'; e.t = 0; } break;
      case 'pre':
        if (e.t > 0.25) { if (e.spot.k === 'open' && e.pose === 'idle') { setPose(e, 'kneel'); e.upY = e.base.y; } e.state = 'aim'; e.t = 0; e.aim = aimTime(e) + (e.first ? 0 : 0.3); e.first = true; S.play('alert'); }
        break;
      case 'aim': if (e.t >= e.aim) { enemyFire(e); e.state = 'fire'; e.t = 0; } break;
      case 'fire':
        if (e.t > 0.15) {
          e.shots++;
          if (e.spot.k === 'run') { e.state = 'run2'; setPose(e, 'idle'); }
          else if (e.shots >= e.maxShots && e.spot.k !== 'open') { e.state = 'duck'; e.t = 0; }
          else { e.state = 'aim'; e.t = 0; e.aim = aimTime(e) * 0.85; }
        }
        break;
      case 'duck': e.k = Math.max(0, e.k - dt / 0.28); if (e.k <= 0) { e.state = 'wait'; e.t = 0; e.delay = 0.8 + rand() * 1.4; e.shots = 0; e.maxShots = 1 + Math.floor(rand() * 3); } break;
      case 'run': case 'run2': {
        e.x += e.dir * 4.2 * dt;
        if (e.state === 'run' && ((e.dir > 0 && e.x > e.stopX) || (e.dir < 0 && e.x < e.stopX))) { setPose(e, 'kneel'); e.state = 'aim'; e.t = 0; e.aim = aimTime(e) * 0.9; }
        if (e.x < e.spot.x0 - 2 || e.x > e.spot.x1 + 2) { e.state = 'gone'; }
        if (rand() < dt * 6) sandPuff(m.position.clone(), 0.4);
        break;
      }
      case 'surrender': e.t2 = (e.t2 || 0) + dt; if (e.t2 > 1.2) { e.k = Math.max(0, e.k - dt * 2); if (e.k <= 0) e.state = 'gone'; } break;
      case 'dead': {
        e.vel.y -= 9 * dt; m.position.addScaledVector(e.vel, dt);
        const gy = groundH(m.position.x, m.position.z) - 0.2;
        if (m.position.y < gy) { m.position.y = gy; if (!e.landed) { e.landed = true; sandPuff(m.position.clone(), 1); } e.vel.set(0, 0, 0); }
        e.rot = Math.min(1.45, (e.rot || 0) + dt * 4); m.rotateZ(0); m.rotation.z = e.rot * e.fall;
        e.fade = (e.fade || 0) + dt; if (e.fade > 1.4) { m.material.transparent = true; m.material.opacity = Math.max(0, 1 - (e.fade - 1.4) / 0.6); if (e.fade > 2) e.state = 'gone'; }
        return;
      }
    }
    if (e.state !== 'dead') placeEnt(e);
  }

  function updJeep(e, dt) {
    if (e.state === 'drive') { const dx = e.stopX - e.x; e.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 9); if (Math.abs(dx) < 0.05) { e.state = 'aim'; e.t = 0; e.aim = aimTime(e); } if (rand() < dt * 30) sandPuff(e.mesh.position.clone().add(new T.Vector3(-e.dir * 1.6, 0.2, 0)), 1.2); }
    else if (e.state === 'aim') { if (e.t >= e.aim) { enemyFire(e); e.t = 0; e.aim = aimTime(e) * 0.85; } }
    else if (e.state === 'dead') { if (rand() < dt * 10) smoke(e.mesh.position.clone().add(new T.Vector3((rand() - 0.5) * 2, 1.5, 0)), 1.4, true); if (rand() < dt * 14) fire(e.mesh.position.clone().add(new T.Vector3((rand() - 0.5) * 2, 1 + rand(), 0.2)), 0.8); return; }
    placeEnt(e);
  }

  function enemyFire(e) {
    const p = muzzleWorld(e);
    flashAt(p, e.type === 'jeep' ? 1.6 : 1.1);
    S.play('enemyShot');
    tracer3(p, camera.position.clone().add(new T.Vector3((rand() - 0.5) * 0.6, -0.3, 0)), '#ffcf80');
    playerHit();
  }

  function playerHit() {
    if (G.screen !== 'play' || L.phase !== 'fight') return;
    L.lives--; L.dmgTaken++; L.combo = 0; G.dmg = 1; G.shake = Math.max(G.shake, 0.6); S.play('hurt');
    if (rand() < 0.35) radio(['נפגעת! תחזיק מעמד!', 'חובש! לפה!', 'תמשיך לירות, סמל!'][Math.floor(rand() * 3)]);
    if (L.lives <= 0) { L.lives = 0; G.screen = 'dying'; setTimeout(gameOver, 900); }
  }

  // ---------- בוס: טנק ----------
  function makeTank() {
    const z = -150, x = 18;
    const e = { type: 'tank', state: 'drive', t: 0, x, z, tx: 2, tz: -119, hostile: true, flash: 0, parts: [
      { id: 'turret', u: 0.47, v: 0.22, r: 0.075, hp: 50, max: 50, core: true, alive: true },
      { id: 'mg', u: 0.84, v: 0.55, r: 0.05, hp: 14, max: 14, alive: true, aim: 0, aimDur: 0, timer: 3 },
    ], shellT: 4.5 };
    e.mesh = makeCard('tank'); setPose(e, 'tank'); e.mesh.scale.multiplyScalar(1.3); e.h *= 1.3;
    e.mesh.position.set(x, groundH(x, z), z);
    ENTS.push(e); L.boss = e; S.play('alert'); hint('טנק כבד!', true); radio('טנק! כוון לצריח ולמקלע. את הפגזים אפשר ליירט!');
    return e;
  }
  function partWorld(e, p) { return e.mesh.localToWorld(new T.Vector3(p.u - 0.5, 1 - p.v, 0.05)); }
  function updTank(e, dt) {
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    const m = e.mesh;
    m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z) * 0.6;
    m.material.color.setRGB(1 + e.flash * 6, 0.94 + e.flash * 6, 0.86 + e.flash * 6);
    if (e.state === 'dead') { if (rand() < dt * 16) smoke(partWorld(e, e.parts[0]).add(new T.Vector3((rand() - 0.5) * 3, 0, 0)), 2.2, true); if (rand() < dt * 20) fire(partWorld(e, e.parts[0]).add(new T.Vector3((rand() - 0.5) * 3, rand(), 0)), 1.4); e.dt2 = (e.dt2 || 0) + dt; if (e.dt2 < 2 && rand() < dt * 6) explode(partWorld(e, e.parts[rand() < 0.5 ? 0 : 1]).add(new T.Vector3((rand() - 0.5) * 4, rand() * 2, 0)), 1.3); return; }
    if (e.state === 'drive') {
      e.x = lerp(e.x, e.tx, dt * 0.35); e.z = lerp(e.z, e.tz, dt * 0.35);
      if (Math.hypot(e.x - e.tx, e.z - e.tz) < 0.6) { e.state = 'fight'; }
      if (rand() < dt * 20) sandPuff(m.position.clone().add(new T.Vector3((rand() - 0.5) * 6, 0.3, 1)), 2);
    } else { e.x = e.tx + Math.sin(e.t * 0.35) * 4; }
    m.position.set(e.x, groundH(e.x, e.z) - 0.25, e.z);
    // פגזים
    e.shellT -= dt;
    if (e.shellT <= 0 && e.parts[0].alive) { e.shellT = 4 + rand() * 1.5; const mp = muzzleWorld(e); flashAt(mp, 4); S.play('explosion', { vol: 0.6 }); smoke(mp, 2.5); fireShell(mp); G.shake = Math.max(G.shake, 0.4); }
    const mg = e.parts[1];
    if (mg.alive) { mg.timer -= dt; if (mg.timer <= 0 && !mg.aimDur) { mg.aimDur = 2.2; mg.aim = 0; } if (mg.aimDur) { mg.aim += dt; if (mg.aim >= mg.aimDur) { const p = partWorld(e, mg); flashAt(p, 1.3); S.play('mg'); playerHit(); mg.aimDur = 0; mg.timer = 2.6; } } }
  }
  function fireShell(from) {
    const to = camera.position.clone().add(new T.Vector3((rand() - 0.5) * 1.2, -0.4 + rand() * 0.4, -1.2));
    const mesh = new T.Sprite(new T.SpriteMaterial({ map: partTex.soft, color: new T.Color('#ffb040').convertSRGBToLinear(), blending: T.AdditiveBlending, depthWrite: false }));
    mesh.scale.setScalar(1.4); scene.add(mesh);
    PROJS.push({ from, to, t: 0, dur: 2.0, mesh, hp: 2 });
  }

  // ---------- אפקטים ----------
  function sprite(tex, col, blend, size) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: new T.Color(col).convertSRGBToLinear(), blending: blend || T.NormalBlending, depthWrite: false, transparent: true }));
    s.scale.setScalar(size); scene.add(s); return s;
  }
  function addPart(o) { if (PARTS.length > 420) { const x = PARTS.shift(); scene.remove(x.s); x.s.material.dispose(); } PARTS.push(o); }
  function flashAt(p, k) { const s = sprite(partTex.flash, '#fff2c8', T.AdditiveBlending, 1.1 * k); s.position.copy(p); s.material.rotation = rand() * 6; addPart({ s, life: 0.06, t: 0, v: new T.Vector3(), grow: 0, fade: true }); const l = sprite(partTex.soft, '#ffb060', T.AdditiveBlending, 3 * k); l.position.copy(p); addPart({ s: l, life: 0.08, t: 0, v: new T.Vector3(), grow: 0, fade: true }); }
  function sandPuff(p, k) { for (let i = 0; i < 3; i++) { const s = sprite(partTex.smoke, '#d9b48a', T.NormalBlending, (0.5 + rand() * 0.5) * k); s.position.copy(p).add(new T.Vector3((rand() - 0.5) * 0.4 * k, 0.1, (rand() - 0.5) * 0.4)); s.material.opacity = 0.6; addPart({ s, life: 0.9 + rand() * 0.6, t: 0, v: new T.Vector3((rand() - 0.5) * 1.2, 0.6 + rand() * 0.8, (rand() - 0.5) * 0.6), grow: 1.4 * k, fade: true, op: 0.6 }); } }
  function smoke(p, k, dark) { const s = sprite(partTex.smoke, dark ? '#2a2420' : '#8a7a6a', T.NormalBlending, k * (1 + rand())); s.position.copy(p); s.material.rotation = rand() * 6; addPart({ s, life: 2.5 + rand() * 1.5, t: 0, v: new T.Vector3((rand() - 0.2) * 0.8, 1.2 + rand(), 0), grow: k * 1.2, fade: true, op: dark ? 0.7 : 0.5 }); }
  function fire(p, k) { const s = sprite(partTex.soft, rand() < 0.5 ? '#ff9a30' : '#ff5a20', T.AdditiveBlending, k * (0.6 + rand() * 0.6)); s.position.copy(p); addPart({ s, life: 0.5 + rand() * 0.4, t: 0, v: new T.Vector3((rand() - 0.5) * 0.5, 1.5 + rand(), 0), grow: -k * 0.6, fade: true }); }
  function sparks(p, n, col) { for (let i = 0; i < n; i++) { const s = sprite(partTex.soft, col || '#ffd27a', T.AdditiveBlending, 0.12); s.position.copy(p); addPart({ s, life: 0.3 + rand() * 0.3, t: 0, v: new T.Vector3((rand() - 0.5) * 7, rand() * 6, (rand() - 0.5) * 7), g: 14, grow: 0, fade: true }); } }
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
    const g = new T.BufferGeometry().setFromPoints([a, b]);
    const l = new T.Line(g, new T.LineBasicMaterial({ color: new T.Color(col).convertSRGBToLinear(), transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
    scene.add(l); TRACERS.push({ l, t: 0.07 });
  }
  function decal(point, normal) {
    const m = new T.Mesh(new T.PlaneGeometry(0.16, 0.16), new T.MeshBasicMaterial({ map: partTex.decal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.position.copy(point).addScaledVector(normal, 0.01); m.lookAt(point.clone().add(normal)); scene.add(m);
    DECALS.push(m); if (DECALS.length > 90) { const d = DECALS.shift(); scene.remove(d); d.geometry.dispose(); d.material.dispose(); }
  }

  // ---------- ירי ----------
  const ndc = new T.Vector2();
  function shoot() {
    const w = L.w, now = performance.now();
    if (w.reloading || now - w.last < w.d.rate) return;
    if (w.ammo <= 0) { if (G.pressed) { S.play('empty'); L.needReload = 1.2; if (isTouch) reload(); } return; }
    w.last = now; w.ammo--; w.recoil = 1; L.shots++; S.play(w.d.sound);
    const sx = (rand() - 0.5) * w.d.spread * W * (1 + (G.heat || 0)), sy = (rand() - 0.5) * w.d.spread * W * (1 + (G.heat || 0));
    const hit = resolve(G.mx + sx, G.my + sy, w.d);
    if (hit) L.hits++; else L.combo = 0;
    if (w.d.auto) G.heat = Math.min(1.5, (G.heat || 0) + 0.1);
    gunFlash = 0.06;
    if (w.ammo === 0 && !w.base && w.reserve <= 0) setTimeout(() => { L.w = weapon('uzi', true); hint('חזרה לעוזי'); }, 300);
    else if (w.ammo === 0 && isTouch) setTimeout(reload, 150);
  }
  function reload() { const w = L.w; if (w.reloading || w.ammo === w.d.mag || (!w.base && w.reserve <= 0)) return; w.reloading = true; w.rt = 0; S.play('reload'); L.needReload = 0; }

  function resolve(px, py, wd) {
    ndc.set(px / W * 2 - 1, -(py / H * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const ray = raycaster.ray;
    // פגזים באוויר
    for (const p of PROJS) { if (ray.distanceToPoint(p.mesh.position) < 0.9) { p.hp -= wd.dmg; sparks(p.mesh.position, 6); if (p.hp <= 0) { p.dead = true; explode(p.mesh.position.clone(), 0.8); score(150, p.mesh.position, 'יירוט!'); } return true; } }
    // פריטים
    for (const it of ITEMS) { if (ray.distanceToPoint(it.pos) < 0.7) { collect(it); return true; } }
    const objs = [ground, ...COVERS];
    ENTS.forEach(e => { if (e.state !== 'dead' && e.state !== 'gone' && e.state !== 'wait') objs.push(e.mesh); });
    const hits = raycaster.intersectObjects(objs, false);
    let any = false;
    for (const h of hits) {
      const o = h.object;
      const ent = ENTS.find(e => e.mesh === o);
      if (ent) {
        const sp = ent.sp; const u = h.uv.x;
        if (alphaAt(sp.f, h.uv.x, h.uv.y) < 110) continue;
        if (ent.type === 'tank') { tankHit(ent, u, h.uv.y, h.point, wd); return true; }
        hitEnt(ent, u, h.uv.y, h.point, wd); any = true;
        if (!wd.pierce) return true;
        continue;
      }
      if (o.userData.cover && o.userData.sprite) { if (alphaAt(o.userData.sprite.f, h.uv.x, h.uv.y) < 110) continue; }
      if (wd.pierce && o !== ground) continue;
      // מחסה או קרקע
      const n = h.face ? h.face.normal.clone().transformDirection(o.matrixWorld) : new T.Vector3(0, 1, 0);
      if (o === ground) { sandPuff(h.point, 0.5); decal(h.point, n); }
      else { sparks(h.point, 5, o.userData.cover.barrel ? '#ffe0a0' : '#ffd8a0'); sandPuff(h.point, 0.25); if (!o.userData.sprite) decal(h.point, n); S.play(o.userData.cover.barrel ? 'metal' : 'ricochet'); }
      return any;
    }
    return any;
  }

  function score(base, p3, label) {
    const mult = 1 + Math.min(3, Math.floor(L.combo / 5) * 0.5), v = Math.round(base * mult); L.score += v;
    pop((label ? label + ' ' : '') + '+' + v, p3, mult > 1 ? '#ffd85a' : '#ffffff', label ? 1.05 : 0.85);
  }

  function hitEnt(e, u, v, point, wd) {
    e.flash = 0.06; L.combo++; L.maxCombo = Math.max(L.maxCombo, L.combo);
    if (e.type === 'jeep') {
      e.hp -= wd.dmg; sparks(point, 7); S.play('metal');
      if (e.hp <= 0) { e.state = 'dead'; e.hostile = false; explode(e.mesh.position.clone().add(new T.Vector3(0, 1.2, 0.3)), 1.6); e.mesh.material.color.setRGB(0.3, 0.28, 0.26); L.kills++; score(800, point, 'ג׳יפ הושמד!'); dropItem(e.mesh.position.clone().add(new T.Vector3(0, 2.4, 1))); }
      return;
    }
    const hb = e.sp.head || [0, 0, 0, 0], iy = 1 - v;
    const head = u > hb[0] - 0.04 && u < hb[2] + 0.04 && iy > hb[1] && iy < hb[3] + 0.03;
    const legs = e.pose !== 'aim' && iy > 0.62;
    let dmg = wd.dmg * (head ? 3 : 1);
    if (legs && e.type !== 'heavy' && e.hp <= 2 && wd.dmg < 3) {
      e.state = 'surrender'; e.hostile = false; L.kills++; L.neutral++; score(250, point, 'ניטרול!'); S.play('hit'); sparks(point, 4, '#fff');
      setPose(e, 'idle'); e.k = 1; e.t2 = 0; if (e.spot) e.spot.busy = false; return;
    }
    e.hp -= dmg; sandPuff(point, 0.2); sparks(point, 3, '#ffcf9a');
    S.play(head ? 'head' : 'hit');
    if (e.hp <= 0) kill(e, head, point);
    else if (e.state === 'aim') e.t = Math.max(0, e.t - 0.3);
  }
  function kill(e, head, point) {
    e.state = 'dead'; e.hostile = false; L.kills++; if (e.spot) e.spot.busy = false;
    if (head) { L.heads++; score(e.type === 'heavy' ? 400 : 200, point, 'ראש!'); } else score(e.type === 'heavy' ? 300 : 100, point);
    const pos = e.mesh.position.clone();
    setPose(e, 'hit'); e.mesh.position.copy(pos);
    const away = new T.Vector3().subVectors(pos, camera.position).setY(0).normalize();
    e.vel = away.multiplyScalar(2.2).add(new T.Vector3(0, 2.4, 0)); e.fall = rand() < 0.5 ? 1 : -1; e.fade = 0;
    if (rand() < 0.18) dropItem(headWorld(e).add(new T.Vector3(0, 0.6, 0)));
  }
  function tankHit(e, u, v, point, wd) {
    for (const p of e.parts) {
      if (!p.alive) continue;
      const du = (u - p.u) * e.mesh.scale.x / e.mesh.scale.y, dv = (1 - v) - p.v;
      if (Math.hypot(du, dv) < p.r * 1.2) {
        p.hp -= wd.dmg; e.flash = 0.05; sparks(point, 8); S.play('hit'); L.score += 10; L.combo++;
        if (p.hp <= 0) { p.alive = false; explode(partWorld(e, p), p.core ? 2.4 : 1.2); score(p.core ? 5000 : 800, point, p.core ? 'הטנק הושמד!' : 'המקלע הושמד!'); if (p.core) { e.state = 'dead'; e.hostile = false; e.mesh.material.color.setRGB(0.32, 0.3, 0.28); L.kills++; } }
        return;
      }
    }
    sparks(point, 5, '#ffe8b0'); S.play('ricochet');
    if (!L.tankHint) { L.tankHint = true; hint('השריון עבה מדי. כוון לנקודות המסומנות'); }
  }

  // ---------- פריטים ----------
  function dropItem(pos) {
    const r = rand(); const kind = r < 0.4 && L.lives < L.max ? 'heal' : r < 0.65 ? 'slow' : 'weapon';
    ITEMS.push({ kind, wk: rand() < 0.5 ? 'fal' : 'mag', pos, t: 0, life: 7 });
  }
  function collect(it) {
    it.dead = true; S.play('pickup');
    if (it.kind === 'heal') { L.lives = Math.min(L.max, L.lives + 1); pop('מימייה +1', it.pos, '#9be36a'); }
    else if (it.kind === 'slow') { L.slowT = 6; pop('קפה שחור! הזמן מאט', it.pos, '#ffd85a'); }
    else { L.w = weapon(it.wk, false); pop(WEAPONS[it.wk].name + '!', it.pos, '#ffd85a', 1.1); }
    sparks(it.pos, 14, '#fff6c0');
  }

  // ---------- לולאה ----------
  let last = performance.now(), gunFlash = 0;
  function frame(now) {
    const rdt = Math.min(0.05, (now - last) / 1000); last = now; G.t += rdt;
    if (G.screen === 'play' || G.screen === 'dying') update(rdt);
    if (G.screen !== 'loading') render(rdt);
    requestAnimationFrame(frame);
  }

  function update(rdt) {
    const slow = L.slowT > 0 ? 0.35 : 1; if (L.slowT > 0) L.slowT -= rdt;
    const dt = rdt * slow; L.time += rdt;
    const w = L.w; w.recoil = Math.max(0, w.recoil - rdt * 9); G.heat = Math.max(0, (G.heat || 0) - rdt * (G.down ? 0.5 : 3));
    if (w.reloading) { w.rt += rdt * 1000; if (w.rt >= w.d.reload) { w.reloading = false; const need = w.d.mag - w.ammo, take = w.base ? need : Math.min(need, w.reserve); w.ammo += take; if (!w.base) w.reserve -= take; } }
    if (G.screen === 'play' && L.phase === 'fight' && (G.pressed || (G.down && w.d.auto))) shoot();
    G.pressed = false; if (L.needReload > 0) L.needReload -= rdt;

    // מצלמה
    if (L.phase === 'move') {
      const c = L.cam; c.t += rdt / c.dur; const k = ease(Math.min(1, c.t));
      L.camPos = new T.Vector3().lerpVectors(c.a, c.b, k); L.camPos.y += Math.sin(k * Math.PI) * (c.intro ? 2 : 0.6);
      if (!c.intro) L.camPos.y += Math.abs(Math.sin(c.t * c.dur * 7)) * 0.07;
      L.yaw = lerp(c.ay, c.by, k); L.pitch = c.intro ? lerp(-0.35, 0, k) : 0;
      if (c.t >= 1) beginScene(L.next);
    }
    // סצנה
    if (L.phase === 'fight') {
      L.pt += rdt;
      L.spawnT -= dt;
      const active = ENTS.filter(e => e.hostile && e.state !== 'gone' && e.state !== 'dead' && e.type !== 'tank').length;
      if (L.queue.length && L.spawnT <= 0 && active < L.maxActive) { if (spawn(L.queue[0])) L.queue.shift(); L.spawnT = 0.5 + rand() * 0.9; }
      if (L.scene === 2) { if (!L.boss) { L.bossT -= rdt; if (L.bossT <= 0) makeTank(); } else if (L.boss.state !== 'dead' && !L.queue.length && active < 2 && rand() < dt * 0.3) L.queue.push('soldier'); }
      if (!L.crate && L.pt > 7) { L.crate = true; const c = COVERS.filter(o => o.position.distanceTo(camera.position) < 30 && o.position.distanceTo(camera.position) > 8); const o = c[Math.floor(rand() * c.length)]; if (o) ITEMS.push({ kind: 'weapon', wk: rand() < 0.5 ? 'fal' : 'mag', pos: o.position.clone().add(new T.Vector3(0, 1.6, 0)), t: 0, life: 8 }); }
      const left = ENTS.filter(e => e.hostile && e.state !== 'gone' && e.state !== 'dead').length;
      const bossOk = L.scene < 2 || (L.boss && L.boss.state === 'dead' && (L.boss.dt2 || 0) > 1.8);
      if (bossOk && L.scene === 2) { L.queue = []; ENTS.forEach(e => { if (e.hostile && e.type !== 'tank') { e.state = 'surrender'; e.hostile = false; e.t2 = 0; } }); }
      if (bossOk && !L.queue.length && left === 0) { L.phase = 'clear'; L.pt = 0; S.play('clear'); radio(L.scene < 2 ? ['האזור נקי! ממשיכים!', 'יפה מאוד, זזים קדימה!'][L.scene] : 'הטנק עולה באש! הדרך לתעלה פתוחה!'); }
    } else if (L.phase === 'clear' && L.pt > 1.6) {
      L.pt += 0;
      if (L.scene < 2) { L.phase = 'move'; L.next = L.scene + 1; L.cam = { a: L.camPos.clone(), ay: L.yaw, b: stopPos(L.next), by: STOPS[L.next].yaw, t: 0, dur: 3.2 }; S.play('radio'); }
      else { L.phase = 'done'; setTimeout(levelComplete, 1200); }
    }
    if (L.phase === 'clear') L.pt += rdt;

    ENTS.forEach(e => e.type === 'tank' ? updTank(e, dt) : updEnt(e, dt));
    for (let i = ENTS.length - 1; i >= 0; i--) if (ENTS[i].state === 'gone') { scene.remove(ENTS[i].mesh); ENTS[i].mesh.material.dispose(); ENTS.splice(i, 1); }
    // פגזים
    PROJS.forEach(p => {
      p.t += dt / p.dur; const k = Math.min(1, p.t);
      p.mesh.position.lerpVectors(p.from, p.to, k); p.mesh.position.y += Math.sin(k * Math.PI) * 3;
      if (rand() < 0.9) smoke(p.mesh.position.clone(), 0.5, false);
      if (p.t >= 1 && !p.dead) { p.dead = true; G.flash = 0.25; S.play('explosion'); playerHit(); G.shake = 1; }
    });
    for (let i = PROJS.length - 1; i >= 0; i--) if (PROJS[i].dead) { scene.remove(PROJS[i].mesh); PROJS.splice(i, 1); }
    ITEMS.forEach(it => { it.t += dt; if (it.t > it.life) it.dead = true; });
    for (let i = ITEMS.length - 1; i >= 0; i--) if (ITEMS[i].dead) ITEMS.splice(i, 1);
    SMOKERS.forEach(s => { if (rand() < rdt * s.rate) smoke(s.pos.clone().add(new T.Vector3((rand() - 0.5) * 2, 0, 0)), s.big ? 4 : 1.5, true); });
    POPS.forEach(p => p.t -= rdt); for (let i = POPS.length - 1; i >= 0; i--) if (POPS[i].t <= 0) POPS.splice(i, 1);
    if (L.radio) { L.radio.t -= rdt; if (L.radio.t <= 0) L.radio = null; }
    if (L.hint) { L.hint.t -= rdt; if (L.hint.t <= 0) L.hint = null; }
  }

  function updParts(dt) {
    for (let i = PARTS.length - 1; i >= 0; i--) {
      const p = PARTS[i]; p.t += dt;
      if (p.t >= p.life) { scene.remove(p.s); if (p.s.material) p.s.material.dispose(); PARTS.splice(i, 1); continue; }
      const k = p.t / p.life;
      if (p.light) { p.s.intensity = p.base * (1 - k); continue; }
      if (p.g) p.v.y -= p.g * dt;
      p.s.position.addScaledVector(p.v, dt);
      if (p.grow) { const s = Math.max(0.01, p.s.scale.x + p.grow * dt); p.s.scale.setScalar(s); }
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
    if (renderer) { const pr = Math.min(1.6, dpr); renderer.setPixelRatio(pr); renderer.setSize(cw, ch, false); composer.setPixelRatio(pr); composer.setSize(cw, ch); }
  }
  window.addEventListener('resize', resize);

  const tmpV = new T.Vector3();
  function toScreen(v) { tmpV.copy(v).project(camera); return [(tmpV.x + 1) / 2 * W, (1 - tmpV.y) / 2 * H, tmpV.z]; }

  function render(rdt) {
    updParts(rdt * (L && L.slowT > 0 ? 0.35 : 1));
    // מצלמה
    let cp = L && L.camPos ? L.camPos : new T.Vector3(-14, 16, 34), yaw = L ? L.yaw || 0 : 0.5, pitch = L ? L.pitch || 0 : -0.3;
    if (!L) { yaw = 0.4 + Math.sin(G.t * 0.1) * 0.2; cp = new T.Vector3(-10 + Math.sin(G.t * 0.08) * 8, 6, 20); pitch = -0.08; }
    const sway = L && L.phase === 'fight' ? [(G.mx / W - 0.5) * 0.12, (G.my / H - 0.5) * 0.06] : [0, 0];
    camera.position.copy(cp);
    if (G.shake > 0) { camera.position.x += (rand() - 0.5) * 0.12 * G.shake; camera.position.y += (rand() - 0.5) * 0.12 * G.shake; G.shake = Math.max(0, G.shake - rdt * 2); }
    camera.rotation.order = 'YXZ'; camera.rotation.set(pitch - sway[1] + Math.sin(G.t * 1.3) * 0.004, yaw - sway[0], 0);
    sun.position.copy(camera.position).add(new T.Vector3(-60, 26, -70)); sun.target.position.copy(camera.position).add(new T.Vector3(0, 0, -18));
    scene.userData.sky.position.x = camera.position.x; scene.userData.sky.position.z = camera.position.z;
    const d = scene.userData.dust; d.position.x = Math.sin(G.t * 0.2) * 2; d.rotation.y = G.t * 0.01;
    if (boomLight) boomLight.intensity = Math.max(0, boomLight.intensity - rdt * 160);
    G.dmg = Math.max(0, G.dmg - rdt * 1.6); G.flash = Math.max(0, G.flash - rdt * 2);
    finalPass.uniforms.time.value = G.t % 100; finalPass.uniforms.dmg.value = G.dmg; finalPass.uniforms.slow.value = L && L.slowT > 0 ? 1 : 0; finalPass.uniforms.flash.value = G.flash;
    // פגזים מסתובבים
    PROJS.forEach(p => { p.mesh.material.rotation += rdt * 8; });
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

  function drawHUD() {
    hc.setTransform(dpr * cssScale, 0, 0, dpr * cssScale, 0, 0); hc.clearRect(0, 0, W, H);
    if (!L || G.screen === 'loading') return;
    // טבעות כוונון
    ENTS.forEach(e => {
      if (e.type === 'tank') {
        if (e.state === 'dead') return;
        e.parts.forEach(p => { if (!p.alive) return; const [x, y] = toScreen(partWorld(e, p)); const pulse = 0.5 + 0.5 * Math.sin(G.t * 6); hc.strokeStyle = `rgba(255,70,50,${0.55 + pulse * 0.4})`; hc.lineWidth = 3; hc.setLineDash([8, 6]); hc.beginPath(); hc.arc(x, y, 30 + pulse * 5, 0, 7); hc.stroke(); hc.setLineDash([]); hc.strokeStyle = '#ffcf4a'; hc.lineWidth = 4; hc.beginPath(); hc.arc(x, y, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.hp / p.max); hc.stroke(); if (p.aimDur) ring(x, y, 70, p.aim / p.aimDur); });
        return;
      }
      if (e.state === 'aim') { const [x, y, z] = toScreen(e.type === 'jeep' ? muzzleWorld(e) : headWorld(e)); if (z < 1) ring(x, y + 10, 64, e.t / e.aim); }
      if ((e.type === 'heavy' || e.type === 'jeep') && e.hostile && e.state !== 'wait') { const [x, y] = toScreen(e.mesh.position.clone().add(new T.Vector3(0, e.h + 0.25, 0))); hc.fillStyle = 'rgba(0,0,0,0.6)'; hc.fillRect(x - 32, y - 2, 64, 8); hc.fillStyle = '#ffcf4a'; hc.fillRect(x - 30, y, 60 * Math.max(0, e.hp / e.max), 4); }
    });
    // פגזים: אזהרה
    PROJS.forEach(p => { const [x, y] = toScreen(p.mesh.position); hc.strokeStyle = p.t > 0.6 && Math.floor(G.t * 10) % 2 ? '#ff3a2a' : 'rgba(255,90,60,0.7)'; hc.lineWidth = 2.5; hc.setLineDash([5, 5]); hc.beginPath(); hc.arc(x, y, 20 + p.t * 50, 0, 7); hc.stroke(); hc.setLineDash([]); });
    // פריטים
    ITEMS.forEach(it => {
      const [x, y, z] = toScreen(it.pos); if (z > 1) return; const b = Math.sin(it.t * 5) * 5;
      if (it.life - it.t < 1.5 && Math.floor(it.t * 10) % 2) return;
      const g = hc.createRadialGradient(x, y + b, 0, x, y + b, 46); g.addColorStop(0, it.kind === 'heal' ? 'rgba(155,227,106,0.6)' : 'rgba(255,216,90,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); hc.fillStyle = g; hc.fillRect(x - 46, y + b - 46, 92, 92);
      hc.save(); hc.translate(x, y + b);
      if (it.kind === 'heal') { hc.fillStyle = '#5a6a3a'; hc.beginPath(); hc.ellipse(0, 4, 16, 20, 0, 0, 7); hc.fill(); hc.fillStyle = '#c8c0a0'; hc.fillRect(-5, -22, 10, 8); hc.fillStyle = '#e8443a'; hc.fillRect(-3, -4, 6, 16); hc.fillRect(-8, 1, 16, 6); }
      else if (it.kind === 'slow') { hc.fillStyle = '#f4f0e8'; hc.beginPath(); hc.moveTo(-13, -12); hc.lineTo(13, -12); hc.lineTo(10, 16); hc.lineTo(-10, 16); hc.fill(); hc.fillStyle = '#4a2a14'; hc.fillRect(-11, -10, 22, 5); }
      else { hc.fillStyle = '#5a4a2a'; hc.fillRect(-30, -18, 60, 36); hc.strokeStyle = '#2a2010'; hc.lineWidth = 3; hc.strokeRect(-30, -18, 60, 36); hc.fillStyle = '#ffd85a'; hc.font = '800 12px Assistant, Arial'; hc.textAlign = 'center'; hc.fillText(WEAPONS[it.wk].name, 0, 5); }
      hc.restore();
    });
    // נקודות
    POPS.forEach(p => { const [x, y, z] = toScreen(p.p); if (z > 1) return; hc.globalAlpha = Math.min(1, p.t * 3); txt(p.text, x, y - (1.1 - p.t) * 60, Math.round(24 * p.size), p.col); hc.globalAlpha = 1; });
    drawGun();
    // לבבות
    for (let i = 0; i < L.max; i++) { const x = W - 40 - i * 38, y = 40, on = i < L.lives; hc.save(); hc.translate(x, y); hc.scale(1.15, 1.15); hc.fillStyle = on ? '#e8443a' : 'rgba(255,255,255,0.18)'; hc.beginPath(); hc.moveTo(0, 8); hc.bezierCurveTo(-16, -4, -10, -16, 0, -8); hc.bezierCurveTo(10, -16, 16, -4, 0, 8); hc.fill(); hc.restore(); }
    // ניקוד
    hc.direction = 'ltr'; hc.font = '400 50px "Karantina", "Assistant", sans-serif'; hc.textAlign = 'left';
    hc.fillStyle = 'rgba(0,0,0,0.5)'; hc.fillText(String(L.score).padStart(7, '0'), 26, 56); hc.fillStyle = '#fff'; hc.fillText(String(L.score).padStart(7, '0'), 24, 54);
    if (L.combo >= 5) txt(`קומבו ${L.combo}  x${1 + Math.min(3, Math.floor(L.combo / 5) * 0.5)}`, 30, 88, 24, '#ffd85a', 'left');
    txt('ששת הימים  |  הפריצה בסיני', W / 2, 32, 20, 'rgba(255,255,255,0.85)');
    for (let i = 0; i < 3; i++) { hc.fillStyle = i < L.scene ? '#e0a84a' : i === L.scene ? '#fff' : 'rgba(255,255,255,0.3)'; hc.beginPath(); hc.arc(W / 2 + (i - 1) * 24, 50, i === L.scene ? 6 : 4, 0, 7); hc.fill(); }
    if (L.boss && L.boss.state !== 'dead') { const tot = L.boss.parts.reduce((a, p) => a + p.max, 0), cur = L.boss.parts.reduce((a, p) => a + (p.alive ? p.hp : 0), 0); hc.fillStyle = 'rgba(0,0,0,0.6)'; hc.fillRect(W / 2 - 263, 70, 526, 18); hc.fillStyle = '#d8423a'; hc.fillRect(W / 2 - 260, 73, 520 * cur / tot, 12); txt('טנק כבד', W / 2, 112, 22, '#ffcf9a'); }
    // תחמושת
    const w = L.w; txt(w.d.name + (w.base ? '' : `  (${w.reserve})`), 28, H - 64, 22, w.base ? '#fff' : '#ffd85a', 'left');
    const pw = Math.min(10, 380 / w.d.mag); for (let i = 0; i < w.d.mag; i++) { hc.fillStyle = i < w.ammo ? '#e8c070' : 'rgba(255,255,255,0.15)'; hc.fillRect(24 + i * pw, H - 48, Math.max(2, pw - 2), 18); }
    if (w.reloading) txt('טוען...', 240, H - 90, 22, '#fff');
    else if ((w.ammo === 0 || L.needReload > 0) && Math.floor(G.t * 4) % 2) txt(isTouch ? 'טען! הקש על כפתור הטעינה' : 'טען! קליק ימני או R', W / 2, H - 170, 34, '#ff5a4a');
    if (isTouch) { hc.fillStyle = 'rgba(0,0,0,0.45)'; hc.beginPath(); hc.arc(70, H - 130, 46, 0, 7); hc.fill(); hc.strokeStyle = '#e0a84a'; hc.lineWidth = 3; hc.stroke(); txt('טען', 70, H - 122, 24, '#fff'); }
    if (L.slowT > 0) txt('הזמן מאט', W / 2, 150, 30, '#ffd85a');
    // קשר עם תמונת המג״ד
    if (L.radio) {
      const a = Math.min(1, L.radio.t * 2); hc.globalAlpha = a;
      hc.fillStyle = 'rgba(8,10,8,0.78)'; hc.beginPath(); hc.roundRect ? hc.roundRect(W / 2 - 520, H - 128, 720, 84, 10) : hc.rect(W / 2 - 520, H - 128, 720, 84); hc.fill();
      if (TEX.commanderImg) { hc.save(); hc.beginPath(); hc.rect(W / 2 + 120, H - 122, 72, 72); hc.clip(); hc.drawImage(TEX.commanderImg, W / 2 + 120, H - 122, 72, 72); hc.restore(); hc.strokeStyle = '#e0a84a'; hc.lineWidth = 2; hc.strokeRect(W / 2 + 120, H - 122, 72, 72); }
      txt('המג״ד רפי:', W / 2 + 106, H - 96, 17, '#e0a84a', 'right'); txt(L.radio.text, W / 2 + 106, H - 64, 23, '#fff', 'right');
      hc.globalAlpha = 1;
    }
    if (L.hint) { hc.globalAlpha = Math.min(1, L.hint.t * 2); txt(L.hint.text, W / 2, L.hint.big ? 250 : 190, L.hint.big ? 64 : 30, L.hint.big ? '#ffcf9a' : '#fff', 'center', L.hint.big ? '"Karantina", sans-serif' : undefined); hc.globalAlpha = 1; }
    if (L.phase === 'clear') txt(L.scene < 2 ? 'האזור נקי!' : 'ניצחון!', W / 2, H / 2, 96, '#e0a84a', 'center', '"Karantina", sans-serif');
    if (L.phase === 'move' && L.cam.intro && L.cam.t < 0.9) { hc.globalAlpha = 1 - Math.max(0, L.cam.t - 0.6) / 0.3; txt('שלב 2', W / 2, H / 2 - 40, 36, '#e0a84a', 'center', '"Karantina", sans-serif'); txt('הפריצה בסיני', W / 2, H / 2 + 40, 96, '#fff', 'center', '"Karantina", sans-serif'); hc.globalAlpha = 1; }
    if (L.lives === 1 && G.screen === 'play') { const g = hc.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${0.25 + 0.15 * Math.sin(G.t * 5)})`); hc.fillStyle = g; hc.fillRect(0, 0, W, H); }
    if (G.screen === 'play') drawCross();
  }

  function drawGun() {
    const img = TEX.uziImg; if (!img) return;
    const w = L.w, rec = w.recoil;
    const gw = 470, gh = gw * img.height / img.width;
    const gx = W - gw - 40 + (G.mx - W / 2) * 0.1 + rec * 12, gy = H - gh + 40 + (G.my - H / 2) * 0.06 + rec * 26 + (w.reloading ? 120 : 0);
    hc.save(); hc.translate(gx + gw * 0.5, gy + gh); hc.rotate((G.mx - W / 2) * 0.00025 - rec * 0.04); hc.drawImage(img, -gw * 0.5, -gh, gw, gh); hc.restore();
    if (gunFlash > 0) { gunFlash -= 0.016; const mx = gx + gw * 0.16, my = gy + gh * 0.04; const g = hc.createRadialGradient(mx, my, 0, mx, my, 70); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.3, 'rgba(255,190,90,0.8)'); g.addColorStop(1, 'rgba(255,140,40,0)'); hc.fillStyle = g; hc.fillRect(mx - 70, my - 70, 140, 140); }
  }
  function drawCross() {
    const x = G.mx, y = G.my, w = L.w; const r = 14 + (w.d.spread || 0) * 600 * (1 + (G.heat || 0)) + w.recoil * 8;
    hc.save(); const draw = (c, lw) => { hc.strokeStyle = c; hc.lineWidth = lw; hc.beginPath(); hc.arc(x, y, r, 0, 7); hc.stroke(); hc.beginPath(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { hc.moveTo(x + a * (r + 4), y + b * (r + 4)); hc.lineTo(x + a * (r + 14), y + b * (r + 14)); }); hc.stroke(); };
    draw('rgba(0,0,0,0.6)', 4); draw('#ffd27a', 2); hc.fillStyle = '#ffd27a'; hc.beginPath(); hc.arc(x, y, 2, 0, 7); hc.fill();
    if (w.reloading) { hc.strokeStyle = '#fff'; hc.lineWidth = 4; hc.beginPath(); hc.arc(x, y, r + 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * w.rt / w.d.reload); hc.stroke(); }
    hc.restore();
  }

  // ---------- מסכים ----------
  function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== id); hud.classList.toggle('playing', !id); }
  function levelComplete() {
    G.screen = 'end'; S.stopMusic(); S.play('clear');
    const acc = L.shots ? L.hits / L.shots : 0; L.score += L.lives * 300 + Math.round(acc * 2000);
    let stars = 1; if (acc >= 0.5) stars++; if (L.dmgTaken <= 1) stars++;
    $('end-title').textContent = 'השלב הושלם';
    $('end-stars').innerHTML = [0, 1, 2].map(i => `<span class="star ${i < stars ? 'on' : ''}">★</span>`).join('');
    $('end-stats').innerHTML = [['ניקוד', L.score.toLocaleString('he-IL')], ['דיוק', Math.round(acc * 100) + '%'], ['נוטרלו', L.kills], ['פגיעות ראש', L.heads], ['ניטרולים', L.neutral], ['קומבו שיא', L.maxCombo]].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    $('end-story').textContent = 'הטנק עולה באש והעמדות נוקו. השמש כבר גבוהה מעל החולות, ורפי מסמן לגדוד להמשיך מערבה.';
    showScreen('end');
  }
  function gameOver() { G.screen = 'end'; S.stopMusic(); $('end-title').textContent = 'נפגעת'; $('end-stars').innerHTML = ''; $('end-stats').innerHTML = `<div class="stat"><span>ניקוד</span><b>${L.score.toLocaleString('he-IL')}</b></div>`; $('end-story').textContent = 'רפי גורר אותך מאחורי שק חול. עוד ניסיון, סמל.'; showScreen('end'); }

  // ---------- קלט ----------
  function toGame(e) { const r = hud.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
  hud.addEventListener('pointerdown', e => {
    S.init(); const [x, y] = toGame(e); G.mx = x; G.my = y;
    if (G.screen !== 'play') return; e.preventDefault();
    try { hud.setPointerCapture(e.pointerId); } catch (er) { }
    if (e.button === 2) { reload(); return; }
    if (isTouch && Math.hypot(x - 70, y - (H - 130)) < 56) { reload(); return; }
    G.down = true; G.pressed = true;
  });
  hud.addEventListener('pointermove', e => { const [x, y] = toGame(e); G.mx = x; G.my = y; });
  window.addEventListener('pointerup', () => G.down = false);
  hud.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => { if (G.screen === 'play' && (e.code === 'KeyR' || e.code === 'Space')) { e.preventDefault(); reload(); } });

  // ---------- אתחול ----------
  function typeBrief() {
    const t = 'חמישה ביוני, שחר. הטנקים כבר פרצו קדימה ועכשיו תורנו לנקות את העמדות שנשארו מאחור. הם מתבצרים מאחורי שקי חול וארגזים. בסוף הדרך מחכה להם טנק. כוון לצריח, ואת הפגזים שלו תפיל באוויר.';
    const el = $('brief-text'); el.textContent = ''; let n = 0; const iv = setInterval(() => { n += 2; el.textContent = t.slice(0, n); if (n >= t.length) clearInterval(iv); }, 18);
  }
  $('go').onclick = () => { S.init(); startGame(); };
  $('again').onclick = () => { location.reload(); };
  resize();
  loadAll(k => { $('bar').style.width = Math.round(k * 100) + '%'; }).then(() => {
    initGL(); resize(); G.screen = 'menu'; showScreen('brief'); typeBrief();
    if (TEX.commanderImg) $('brief-face').src = TEX.commanderImg.src;
  }).catch(err => { $('load-text').textContent = 'טעינת הגרפיקה נכשלה. צריך לפתוח את המשחק דרך שרת (ראה README).'; console.error(err); });
  requestAnimationFrame(frame);
  window.__g3 = { G, get L() { return L; }, get scene() { return scene; }, ENTS, startGame, tick(n) { for (let i = 0; i < n; i++) update(0.05); }, jump(i) { L.camPos = stopPos(i); L.yaw = STOPS[i].yaw; L.pitch = 0; beginScene(i); } };
  Object.defineProperty(window, "__cam", { get: () => camera });
})();
