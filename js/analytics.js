import {
  formatMinutes,
  getProductivityStats,
  getWeeklyFocusData,
} from './productivity-storage.js';

function formatSeconds(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.round(total / 60);
  return formatMinutes(minutes);
}

function signalMarkup(label, value, hint) {
  return `
    <div class="analytics-signal">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${hint}</small>
    </div>
  `;
}

export function initAnalyticsView() {
  const meta = document.getElementById('analyticsMeta');
  const focusTotal = document.getElementById('analyticsFocusTotal');
  const focusCopy = document.getElementById('analyticsFocusCopy');
  const completion = document.getElementById('analyticsCompletion');
  const bestDay = document.getElementById('analyticsBestDay');
  const bars = document.getElementById('analyticsBars');
  const signals = document.getElementById('analyticsSignals');

  function render() {
    const stats = getProductivityStats();
    const week = getWeeklyFocusData();
    const totalSeconds = week.reduce((sum, day) => sum + day.seconds, 0);
    const activeDays = week.filter((day) => day.seconds > 0).length;
    const topDay = week.reduce((best, day) => (day.seconds > best.seconds ? day : best), week[0]);
    const planPercent = stats.planTotalToday
      ? Math.round((stats.planDoneToday / stats.planTotalToday) * 100)
      : 0;

    if (meta) {
      meta.textContent = `${activeDays}/7 dias com foco`;
    }

    if (focusTotal) {
      focusTotal.textContent = formatSeconds(totalSeconds);
    }

    if (focusCopy) {
      focusCopy.textContent = totalSeconds
        ? `Melhor dia: ${topDay.label} com ${topDay.display}. Continue empilhando sessoes curtas.`
        : 'Complete uma sessao de foco para iniciar seu historico.';
    }

    if (completion) {
      completion.textContent = `${planPercent}%`;
    }

    if (bestDay) {
      bestDay.textContent = topDay?.seconds ? `${topDay.label} ${topDay.display}` : 'Comece hoje';
    }

    if (bars) {
      bars.innerHTML = week
        .map(
          (day) => `
            <div class="analytics-bar">
              <span class="analytics-bar-fill" style="height:${Math.max(day.percent, day.seconds ? 12 : 4)}%"></span>
              <small>${day.label}</small>
            </div>
          `
        )
        .join('');
    }

    if (signals) {
      signals.innerHTML = [
        signalMarkup('Plano de hoje', `${stats.planDoneToday}/${stats.planTotalToday}`, 'itens concluidos'),
        signalMarkup('Tarefas ativas', stats.tasksActive, 'pendencias abertas'),
        signalMarkup('Foco semanal', activeDays, 'dias com registro'),
      ].join('');
    }
  }

  window.addEventListener('chronos:productivity', render);
  render();
  return { render };
}
