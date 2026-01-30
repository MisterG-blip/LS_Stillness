// -------------------------
// 1️⃣ State Management
// -------------------------
const state = {
  durst: 50,
  hunger: 50,
  isolation: 50,
  hope: 50,
  currentScene: 'wald',       // Startszene
  choicesMade: [],            // Tracking aller Entscheidungen
  currentEnding: null,        // Welches Ende wurde erreicht
  timeouts: 0                 // Anzahl der Timeouts
};

// -------------------------
// 2️⃣ Szenen- und Overlay-Elemente
// -------------------------
const scenes = {
  wald: document.getElementById('wald'),
  cabin_out: document.getElementById('cabin_out'),
  cabin_in: document.getElementById('cabin_in'),
  clearing: document.getElementById('clearing'),
  end_isolation: document.getElementById('end_isolation'),
  end_hope: document.getElementById('end_hope'),
  end_safe: document.getElementById('end_safe'),
  end_danger: document.getElementById('end_danger'),
  end_despair: document.getElementById('end_despair'),
  end_secret: document.getElementById('end_secret')
};

const overlays = {
  wasser: document.getElementById('wasser'),
  funk: document.getElementById('funk'),
  fruit: document.getElementById('fruit'),
  lighter: document.getElementById('lighter'),
  path: document.getElementById('path'),
  smoke: document.getElementById('smoke')
};

// Vignette
const vignette = document.getElementById('vignette');

// Black Transition
const blackTransition = document.getElementById('black-transition');

// Audio (optional)
const sounds = {
  wald: document.getElementById('sound-wald'),
  wasser: document.getElementById('sound-wasser'),
  funk: document.getElementById('sound-funk'),
  fruit: document.getElementById('sound-fruit'),
  lighter: document.getElementById('sound-lighter'),
  path: document.getElementById('sound-path'),
  smoke: document.getElementById('sound-smoke'),
  cabinVoiceover: document.getElementById('sound-cabin-voiceover'),
  signal: document.getElementById('sound-signal')
};

// UI
const startMessage = document.getElementById('start-message');
const choicesUI = document.getElementById('choices');
const endScreen = document.getElementById('end-screen');
const endText = document.getElementById('end-text');
const restartBtn = document.getElementById('restart-btn');

// Timeout Timer
let timeoutTimer = null;

// -------------------------
// 3️⃣ Utility Funktionen
// -------------------------
function showScene(id) {
  // Fade to black (1.5s)
  blackTransition.style.opacity = 1;
  
  // After 1.5s: hide all scenes
  setTimeout(() => {
    Object.values(scenes).forEach(s => s.classList.add('hidden'));
    scenes[id].classList.remove('hidden');
  }, 1500);
  
  // After 1.5s + 0.5s black = 2s: fade from black (1.5s)
  setTimeout(() => {
    blackTransition.style.opacity = 0;
  }, 2000);
}

function hideAllOverlays() {
  Object.values(overlays).forEach(o => {
    o.style.opacity = 0;
    o.style.pointerEvents = 'none';
  });
}

function showOverlay(id) {
  overlays[id].style.opacity = 1;
  overlays[id].style.pointerEvents = 'auto';
}

function hideOverlay(id) {
  overlays[id].style.opacity = 0;
  overlays[id].style.pointerEvents = 'none';
}

function updateVignette() {
  // Beispiel: Isolation beeinflusst die Dunkelheit
  vignette.style.opacity = 0.4 + (state.isolation / 100) * 0.4;
}

// -------------------------
// 4️⃣ Spielstart & Restart
// -------------------------
startMessage.addEventListener('click', () => {
  startMessage.classList.add('hidden');
  // Start ambient forest sound
  if (sounds.wald) {
    sounds.wald.volume = 0.3; // Leiser im Hintergrund
    sounds.wald.play();
  }
  nextScene();
});

restartBtn.addEventListener('click', () => {
  // Reset State
  state.durst = 50;
  state.hunger = 50;
  state.isolation = 50;
  state.hope = 50;
  state.currentScene = 'wald';
  state.choicesMade = [];
  state.currentEnding = null;
  state.timeouts = 0;
  
  // Clear any active timeout
  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }
  
  // Restart forest sound
  if (sounds.wald) {
    sounds.wald.currentTime = 0;
    sounds.wald.play();
  }
  
  // Hide end screen
  endScreen.classList.add('hidden');
  
  // Start new game
  nextScene();
});

