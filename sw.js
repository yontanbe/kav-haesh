// שומר את קבצי המשחק במטמון: דפים מהרשת קודם, ותמונות, קולות וסקריפטים מהמטמון קודם
const CACHE = 'kav-haesh-v1';
const CORE = ['./', 'index.html', 'play.html', 'engine3d.js', 'levels67.js', 'profile.js', 'board.js', 'audio.js', 'voices.js',
  'vendor/three.min.js', 'vendor/three-post.js', 'manifest.webmanifest', 'icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  const fresh = req.mode === 'navigate' || /\.(html|js|webmanifest)$/.test(url.pathname);
  if (fresh) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); } return r; }).catch(() => caches.match(req, { ignoreSearch: true })));
  } else {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); } return r; })));
  }
});
