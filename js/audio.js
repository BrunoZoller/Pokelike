// audio.js - Background music manager with per-track file loading

const TRACKS = [
  'audio/01-littleroot-town.mp3',
  'audio/02-route-101.mp3',
  'audio/03-oldale-town.mp3',
  'audio/04-rustboro-city.mp3',
  'audio/05-dewford-town.mp3',
  'audio/06-oceanic-museum.mp3',
  'audio/07-verdanturf-town.mp3',
  'audio/08-fallabor-town.mp3',
  'audio/09-surf-rse.mp3',
  'audio/10-lilycove-city.mp3',
  'audio/11-dive.mp3',
  'audio/12-ending-rse.mp3',
  'audio/13-new-bark-town.mp3',
  'audio/14-azalea-town.mp3',
  'audio/15-goldenrod-city.mp3',
  'audio/16-nature-park.mp3',
  'audio/17-surfing-hgss.mp3',
  'audio/18-cianwood-city.mp3',
  'audio/19-vermilion-hgss.mp3',
  'audio/20-pewter-city.mp3',
  'audio/21-route-47.mp3',
  'audio/22-route-201.mp3',
  'audio/23-floaroma-town.mp3',
  'audio/24-route-209.mp3',
  'audio/25-canalave-city.mp3',
  'audio/26-ending-dppt.mp3',
  'audio/27-pallet-town.mp3',
  'audio/28-cerulean-city.mp3',
  'audio/29-vermilion-frlg.mp3',
  'audio/30-cycling.mp3',
  'audio/31-celadon-city.mp3',
  'audio/32-ending-frlg.mp3',
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

  function playTrack(idx) {
    if (!audio) return;
    currentIdx = idx;
    audio.src = shuffled[idx];
    audio.play().catch(() => {});
  }

  function onEnded() {
    const next = currentIdx + 1;
    if (next >= shuffled.length) {
      shuffled = fisherYates(TRACKS);
      playTrack(0);
    } else {
      playTrack(next);
    }
  }

  function syncMuteBtn() {
    const src = (audio && audio.muted) ? 'ui/soundOff.png' : 'ui/soundOn.png';
    ['mute-btn', 'mute-btn-desktop'].forEach(id => {
      const img = document.querySelector(`#${id} img`);
      if (img) img.src = src;
    });
  }

  function applySettings() {
    if (!audio) return;
    const s = typeof getSettings === 'function' ? getSettings() : {};
    audio.volume = s.musicVolume ?? 0.5;
    audio.muted = !(s.musicEnabled ?? true);
    syncMuteBtn();
  }

  function onFirstInteraction() {
    if (audio && audio.paused) audio.play().catch(() => {});
    document.removeEventListener('click', onFirstInteraction);
    document.removeEventListener('keydown', onFirstInteraction);
    document.removeEventListener('touchstart', onFirstInteraction);
  }

  function init() {
    if (ready) return;
    ready = true;
    audio = document.getElementById('bg-music');
    if (!audio) return;
    shuffled = fisherYates(TRACKS);
    audio.addEventListener('ended', onEnded);
    applySettings();
    playTrack(0);
    document.addEventListener('click', onFirstInteraction);
    document.addEventListener('keydown', onFirstInteraction);
    document.addEventListener('touchstart', onFirstInteraction);
  }

  return { init, applySettings };
})();

function toggleMusicMute() {
  const s = typeof getSettings === 'function' ? getSettings() : {};
  s.musicEnabled = !(s.musicEnabled ?? true);
  if (typeof saveSettings === 'function') saveSettings(s);
  AudioManager.applySettings();
}
