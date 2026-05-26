// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — Dashboard (Phase 1–2)
//  Card interactions + live focus sync
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const RING_CIRCUMFERENCE = 2 * Math.PI * 45;

export function initDashboard({ focusMode, navigation }) {
  document.querySelectorAll('[data-action="open-focus"]').forEach((el) => {
    el.addEventListener('click', () => focusMode.open());
  });

  document.querySelectorAll('[data-action="go-chat"]').forEach((el) => {
    el.addEventListener('click', () => navigation.setView('chat'));
  });

  document.querySelectorAll('[data-view-link]').forEach((el) => {
    el.addEventListener('click', () => navigation.setView(el.dataset.viewLink));
  });

  const dashDate = document.getElementById('dashDate');
  if (dashDate) {
    const now = new Date();
    dashDate.textContent = now.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    dashDate.dateTime = now.toISOString().slice(0, 10);
  }

  const dashFocusTime = document.getElementById('dashFocusTime');
  const dashFocusMeta = document.getElementById('dashFocusMeta');
  const dashFocusBadge = document.getElementById('dashFocusBadge');
  const dashFocusRing = document.querySelector('.dash-focus-ring-progress');
  const dashStatFocusToday = document.getElementById('dashStatFocusToday');
  const dashStatSessions = document.getElementById('dashStatSessions');

  function syncFocusUI(state) {
    if (dashFocusTime) dashFocusTime.textContent = state.display;

    if (dashFocusRing) {
      const offset = RING_CIRCUMFERENCE * (1 - state.progress);
      dashFocusRing.style.strokeDashoffset = String(offset);
    }

    if (dashFocusMeta) {
      const mins = Math.round(state.sessionDuration / 60);
      if (state.status === 'running') {
        dashFocusMeta.textContent = 'Sessão em andamento · ' + mins + ' min';
      } else if (state.status === 'paused') {
        dashFocusMeta.textContent = 'Pausado · ' + mins + ' min';
      } else {
        dashFocusMeta.textContent = 'Sessão profunda · ' + mins + ' min';
      }
    }

    if (dashFocusBadge) {
      const badges = {
        idle: 'Pronto',
        running: 'Em foco',
        paused: 'Pausado',
      };
      dashFocusBadge.textContent = badges[state.status] || 'Ativo';
    }

    if (dashStatFocusToday && state.stats) {
      const total = state.stats.totalFocusSecondsToday;
      dashStatFocusToday.textContent =
        total > 0 ? formatFocusTotal(total) : '0m';
    }

    if (dashStatSessions && state.stats) {
      dashStatSessions.textContent = String(state.stats.completedSessionsToday);
    }
  }

  function formatFocusTotal(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    if (s < 60) return `${s}s`;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
  }

  focusMode.subscribe(syncFocusUI);
}
