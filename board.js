/* קו האש: טבלת שיאים משותפת. עובדת רק בעמוד המשותף ב-claude.ai (מאגר נתונים של הדף).
   שורה אחת לכל שחקן, scores/<מזהה>, ורק השחקן עצמו כותב אותה. */
window.BOARD = (function () {
  let ready = null;
  function init() {
    if (!window.claude || typeof window.claude.use !== 'function') return Promise.resolve(null);
    ready = ready || Promise.all([window.claude.use('db'), window.claude.use('user')])
      .then(([db, user]) => (db && user ? { db, user } : null)).catch(() => null);
    return ready;
  }
  async function submit(level, name, score, diff) {
    const c = await init(); if (!c) return false;
    try {
      const id = await c.user.id(); if (!id) return false;
      const ref = c.db.doc('scores/' + id), snap = await ref.get();
      const cur = snap.exists ? snap.data() : {};
      const levels = Object.assign({}, cur.levels || {});
      const nm = String(name || '').slice(0, 18);
      if ((levels[level] || 0) >= score && cur.name === nm) return true;
      levels[level] = Math.max(levels[level] || 0, score);
      const total = Object.values(levels).reduce((a, b) => a + (+b || 0), 0);
      await ref.set({ name: nm, levels, total, done: Object.keys(levels).length, diff: diff || 'normal', at: Date.now() });
      return true;
    } catch (e) { return false; }
  }
  // שולח את כל השיאים מהפרופיל בכתיבה אחת, רק אם משהו השתפר
  async function sync(profile) {
    const c = await init(); if (!c || !profile) return false;
    try {
      const id = await c.user.id(); if (!id) return false;
      const mine = {}; Object.keys(profile.levels || {}).forEach(k => { const l = profile.levels[k]; if (l && l.completed && l.best) mine[k.replace('67-', '')] = l.best; });
      if (!Object.keys(mine).length) return false;
      const ref = c.db.doc('scores/' + id), snap = await ref.get(), cur = snap.exists ? snap.data() : {};
      const levels = Object.assign({}, cur.levels || {}); let changed = false;
      Object.keys(mine).forEach(k => { if ((levels[k] || 0) < mine[k]) { levels[k] = mine[k]; changed = true; } });
      const nm = String(window.PROFILE ? PROFILE.displayName(profile) : profile.name || '').slice(0, 18);
      if (!changed && cur.name === nm) return true;
      const total = Object.values(levels).reduce((a, b) => a + (+b || 0), 0);
      await ref.set({ name: nm, levels, total, done: Object.keys(levels).length, diff: (profile.settings && profile.settings.difficulty) || 'normal', at: Date.now() });
      return true;
    } catch (e) { return false; }
  }
  async function watch(cb) {
    const c = await init(); if (!c) { cb(null); return null; }
    let me = null; try { me = await c.user.id(); } catch (e) { }
    return c.db.collection('scores').orderBy('total', 'desc').limit(25).onSnapshot(
      s => cb(s.docs.map(d => Object.assign({ id: d.id, me: d.id === me }, d.data()))),
      e => cb(null, e));
  }
  return { init, submit, sync, watch };
})();
