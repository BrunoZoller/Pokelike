// audio.js — Lo-fi Web Audio music & SFX engine

const GameAudio = (() => {
  let AC = null, mGain, mBus, sBus;
  let _handle = null;
  let _currentTheme = null; // prevent re-starting the same theme

  // ── init ──────────────────────────────────────────────────────────────────
  function init() {
    if (AC) return;
    AC = new (window.AudioContext || window.webkitAudioContext)();

    mGain = AC.createGain();
    mGain.gain.value = parseFloat(localStorage.getItem('poke_vol') ?? '0.5');
    mGain.connect(AC.destination);

    // Music bus → gentle lowpass filter for warmth
    const lpf = AC.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 1800;
    lpf.Q.value = 0.5;
    lpf.connect(mGain);

    mBus = AC.createGain(); mBus.gain.value = 0.18; mBus.connect(lpf);
    sBus = AC.createGain(); sBus.gain.value = 0.32; sBus.connect(mGain);
  }

  function resume() { if (AC?.state === 'suspended') AC.resume(); }

  function getVolume() { return parseFloat(localStorage.getItem('poke_vol') ?? '0.5'); }

  function setVolume(v) {
    v = Math.max(0, Math.min(1, v));
    localStorage.setItem('poke_vol', String(v));
    if (mGain) mGain.gain.value = v;
  }

  // ── note frequency table ───────────────────────────────────────────────────
  const hz = { _: 0 };
  ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].forEach((n, i) => {
    for (let o = 1; o <= 8; o++)
      hz[n + o] = 440 * 2 ** ((12 * (o + 1) + i - 69) / 12);
  });

  // ── single note ───────────────────────────────────────────────────────────
  function schedNote(bus, freq, t, dur, wave = 'triangle', vol = 0.4) {
    if (!AC || !(freq > 0)) return;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = wave;
    o.frequency.value = freq;
    // soft attack, slow release — lo-fi feel
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.04, dur * 0.1));
    g.gain.setValueAtTime(vol * 0.75, t + dur * 0.55);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 0.98);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.015);
  }

  function schedVoice(bus, voice, t0, wave, vol) {
    let t = t0;
    for (const [n, d] of voice) { schedNote(bus, hz[n] || 0, t, d, wave, vol); t += d; }
    return t - t0;
  }

  // ── looping music engine ───────────────────────────────────────────────────
  function startMusic(id, voices) {
    if (_currentTheme === id) return; // already playing — don't layer
    stopMusic();
    _currentTheme = id;
    init();
    if (!AC) return;
    const loopDur = voices[0].seq.reduce((s, [, d]) => s + d, 0);
    let nxt = AC.currentTime + 0.06, stopped = false;
    function pump() {
      if (stopped) return;
      while (nxt < AC.currentTime + 3.5) {
        for (const v of voices) schedVoice(mBus, v.seq, nxt, v.wave, v.vol);
        nxt += loopDur;
      }
      setTimeout(pump, 400);
    }
    pump();
    _handle = { stop() { stopped = true; } };
  }

  function stopMusic() {
    _handle?.stop(); _handle = null; _currentTheme = null;
  }

  // ── tempo helpers ──────────────────────────────────────────────────────────
  function pad(seq, target) {
    const got = seq.reduce((s, [, d]) => s + d, 0);
    if (target - got > 0.0005) seq.push(['_', target - got]);
    return seq;
  }

  // ── LO-FI MAP THEME ───────────────────────────────────────────────────────
  // C major, 82 BPM, gentle and warm. 8-bar loop.
  const mq = 60 / 82, me = mq / 2, mh = mq * 2;
  const MAP_LEN = mq * 32;

  const MAP = [
    // Soft melody — sine wave, slow and airy
    { wave: 'sine', vol: 0.55, seq: pad([
      ['G4', mh],  ['E4', mh],
      ['F4', mq],  ['E4', mq],  ['D4', mh],
      ['E4', mh],  ['C4', mh],
      ['D4', mq],  ['C4', mq],  ['B3', mh],
      ['C4', mh],  ['E4', mh],
      ['G4', mq],  ['F4', mq],  ['E4', mh],
      ['D4', mh],  ['G4', mh],
      ['C4', mq * 3], ['_', mq],
    ], MAP_LEN) },

    // Chord arpeggios — triangle, quiet
    { wave: 'triangle', vol: 0.38, seq: pad([
      ...['C4','E4','G4','E4', 'C4','E4','G4','E4',
          'F3','A3','C4','A3', 'F3','A3','C4','A3',
          'G3','B3','D4','B3', 'G3','B3','D4','B3',
          'A3','C4','E4','C4', 'A3','C4','E4','C4',
          'C4','E4','G4','E4', 'C4','E4','G4','E4',
          'F3','A3','C4','A3', 'G3','B3','D4','B3',
          'F3','A3','C4','A3', 'E3','G3','C4','G3',
          'G3','D4','G4','D4', 'C3','G3','C4','G3'].map(n => [n, me]),
    ], MAP_LEN) },

    // Walking bass — triangle, low
    { wave: 'triangle', vol: 0.50, seq: pad([
      ['C3', mh],  ['C3', mh],
      ['F2', mh],  ['F2', mh],
      ['G2', mh],  ['G2', mh],
      ['A2', mh],  ['A2', mh],
      ['C3', mh],  ['E3', mh],
      ['F2', mq],  ['G2', mq],  ['A2', mh],
      ['F2', mh],  ['G2', mh],
      ['C3', mq * 3], ['_', mq],
    ], MAP_LEN) },
  ];

  // ── LO-FI BATTLE THEME ───────────────────────────────────────────────────
  // A minor, 95 BPM, tense but restrained.
  const bq = 60 / 95, be = bq / 2, bh = bq * 2;
  const BAT_LEN = bq * 32;

  const BATTLE = [
    { wave: 'triangle', vol: 0.55, seq: pad([
      ['A4', be], ['_', be], ['C5', be], ['B4', be], ['A4', bh],
      ['G4', be], ['_', be], ['A4', be], ['G4', be], ['E4', bh],
      ['F4', be], ['_', be], ['G4', be], ['F4', be], ['D4', bh],
      ['E4', bq], ['A3', bq], ['E4', bh],
      ['A4', be], ['C5', be], ['E5', be], ['_', be], ['D5', bh],
      ['C5', be], ['B4', be], ['A4', be], ['_', be], ['E4', bh],
      ['F4', be], ['A4', be], ['C5', be], ['_', be], ['B4', bh],
      ['A4', bq * 3], ['_', bq],
    ], BAT_LEN) },

    { wave: 'triangle', vol: 0.45, seq: pad([
      ...['A3','E3','A3','E3', 'A3','E3','A3','E3',
          'G3','D3','G3','D3', 'G3','D3','G3','D3',
          'F3','C3','F3','C3', 'F3','C3','F3','C3',
          'E3','B2','E3','B2', 'A3','E3','A3','E3',
          'A3','E3','A3','E3', 'D3','A2','D3','A2',
          'C3','G2','C3','G2', 'E3','B2','E3','B2',
          'F3','C3','F3','C3', 'E3','B2','E3','B2',
          'A3','E3','A3','E3', 'A3','_','A3','_'].map(n => [n, be]),
    ], BAT_LEN) },

    { wave: 'sine', vol: 0.40, seq: pad([
      ['A2', bh], ['A2', bh],
      ['G2', bh], ['G2', bh],
      ['F2', bh], ['F2', bh],
      ['E2', bq], ['A2', bq], ['E2', bh],
      ['A2', bh], ['G2', bh],
      ['C3', bh], ['E2', bh],
      ['F2', bh], ['E2', bh],
      ['A2', bq * 3], ['_', bq],
    ], BAT_LEN) },
  ];

  // ── BOSS / GYM THEME ─────────────────────────────────────────────────────
  // D minor, 100 BPM, more urgent than battle but still lo-fi.
  const gq = 60 / 100, ge = gq / 2, gh = gq * 2;
  const GYM_LEN = gq * 32;

  const GYM = [
    { wave: 'triangle', vol: 0.55, seq: pad([
      ['D5', ge], ['_', ge], ['F5', ge], ['E5', ge], ['D5', gh],
      ['C5', ge], ['_', ge], ['D5', ge], ['C5', ge], ['A4', gh],
      ['A#4',ge], ['_', ge], ['C5', ge], ['A#4',ge], ['G4', gh],
      ['A4', gq], ['D4', gq], ['A4', gh],
      ['D5', ge], ['F5', ge], ['A5', ge], ['_', ge], ['G5', gh],
      ['F5', ge], ['E5', ge], ['D5', ge], ['_', ge], ['A4', gh],
      ['A#4',ge], ['D5', ge], ['F5', ge], ['_', ge], ['E5', gh],
      ['D5', gq * 3], ['_', gq],
    ], GYM_LEN) },

    { wave: 'triangle', vol: 0.45, seq: pad([
      ...['D3','A2','D3','A2', 'D3','A2','D3','A2',
          'C3','G2','C3','G2', 'C3','G2','C3','G2',
          'A#2','F2','A#2','F2','A#2','F2','A#2','F2',
          'A2','E2','A2','E2', 'D3','A2','D3','A2',
          'D3','A2','D3','A2', 'G2','D2','G2','D2',
          'F3','C3','F3','C3', 'A2','E2','A2','E2',
          'A#2','F2','A#2','F2','A2','E2','A2','E2',
          'D3','A2','D3','A2', 'D3','_','D3','_'].map(n => [n, ge]),
    ], GYM_LEN) },

    { wave: 'sine', vol: 0.40, seq: pad([
      ['D2', gh], ['D2', gh],
      ['C2', gh], ['C2', gh],
      ['A#1',gh], ['A#1',gh],
      ['A1', gq], ['D2', gq], ['A1', gh],
      ['D2', gh], ['C2', gh],
      ['F2', gh], ['A1', gh],
      ['A#1',gh], ['A1', gh],
      ['D2', gq * 3], ['_', gq],
    ], GYM_LEN) },
  ];

  // ── VICTORY / DEFEAT ─────────────────────────────────────────────────────
  function playVictory() {
    init();
    const q = 60 / 140, e = q / 2;
    const t = AC.currentTime + 0.05;
    schedVoice(sBus, [
      ['C5',e],['_',e],['C5',e],['_',e],['C5',e],['_',e],
      ['C5',e],['E5',e],['G5',e],['_',e],
      ['A5',q],['G5',e],['_',e],['E5',q],
      ['C6',q * 2],
    ], t, 'triangle', 0.45);
  }

  function playDefeat() {
    init();
    const q = 60 / 72;
    const t = AC.currentTime + 0.05;
    schedVoice(sBus, [
      ['G4',q],['F4',q],['E4',q],['D4',q],
      ['C4',q * 2.5],
    ], t, 'triangle', 0.4);
  }

  // ── SFX ───────────────────────────────────────────────────────────────────
  function sfxClick() {
    init();
    schedNote(sBus, hz.C5, AC.currentTime, 0.05, 'triangle', 0.2);
  }

  function sfxHit(moveType) {
    init();
    const t = AC.currentTime + 0.01;
    const S = {
      fire:     () => { schedNote(sBus, 160, t, 0.09, 'sawtooth', 0.35); schedNote(sBus, 220, t+0.04, 0.07, 'sawtooth', 0.22); },
      water:    () => { schedNote(sBus, hz.A4, t, 0.06, 'sine', 0.28); schedNote(sBus, hz.D5, t+0.03, 0.06, 'sine', 0.22); },
      electric: () => { schedNote(sBus, hz.A5, t, 0.03, 'square', 0.38); schedNote(sBus, hz.A4, t+0.025, 0.03, 'square', 0.3); schedNote(sBus, hz.A5, t+0.055, 0.03, 'square', 0.28); },
      grass:    () => { schedNote(sBus, hz.E5, t, 0.08, 'triangle', 0.32); schedNote(sBus, hz.G5, t+0.04, 0.07, 'triangle', 0.24); },
      ice:      () => { schedNote(sBus, hz.C6, t, 0.07, 'sine', 0.28); schedNote(sBus, hz.E6, t+0.03, 0.07, 'sine', 0.22); },
      fighting: () => { schedNote(sBus, 75, t, 0.08, 'sawtooth', 0.42); schedNote(sBus, 100, t+0.03, 0.07, 'sawtooth', 0.3); },
      poison:   () => { schedNote(sBus, hz['G#4'], t, 0.09, 'triangle', 0.28); },
      ground:   () => { schedNote(sBus, 55, t, 0.12, 'sawtooth', 0.42); schedNote(sBus, 75, t+0.05, 0.09, 'sawtooth', 0.3); },
      psychic:  () => { schedNote(sBus, hz.B5, t, 0.11, 'sine', 0.3); schedNote(sBus, hz['G#5'], t+0.05, 0.09, 'sine', 0.24); },
      ghost:    () => { schedNote(sBus, hz.A3, t, 0.14, 'sine', 0.24); schedNote(sBus, hz['D#4'], t+0.06, 0.12, 'sine', 0.18); },
      dragon:   () => { [0,0.04,0.08].forEach((dt,i) => schedNote(sBus, [hz.A4,hz['C#5'],hz.E5][i], t+dt, 0.08, 'sawtooth', 0.3)); },
      dark:     () => { schedNote(sBus, hz.B3, t, 0.09, 'sawtooth', 0.3); schedNote(sBus, hz.E3, t+0.04, 0.09, 'sawtooth', 0.22); },
      fairy:    () => { [0,0.04,0.08,0.12].forEach((dt,i) => schedNote(sBus, [hz.E6,hz['G#6'],hz.B5,hz.E6][i], t+dt, 0.06, 'triangle', 0.22)); },
      normal:   () => { schedNote(sBus, hz.C5, t, 0.07, 'triangle', 0.26); },
    };
    (S[(moveType || 'normal').toLowerCase()] || S.normal)();
  }

  function sfxLevelUp() {
    init();
    const e = 60 / 180 / 2, t = AC.currentTime + 0.02;
    schedVoice(sBus, [['C5',e],['E5',e],['G5',e],['C6',e*1.5]], t, 'triangle', 0.38);
    schedVoice(sBus, [['E4',e],['G4',e],['C5',e],['E5',e*1.5]], t, 'sine', 0.22);
  }

  function sfxCatch() {
    init();
    const e = 60 / 160 / 2, t = AC.currentTime + 0.02;
    schedVoice(sBus, [['G5',e],['_',e],['G5',e],['_',e],['C6',e*2]], t, 'triangle', 0.35);
  }

  function sfxItem() {
    init();
    const s = 60 / 200 / 4, t = AC.currentTime + 0.02;
    schedVoice(sBus, [['E5',s],['G5',s],['B5',s],['E6',s*2]], t, 'triangle', 0.35);
  }

  function sfxHeal() {
    init();
    const e = 60 / 160 / 2, t = AC.currentTime + 0.02;
    schedVoice(sBus, [['C5',e],['E5',e],['G5',e],['E5',e],['C6',e*2]], t, 'sine', 0.32);
  }

  function sfxEvolution() {
    init();
    const s = 60 / 240 / 4, t = AC.currentTime + 0.02;
    ['C5','D5','E5','F#5','G#5','A#5','C6'].forEach((n, i) =>
      schedNote(sBus, hz[n], t + i * s, s * 3, 'sine', 0.28));
  }

  function sfxBattleStart() {
    init();
    const e = 60 / 150 / 2, t = AC.currentTime + 0.02;
    schedVoice(sBus, [['A4',e],['_',e],['A4',e],['_',e],['A5',e*3]], t, 'triangle', 0.38);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init, resume, getVolume, setVolume,
    playMap()    { startMusic('map',    MAP);    },
    playBattle() { startMusic('battle', BATTLE); },
    playGym()    { startMusic('gym',    GYM);    },
    stopMusic,
    playVictory, playDefeat,
    sfxClick, sfxHit, sfxLevelUp, sfxCatch, sfxItem, sfxHeal, sfxEvolution, sfxBattleStart,
  };
})();
