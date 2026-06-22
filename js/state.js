// ─────────────────────────────────────────────
// state.js  —  Globaler Spielzustand
// ─────────────────────────────────────────────

export const state = {
  // Numerische State-Werte (0–100)
  values: {},

  // Boolean Flags
  flags: {},

  // Interne Meta-Daten
  currentEpisodeIndex: 0,
  currentSceneId: null,
  choicesMade: [],
  timeouts: 0,
  currentEnding: null,

  // Initialisiert den State (nur beim allerersten Start)
  init(startState, startFlags = {}) {
    this.values = { ...startState };
    this.flags  = { ...startFlags };
    this.currentEpisodeIndex = 0;
    this.currentSceneId = null;
    this.choicesMade = [];
    this.timeouts = 0;
    this.currentEnding = null;
  },

  // Merget episoden-spezifische Startwerte (nur fehlende Felder)
  mergeEpisodeState(episodeState = {}) {
    for (const [key, startValue] of Object.entries(episodeState)) {
      if (!(key in this.values)) {
        this.values[key] = startValue;
      }
    }
  },

  // Merget episoden-spezifische Flags (nur fehlende)
  mergeFlags(episodeFlags = {}) {
    for (const [key, defaultValue] of Object.entries(episodeFlags)) {
      if (!(key in this.flags)) {
        this.flags[key] = defaultValue;
      }
    }
  },

  // Wendet einen stateEffect an
  applyEffect(effect) {
    for (const [key, delta] of Object.entries(effect)) {
      if (key in this.values) {
        this.values[key] = Math.max(0, Math.min(100, this.values[key] + delta));
      } else {
        this.values[key] = Math.max(0, Math.min(100, delta));
      }
    }
  },

  // Setzt Flags (aus setFlags in einer Choice)
  applyFlags(setFlags = {}) {
    for (const [key, value] of Object.entries(setFlags)) {
      this.flags[key] = value;
    }
  },

  // Gibt einen Flag-Wert zurück — nicht deklarierte Flags sind immer false
  getFlag(name) {
    return this.flags[name] ?? false;
  },

  // Tracking für Secret Ending
  trackEnding(key) {
    const seen = JSON.parse(localStorage.getItem('endings_seen') || '[]');
    if (!seen.includes(key)) {
      seen.push(key);
      localStorage.setItem('endings_seen', JSON.stringify(seen));
    }
  },

  getSeenEndings() {
    return JSON.parse(localStorage.getItem('endings_seen') || '[]');
  },

  clearSeenEndings() {
    localStorage.removeItem('endings_seen');
  }
};
