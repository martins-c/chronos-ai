const REMINDERS_KEY = 'chronos_reminders';
const REMINDER_SETTINGS_KEY = 'chronos_reminder_settings';

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function createId() {
  return `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getReminders() {
  return safeParse(localStorage.getItem(REMINDERS_KEY), []).sort((a, b) => a.dueAt - b.dueAt);
}

function saveReminders(reminders) {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  window.dispatchEvent(new CustomEvent('chronos:reminders'));
}

export function getReminderSettings() {
  return {
    dailyBriefing: false,
    briefingTime: '08:00',
    lastBriefingDate: '',
    ...safeParse(localStorage.getItem(REMINDER_SETTINGS_KEY), {}),
  };
}

export function saveReminderSettings(patch) {
  localStorage.setItem(
    REMINDER_SETTINGS_KEY,
    JSON.stringify({ ...getReminderSettings(), ...patch })
  );
  window.dispatchEvent(new CustomEvent('chronos:reminders'));
}

export function addReminder(title, dueAt) {
  const cleanTitle = String(title || '').trim();
  const timestamp = Number(dueAt);
  if (!cleanTitle || !Number.isFinite(timestamp)) return null;

  const reminder = { id: createId(), title: cleanTitle, dueAt: timestamp, notifiedAt: null, completed: false };
  saveReminders([...getReminders(), reminder]);
  return reminder;
}

export function completeReminder(id) {
  saveReminders(getReminders().map((item) => item.id === id ? { ...item, completed: true } : item));
}

export function deleteReminder(id) {
  saveReminders(getReminders().filter((item) => item.id !== id));
}

export function formatReminderDate(timestamp) {
  return new Date(timestamp).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function parseReminderCommand(text) {
  const original = String(text || '').trim();
  const normalized = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!/(me lembre|lembrete|lembrar)/.test(normalized)) return null;

  const now = new Date();
  let due = null;
  const relative = normalized.match(/daqui a\s+(\d+)\s*(minuto|minutos|hora|horas)/);
  if (relative) {
    const amount = Number(relative[1]);
    const multiplier = relative[2].startsWith('hora') ? 60 * 60 * 1000 : 60 * 1000;
    due = new Date(now.getTime() + amount * multiplier);
  }

  const timeMatch = normalized.match(/(?:as|às|a)\s*(\d{1,2})(?::(\d{2}))?\b/);
  if (!due && timeMatch) {
    due = new Date(now);
    due.setSeconds(0, 0);
    due.setHours(Number(timeMatch[1]), Number(timeMatch[2] || 0));
    if (normalized.includes('amanha')) due.setDate(due.getDate() + 1);
    else if (due <= now && !normalized.includes('hoje')) due.setDate(due.getDate() + 1);
  }

  if (!due && normalized.includes('amanha')) {
    due = new Date(now);
    due.setDate(due.getDate() + 1);
    due.setHours(9, 0, 0, 0);
  }

  if (!due || due.getTime() <= now.getTime()) return { error: 'Informe quando devo lembrar, por exemplo: amanhã às 9 ou daqui a 30 minutos.' };

  let title = original
    .replace(/^(chronos[,:]?\s*)?(me lembre de|criar lembrete para|lembrete para|lembrar de)\s*/i, '')
    .replace(/\s+daqui a\s+\d+\s*(minuto|minutos|hora|horas).*$/i, '')
    .replace(/\s+(hoje|amanhã|amanha)?\s*(às|as|a)\s*\d{1,2}(?::\d{2})?.*$/i, '')
    .trim();
  if (!title) title = 'Lembrete da Chronos';
  return { title, dueAt: due.getTime() };
}

async function showNotification(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker?.ready.catch(() => null);
  if (registration) {
    await registration.showNotification(title, {
      body,
      icon: '/icons/chronos-192.png',
      badge: '/icons/chronos-192.png',
      tag,
      data: { url: '/' },
    });
    return true;
  }
  new Notification(title, { body, icon: '/icons/chronos-192.png', tag });
  return true;
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission === 'default' ? Notification.requestPermission() : Notification.permission;
}

export function initReminderEngine({ ui, getBriefing }) {
  async function check() {
    const now = Date.now();
    let changed = false;
    const reminders = getReminders().map((item) => {
      if (item.completed || item.notifiedAt || item.dueAt > now) return item;
      changed = true;
      showNotification('Chronos', item.title, item.id);
      ui.showToast?.(`Lembrete: ${item.title}`, 'info', 7000);
      return { ...item, notifiedAt: now };
    });
    if (changed) saveReminders(reminders);

    const settings = getReminderSettings();
    if (!settings.dailyBriefing) return;
    const today = localDateKey();
    const [hour, minute] = settings.briefingTime.split(':').map(Number);
    const scheduled = new Date();
    scheduled.setHours(hour || 0, minute || 0, 0, 0);
    if (now >= scheduled.getTime() && settings.lastBriefingDate !== today) {
      const briefing = getBriefing();
      showNotification('Briefing da Chronos', briefing.replace(/\n/g, ' ').slice(0, 220), `briefing-${today}`);
      ui.showToast?.('Seu briefing diário está pronto. Abra o chat e peça "briefing do dia".', 'info', 7000);
      saveReminderSettings({ lastBriefingDate: today });
    }
  }

  check();
  const timer = window.setInterval(check, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  return { check, destroy: () => clearInterval(timer) };
}
