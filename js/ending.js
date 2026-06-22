// ─────────────────────────────────────────────
// ending.js  —  Ending-Auswertungslogik
// ─────────────────────────────────────────────

import { state } from './state.js';

/**
 * Wertet eine einzelne Bedingung aus.
 * Unterstützt:
 *   { field, op, value }       — numerischer State-Wert
 *   { flag, is }               — Boolean Flag
 *   { allOf: [...] }           — alle müssen zutreffen
 *   { any: [...] }             — mindestens eine muss zutreffen
 *   { always: true }           — immer wahr (Fallback)
 */
export function evalCondition(cond) {
  if (!cond) return false;
  if (cond.always) return true;

  if (cond.allOf) return cond.allOf.every(c => evalCondition(c));
  if (cond.any)   return cond.any.some(c  => evalCondition(c));

  // Flag-Prüfung
  if ('flag' in cond) {
    return state.getFlag(cond.flag) === cond.is;
  }

  // Numerische State-Prüfung
  const fieldValue = cond.field === 'timeouts'
    ? state.timeouts
    : state.values[cond.field] ?? 0;

  switch (cond.op) {
    case '>=': return fieldValue >= cond.value;
    case '<=': return fieldValue <= cond.value;
    case '>':  return fieldValue >  cond.value;
    case '<':  return fieldValue <  cond.value;
    case '==': return fieldValue === cond.value;
    default:   return false;
  }
}

/**
 * Gibt das passende Ending zurück.
 * Prüft zuerst Secret Ending, dann nach Priorität.
 */
export function resolveEnding(episodeData) {
  const { endings, secretEnding } = episodeData;

  // Secret Ending
  if (secretEnding) {
    const seen     = state.getSeenEndings();
    const required = secretEnding.requiredTrackingKeys;
    const allSeen  = required.every(k => seen.includes(k));
    if (allSeen) {
      if (secretEnding.resetTracking) state.clearSeenEndings();
      return secretEnding;
    }
  }

  // Endings nach Priorität
  const sorted = [...endings].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  for (const ending of sorted) {
    if (evalCondition(ending.condition)) return ending;
  }

  return endings[endings.length - 1];
}
