// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — Plano do Dia view
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import {
  getPlanForDate,
  addPlanItem,
  updatePlanItem,
  togglePlanItem,
  deletePlanItem,
  DIFFICULTY_LABELS,
  CATEGORY_LABELS,
  formatMinutes,
} from './productivity-storage.js';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function initPlanView({ ui }) {
  const form = document.getElementById('planForm');
  const list = document.getElementById('planList');
  const empty = document.getElementById('planEmpty');
  const countEl = document.getElementById('planCount');
  const dateLabel = document.getElementById('planDateLabel');

  if (!form || !list) return { render: () => {} };

  function render() {
    const items = getPlanForDate();
    const done = items.filter((i) => i.completed).length;

    if (dateLabel) {
      dateLabel.textContent = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    }
    if (countEl) {
      countEl.textContent =
        items.length === 0
          ? 'Nenhuma prioridade'
          : `${done}/${items.length} concluídas`;
    }

    list.querySelectorAll('.prod-item').forEach((el) => el.remove());

    if (items.length === 0) {
      empty?.classList.remove('hidden');
      return;
    }

    empty?.classList.add('hidden');

    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = `prod-item prod-item--plan${item.completed ? ' is-done' : ''}`;
      li.dataset.id = item.id;
      li.innerHTML = `
        <button type="button" class="prod-check" aria-label="Marcar como concluída"></button>
        <div class="prod-item-body">
          <span class="prod-item-title">${escapeHtml(item.title)}</span>
          <div class="prod-item-meta">
            <span class="prod-tag prod-tag--${item.difficulty}">${DIFFICULTY_LABELS[item.difficulty]}</span>
            <span class="prod-tag prod-tag--cat">${CATEGORY_LABELS[item.category]}</span>
            <span class="prod-time">${formatMinutes(item.estimatedMinutes)}</span>
          </div>
        </div>
        <div class="prod-item-actions">
          <button type="button" class="prod-icon-btn" data-action="edit" aria-label="Editar">✎</button>
          <button type="button" class="prod-icon-btn prod-icon-btn--danger" data-action="delete" aria-label="Excluir">×</button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.querySelector('[name="title"]')?.value;
    if (!title?.trim()) return;

    addPlanItem({
      title,
      estimatedMinutes: form.querySelector('[name="minutes"]')?.value,
      difficulty: form.querySelector('[name="difficulty"]')?.value,
      category: form.querySelector('[name="category"]')?.value,
    });

    form.reset();
    if (form.querySelector('[name="minutes"]')) {
      form.querySelector('[name="minutes"]').value = '30';
    }
    ui?.showToast?.('Prioridade adicionada ao plano ✓');
    render();
  });

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.prod-item');
    if (!item) return;
    const id = item.dataset.id;

    if (e.target.closest('.prod-check')) {
      togglePlanItem(id);
      render();
      return;
    }

    const editBtn = e.target.closest('[data-action="edit"]');
    if (editBtn) {
      openEditPlan(id, ui, render);
      return;
    }

    if (e.target.closest('[data-action="delete"]')) {
      if (confirm('Remover esta prioridade do plano?')) {
        deletePlanItem(id);
        ui?.showToast?.('Prioridade removida');
        render();
      }
    }
  });

  window.addEventListener('chronos:productivity', render);
  render();

  return { render };
}

function openEditPlan(id, ui, render) {
  const items = getPlanForDate();
  const item = items.find((i) => i.id === id);
  if (!item) return;

  const title = prompt('Título da prioridade:', item.title);
  if (title === null) return;
  if (!title.trim()) {
    ui?.showToast?.('Título não pode ficar vazio', 'error');
    return;
  }

  const minutes = prompt('Tempo estimado (minutos):', String(item.estimatedMinutes));
  if (minutes === null) return;

  updatePlanItem(id, {
    title,
    estimatedMinutes: Math.max(5, Number(minutes) || item.estimatedMinutes),
  });
  ui?.showToast?.('Prioridade atualizada ✓');
  render();
}
