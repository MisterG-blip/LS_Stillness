// ─────────────────────────────────────────────
// engine.js  —  Haupt-Spielschleife
// ─────────────────────────────────────────────

import { state }         from './state.js';
import { audio }         from './audio.js';
import { resolveEnding } from './ending.js';
import { saveProgress, clearProgress, trackEnding } from './save.js';
import {
  transitionToScene,
  showEpisodeTitle,
  fadeToBlack,
  addOverlay,
  clearOverlays,
  fadeOutOverlays,
  disableAllOverlayClicks,
  updateVignette,
  hideEndScreen
} from './renderer.js';

let storyData    = null;
let timeoutTimer = null;

// ─── Laden ─────────────────────────────────────────

export async function loadStory(jsonPath) {
  const res  = await fetch(jsonPath);
  const meta = await res.json();

  const episodes = await Promise.all(
    meta.episodes.map(entry => {
      if (typeof entry === 'string') {
        return fetch(entry).then(r => {
          if (!r.ok) throw new Error(`Episode nicht gefunden: ${entry}`);
          return r.json();
        });
      }
      return Promise.resolve(entry);
    })
  );

  storyData = { ...meta, episodes };
}

export function getStoryData() {
  return storyData;
}

// ─── Start ─────────────────────────────────────────

/**
 * Startet das Spiel ab einer bestimmten Episode.
 * Wenn savedState übergeben wird, wird der State damit befüllt
 * statt neu initialisiert.
 */
export async function startGame(startEpisodeIndex = 0, savedState = null) {
  if (!storyData) throw new Error('Story nicht geladen.');

  if (savedState) {
    // Gespeicherten State wiederherstellen
    state.init(storyData.startState, storyData.startFlags);
    Object.assign(state.values, savedState.stateValues);
    Object.assign(state.flags,  savedState.flagValues ?? {});
    state.timeouts = savedState.timeouts ?? 0;
  } else {
    // Frischer Start
    state.init(storyData.startState, storyData.startFlags);
    // State + Flags aller übersprungenen Episoden vormergen
    for (let i = 0; i < startEpisodeIndex; i++) {
      const ep = storyData.episodes[i];
      if (ep) {
        state.mergeEpisodeState(ep.episodeState);
        state.mergeFlags(ep.flags);
      }
    }
  }

  await new Promise(resolve => hideEndScreen(resolve));
  await runEpisode(startEpisodeIndex);
}

// ─── Episode Runner ────────────────────────────────

async function runEpisode(episodeIndex) {
  const episode = storyData.episodes[episodeIndex];
  if (!episode) return;

  // Episode überspringen wenn requireFlag nicht erfüllt
  if (episode.requireFlag !== undefined) {
    if (state.getFlag(episode.requireFlag) !== true) {
      // Zur nächsten Episode springen
      if (storyData.episodes[episodeIndex + 1]) {
        await runEpisode(episodeIndex + 1);
      }
      return;
    }
  }

  state.currentEpisodeIndex = episodeIndex;
  state.mergeEpisodeState(episode.episodeState);
  state.mergeFlags(episode.flags);

  await showEpisodeTitle(episode.label);

  const sceneList = episode.scenes;
  let sceneIndex = 0;

  while (sceneIndex < sceneList.length) {
    const scene = sceneList[sceneIndex];
    const nextSceneId = await runScene(scene);

    if (nextSceneId === '__ending__') {
      break;
    } else if (nextSceneId) {
      const targetIndex = sceneList.findIndex(s => s.id === nextSceneId);
      sceneIndex = targetIndex !== -1 ? targetIndex : sceneIndex + 1;
    } else {
      sceneIndex++;
    }
  }

  const action = await runEnding(episode, episodeIndex);

  if (action === 'restart') {
    // Zurück zur Übersicht
    showEpisodeMenu();
  } else if (action === 'next' && storyData.episodes[episodeIndex + 1]) {
    await runEpisode(episodeIndex + 1);
  }
}

// ─── Szenen Runner ─────────────────────────────────

