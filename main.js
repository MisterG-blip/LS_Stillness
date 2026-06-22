// ─────────────────────────────────────────────
// main.js  —  Einstiegspunkt & Episodenübersicht
// ─────────────────────────────────────────────

import { loadStory, startGame, getStoryData } from './js/engine.js';
import { audio }    from './js/audio.js';
import { loadProgress, getSeenEndings } from './js/save.js';

// Debug: ?episode=2 startet direkt bei Episode 2
const urlParams    = new URLSearchParams(window.location.search);
const debugEpisode = parseInt(urlParams.get('episode') ?? '0') - 1;

const startMessage = document.getElementById('start-message');
const episodeMenu  = document.getElementById('episode-menu');
const endingsMenu  = document.getElementById('endings-menu');

(async () => {
  await loadStory('data/story.json');

  // Engine meldet: zurück zur Übersicht
  document.addEventListener('show-episode-menu', () => {
    audio.stopAmbient();
    renderEpisodeMenu();
  });

  // Debug-Modus
  if (debugEpisode >= 0) {
    startMessage.addEventListener('click', async () => {
      audio.unlock();
      startMessage.classList.add('hidden');
      await startGame(debugEpisode);
    }, { once: true });
    return;
  }

  // Splash Screen — Klick startet alles
  startMessage.addEventListener('click', async () => {
    audio.unlock();
    startMessage.classList.add('hidden');
    await showSplash();

    const save = loadProgress();
    if (save) {
      renderEpisodeMenu();
    } else {
      await startGame(0);
    }
  }, { once: true });
})();

// ─── Splash Screen ─────────────────────────────────

function showSplash() {
  return new Promise(resolve => {
    const splash = document.getElementById('splash-screen');
    splash.classList.remove('hidden');

    // Einblenden
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        splash.classList.add('visible');
        splash.style.pointerEvents = 'all';
        splash.style.cursor = 'pointer';
      });
    });

    // Klick blendet aus
    splash.addEventListener('click', () => {
      splash.style.pointerEvents = 'none';
      splash.classList.add('fade-out');
      setTimeout(() => {
        splash.classList.add('hidden');
        splash.classList.remove('visible', 'fade-out');
        resolve();
      }, 1200);
    }, { once: true });
  });
}

// ─── Episodenübersicht ─────────────────────────────

function renderEpisodeMenu() {
  const story = getStoryData();
  const save  = loadProgress();

  endingsMenu.classList.add('hidden');
  episodeMenu.classList.remove('hidden');
  episodeMenu.innerHTML = '';

  // Titel
  const title = document.createElement('h1');
  title.id = 'menu-title';
  title.textContent = story.title ?? 'Lost Soldier';
  episodeMenu.appendChild(title);

  // Episodenliste
  const list = document.createElement('div');
  list.id = 'menu-episodes';

  story.episodes.forEach((episode, index) => {
    const completed = save ? index < save.completedEpisodes : false;
    const isNext    = save ? index === save.nextEpisode : index === 0;
    const isLocked  = save ? index > save.nextEpisode  : index > 0;

    const btn = document.createElement('button');
    btn.className = 'menu-episode-btn';
    if (completed) btn.classList.add('completed');
    if (isNext)    btn.classList.add('next');
    if (isLocked)  btn.classList.add('locked');

    btn.innerHTML = `
      <span class="ep-label">${episode.label}</span>
      <span class="ep-status">${completed ? '✓' : isNext ? '▶' : '🔒'}</span>
    `;

    if (!isLocked) {
      btn.addEventListener('click', async () => {
        audio.unlock();
        episodeMenu.classList.add('hidden');
        if (completed && save && index < save.nextEpisode) {
          await startGame(index);
        } else if (isNext && save) {
          await startGame(save.nextEpisode, save);
        } else {
          await startGame(0);
        }
      });
    } else {
      btn.disabled = true;
    }

    list.appendChild(btn);
  });

  episodeMenu.appendChild(list);

  // Untere Button-Reihe
  const menuFooter = document.createElement('div');
  menuFooter.id = 'menu-footer';

  // Endings-Button
  const endingsBtn = document.createElement('button');
  endingsBtn.id = 'menu-endings-btn';
  endingsBtn.textContent = 'CASE FILES';
  endingsBtn.addEventListener('click', () => renderEndingsGallery());
  menuFooter.appendChild(endingsBtn);

  // Reset-Button
  const resetBtn = document.createElement('button');
  resetBtn.id = 'menu-reset-btn';
  resetBtn.textContent = 'Neu beginnen';
  resetBtn.addEventListener('click', async () => {
    if (confirm('Alle Fortschritte löschen und neu beginnen?')) {
      localStorage.clear();
      episodeMenu.classList.add('hidden');
      audio.unlock();
      await startGame(0);
    }
  });
  menuFooter.appendChild(resetBtn);

  episodeMenu.appendChild(menuFooter);
}

