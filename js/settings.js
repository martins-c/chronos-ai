import { clearMemory, readMemory, replaceMemory } from './memory.js';
import { getVoiceSettings, saveVoiceSettings, speakChronos } from './voice.js';
import {
  addReminder,
  completeReminder,
  deleteReminder,
  formatReminderDate,
  getReminderSettings,
  getReminders,
  requestNotificationPermission,
  saveReminderSettings,
} from './reminders.js';

function toText(items) {
  return Array.isArray(items) ? items.join('\n') : '';
}

function fromText(value) {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function initSettingsView({ ui }) {
  const form = document.getElementById('memoryForm');
  const clearBtn = document.getElementById('memoryClear');
  const updated = document.getElementById('memoryUpdatedAt');
  const exportBtn = document.getElementById('personalDataExport');
  const importBtn = document.getElementById('personalDataImport');
  const importFile = document.getElementById('personalDataFile');
  const logoutBtn = document.getElementById('privateLogout');
  const installBtn = document.getElementById('pwaInstall');
  const speakResponses = document.getElementById('voiceSpeakResponses');
  const testVoice = document.getElementById('voiceTest');
  const notificationPermission = document.getElementById('notificationPermission');
  const reminderTitle = document.getElementById('reminderTitle');
  const reminderDueAt = document.getElementById('reminderDueAt');
  const reminderAdd = document.getElementById('reminderAdd');
  const reminderList = document.getElementById('reminderList');
  const reminderEmpty = document.getElementById('reminderEmpty');
  const dailyBriefingEnabled = document.getElementById('dailyBriefingEnabled');
  const dailyBriefingTime = document.getElementById('dailyBriefingTime');
  let installPrompt = null;
  const fields = {
    name: document.getElementById('memoryName'),
    course: document.getElementById('memoryCourse'),
    goals: document.getElementById('memoryGoals'),
    routine: document.getElementById('memoryRoutine'),
    subjects: document.getElementById('memorySubjects'),
    exams: document.getElementById('memoryExams'),
    preferences: document.getElementById('memoryPreferences'),
    notes: document.getElementById('memoryNotes'),
  };

  function render() {
    const memory = readMemory();
    if (fields.name) fields.name.value = memory.profile?.name || '';
    if (fields.course) fields.course.value = memory.profile?.course || '';
    if (fields.goals) fields.goals.value = toText(memory.goals);
    if (fields.routine) fields.routine.value = toText(memory.routine);
    if (fields.subjects) fields.subjects.value = toText(memory.subjects);
    if (fields.exams) fields.exams.value = toText(memory.exams);
    if (fields.preferences) fields.preferences.value = toText(memory.preferences);
    if (fields.notes) fields.notes.value = toText(memory.conversationNotes);
    if (updated) {
      updated.textContent = memory.updatedAt
        ? `Atualizada ${new Date(memory.updatedAt).toLocaleString('pt-BR')}`
        : 'Sem memória salva ainda';
    }
    if (speakResponses) speakResponses.checked = getVoiceSettings().speakResponses;
    const reminderSettings = getReminderSettings();
    if (dailyBriefingEnabled) dailyBriefingEnabled.checked = reminderSettings.dailyBriefing;
    if (dailyBriefingTime) dailyBriefingTime.value = reminderSettings.briefingTime;
    if (notificationPermission && 'Notification' in window) {
      const labels = { granted: 'Notificações ativas', denied: 'Notificações bloqueadas', default: 'Ativar notificações' };
      notificationPermission.textContent = labels[Notification.permission];
      notificationPermission.disabled = Notification.permission === 'granted';
    }
    renderReminders();
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value || '');
    return div.innerHTML;
  }

  function renderReminders() {
    if (!reminderList) return;
    const items = getReminders().filter((item) => !item.completed);
    reminderEmpty?.classList.toggle('hidden', items.length > 0);
    reminderList.innerHTML = items.map((item) => `
      <article class="reminder-item${item.dueAt <= Date.now() ? ' is-overdue' : ''}" data-reminder-id="${item.id}">
        <div><strong>${escapeHtml(item.title)}</strong><span>${formatReminderDate(item.dueAt)}</span></div>
        <div class="reminder-actions">
          <button type="button" data-action="complete" aria-label="Concluir lembrete">Concluir</button>
          <button type="button" data-action="delete" aria-label="Excluir lembrete">Excluir</button>
        </div>
      </article>
    `).join('');
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    replaceMemory({
      profile: {
        name: fields.name?.value.trim() || '',
        course: fields.course?.value.trim() || '',
      },
      goals: fromText(fields.goals?.value),
      routine: fromText(fields.routine?.value),
      subjects: fromText(fields.subjects?.value),
      exams: fromText(fields.exams?.value),
      preferences: fromText(fields.preferences?.value),
      conversationNotes: fromText(fields.notes?.value),
    });
    render();
    ui.showToast?.('Memória atualizada');
  });

  clearBtn?.addEventListener('click', () => {
    if (!confirm('Limpar toda a memória salva neste navegador?')) return;
    clearMemory();
    render();
    ui.showToast?.('Memória limpa');
  });

  exportBtn?.addEventListener('click', () => {
    const data = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('chronos_')) data[key] = localStorage.getItem(key);
    }

    const blob = new Blob(
      [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chronos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    ui.showToast?.('Backup exportado');
  });

  importBtn?.addEventListener('click', () => importFile?.click());

  importFile?.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    if (!file) return;

    try {
      const backup = JSON.parse(await file.text());
      if (!backup?.data || typeof backup.data !== 'object') {
        throw new Error('Arquivo de backup inválido.');
      }

      Object.entries(backup.data).forEach(([key, value]) => {
        if (key.startsWith('chronos_') && typeof value === 'string') {
          localStorage.setItem(key, value);
        }
      });
      ui.showToast?.('Backup restaurado. Recarregando...');
      setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      ui.showToast?.(error.message || 'Não consegui restaurar o backup.', 'error');
    } finally {
      importFile.value = '';
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } finally {
      window.location.replace('/login.html');
    }
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    if (installBtn) installBtn.hidden = false;
  });

  installBtn?.addEventListener('click', async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    installPrompt = null;
    installBtn.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    if (installBtn) installBtn.hidden = true;
    ui.showToast?.('Chronos instalada');
  });

  speakResponses?.addEventListener('change', () => {
    saveVoiceSettings({ speakResponses: speakResponses.checked });
    ui.showToast?.(speakResponses.checked ? 'Respostas por voz ativadas' : 'Respostas por voz desativadas');
  });

  testVoice?.addEventListener('click', () => {
    speakChronos('Chronos online. Sistema de voz funcionando.', true);
  });

  notificationPermission?.addEventListener('click', async () => {
    const permission = await requestNotificationPermission();
    render();
    ui.showToast?.(
      permission === 'granted' ? 'Notificações ativadas' : 'Permissão de notificações não concedida',
      permission === 'granted' ? 'info' : 'error'
    );
  });

  reminderAdd?.addEventListener('click', () => {
    const title = reminderTitle?.value.trim();
    const dueAt = reminderDueAt?.value ? new Date(reminderDueAt.value).getTime() : NaN;
    if (!title || !Number.isFinite(dueAt) || dueAt <= Date.now()) {
      ui.showToast?.('Informe um lembrete e uma data futura.', 'error');
      return;
    }
    addReminder(title, dueAt);
    reminderTitle.value = '';
    reminderDueAt.value = '';
    ui.showToast?.('Lembrete criado');
    renderReminders();
  });

  reminderList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    const item = event.target.closest('[data-reminder-id]');
    if (!button || !item) return;
    if (button.dataset.action === 'complete') completeReminder(item.dataset.reminderId);
    if (button.dataset.action === 'delete') deleteReminder(item.dataset.reminderId);
    renderReminders();
  });

  dailyBriefingEnabled?.addEventListener('change', () => {
    saveReminderSettings({ dailyBriefing: dailyBriefingEnabled.checked });
    ui.showToast?.(dailyBriefingEnabled.checked ? 'Briefing diário ativado' : 'Briefing diário desativado');
  });

  dailyBriefingTime?.addEventListener('change', () => {
    saveReminderSettings({ briefingTime: dailyBriefingTime.value || '08:00', lastBriefingDate: '' });
    ui.showToast?.('Horário do briefing atualizado');
  });

  window.addEventListener('chronos:memory', render);
  window.addEventListener('chronos:reminders', renderReminders);
  render();

  return { render };
}