// -------------------------
// 5️⃣ Szenenlogik
// -------------------------
function nextScene() {
  // Erst alle Overlays verstecken
  hideAllOverlays();
  
  switch(state.currentScene) {
    case 'wald':
      showScene('wald');
      // Szene wirken lassen: 1.5 Sek NACH dem die Szene erschienen ist
      setTimeout(() => {
        // Erstes Overlay + Sound
        showOverlay('wasser');
        playSound('wasser');
        // 3 Sek später: zweites Overlay + Sound + Click-Handler + Timer
        setTimeout(() => {
          showOverlay('funk');
          playSound('funk');
          setupChoice('wald', ['wasser', 'funk']);
        }, 3000);
      }, 5000);
      break;

    case 'cabin_out':
      showScene('cabin_out');
      setTimeout(() => {
        showOverlay('fruit');
        playSound('fruit');
        setTimeout(() => {
          showOverlay('lighter');
          playSound('lighter');
          setupChoice('cabin_out', ['fruit','lighter']);
        }, 3000);
      }, 5000);
      break;

    case 'cabin_in':
      showScene('cabin_in');
      // Voice-Over abspielen
      setTimeout(() => {
        playSound('cabinVoiceover');
        // Nach 5 Sek Voice-Over + Transitions automatisch weiter zu clearing
        setTimeout(() => {
          state.currentScene = 'clearing';
          nextScene();
        }, 5000);
      }, 5000); // Nach fade in
      break;

    case 'clearing':
      showScene('clearing');
      setTimeout(() => {
        showOverlay('path');
        playSound('path');
        setTimeout(() => {
          showOverlay('smoke');
          playSound('smoke');
          setupChoice('clearing', ['path','smoke']);
        }, 3000);
      }, 5000);
      break;
      
    case 'ending':
      determineEnding();
      break;
  }
}

// -------------------------
// 6️⃣ Choice Handler
// -------------------------
function setupChoice(scene, options) {
  // Clear any existing timeout
  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }
  
  // Set up click handlers
  options.forEach(opt => {
    const el = overlays[opt];
    el.onclick = () => {
      // Clear timeout when choice is made
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      
      // Immediately disable ALL click handlers to prevent multiple clicks
      Object.values(overlays).forEach(o => {
        o.onclick = null;
      });
      
      state.choicesMade.push(opt);
      handleChoice(opt);
    };
  });
  
  // Start 10 second timeout
  timeoutTimer = setTimeout(() => {
    // Also disable click handlers on timeout
    Object.values(overlays).forEach(o => {
      o.onclick = null;
    });
    handleTimeout(scene);
  }, 10000);
}

function handleChoice(choice) {
  // Clear timeout when choice is made
  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }
  
  // Hide ALL overlays immediately to prevent them showing in next scene
  hideAllOverlays();
  
  // Einfluss auf State und nächste Szene
  switch(choice) {
    case 'wasser':
      state.durst = Math.max(0, state.durst - 30);
      state.hope = Math.max(0, state.hope - 10);
      state.currentScene = 'cabin_out';
      playSound('wasser');
      break;

    case 'funk':
      state.hope = Math.min(100, state.hope + 20);
      state.durst = Math.min(100, state.durst + 10);
      state.currentScene = 'cabin_out';
      playSound('funk');
      break;

    case 'fruit':
      state.hunger = Math.max(0, state.hunger - 30);
      state.isolation += 10;
      state.currentScene = 'clearing';
      break;

    case 'lighter':
      state.isolation = Math.max(0, state.isolation - 10);
      state.currentScene = 'cabin_in'; // Geht zur Hütte, nicht direkt zu clearing
      break;

    case 'path':
      state.isolation = Math.min(100, state.isolation + 20);
      state.currentScene = 'ending';
      break;

    case 'smoke':
      state.isolation = Math.max(0, state.isolation - 10);
      state.hope = Math.min(100, state.hope + 20);
      state.currentScene = 'ending';
      break;
  }

  // Update Vignette
  updateVignette();

  // Wait for black transition to complete (1.5s fade to black + 0.5s black + 1.5s fade in = 3.5s)
  setTimeout(nextScene, 3500);
}

function handleTimeout(scene) {
  // Track timeout
  state.timeouts++;
  state.choicesMade.push('timeout');
  
  // Apply penalties
  state.hope = Math.max(0, state.hope - 20);
  state.isolation = Math.min(100, state.isolation + 15);
  state.durst = Math.min(100, state.durst + 10);
  state.hunger = Math.min(100, state.hunger + 10);
  
  // Update Vignette
  updateVignette();
  
  // Hide all overlays immediately
  hideAllOverlays();
  
  // Move to next scene based on current scene
  switch(scene) {
    case 'wald':
      state.currentScene = 'cabin_out';
      break;
    case 'cabin_out':
      state.currentScene = 'clearing';
      break;
    case 'clearing':
      state.currentScene = 'ending';
      break;
  }
  
  // Wait for black transition to complete (3.5s)
  setTimeout(nextScene, 3500);
}

