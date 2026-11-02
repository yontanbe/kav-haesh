/* קו האש: פרופיל שחקן, הגדרות, הישגים ושמירת התקדמות. נשמר בדפדפן (localStorage) */
(function () {
  const KEY = 'kav-haesh-profile';
  const RANKS = ['טוראי', 'רב״ט', 'סמל', 'סמ״ר', 'סג״ם', 'סגן', 'סרן', 'רס״ן', 'סא״ל', 'אל״ם', 'תא״ל', 'אלוף', 'רא״ל'];
  const ACH = [
    { id: 'first_blood', name: 'טבילת אש', desc: 'נטרלת את האויב הראשון' },
    { id: 'headhunter', name: 'צלף', desc: '25 פגיעות ראש בסך הכל' },
    { id: 'merciful', name: 'רחמן', desc: '5 ניטרולים בגפיים בשלב אחד' },
    { id: 'untouchable', name: 'בלתי פגיע', desc: 'סיימת שלב בלי לקבל פגיעה' },
    { id: 'sharpshooter', name: 'יד יציבה', desc: 'סיימת שלב עם דיוק של 70% ומעלה' },
    { id: 'demolition', name: 'חבלן', desc: 'פוצצת 10 חביות דלק' },
    { id: 'interceptor', name: 'כיפת ברזל', desc: 'יירטת 5 פגזים או רימונים באוויר' },
    { id: 'multi', name: 'שלושה במכה', desc: 'שלושה אויבים בפיצוץ אחד' },
    { id: 'tank_buster', name: 'צייד טנקים', desc: 'השמדת טנק' },
    { id: 'bunker_buster', name: 'פורץ בונקרים', desc: 'השמדת בונקר או מוצב' },
    { id: 'no_civ', name: 'ידיים נקיות', desc: 'סיימת את העיר העתיקה בלי לפגוע באזרחים' },
    { id: 'hard_mode', name: 'קשוח', desc: 'סיימת שלב ברמה קשה' },
    { id: 'campaign', name: 'ששת הימים', desc: 'סיימת את כל עשרת השלבים' },
  ];
  const def = () => ({ name: '', created: Date.now(), settings: { quality: 'high', sound: true, music: true, difficulty: 'normal' }, levels: {}, achievements: {}, totals: {} });

  function load() {
    let p = def();
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s === 'object') p = Object.assign(def(), s, { settings: Object.assign(def().settings, s.settings || {}), levels: s.levels || {}, achievements: s.achievements || {}, totals: s.totals || {} });
    } catch (e) { }
    // שמירה ישנה של שלב סיני עוברת לשלב 2 במערכה
    if (p.levels.sinai && !p.levels['67-2']) { p.levels['67-2'] = p.levels.sinai; delete p.levels.sinai; if (p.levels['67-2'].checkpoint && p.levels['67-2'].checkpoint.scene > 5) p.levels['67-2'].checkpoint = null; }
    return p;
  }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch (e) { return false; } }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) { } }
  function displayName(p) { return ((p && p.name) || '').trim() || 'דני'; }
  function totalBest(p) { return Object.values(p.levels || {}).reduce((a, l) => a + (l.best || 0), 0); }
  function rank(p) { return RANKS[Math.min(RANKS.length - 1, Math.floor(totalBest(p) / 12000))]; }
  function level(p, id) { p.levels[id] = p.levels[id] || { best: 0, stars: 0, completed: false, plays: 0, checkpoint: null }; return p.levels[id]; }
  function unlock(p, id) { if (p.achievements[id]) return false; p.achievements[id] = Date.now(); return true; }
  function isUnlocked(p, n) { return n <= 2 || !!(p.settings && p.settings.unlockAll) || !!(p.levels['67-' + (n - 1)] || {}).completed; }

  window.PROFILE = { KEY, load, save, reset, displayName, rank, totalBest, level, unlock, isUnlocked, ACH, RANKS };
})();
