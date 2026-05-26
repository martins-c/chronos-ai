// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — Tarefas view
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import {
  getAllTasks,
  addTask,
  updateTask,
  toggleTask,
  deleteTask,
} from './productivity-storage.js';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function initTasksView({ ui }) {
  const form = document.getElementById('tasksForm');
  const list = document.getElementById('tasksList');
  const empty = document.getElementById('tasksEmpty');
  const countEl = document.getElementById('tasksCount');
  const filterBtns = document.querySelectorAll('[data-tasks-filter]');

  if (!form || !list) return { render: () => {} };

  let filter = 'all';

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filter = btn.dataset.tasksFilter || 'all';
      filterBtns.forEach((b) => b.classList.toggle('active', b === btn));
      render();
    });
  });

  function getFiltered() {
    const all = getAllTasks();
    if (filter === 'active') return all.filter((t) => !t.completed);
    if (filter === 'done') return all.filter((t) => t.completed);
    return all;
  }

  function render() {
    const all = getAllTasks();
    const items = getFiltered();
    const done = all.filter((t) => t.completed).length;

    if (countEl) {
      countEl.textContent =
        all.length === 0
          ? 'Nenhuma tarefa'
          : `${done}/${all.length} concluídas`;
    }

    list.querySelectorAll('.prod-item').forEach((el) => el.remove());

    if (items.length === 0) {
      empty?.classList.remove('hidden');
      return;
    }

    empty?.classList.add('hidden');

    items.forEach((task) => {
      const li = document.createElement('li');
      li.className = `prod-item prod-item--task${task.completed ? ' is-done' : ''}`;
      li.dataset.id = task.id;
      li.innerHTML = `
        <button type="button" class="prod-check" aria-label="Marcar como concluída"></button>
        <div class="prod-item-body">
          <span class="prod-item-title">${escapeHtml(task.title)}</span>
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
    const input = form.querySelector('[name="title"]');
    const title = input?.value;
    if (!title?.trim()) return;

    addTask(title);
    form.reset();
    ui?.showToast?.('Tarefa criada ✓');
    render();
  });

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.prod-item');
    if (!item) return;
    const id = item.dataset.id;

    if (e.target.closest('.prod-check')) {
      const task = toggleTask(id);
      if (task?.completed) ui?.showToast?.('Tarefa concluída! ✓');
      render();
      return;
    }

    if (e.target.closest('[data-action="edit"]')) {
      const tasks = getAllTasks();
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const title = prompt('Editar tarefa:', task.title);
      if (title === null) return;
      if (!title.trim()) {
        ui?.showToast?.('Título não pode ficar vazio', 'error');
        return;
      }
      updateTask(id, { title });
      ui?.showToast?.('Tarefa atualizada ✓');
      render();
      return;
    }

    if (e.target.closest('[data-action="delete"]')) {
      if (confirm('Excluir esta tarefa?')) {
        deleteTask(id);
        ui?.showToast?.('Tarefa excluída');
        render();
      }
    }
  });

  window.addEventListener('chronos:productivity', render);
  render();

  return { render };
}
