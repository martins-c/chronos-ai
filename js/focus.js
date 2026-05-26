// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — Focus Mode (Phase 2)
//  Pomodoro timer, localStorage stats, UI sync
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DEFAULT_DURATION_SEC = 25 * 60;
const STORAGE_STATS = 'chronos_focus_stats';
const STORAGE_RUNTIME = 'chronos_focus_runtime';

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function formatTimer(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function defaultStats() {
  return {
    todayDate: todayKey(),
    totalFocusSecondsToday: 0,
    completedSessionsToday: 0,
    lastSessionAt: null,
    sessions: [],
  };
}

function defaultRuntime() {
  return {
    sessionDuration: DEFAULT_DURATION_SEC,
    remaining: DEFAULT_DURATION_SEC,
    status: 'idle',
    endAt: null,
  };
}

function normalizeStats(stats) {
  const base = { ...defaultStats(), ...stats };
  if (base.todayDate !== todayKey()) {
    base.todayDate = todayKey();
    base.totalFocusSecondsToday = 0;
    base.completedSessionsToday = 0;
  }
  if (!Array.isArray(base.sessions)) base.sessions = [];
  return base;
}

export function initFocusMode({ elements, ui }) {
  const {
    focusOverlay,
    btnFocus,
    btnFocusClose,
    focusTimer,
    focusTimerLabel,
    btnFocusPrimary,
    btnFocusReset,
    btnFocusFinish,
  } = elements;

  let stats = normalizeStats(loadJson(STORAGE_STATS, defaultStats()));
  let runtime = { ...defaultRuntime(), ...loadJson(STORAGE_RUNTIME, defaultRuntime()) };

  let tickInterval = null;
  const listeners = new Set();

  function persistStats() {
    saveJson(STORAGE_STATS, stats);
  }

  function persistRuntime() {
    saveJson(STORAGE_RUNTIME, runtime);
  }

  function emit() {
    const snapshot = getState();
    listeners.forEach((fn) => fn(snapshot));
    return snapshot;
  }

  function getState() {
    syncRemainingFromClock();
    return {
      remaining: runtime.remaining,
      sessionDuration: runtime.sessionDuration,
      status: runtime.status,
      display: formatTimer(runtime.remaining),
      progress: 1 - runtime.remaining / runtime.sessionDuration,
      stats: {
        totalFocusSecondsToday: stats.totalFocusSecondsToday,
        completedSessionsToday: stats.completedSessionsToday,
        lastSessionAt: stats.lastSessionAt,
      },
    };
  }

  function subscribe(fn) {
    listeners.add(fn);
    fn(getState());
    return () => listeners.delete(fn);
  }

  function syncRemainingFromClock() {
    if (runtime.status !== 'running' || !runtime.endAt) return;
    runtime.remaining = Math.max(0, (runtime.endAt - Date.now()) / 1000);
    if (runtime.remaining <= 0) {
      runtime.remaining = 0;
      completeSession(runtime.sessionDuration);
    }
  }

  function startTick() {
    stopTick();
    tickInterval = setInterval(() => {
      syncRemainingFromClock();
      render();
      persistRuntime();
      if (runtime.status !== 'running') stopTick();
    }, 250);
  }

  function stopTick() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  function render() {
    if (focusTimer) {
      focusTimer.textContent = formatTimer(runtime.remaining);
      focusTimer.setAttribute('aria-label', `Tempo restante ${formatTimer(runtime.remaining)}`);
    }
    if (focusTimerLabel) {
      const labels = {
        idle: 'Pronto para começar',
        running: 'Sessão em andamento',
        paused: 'Sessão pausada',
      };
      focusTimerLabel.textContent = labels[runtime.status] || 'Sessão de foco';
    }
    updateControls();
    emit();
  }

  function updateControls() {
    if (!btnFocusPrimary) return;
    const { status } = runtime;

    if (status === 'idle') {
      btnFocusPrimary.textContent = 'Iniciar';
      btnFocusPrimary.dataset.action = 'start';
      btnFocusPrimary.disabled = false;
    } else if (status === 'running') {
      btnFocusPrimary.textContent = 'Pausar';
      btnFocusPrimary.dataset.action = 'pause';
      btnFocusPrimary.disabled = false;
    } else if (status === 'paused') {
      btnFocusPrimary.textContent = 'Retomar';
      btnFocusPrimary.dataset.action = 'resume';
      btnFocusPrimary.disabled = false;
    }

    if (btnFocusReset) {
      btnFocusReset.disabled = status === 'idle' && runtime.remaining === runtime.sessionDuration;
    }
    if (btnFocusFinish) {
      btnFocusFinish.disabled = status === 'idle';
    }
  }

  function start() {
    stats = normalizeStats(stats);
    if (runtime.status === 'idle' && runtime.remaining <= 0) {
      runtime.remaining = runtime.sessionDuration;
    }
    runtime.status = 'running';
    runtime.endAt = Date.now() + runtime.remaining * 1000;
    persistRuntime();
    startTick();
    render();
  }

  function pause() {
    if (runtime.status !== 'running') return;
    syncRemainingFromClock();
    runtime.status = 'paused';
    runtime.endAt = null;
    stopTick();
    persistRuntime();
    render();
  }

  function resume() {
    if (runtime.status !== 'paused') return;
    runtime.status = 'running';
    runtime.endAt = Date.now() + runtime.remaining * 1000;
    persistRuntime();
    startTick();
    render();
  }

  function reset() {
    stopTick();
    runtime = defaultRuntime();
    persistRuntime();
    render();
  }

  function recordSession(elapsedSeconds) {
    const elapsed = Math.max(1, Math.floor(elapsedSeconds));
    stats = normalizeStats(stats);
    stats.totalFocusSecondsToday += elapsed;
    stats.completedSessionsToday += 1;
    stats.lastSessionAt = Date.now();
    stats.sessions.unshift({
      durationSeconds: elapsed,
      plannedDuration: runtime.sessionDuration,
      completedAt: stats.lastSessionAt,
    });
    if (stats.sessions.length > 50) stats.sessions.length = 50;
    persistStats();
  }

  function completeSession(elapsedSeconds) {
    const wasRunning = runtime.status === 'running' || runtime.status === 'paused';
    stopTick();
    if (wasRunning && elapsedSeconds > 0) {
      recordSession(elapsedSeconds);
      ui?.showToast?.('Sessão de foco concluída! ⚡', 'info', 4000);
    }
    runtime = defaultRuntime();
    persistRuntime();
    render();
  }

  function finish() {
    if (runtime.status === 'idle') return;
    const elapsed = runtime.sessionDuration - runtime.remaining;
    completeSession(elapsed > 0 ? elapsed : runtime.sessionDuration);
  }

  function handlePrimary() {
    const action = btnFocusPrimary?.dataset.action;
    if (action === 'start') start();
    else if (action === 'pause') pause();
    else if (action === 'resume') resume();
  }

  function open() {
    syncRemainingFromClock();
    if (runtime.status === 'running') startTick();
    focusOverlay.classList.add('active');
    focusOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    render();
  }

  function close() {
    focusOverlay.classList.remove('active');
    focusOverlay.setAttribute('aria-hidden', 'true');
    if (!elements.sidebar?.classList.contains('open')) {
      document.body.style.overflow = '';
    }
    persistRuntime();
  }

  function isOpen() {
    return focusOverlay.classList.contains('active');
  }

  btnFocusPrimary?.addEventListener('click', handlePrimary);
  btnFocusReset?.addEventListener('click', reset);
  btnFocusFinish?.addEventListener('click', finish);
  btnFocus?.addEventListener('click', open);
  btnFocusClose?.addEventListener('click', close);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && runtime.status === 'running') {
      syncRemainingFromClock();
      render();
      persistRuntime();
    }
  });

  if (runtime.status === 'running') startTick();
  render();

  return { open, close, isOpen, subscribe, getState };
}
