import {
  addPlanItem,
  addTask,
  formatMinutes,
  getAllTasks,
  getPlanForDate,
  getProductivityStats,
} from './productivity-storage.js';
import { readMemory } from './memory.js';
import { addReminder, formatReminderDate, getReminders, parseReminderCommand } from './reminders.js';

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function cleanActionText(text, patterns) {
  let result = String(text || '').trim();
  patterns.forEach((pattern) => {
    result = result.replace(pattern, '').trim();
  });
  return result.replace(/^[,:-]+/, '').trim();
}

export function parseTaskCommand(text) {
  const original = String(text || '').trim().replace(/^chronos[,:]?\s*/i, '');
  const normalized = normalize(original);
  const verbs = '(?:adiciona|adicione|adicionar|coloca|coloque|incluir|inclua|cria|crie|criar|anota|anote)';
  const patterns = [
    new RegExp(`^${verbs}\\s+(?:uma\\s+)?(?:nova\\s+)?tarefas?\\s*(?:de|para|:)?\\s+(.+)$`, 'i'),
    new RegExp(`^${verbs}\\s+(?:na|nas|em)\\s+(?:aba\\s+(?:de|das)\\s+)?tarefas?\\s*(?::)?\\s+(.+)$`, 'i'),
    new RegExp(`^${verbs}\\s+(.+?)\\s+(?:na|nas|em)\\s+(?:aba\\s+(?:de|das)\\s+)?tarefas?\\s*$`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (!match?.[1]) continue;
    const title = match[1]
      .replace(/\s+(?:por favor|pra mim|para mim)[.!?]*$/i, '')
      .replace(/[.!?]+$/, '')
      .trim();
    if (title) return title;
  }

  if (/^(nova|criar) tarefa\b/.test(normalized)) {
    return cleanActionText(original, [/^(nova|criar) tarefa\s*(?:de|para|:)?\s*/i]) || null;
  }
  return null;
}

export function buildBriefing() {
  const memory = readMemory();
  const stats = getProductivityStats();
  const plan = getPlanForDate();
  const activeTasks = getAllTasks().filter((task) => !task.completed);
  const pendingPlan = plan.filter((item) => !item.completed);
  const name = memory.profile?.name || 'Martins';
  const lines = [`${name}, aqui esta seu briefing de hoje.`];

  if (pendingPlan.length) {
    lines.push(`Plano: ${pendingPlan.length} prioridade${pendingPlan.length > 1 ? 's' : ''} pendente${pendingPlan.length > 1 ? 's' : ''}.`);
    pendingPlan.slice(0, 3).forEach((item) => {
      lines.push(`- ${item.title} (${formatMinutes(item.estimatedMinutes)})`);
    });
  } else {
    lines.push('Seu plano do dia ainda nao tem prioridades pendentes.');
  }

  lines.push(
    activeTasks.length
      ? `Voce tem ${activeTasks.length} tarefa${activeTasks.length > 1 ? 's' : ''} ativa${activeTasks.length > 1 ? 's' : ''}.`
      : 'Nao ha tarefas ativas agora.'
  );

  if (stats.tasksCompletedToday || stats.planDoneToday) {
    lines.push(`Concluido hoje: ${stats.tasksCompletedToday + stats.planDoneToday} item(ns).`);
  }

  const nextExam = memory.exams?.[memory.exams.length - 1];
  if (nextExam) lines.push(`Atencao registrada: ${nextExam}`);
  return lines.join('\n');
}

export function executeAssistantCommand(text, { navigation, focusMode }) {
  const command = normalize(text);
  if (!command) return { handled: false };

  const destinations = [
    { terms: ['abrir inicio', 'ir para inicio', 'mostrar inicio'], view: 'home', label: 'inicio' },
    { terms: ['abrir chat', 'ir para chat'], view: 'chat', label: 'chat' },
    { terms: ['abrir tarefas', 'mostrar tarefas', 'ir para tarefas'], view: 'tarefas', label: 'tarefas' },
    { terms: ['abrir plano', 'mostrar plano', 'plano do dia'], view: 'plano', label: 'plano do dia' },
    { terms: ['abrir materiais', 'abrir uploads', 'mostrar materiais'], view: 'uploads', label: 'materiais' },
    { terms: ['abrir analises', 'mostrar desempenho'], view: 'analytics', label: 'analises' },
    { terms: ['abrir memoria', 'abrir configuracoes'], view: 'settings', label: 'configuracoes' },
    { terms: ['abrir resolvedor', 'resolver questao'], view: 'solver', label: 'resolvedor' },
  ];

  const destination = destinations.find((item) => item.terms.some((term) => command.includes(term)));
  if (destination) {
    navigation.setView(destination.view);
    return { handled: true, reply: `Abrindo ${destination.label}.` };
  }

  if (['iniciar foco', 'abrir modo foco', 'comecar foco', 'modo foco'].some((term) => command.includes(term))) {
    focusMode.open();
    return { handled: true, reply: 'Modo Foco aberto. Escolha a duracao e inicie quando estiver pronto.' };
  }

  const reminderRequest = parseReminderCommand(text);
  if (reminderRequest) {
    if (reminderRequest.error) return { handled: true, reply: reminderRequest.error };
    const reminder = addReminder(reminderRequest.title, reminderRequest.dueAt);
    return {
      handled: true,
      reply: `Lembrete criado: ${reminder.title}, ${formatReminderDate(reminder.dueAt)}.`,
    };
  }

  if (['meus lembretes', 'listar lembretes', 'proximos lembretes'].some((term) => command.includes(term))) {
    const upcoming = getReminders().filter((item) => !item.completed && item.dueAt > Date.now()).slice(0, 5);
    if (!upcoming.length) return { handled: true, reply: 'Voce nao tem lembretes futuros.' };
    return {
      handled: true,
      reply: ['Seus proximos lembretes:', ...upcoming.map((item) => `- ${item.title}: ${formatReminderDate(item.dueAt)}`)].join('\n'),
    };
  }

  const taskTitle = parseTaskCommand(text);
  if (taskTitle) {
    const title = taskTitle;
    addTask(title);
    return { handled: true, reply: `Tarefa criada na aba Tarefas: ${title}.` };
  }
  if (/(adiciona|adicione|adicionar|coloca|coloque|cria|crie|criar|anota|anote).{0,35}\btarefas?\b/.test(command)) {
    return { handled: true, reply: 'Qual tarefa voce quer adicionar?' };
  }

  if (/^(adicionar|incluir|criar).*(plano|prioridade)/.test(command)) {
    const title = cleanActionText(text, [
      /^(adicionar|incluir|criar)\s*/i,
      /^(ao|no)\s+plano\s*/i,
      /^prioridade\s*/i,
    ]);
    if (!title) return { handled: true, reply: 'Qual prioridade devo adicionar ao plano de hoje?' };
    addPlanItem({ title, estimatedMinutes: 30, difficulty: 'medium', category: 'personal' });
    return { handled: true, reply: `Adicionei ao plano de hoje: ${title}, com 30 minutos estimados.` };
  }

  if (['briefing', 'resumo do dia', 'me atualize', 'como esta meu dia'].some((term) => command.includes(term))) {
    return { handled: true, reply: buildBriefing() };
  }

  return { handled: false };
}
