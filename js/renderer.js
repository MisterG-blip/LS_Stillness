// ─────────────────────────────────────────────
// renderer.js  —  DOM-Rendering & Transitionen
// ─────────────────────────────────────────────

import { state } from './state.js';

const container       = document.getElementById('container');
const blackTransition = document.getElementById('black-transition');
const episodeTitle    = document.getElementById('episode-title');
const vignette        = document.getElementById('vignette');

// Aktives Hintergrundbild
let activeBg = null;

// Aktive Overlay-Elemente (für Entscheidungen)
const activeOverlays = [];

// ─── Hilfsfunktionen ───────────────────────────────

function createImg(src, className = '') {
  const img = document.createElement('img');
  img.src = src;
  if (className) img.className = className;
  return img;
}

/**
 * Erkennt ob eine Quelle ein Video ist (mp4, webm, ogg).
 */
function isVideo(src) {
  return /\.(mp4|webm|ogg)$/i.test(src);
}

/**
 * Erstellt ein Hintergrundelement — img oder video je nach Dateiendung.
 */
function createBackground(src, loop = true, filter = '') {
  if (isVideo(src)) {
    const video = document.createElement('video');
    video.src = src;
    video.className = 'scene';
    video.autoplay = true;
    video.muted = true;       // Browser-Autoplay erfordert muted
    video.loop = loop;
    video.playsInline = true; // iOS
    video.style.objectFit = 'cover';
    if (filter) video.style.filter = filter;
    return video;
  } else {
    const img = createImg(src, 'scene');
    if (filter) img.style.filter = filter;
    return img;
  }
}

// ─── Hintergrundszene ──────────────────────────────

/**
 * Faded zur schwarzen Überblende, tauscht Hintergrund (Bild oder Video), faded zurück.
 * Gibt ein Promise zurück, das nach dem Einblenden auflöst.
 * scene kann ein Objekt { src, loop, filter } oder ein reiner String sein.
 */
export function transitionToScene(sceneOrSrc, filter = '', duration = 1500) {
  // Rückwärtskompatibel: String oder Objekt { background, backgroundVideo, backgroundVideoLoop }
  let src, loop;
  if (typeof sceneOrSrc === 'object' && sceneOrSrc !== null) {
    src    = sceneOrSrc.backgroundVideo || sceneOrSrc.background;
    loop   = sceneOrSrc.backgroundVideoLoop ?? true;
    filter = sceneOrSrc.backgroundFilter || filter;
  } else {
    src  = sceneOrSrc;
    loop = true;
  }

  return new Promise(resolve => {
    blackTransition.style.transition = `opacity ${duration}ms ease`;
    blackTransition.style.opacity = 1;

    setTimeout(() => {
      // Alten Hintergrund entfernen (Video pausieren vor Remove)
      if (activeBg) {
        if (activeBg.tagName === 'VIDEO') activeBg.pause();
        activeBg.remove();
        activeBg = null;
      }

      clearOverlays();

      // Neues Hintergrundelement (img oder video)
      const el = createBackground(src, loop, filter);
      container.insertBefore(el, container.firstChild);
      activeBg = el;

      setTimeout(() => {
        blackTransition.style.opacity = 0;
        setTimeout(resolve, duration);
      }, 500);

    }, duration);
  });
}

// ─── Episodentitel ─────────────────────────────────

/**
 * Zeigt "Episode N" kurz auf schwarzem Bildschirm.
 */
export function showEpisodeTitle(label) {
  return new Promise(resolve => {
    // Erst vollständig schwarz
    blackTransition.style.transition = 'opacity 0.8s ease';
    blackTransition.style.opacity = 1;

    episodeTitle.textContent = label;
    episodeTitle.classList.remove('hidden', 'fade-out');
    episodeTitle.classList.add('visible');

    // Nach 2.5s ausblenden
    setTimeout(() => {
      episodeTitle.classList.add('fade-out');
      setTimeout(() => {
        episodeTitle.classList.remove('visible', 'fade-out');
        episodeTitle.classList.add('hidden');
        blackTransition.style.opacity = 0;
        resolve();
      }, 800);
    }, 2500);
  });
}

// ─── Schwarze Endblende ────────────────────────────

export function fadeToBlack(duration = 1500) {
  return new Promise(resolve => {
    blackTransition.style.transition = `opacity ${duration}ms ease`;
    blackTransition.style.opacity = 1;
    setTimeout(resolve, duration);
  });
}

export function fadeFromBlack(duration = 1500) {
  return new Promise(resolve => {
    blackTransition.style.transition = `opacity ${duration}ms ease`;
    blackTransition.style.opacity = 0;
    setTimeout(resolve, duration);
  });
}

// ─── Overlays (Entscheidungsbilder) ────────────────

/**
 * Erstellt und zeigt ein Overlay-Bild für eine Entscheidung.
 * Gibt das Element zurück.
 */
export function addOverlay(choice) {
  const img = createImg(choice.image, 'overlay-choice');

  // Positionierung aus JSON
  const pos = choice.position || {};
  if (pos.side === 'left')  img.style.left  = pos.left  || '8%';
  if (pos.side === 'right') img.style.right = pos.right || '8%';
  img.style.bottom = pos.bottom || '10%';

  img.style.opacity = '0';
  img.style.pointerEvents = 'none';
  container.appendChild(img);
  activeOverlays.push(img);

  // Kurze Verzögerung für CSS-Transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      img.style.opacity = '1';
      img.style.pointerEvents = 'auto';
    });
  });

  return img;
}

export function clearOverlays() {
  activeOverlays.forEach(o => o.remove());
  activeOverlays.length = 0;
}

/**
 * Blendet Overlays sanft aus und entfernt sie dann —
 * für staticBackground Szenen wo kein harter Cut stattfindet.
 */
export function fadeOutOverlays(elements) {
  elements.forEach(el => {
    el.style.transition = 'opacity 0.8s ease';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    setTimeout(() => {
      el.remove();
      const idx = activeOverlays.indexOf(el);
      if (idx !== -1) activeOverlays.splice(idx, 1);
    }, 800);
  });
}

export function disableAllOverlayClicks() {
  activeOverlays.forEach(o => {
    o.onclick = null;
    o.style.pointerEvents = 'none';
  });
}

// ─── Vignette ──────────────────────────────────────

export function updateVignette(isolation) {
  vignette.style.opacity = 0.4 + (isolation / 100) * 0.4;
}

// ─── End Screen ────────────────────────────────────

export function showEndScreen(htmlText) {
  const endScreen = document.getElementById('end-screen');
  const endText   = document.getElementById('end-text');
  endText.innerHTML = htmlText;
  endScreen.classList.remove('hidden');
}

export function hideEndScreen(callback) {
  const endScreen = document.getElementById('end-screen');
  endScreen.classList.remove('visible');
  endScreen.classList.add('fade-out');
  setTimeout(() => {
    endScreen.classList.add('hidden');
    endScreen.classList.remove('fade-out');
    if (callback) callback();
  }, 1500);
}
