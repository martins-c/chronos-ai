const MEMORY_KEY = 'chronos_user_memory';
const PERSONAL_PROFILE = { name: 'Martins', course: '' };

const MEMORY_FIELDS = {
  goals: ['objetivo', 'meta', 'quero', 'preciso', 'passar', 'melhorar'],
  routine: ['rotina', 'horario', 'horário', 'trabalho', 'aula', 'tempo livre', 'manha', 'manhã', 'tarde', 'noite'],
  subjects: ['matematica', 'matemática', 'fisica', 'física', 'quimica', 'química', 'biologia', 'historia', 'história', 'geografia', 'portugues', 'português', 'ingles', 'inglês', 'redacao', 'redação'],
  exams: ['prova', 'enem', 'vestibular', 'simulado', 'teste', 'concurso', 'avaliação', 'avaliacao'],
  preferences: ['prefiro', 'gosto', 'não gosto', 'nao gosto', 'melhor pra mim', 'funciona melhor', 'dificuldade'],
};

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function unique(items) {
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
}

function compact(items, limit = 12) {
  return unique(items).slice(-limit);
}

function baseMemory() {
  return {
    profile: {
      name: '',
      course: '',
    },
    goals: [],
    routine: [],
    subjects: [],
    exams: [],
    preferences: [],
    conversationNotes: [],
    updatedAt: null,
  };
}

export function readMemory() {
  return { ...baseMemory(), ...safeParse(localStorage.getItem(MEMORY_KEY), {}) };
}

export function ensurePersonalMemory() {
  const memory = readMemory();
  if (memory.profile?.name) return memory;

  const next = {
    ...memory,
    profile: { ...PERSONAL_PROFILE, ...(memory.profile || {}), name: PERSONAL_PROFILE.name },
  };
  saveMemory(next);
  return next;
}

export function saveMemory(memory) {
  localStorage.setItem(MEMORY_KEY, JSON.stringify({ ...memory, updatedAt: Date.now() }));
  window.dispatchEvent(new CustomEvent('chronos:memory'));
}

export function clearMemory() {
  localStorage.removeItem(MEMORY_KEY);
  window.dispatchEvent(new CustomEvent('chronos:memory'));
}

export function replaceMemory(patch) {
  const memory = readMemory();
  saveMemory({
    ...memory,
    ...patch,
    profile: {
      ...memory.profile,
      ...(patch.profile || {}),
    },
  });
}

export function rememberOnboarding({ name, course, goal }) {
  const memory = readMemory();
  memory.profile = {
    ...memory.profile,
    name: name || memory.profile.name,
    course: course || memory.profile.course,
  };
  if (goal) memory.goals = compact([...memory.goals, goal]);
  saveMemory(memory);
}

function sentenceHits(text, keywords) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function extractNotes(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return {};

  const chunks = clean
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12 && part.length <= 240);

  const result = {};
  Object.entries(MEMORY_FIELDS).forEach(([field, keywords]) => {
    result[field] = chunks.filter((chunk) => sentenceHits(chunk, keywords)).slice(0, 4);
  });
  return result;
}

export function rememberMessage(role, content) {
  if (role !== 'user') return;
  const notes = extractNotes(content);
  const memory = readMemory();

  memory.goals = compact([...memory.goals, ...(notes.goals || [])]);
  memory.routine = compact([...memory.routine, ...(notes.routine || [])]);
  memory.subjects = compact([...memory.subjects, ...(notes.subjects || [])]);
  memory.exams = compact([...memory.exams, ...(notes.exams || [])]);
  memory.preferences = compact([...memory.preferences, ...(notes.preferences || [])]);

  const summary = String(content || '').trim();
  if (summary.length > 24) {
    memory.conversationNotes = compact([...memory.conversationNotes, summary.slice(0, 220)], 16);
  }

  saveMemory(memory);
}

function list(label, values) {
  return values?.length ? `${label}: ${values.join(' | ')}` : '';
}

export function getMemoryContext() {
  const memory = readMemory();
  const lines = [
    memory.profile?.name ? `Nome: ${memory.profile.name}` : '',
    memory.profile?.course ? `Curso/objetivo escolar: ${memory.profile.course}` : '',
    list('Objetivos', memory.goals),
    list('Rotina e disponibilidade', memory.routine),
    list('Matérias e dificuldades', memory.subjects),
    list('Provas futuras', memory.exams),
    list('Preferências de estudo', memory.preferences),
    list('Notas recentes entre conversas', memory.conversationNotes),
  ].filter(Boolean);

  if (!lines.length) return '';
  return [
    'Memoria persistente do usuario no Chronos. Use com naturalidade, sem repetir tudo. Se algo estiver desatualizado, pergunte e atualize:',
    ...lines,
  ].join('\n');
}