async function runScene(scene) {
  state.currentSceneId = scene.id;

  // Szene überspringen wenn requireFlag nicht erfüllt
  if (scene.requireFlag !== undefined) {
    if (state.getFlag(scene.requireFlag) !== true) {
      return scene.skipTo ?? null;
    }
  }

  if (scene.ambientSound) {
    audio.playAmbient(scene.ambientSound, scene.ambientVolume ?? 0.3);
  }

  if (!scene.staticBackground) {
    await transitionToScene(scene.backgroundVideo ? scene : scene.background);
  }
  updateVignette(state.values.isolation ?? 50);

  if (scene.voiceover) {
    await delay(scene.voiceoverDelay ?? 0);
    audio.play(scene.voiceover);
    await delay(scene.autoAdvanceAfterVoiceover ?? 5000);
    return scene.nextScene ?? null;
  }

  if (!scene.choices || scene.choices.length === 0) {
    await delay(scene.displayDuration ?? 5000);
    return scene.nextScene ?? null;
  }

  if (scene.loop) {
    return await runLoopScene(scene);
  }

  await delay(scene.displayDuration ?? 5000);
  return await presentChoices(scene, scene.staticBackground);
}

// ─── Loop-Szene ────────────────────────────────────

async function runLoopScene(scene) {
  await delay(scene.displayDuration ?? 3000);

  return new Promise(resolve => {
    let resolved = false;
    const overlayElements = [];

    function finish(nextSceneId) {
      if (resolved) return;
      resolved = true;
      overlayElements.forEach(el => { el.onclick = null; el.style.pointerEvents = 'none'; });
      if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
      clearOverlays();
      resolve(nextSceneId);
    }

    function onSilence() {
      state.applyEffect(scene.loopTimeoutEffect || {});
      state.applyEffect(scene.loopExit?.stateEffect || {});
      updateVignette(state.values.isolation ?? 50);
      finish(scene.loopExit?.nextScene ?? '__ending__');
    }

    function onChoice(choice) {
      state.choicesMade.push(choice.id);
      state.applyEffect(choice.stateEffect || {});
      updateVignette(state.values.isolation ?? 50);
      if (choice.confirmSound) audio.play(choice.confirmSound);
      if (choice.sound) audio.play(choice.sound);
      if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
      timeoutTimer = setTimeout(onSilence, scene.loopTimeout ?? 12000);
    }

    choices(scene).forEach((choice, i) => {
      const after = i === 0 ? 0 : (choice.delayAfterFirst ?? 3000);
      setTimeout(() => {
        if (resolved) return;
        const el = addOverlay(choice);
        if (i === 0) audio.play(choice.sound);
        el.onclick = () => onChoice(choice);
        overlayElements.push(el);
      }, after);
    });

    const allVisible = (scene.choices[1]?.delayAfterFirst ?? 3000);
    timeoutTimer = setTimeout(onSilence, allVisible + (scene.loopTimeout ?? 12000));
  });
}

// ─── Normale Entscheidungen ────────────────────────

