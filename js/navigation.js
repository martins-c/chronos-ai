// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — View Navigation
//  Shell routing between dashboard, chat, placeholders
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VIEW_IDS = {
  home: 'viewDashboard',
  chat: 'viewChat',
  solver: 'viewSolver',
  plano: 'viewPlano',
  tarefas: 'viewTarefas',
  uploads: 'viewUploads',
  analytics: 'viewAnalytics',
  settings: 'viewSettings',
  placeholder: 'viewPlaceholder',
};

export function initNavigation({ elements, focusMode, ui, onViewChange }) {
  const navItems = elements.sidebarNav.querySelectorAll('.nav-item[data-view]');
  const views = {
    home: document.getElementById(VIEW_IDS.home),
    chat: document.getElementById(VIEW_IDS.chat),
    solver: document.getElementById(VIEW_IDS.solver),
    plano: document.getElementById(VIEW_IDS.plano),
    tarefas: document.getElementById(VIEW_IDS.tarefas),
    uploads: document.getElementById(VIEW_IDS.uploads),
    analytics: document.getElementById(VIEW_IDS.analytics),
    settings: document.getElementById(VIEW_IDS.settings),
    placeholder: document.getElementById(VIEW_IDS.placeholder),
  };

  let currentView = 'home';

  function setNavActive(view) {
    navItems.forEach((item) => {
      const isActive = item.dataset.view === view;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  // ━━━ Bottom Nav sync ━━━
  function syncBottomNav(view) {
    document.querySelectorAll('.bottom-nav-item[data-view]').forEach((item) => {
      item.classList.toggle('active', item.dataset.view === view);
    });
  }

  function setView(view, options = {}) {
    const { title, subtitle } = options;

    if (view === 'focus') {
      focusMode.open();
      return;
    }

    if (['solver', 'plano', 'tarefas', 'uploads', 'analytics', 'settings'].includes(view)) {
      currentView = view;
      setNavActive(view);
      syncBottomNav(view);
      showOnly(view);
      elements.sidebarChatPanel?.classList.remove('is-visible');
      ui.closeSidebar();
      onViewChange?.(view);
      return;
    }

    if (['uploads', 'analytics'].includes(view)) {
      if (elements.placeholderTitle) {
        elements.placeholderTitle.textContent = options.title || 'Em breve';
      }
      if (elements.placeholderSubtitle) {
        elements.placeholderSubtitle.textContent =
          options.subtitle || 'Este módulo será liberado em uma próxima fase.';
      }
      currentView = view;
      setNavActive(view);
      syncBottomNav(view);
      showOnly('placeholder');
      elements.sidebarChatPanel?.classList.remove('is-visible');
      ui.closeSidebar();
      onViewChange?.(view);
      return;
    }

    currentView = view;
    setNavActive(view);
    syncBottomNav(view);

    if (view === 'chat') {
      showOnly('chat');
      elements.sidebarChatPanel?.classList.add('is-visible');
    } else {
      showOnly(view === 'home' ? 'home' : 'placeholder');
      elements.sidebarChatPanel?.classList.remove('is-visible');
    }

    ui.closeSidebar();
    onViewChange?.(view);
  }

  function showOnly(key) {
    Object.entries(views).forEach(([name, el]) => {
      if (!el) return;
      el.classList.toggle('app-view--active', name === key);
    });
  }

  function getView() {
    return currentView;
  }

  const PLACEHOLDER_META = {
    uploads: { title: 'Uploads', subtitle: 'Envie materiais e deixe a Chronos interpretar.' },
    analytics: { title: 'Análises', subtitle: 'Métricas de foco e produtividade em tempo real.' },
  };

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      const meta = PLACEHOLDER_META[view];
      setView(view, meta || {});
    });
  });

  // ━━━ Bottom Nav click ━━━
  document.querySelectorAll('.bottom-nav-item[data-view]').forEach((item) => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      const meta = PLACEHOLDER_META[view];
      setView(view, meta || {});
    });
  });

  document.querySelectorAll('.js-menu-toggle').forEach((btn) => {
    btn.addEventListener('click', () => ui.toggleSidebar());
  });

  return { setView, getView };
}
