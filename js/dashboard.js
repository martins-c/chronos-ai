// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — Dashboard (Phase 1 static UI)
//  Card interactions only — no backend yet
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
    const label = now.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    dashDate.textContent = label;
    dashDate.dateTime = now.toISOString().slice(0, 10);
  }
}