function presentChoices(scene, staticBackground = false) {
  return new Promise(resolve => {
    let resolved = false;
    const overlayElements = [];

    function finish(nextSceneId) {
      if (resolved) return;
      resolved = true;
      overlayElements.forEach(el => { el.onclick = null; el.style.pointerEvents = 'none'; });
      if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
      if (staticBackground) {
        fadeOutOverlays(overlayElements);
      } else {
        clearOverlays();
      }
      resolve(nextSceneId);
    }

    function onChoice(choice) {
      state.choicesMade.push(choice.id);
      state.applyEffect(choice.stateEffect || {});
      state.applyFlags(choice.setFlags || {});
      updateVignette(state.values.isolation ?? 50);
      if (choice.confirmSound) audio.play(choice.confirmSound);
      finish(choice.nextScene ?? null);
    }

    function onTimeout() {
      state.timeouts++;
      state.choicesMade.push('timeout');
      state.applyEffect(scene.timeout?.stateEffect || {});
      state.applyFlags(scene.timeout?.setFlags || {});
      updateVignette(state.values.isolation ?? 50);
      finish(scene.timeout?.nextScene ?? '__ending__');
    }

    // Choices filtern — requireFlag überspringt die Choice komplett
    const visibleChoices = choices(scene).filter(choice => {
      if (choice.requireFlag === undefined) return true;
      return state.getFlag(choice.requireFlag) === true;
    });

    // Sicherheit: wenn keine Choices übrig → Timeout-Logik greift
    if (visibleChoices.length === 0) {
      setTimeout(() => onTimeout(), 100);
      return;
    }

    visibleChoices.forEach((choice, i) => {
      const after = i === 0 ? 0 : (choice.delayAfterFirst ?? 3000);
      setTimeout(() => {
        if (resolved) return;
        const el = addOverlay(choice);
        audio.play(choice.sound);
        el.onclick = () => onChoice(choice);
        overlayElements.push(el);
      }, after);
    });

    const allVisible = (scene.choices[1]?.delayAfterFirst ?? 3000);
    const timeoutMs  = allVisible + (scene.timeout?.seconds ?? 10) * 1000;
    timeoutTimer = setTimeout(onTimeout, timeoutMs);
  });
}

// ─── Utility ───────────────────────────────────────

function choices(scene) {
  return scene.choices ?? [];
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Ending Runner ─────────────────────────────────

async function runEnding(episode, episodeIndex) {
  const ending = resolveEnding(episode);
  state.currentEnding = ending.id;

  // Ending tracken
  if (ending.trackingKey) {
    state.trackEnding(ending.trackingKey);
    trackEnding(ending.trackingKey);       // persistentes Tracking
  }

  if (ending.stopAmbient) audio.stopAmbient();
  if (ending.sound)       audio.play(ending.sound);

  await fadeToBlack(1500);
  await delay(500);

  await transitionToScene(ending.background, ending.backgroundFilter ?? '');
  await delay(1500);

  const isLastEpisode = !storyData.episodes[episodeIndex + 1];

  if (isLastEpisode) {
    // Letzte Episode: State zurücksetzen, nur Übersicht anbieten
    clearProgress();
    showEndScreen(ending.text, false, true);
  } else {
    // Zwischenending: Fortschritt speichern
    saveProgress(state, episodeIndex);
    showEndScreen(ending.text, true, false);
  }

  const action = await waitForAction(!isLastEpisode);
  await new Promise(resolve => hideEndScreen(resolve));
  return action;
}

// ─── End Screen ────────────────────────────────────

function showEndScreen(htmlText, hasNext = false, isLast = false) {
  const endScreen  = document.getElementById('end-screen');
  const endText    = document.getElementById('end-text');
  const nextBtn    = document.getElementById('next-btn');
  const restartBtn = document.getElementById('restart-btn');

  endText.innerHTML = htmlText;

  if (hasNext) {
    nextBtn.classList.remove('hidden');
    nextBtn.textContent = 'Weiter →';
  } else {
    nextBtn.classList.add('hidden');
  }

  restartBtn.textContent = isLast ? 'Zur Übersicht' : 'Neustart';

  // Fade in
  endScreen.classList.remove('hidden', 'fade-out');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      endScreen.classList.add('visible');
    });
  });
}

function waitForAction(hasNext) {
  return new Promise(resolve => {
    const nextBtn    = document.getElementById('next-btn');
    const restartBtn = document.getElementById('restart-btn');

    function onNext() { cleanup(); resolve('next'); }
    function onRestart() { cleanup(); resolve('restart'); }

    function cleanup() {
      nextBtn.removeEventListener('click', onNext);
      restartBtn.removeEventListener('click', onRestart);
    }

    if (hasNext) nextBtn.addEventListener('click', onNext);
    restartBtn.addEventListener('click', onRestart);
  });
}

// ─── Episodenübersicht (von außen aufrufbar) ───────

export function showEpisodeMenu() {
  // main.js übernimmt das Rendering der Übersicht
  document.dispatchEvent(new CustomEvent('show-episode-menu'));
}
