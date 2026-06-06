// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — Dashboard
//  Focus sync + plan preview + task stats
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import {
  getProductivityStats,
  getWeeklyFocusData,
  togglePlanItem,
  formatMinutes,
  DIFFICULTY_LABELS,
} from './productivity-storage.js';

const RING_CIRCUMFERENCE = 2 * Math.PI * 45;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getGreeting(name) {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return `Bom dia, ${name} ☀️`;
  if (hour >= 12 && hour < 18) return `Boa tarde, ${name} ⚡`;
  return `Boa noite, ${name} 🌙`;
}

function updateGreeting() {
  const heroTitle = document.querySelector('.dash-greeting h1');
  if (!heroTitle) return;

  const saved = localStorage.getItem('chronos_user');
  let name = 'estudante';
  if (saved) {
    try {
      name = JSON.parse(saved).name || name;
    } catch {}
  }
  heroTitle.textContent = getGreeting(name);
}

function formatFocusTotal(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

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

  updateGreeting();

  const dashFocusTime = document.getElementById('dashFocusTime');
  const dashFocusMeta = document.getElementById('dashFocusMeta');
  const dashFocusBadge = document.getElementById('dashFocusBadge');
  const dashFocusRing = document.querySelector('.dash-focus-ring-progress');
  const dashStatFocusToday = document.getElementById('dashStatFocusToday');
  const dashStatSessions = document.getElementById('dashStatSessions');
  const dashStatTasksDone = document.getElementById('dashStatTasksDone');
  const dashPlanList = document.getElementById('dashPlanList');
  const dashPlanEmpty = document.getElementById('dashPlanEmpty');
  const dashChartBars = document.querySelector('.dash-chart-bars');
  const chartBadge = document.getElementById('chartBadge');

  function syncFocusUI(state) {
    if (dashFocusTime) dashFocusTime.textContent = state.display;

    if (dashFocusRing) {
      const offset = RING_CIRCUMFERENCE * (1 - state.progress);
      dashFocusRing.style.strokeDashoffset = String(offset);
    }

    if (dashFocusMeta) {
      const mins = Math.round(state.sessionDuration / 60);
      if (state.status === 'running') {
        dashFocusMeta.textContent = `Sessão em andamento · ${mins} min`;
      } else if (state.status === 'paused') {
        dashFocusMeta.textContent = `Pausado · ${mins} min`;
      } else {
        dashFocusMeta.textContent = `Sessão profunda · ${mins} min`;
      }
    }

    if (dashFocusBadge) {
      const badges = { idle: 'Pronto', running: 'Em foco', paused: 'Pausado' };
      dashFocusBadge.textContent = badges[state.status] || 'Ativo';
    }

    if (dashStatFocusToday && state.stats) {
      const total = state.stats.totalFocusSecondsToday;
      dashStatFocusToday.textContent = total > 0 ? formatFocusTotal(total) : '0m';
    }

    if (dashStatSessions && state.stats) {
      dashStatSessions.textContent = String(state.stats.completedSessionsToday);
    }
  }

  function renderWeeklyChart() {
    if (!dashChartBars) return;

    const data = getWeeklyFocusData();
    dashChartBars.innerHTML = '';

    data.forEach((day, index) => {
      const item = document.createElement('div');
      item.className = 'dash-chart-bar';
      item.title = `${day.label}: ${day.display}`;

      const fill = document.createElement('div');
      fill.className = 'dash-chart-bar-fill';
      if (index === data.length - 1) fill.classList.add('dash-chart-bar--today');
      fill.style.height = `${Math.max(day.percent, day.seconds > 0 ? 8 : 4)}%`;

      const label = document.createElement('span');
      label.textContent = day.label;

      item.append(fill, label);
      dashChartBars.appendChild(item);
    });

    if (chartBadge) {
      const totalSeconds = data.reduce((sum, day) => sum + day.seconds, 0);
      chartBadge.textContent = totalSeconds > 0 ? formatFocusTotal(totalSeconds) : 'Esta semana';
    }
  }

  function syncProductivityUI() {
    const stats = getProductivityStats();

    if (dashStatTasksDone) {
      dashStatTasksDone.textContent = String(stats.tasksCompletedToday);
    }

    renderWeeklyChart();

    if (!dashPlanList) return;

    dashPlanList.innerHTML = '';
    const preview = stats.planToday.slice(0, 4);

    if (preview.length === 0) {
      dashPlanEmpty?.classList.remove('hidden');
      return;
    }

    dashPlanEmpty?.classList.add('hidden');

    preview.forEach((item) => {
      const li = document.createElement('li');
      li.className = `dash-task${item.completed ? ' done' : ''}`;
      li.dataset.id = item.id;
      li.innerHTML = `
        <span class="dash-task-check" role="button" tabindex="0" aria-label="Alternar conclusão"></span>
        <span>${escapeHtml(item.title)}</span>
        <time class="dash-task-time">${formatMinutes(item.estimatedMinutes)} · ${DIFFICULTY_LABELS[item.difficulty]}</time>
      `;
      dashPlanList.appendChild(li);
    });
  }

  dashPlanList?.addEventListener('click', (e) => {
    const row = e.target.closest('.dash-task');
    if (!row?.dataset.id) return;
    if (e.target.closest('.dash-task-check')) {
      togglePlanItem(row.dataset.id);
    }
  });

  focusMode.subscribe(syncFocusUI);
  window.addEventListener('chronos:productivity', syncProductivityUI);
  syncProductivityUI();
}
