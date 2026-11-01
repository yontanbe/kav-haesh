/* קו האש: סאונד מסונתז, מוזיקה וקולות בעברית */
(function () {
  const S = { ctx: null, master: null, sfx: null, mus: null, sfxOn: true, musicOn: true, voiceOn: true, noise: null, musicTimer: null, voices: [] };

  S.init = function () {
    if (S.ctx) { if (S.ctx.state === 'suspended') S.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      S.ctx = new AC();
      S.master = S.ctx.createGain(); S.master.gain.value = 0.8; S.master.connect(S.ctx.destination);
      const comp = S.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(S.master);
      S.sfx = S.ctx.createGain(); S.sfx.gain.value = 0.9; S.sfx.connect(comp);
      S.mus = S.ctx.createGain(); S.mus.gain.value = 0.22; S.mus.connect(S.master);
      const len = S.ctx.sampleRate * 2, buf = S.ctx.createBuffer(1, len, S.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      S.noise = buf;
    } catch (e) { S.ctx = null; }
    try {
      const load = () => { S.voices = speechSynthesis.getVoices().filter(v => /^he|iw/i.test(v.lang)); };
      load(); speechSynthesis.onvoiceschanged = load;
    } catch (e) { }
  };

  function noiseBurst(dur, f, q, vol, type, when, decay) {
    const c = S.ctx, t = when || c.currentTime;
    const src = c.createBufferSource(); src.buffer = S.noise; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = q || 1;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + (decay || dur));
    src.connect(fl); fl.connect(g); g.connect(S.sfx); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    return fl;
  }
  function tone(f0, f1, dur, vol, type, when) {
    const c = S.ctx, t = when || c.currentTime;
    const o = c.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(S.sfx); o.start(t); o.stop(t + dur + 0.05);
  }

  S.play = function (name, opt) {
    if (!S.ctx || !S.sfxOn) return;
    const v = (opt && opt.vol) || 1;
    switch (name) {
      case 'smg': noiseBurst(0.12, 1800, 0.8, 0.55 * v); tone(160, 60, 0.08, 0.5 * v); break;
      case 'rifle': noiseBurst(0.22, 1400, 0.7, 0.75 * v); noiseBurst(0.4, 400, 0.6, 0.3 * v, 'lowpass', 0, 0.4); tone(140, 45, 0.12, 0.7 * v); break;
      case 'mg': noiseBurst(0.14, 1200, 0.7, 0.6 * v); tone(120, 45, 0.1, 0.6 * v); break;
      case 'silenced': noiseBurst(0.07, 3000, 1.2, 0.35 * v); tone(500, 200, 0.05, 0.15 * v, 'triangle'); break;
      case 'shotgun': noiseBurst(0.45, 900, 0.5, 0.9 * v, 'lowpass', 0, 0.45); tone(110, 35, 0.2, 0.8 * v); break;
      case 'sniper': noiseBurst(0.6, 1600, 0.5, 0.9 * v, 'bandpass', 0, 0.6); tone(180, 40, 0.18, 0.8 * v); noiseBurst(1.2, 300, 0.5, 0.2 * v, 'lowpass', S.ctx.currentTime + 0.05, 1.2); break;
      case 'plasma': tone(1400, 180, 0.16, 0.35 * v, 'sawtooth'); tone(700, 90, 0.12, 0.25 * v, 'square'); break;
      case 'laser': tone(2200, 1800, 0.05, 0.12 * v, 'sawtooth'); break;
      case 'rail': tone(3000, 80, 0.5, 0.4 * v, 'sawtooth'); noiseBurst(0.4, 2400, 0.4, 0.4 * v); break;
      case 'rocket': noiseBurst(0.8, 600, 0.4, 0.6 * v, 'lowpass', 0, 0.8); tone(300, 80, 0.5, 0.3 * v, 'sawtooth'); break;
      case 'throw': noiseBurst(0.2, 900, 2, 0.2 * v, 'bandpass'); break;
      case 'boom': case 'explosion': noiseBurst(1.4, 500, 0.3, 1.0 * v, 'lowpass', 0, 1.4); tone(90, 25, 0.8, 0.9 * v); break;
      case 'emp': tone(80, 2000, 0.4, 0.4 * v, 'square'); noiseBurst(0.8, 3000, 0.5, 0.4 * v); break;
      case 'flash': noiseBurst(0.5, 4000, 0.3, 0.9 * v, 'highpass', 0, 0.5); tone(4200, 3800, 1.2, 0.12 * v, 'sine'); break;
      case 'enemyShot': noiseBurst(0.18, 1000, 0.6, 0.35 * v); tone(120, 50, 0.08, 0.3 * v); break;
      case 'enemyLaser': tone(900, 200, 0.2, 0.25 * v, 'square'); break;
      case 'reload': noiseBurst(0.05, 2500, 3, 0.4, 'bandpass'); noiseBurst(0.06, 1800, 3, 0.5, 'bandpass', S.ctx.currentTime + 0.25); noiseBurst(0.05, 3200, 3, 0.4, 'bandpass', S.ctx.currentTime + 0.45); break;
      case 'empty': noiseBurst(0.04, 3500, 4, 0.35, 'bandpass'); break;
      case 'hit': tone(900, 500, 0.05, 0.18); break;
      case 'head': tone(1500, 900, 0.07, 0.25); tone(2200, 1600, 0.06, 0.15, 'triangle', S.ctx.currentTime + 0.04); break;
      case 'metal': tone(2400, 1200, 0.18, 0.18, 'triangle'); noiseBurst(0.08, 4000, 2, 0.2); break;
      case 'ricochet': tone(2600 + Math.random() * 800, 600, 0.25, 0.08, 'sine'); noiseBurst(0.05, 3000, 2, 0.15); break;
      case 'hurt': tone(160, 50, 0.35, 0.6, 'sine'); noiseBurst(0.3, 300, 0.7, 0.5, 'lowpass'); break;
      case 'pickup': tone(660, 660, 0.08, 0.25, 'square'); tone(990, 990, 0.12, 0.25, 'square', S.ctx.currentTime + 0.08); break;
      case 'bad': tone(300, 120, 0.4, 0.35, 'sawtooth'); break;
      case 'alert': tone(1200, 1200, 0.06, 0.12, 'square'); break;
      case 'clear': [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.18, 0.18, 'triangle', S.ctx.currentTime + i * 0.1)); break;
      case 'ui': tone(880, 880, 0.05, 0.12, 'triangle'); break;
      case 'radio': noiseBurst(0.15, 2000, 1, 0.25, 'bandpass'); break;
    }
  };

  // ---------- מוזיקה ----------
  const SONGS = {
    six: { bpm: 104, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], wave: 'triangle', snare: true, march: true },
    black: { bpm: 118, root: 40, scale: [0, 1, 3, 5, 7, 8, 10], wave: 'sawtooth', snare: true },
    future: { bpm: 126, root: 38, scale: [0, 3, 5, 7, 10], wave: 'sawtooth', arp: true },
    rescue: { bpm: 112, root: 42, scale: [0, 2, 3, 7, 8], wave: 'square', snare: true },
    menu: { bpm: 90, root: 45, scale: [0, 3, 5, 7, 10], wave: 'triangle', soft: true },
  };
  S.startMusic = function (id) {
    S.stopMusic();
    if (!S.ctx || !S.musicOn) return;
    const song = SONGS[id] || SONGS.menu, c = S.ctx;
    const step = 60 / song.bpm / 4; let n = 0, next = c.currentTime + 0.1;
    const prog = [0, 0, 5, 3];
    const note = (midi, t, dur, vol, type) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = song.soft ? 900 : 1600;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(f); f.connect(g); g.connect(S.mus); o.start(t); o.stop(t + dur + 0.05);
    };
    const drum = (t, kind) => {
      if (kind === 'k') { const o = c.createOscillator(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); const g = c.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(S.mus); o.start(t); o.stop(t + 0.25); }
      else { const s = c.createBufferSource(); s.buffer = S.noise; const f = c.createBiquadFilter(); f.type = kind === 's' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 's' ? 1800 : 7000; const g = c.createGain(); const v = kind === 's' ? 0.45 : 0.12; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 's' ? 0.18 : 0.05)); s.connect(f); f.connect(g); g.connect(S.mus); s.start(t, Math.random()); s.stop(t + 0.2); }
    };
    const tick = () => {
      while (next < c.currentTime + 0.25) {
        const bar = Math.floor(n / 16) % 4, i = n % 16, root = song.root + song.scale[prog[bar] % song.scale.length];
        if (!song.soft) {
          if (i % 4 === 0) drum(next, 'k');
          if (song.snare && (i === 4 || i === 12 || (song.march && (i === 14 || i === 15)))) drum(next, 's');
          if (i % 2 === 0) drum(next, 'h');
        } else if (i === 0) drum(next, 'k');
        if (i % 4 === 0 || (i % 4 === 3 && !song.soft)) note(root, next, step * 3, 0.32, song.wave);
        if (song.arp) note(root + 12 + song.scale[(i * 2) % song.scale.length], next, step * 0.9, 0.1, 'square');
        else if (i % 8 === 6) note(root + 12 + song.scale[(bar + 2) % song.scale.length], next, step * 6, 0.08, 'triangle');
        n++; next += step;
      }
    };
    tick(); S.musicTimer = setInterval(tick, 60);
  };
  S.stopMusic = function () { if (S.musicTimer) clearInterval(S.musicTimer); S.musicTimer = null; };

  // ---------- קול בעברית ----------
  let lastSay = 0;
  S.say = function (text, opts) {
    if (!S.voiceOn) return;
    const now = performance.now(); if (now - lastSay < 900) return; lastSay = now;
    try {
      if (!window.speechSynthesis || !S.voices.length) return;
      const u = new SpeechSynthesisUtterance(text);
      u.voice = S.voices[0]; u.lang = S.voices[0].lang;
      u.rate = (opts && opts.rate) || 1.25; u.pitch = (opts && opts.pitch) || 1.2; u.volume = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { }
  };

  window.SFX = S;
})();
