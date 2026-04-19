// audio.js - Background music manager using timestamp-based track seeking

const TRACKS = [
  { start:    0, name: 'Littleroot Town' },
  { start:  117, name: 'Route 101' },
  { start:  194, name: 'Oldale Town' },
  { start:  282, name: 'Rustboro City' },
  { start:  414, name: 'Dewford Town' },
  { start:  558, name: 'Oceanic Museum' },
  { start:  713, name: 'Verdanturf Town' },
  { start:  815, name: 'Fallabor Town' },
  { start:  932, name: 'Surf (RSE)' },
  { start: 1084, name: 'Lilycove City' },
  { start: 1207, name: 'Dive' },
  { start: 1366, name: 'Ending Theme (RSE)' },
  { start: 1540, name: 'New Bark Town' },
  { start: 1611, name: 'Azalea Town' },
  { start: 1674, name: 'Goldenrod City' },
  { start: 1720, name: 'Nature Park' },
  { start: 1842, name: 'Surfing (HGSS)' },
  { start: 1924, name: 'Cianwood City' },
  { start: 2008, name: 'Vermilion City (HGSS)' },
  { start: 2069, name: 'Pewter City' },
  { start: 2150, name: 'Route 47' },
  { start: 2229, name: 'Route 201' },
  { start: 2297, name: 'Floaroma Town' },
  { start: 2446, name: 'Route 209' },
  { start: 2603, name: 'Canalave City' },
  { start: 2771, name: 'Ending (DPPt)' },
  { start: 3046, name: 'Pallet Town' },
  { start: 3143, name: 'Cerulean City' },
  { start: 3219, name: 'Vermilion City (FRLG)' },
  { start: 3304, name: 'Cycling' },
  { start: 3382, name: 'Celadon City' },
  { start: 3468, name: 'Ending Theme (FRLG)' },
];

const AudioManager = (() => {
  let audio = null;
  let shuffled = [];
  let currentIdx = 0;
  let ready = false;

  function fisherYates(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function trackEndTime(idx) {
    if (idx + 1 < shuffled.length) return TRACKS[shuffled[idx + 1]].start;
    return audio ? audio.duration : Infinity;
  }

  function playTrack(idx) {
    if (!audio) return;
    currentIdx = idx;
    audio.currentTime = TRACKS[shuffled[idx]].start;
    audio.play().catch(() => {});
  }

  function onTimeUpdate() {
    if (!audio || isNaN(audio.duration)) return;
    const end = trackEndTime(currentIdx);
    if (audio.currentTime >= end - 0.3) {
      const next = currentIdx + 1;
      if (next >= shuffled.length) {
        shuffled = fisherYates(TRACKS.map((_, i) => i));
        playTrack(0);
      } else {
        playTrack(next);
      }
    }
  }

  function syncMuteBtn() {
    const icon = (audio && audio.muted) ? '🔇' : '🔊';
    ['mute-btn', 'mute-btn-desktop'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.textContent = icon;
    });
  }

  function applySettings() {
    if (!audio) return;
    const s = typeof getSettings === 'function' ? getSettings() : {};
    audio.volume = s.musicVolume ?? 0.5;
    audio.muted = !(s.musicEnabled ?? true);
    syncMuteBtn();
  }

  function init() {
    if (ready) return;
    ready = true;
    audio = document.getElementById('bg-music');
    if (!audio) return;
    shuffled = fisherYates(TRACKS.map((_, i) => i));
    audio.addEventListener('timeupdate', onTimeUpdate);
    applySettings();
    playTrack(0);
  }

  return { init, applySettings };
})();

function toggleMusicMute() {
  const s = typeof getSettings === 'function' ? getSettings() : {};
  s.musicEnabled = !(s.musicEnabled ?? true);
  if (typeof saveSettings === 'function') saveSettings(s);
  AudioManager.applySettings();
}