// ─── Endings-Galerie ───────────────────────────────

function renderEndingsGallery() {
  const story = getStoryData();
  const seen  = getSeenEndings(); // { trackingKey: count }

  // Alle Endings aus allen Episoden + finalEndings sammeln
  const allEndings = [];

  story.episodes.forEach(episode => {
    (episode.endings ?? []).forEach(ending => {
      if (ending.id === 'end_fallback' || ending.priority === 99) return; // Fallbacks ausblenden
      allEndings.push({ ...ending, episodeLabel: episode.label });
    });
    if (episode.secretEnding) {
      allEndings.push({ ...episode.secretEnding, episodeLabel: episode.label, isSecret: true });
    }
  });

  if (story.finalEndings) {
    story.finalEndings.forEach(ending => {
      if (ending.priority === 99) return;
      allEndings.push({ ...ending, episodeLabel: 'Finale' });
    });
  }

  // Galerie aufbauen
  episodeMenu.classList.add('hidden');
  endingsMenu.classList.remove('hidden');
  endingsMenu.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.id = 'endings-header';

  const backBtn = document.createElement('button');
  backBtn.id = 'endings-back-btn';
  backBtn.textContent = '← ZURÜCK';
  backBtn.addEventListener('click', () => renderEpisodeMenu());
  header.appendChild(backBtn);

  const headerTitle = document.createElement('h2');
  headerTitle.id = 'endings-title';
  headerTitle.textContent = 'CASE FILES';
  header.appendChild(headerTitle);

  endingsMenu.appendChild(header);

  // Karten-Grid
  const grid = document.createElement('div');
  grid.id = 'endings-grid';

  allEndings.forEach(ending => {
    const isUnlocked = seen[ending.trackingKey] > 0;
    const card = document.createElement('div');
    card.className = `ending-card ${isUnlocked ? 'unlocked' : 'locked'}`;

    if (isUnlocked) {
      // Freigeschaltete Karte — Bild + Text
      card.innerHTML = `
        <div class="ending-card-img" style="background-image: url('${ending.background}')">
          ${ending.backgroundFilter ? `<div class="card-filter" style="filter:${ending.backgroundFilter}; position:absolute; inset:0; background: inherit;"></div>` : ''}
          <span class="ending-card-episode">${ending.episodeLabel}</span>
        </div>
        <div class="ending-card-body">
          <div class="ending-card-id">${ending.title ?? ending.id.replace(/_/g, ' ').toUpperCase()}</div>
          <div class="ending-card-text">${stripHtml(ending.text)}</div>
          <div class="ending-card-count">×${seen[ending.trackingKey]}</div>
        </div>
      `;
      card.addEventListener('click', () => showEndingDetail(ending, seen[ending.trackingKey]));
    } else {
      // Gesperrte Karte — Redacted
      card.innerHTML = `
        <div class="ending-card-img locked-img">
          <span class="ending-card-episode">${ending.episodeLabel}</span>
        </div>
        <div class="ending-card-body">
          <div class="ending-card-id redacted">INCIDENT REPORT</div>
          <div class="ending-card-text redacted">
            ██████ — ██████████<br>
            STATUS: ████████<br>
            AGENT: ██████████████
          </div>
        </div>
      `;
    }

    grid.appendChild(card);
  });

  endingsMenu.appendChild(grid);
}

// ─── Ending Detail-Ansicht ─────────────────────────

function showEndingDetail(ending, count) {
  endingsMenu.innerHTML = '';

  const detail = document.createElement('div');
  detail.id = 'ending-detail';
  // Hintergrund und Filter sind im #ending-detail-bg div

  detail.innerHTML = `
    <div id="ending-detail-bg" style="background-image: url('${ending.background}'); ${ending.backgroundFilter ? 'filter:' + ending.backgroundFilter : ''}"></div>
    <div id="ending-detail-overlay">
      <button id="ending-detail-back">← CASE FILES</button>
      <div id="ending-detail-label">${ending.episodeLabel}</div>
      <div id="ending-detail-id">${ending.title ?? ending.id.replace(/_/g, ' ').toUpperCase()}</div>
      <div id="ending-detail-text">${ending.text}</div>
      <div id="ending-detail-count">ERREICHT: ×${count}</div>
    </div>
  `;

  endingsMenu.appendChild(detail);

  document.getElementById('ending-detail-back').addEventListener('click', () => {
    renderEndingsGallery();
  });
}

// ─── Utility ───────────────────────────────────────

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const text = tmp.textContent || tmp.innerText || '';
  return text.length > 80 ? text.substring(0, 80) + '…' : text;
}
