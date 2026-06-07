import { clearMemory, readMemory, replaceMemory } from './memory.js';

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

  window.addEventListener('chronos:memory', render);
  render();

  return { render };
}
