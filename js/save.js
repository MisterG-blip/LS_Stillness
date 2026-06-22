// ─────────────────────────────────────────────
// save.js  —  Speichersystem
// ─────────────────────────────────────────────

const SAVE_KEY    = 'lss_save';
const ENDINGS_KEY = 'lss_endings';

// ─── Speichern ─────────────────────────────────────

/**
 * Speichert den aktuellen State nach Abschluss einer Episode.
 * completedIndex = Index der gerade abgeschlossenen Episode (0-basiert)
 */
export function saveProgress(state, completedIndex) {
  const save = {
    completedEpisodes: completedIndex + 1,  // wie viele abgeschlossen
    nextEpisode: completedIndex + 1,         // wo weitermachen (0-basiert)
    stateValues: { ...state.values },
    flagValues:  { ...state.flags },
    timeouts: state.timeouts,
    savedAt: Date.now()
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

/**
 * Löscht den Spielfortschritt (nach letzter Episode).
 */
export function clearProgress() {
  localStorage.removeItem(SAVE_KEY);
}

/**
 * Gibt den gespeicherten Fortschritt zurück oder null.
 */
export function loadProgress() {
  const raw = localStorage.getItem(SAVE_KEY);
  return raw ? JSON.parse(raw) : null;
}

// ─── Ending Tracking ───────────────────────────────

/**
 * Zählt ein erreichtes Ending hoch.
 * endings_seen: { endingId: count, ... }
 */
export function trackEnding(endingId) {
  const raw     = localStorage.getItem(ENDINGS_KEY);
  const endings = raw ? JSON.parse(raw) : {};
  endings[endingId] = (endings[endingId] ?? 0) + 1;
  localStorage.setItem(ENDINGS_KEY, JSON.stringify(endings));
}

/**
 * Gibt alle gesehenen Endings zurück: { endingId: count }
 */
export function getSeenEndings() {
  const raw = localStorage.getItem(ENDINGS_KEY);
  return raw ? JSON.parse(raw) : {};
}

/**
 * Gibt zurück ob ein bestimmtes Ending schon gesehen wurde.
 */
export function hasSeenEnding(endingId) {
  return (getSeenEndings()[endingId] ?? 0) > 0;
}

/**
 * Gibt die Liste aller Ending-Keys zurück (für Secret Ending Check).
 */
export function getSeenEndingKeys() {
  return Object.keys(getSeenEndings());
}

export function clearSeenEndings() {
  localStorage.removeItem(ENDINGS_KEY);
}
