// ─────────────────────────────────────────────
// audio.js  —  Zentrales Sound-Management
// ─────────────────────────────────────────────

const audioCache = new Map();
let ambientTrack   = null;
let audioUnlocked  = false;

// AudioContext zum Entsperren des Browsers
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function getAudio(src, loop = false, volume = 1.0) {
  if (!audioCache.has(src)) {
    const a = new Audio(src);
    a.loop   = loop;
    a.volume = volume;
    audioCache.set(src, a);
  }
  return audioCache.get(src);
}

export const audio = {

  /**
   * Muss direkt im Click-Handler aufgerufen werden (kein await davor).
   * Entsperrt den Browser-Audio-Kontext einmalig.
   */
  unlock() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    // AudioContext kurz starten und sofort pausieren — reicht zum Entsperren
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Stille 0.001s abspielen damit auch <audio>-Elemente entsperrt sind
    const silent = new Audio();
    silent.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAA'
               + 'EAAQAAgD4AAACAPAABACAAZGF0YQAAAAA=';
    silent.play().catch(() => {});
  },

  /**
   * Startet einen Loop-Ambient-Track.
   * Stoppt vorherigen Ambient automatisch.
   */
  playAmbient(src, volume = 0.3) {
    if (ambientTrack) {
      ambientTrack.pause();
      ambientTrack.currentTime = 0;
    }
    const track = getAudio(src, true, volume);
    track.currentTime = 0;
    track.play().catch(() => {});
    ambientTrack = track;
  },

  stopAmbient() {
    if (ambientTrack) {
      ambientTrack.pause();
      ambientTrack.currentTime = 0;
      ambientTrack = null;
    }
  },

  /**
   * Spielt einen einmaligen Sound-Effekt.
   */
  play(src, volume = 1.0) {
    if (!src) return;
    const track = getAudio(src, false, volume);
    track.currentTime = 0;
    track.volume = volume;
    track.play().catch(() => {});
  },

  restartAmbient() {
    if (ambientTrack) {
      ambientTrack.currentTime = 0;
      ambientTrack.play().catch(() => {});
    }
  }
};