// -------------------------
// 7️⃣ Audio Utility
// -------------------------
function playSound(id) {
  if (sounds[id]) {
    sounds[id].currentTime = 0;
    sounds[id].play();
  }
}

// -------------------------
// 8️⃣ Ending Logic
// -------------------------
function determineEnding() {
  let ending = '';
  let text = '';
  
  // Check for secret ending first
  const endingsSeen = JSON.parse(localStorage.getItem('endings_seen') || '[]');
  
  // Ending Logic - Check DESPAIR first (highest priority)
  if (state.hope <= 30 || (state.durst >= 80 && state.hunger >= 80) || state.timeouts >= 2) {
    // Hoffnungslos / Aufgegeben
    ending = 'end_despair';
    text = `Der Wille ermüdet, bevor das Leben endet.<br><br>
            - nach Arthur Schopenhauer`;
    trackEnding('despair');
  }
  else if (state.isolation >= 80 && state.hope <= 60) {
    // Einsame Isolation
    ending = 'end_isolation';
    text = `„Man muss allein sein, um ganz zu sich zu kommen.“<br><br>
— Franz Kafka`;
    trackEnding('isolation');
  } 
  else if (state.isolation >= 50 && state.isolation <= 70 && state.hope >= 70) {
    // Vorsichtige Hoffnung
    ending = 'end_hope';
    text = text = `„Man muss weitermachen.<br>
    Ich kann nicht weitermachen.<br>
Ich werde weitermachen.“<br><br>
— Samuel Beckett`;
    trackEnding('hope');
  }
  else if (state.isolation <= 50 && state.hope >= 50 && state.hope <= 70) {
    // Ruhiger Rückzug
    ending = 'end_safe';
text = `„Sicherheit ist kein Ersatz für Freiheit.“<br><br>
— Hannah Arendt`;

    trackEnding('safe');
  }
  else if (state.hope >= 70 && state.isolation <= 40) {
    // Alarm / Gefahr
    ending = 'end_danger';
   text = `„Wer mit Ungeheuern kämpft,<br>
mag zusehen, dass er nicht dabei<br>
zum Ungeheuer wird.“<br><br>
— Friedrich Nietzsche`;
    trackEnding('danger');
  }
  else {
    // Fallback: Neutral
    ending = 'end_safe';
    text = `„Wer ein Warum zum Leben hat, erträgt fast jedes Wie.“<br><br>
— Viktor Frankl<br><br>
Du bist am Leben, doch die Welt da draußen bleibt ungewiss.`;
    trackEnding('safe');
  }
  
  // Check for secret ending
  const currentEndingsSeen = JSON.parse(localStorage.getItem('endings_seen') || '[]');
  if (currentEndingsSeen.length === 5 && new Set(currentEndingsSeen).size === 5) {
    // All 5 endings seen! Show secret
    // Stop forest sound for secret ending
    if (sounds.wald) {
      sounds.wald.pause();
    }
    
    // Play secret signal sound
    playSound('signal');
    
    ending = 'end_secret';
    text = `<span style="font-family: monospace; color: #00ff00;">
            [INTRUDER SIGNAL DETECTED]<br><br>
            Frequenz: 4625 kHz<br>
            Timestamp: 03:47 UTC<br>
            Status: [STATIC]<br><br>
            "...der Vorfall... war kein Zufall..."<br><br>
            [SIGNAL LOST - TRACE UNAVAILABLE]
            </span>`;
    localStorage.removeItem('endings_seen'); // Reset for next playthrough
  }
  
  state.currentEnding = ending;
  showEnding(ending, text);
}

function trackEnding(endingType) {
  const seen = JSON.parse(localStorage.getItem('endings_seen') || '[]');
  if (!seen.includes(endingType)) {
    seen.push(endingType);
    localStorage.setItem('endings_seen', JSON.stringify(seen));
  }
}

function showEnding(sceneId, text) {
  hideAllOverlays();
  showScene(sceneId);
  
  // Show end screen after brief delay
  setTimeout(() => {
    endText.innerHTML = text;
    endScreen.classList.remove('hidden');
  }, 1500);
}

