// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — Productivity Storage
//  Daily plan + tasks (localStorage, isolated)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const KEYS = {
  PLAN: 'chronos_plan_items',
  TASKS: 'chronos_tasks',
};

export const DIFFICULTIES = ['low', 'medium', 'high'];
export const CATEGORIES = ['study', 'work', 'personal'];

export const DIFFICULTY_LABELS = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

export const CATEGORY_LABELS = {
  study: 'Estudo',
  work: 'Trabalho',
  personal: 'Pessoal',
};

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function emitProductivityChange() {
  window.dispatchEvent(new CustomEvent('chronos:productivity'));
}

function newId() {
  return `ch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ━━━ Daily plan ━━━

export function getAllPlanItems() {
  return load(KEYS.PLAN, []);
}

export function getPlanForDate(dateKey = todayKey()) {
  return getAllPlanItems()
    .filter((item) => item.date === dateKey)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function addPlanItem({ title, estimatedMinutes, difficulty, category }) {
  const items = getAllPlanItems();
  const item = {
    id: newId(),
    date: todayKey(),
    title: title.trim(),
    estimatedMinutes: Math.max(5, Number(estimatedMinutes) || 30),
    difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 'medium',
    category: CATEGORIES.includes(category) ? category : 'study',
    completed: false,
    createdAt: Date.now(),
  };
  items.push(item);
  save(KEYS.PLAN, items);
  emitProductivityChange();
  return item;
}

export function updatePlanItem(id, patch) {
  const items = getAllPlanItems();
  const index = items.findIndex((i) => i.id === id);
  if (index < 0) return null;
  items[index] = { ...items[index], ...patch };
  if (patch.title !== undefined) items[index].title = String(patch.title).trim();
  save(KEYS.PLAN, items);
  emitProductivityChange();
  return items[index];
}

export function togglePlanItem(id) {
  const items = getAllPlanItems();
  const item = items.find((i) => i.id === id);
  if (!item) return null;
  item.completed = !item.completed;
  save(KEYS.PLAN, items);
  emitProductivityChange();
  return item;
}

export function deletePlanItem(id) {
  const items = getAllPlanItems().filter((i) => i.id !== id);
  save(KEYS.PLAN, items);
  emitProductivityChange();
}

// ━━━ Tasks ━━━

export function getAllTasks() {
  return load(KEYS.TASKS, []).sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
}

export function addTask(title) {
  const tasks = load(KEYS.TASKS, []);
  const task = {
    id: newId(),
    title: title.trim(),
    completed: false,
    createdAt: Date.now(),
    completedAt: null,
  };
  tasks.unshift(task);
  save(KEYS.TASKS, tasks);
  emitProductivityChange();
  return task;
}

export function updateTask(id, patch) {
  const tasks = load(KEYS.TASKS, []);
  const index = tasks.findIndex((t) => t.id === id);
  if (index < 0) return null;
  tasks[index] = { ...tasks[index], ...patch };
  if (patch.title !== undefined) tasks[index].title = String(patch.title).trim();
  save(KEYS.TASKS, tasks);
  emitProductivityChange();
  return tasks[index];
}

export function toggleTask(id) {
  const tasks = load(KEYS.TASKS, []);
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  task.completed = !task.completed;
  task.completedAt = task.completed ? Date.now() : null;
  save(KEYS.TASKS, tasks);
  emitProductivityChange();
  return task;
}

export function deleteTask(id) {
  const tasks = load(KEYS.TASKS, []).filter((t) => t.id !== id);
  save(KEYS.TASKS, tasks);
  emitProductivityChange();
}

// ━━━ Stats for dashboard ━━━

export function getProductivityStats() {
  const dateKey = todayKey();
  const planToday = getPlanForDate(dateKey);
  const tasks = getAllTasks();

  const tasksCompletedToday = tasks.filter(
    (t) => t.completed && t.completedAt && todayKey(new Date(t.completedAt)) === dateKey
  ).length;

  const planDoneToday = planToday.filter((p) => p.completed).length;

  return {
    planToday,
    planDoneToday,
    planTotalToday: planToday.length,
    tasksCompletedToday,
    tasksActive: tasks.filter((t) => !t.completed).length,
    tasksTotal: tasks.length,
  };
}

export function formatMinutes(mins) {
  const m = Math.max(0, Number(mins) || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `${h}h ${r}m` : `${h}h`;
}
