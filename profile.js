/* קו האש: פרופיל שחקן, הגדרות ושמירת התקדמות. נשמר בדפדפן (localStorage) */
(function () {
  const KEY = 'kav-haesh-profile';
  const RANKS = ['טוראי', 'רב״ט', 'סמל', 'סמ״ר', 'סג״ם', 'סגן', 'סרן', 'רס״ן', 'סא״ל', 'אל״ם', 'תא״ל', 'אלוף', 'רא״ל'];
  const def = () => ({ name: '', created: Date.now(), settings: { quality: 'high', sound: true, music: true }, levels: {} });

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s === 'object') return Object.assign(def(), s, { settings: Object.assign(def().settings, s.settings || {}), levels: s.levels || {} });
    } catch (e) { }
    return def();
  }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch (e) { return false; } }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) { } }
  function displayName(p) { return ((p && p.name) || '').trim() || 'דני'; }
  function totalBest(p) { return Object.values(p.levels || {}).reduce((a, l) => a + (l.best || 0), 0); }
  function rank(p) { return RANKS[Math.min(RANKS.length - 1, Math.floor(totalBest(p) / 9000))]; }
  function level(p, id) { p.levels[id] = p.levels[id] || { best: 0, stars: 0, completed: false, plays: 0, checkpoint: null }; return p.levels[id]; }

  window.PROFILE = { KEY, load, save, reset, displayName, rank, totalBest, level, RANKS };
})();
