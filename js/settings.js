import { clearMemory, readMemory, replaceMemory } from './memory.js';
import { getVoiceSettings, saveVoiceSettings, speakChronos } from './voice.js';

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

  window.addEventListener('chronos:memory', render);
  render();

  return { render };
}
