import { getReadyMaterials } from './materials-storage.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function trimText(value, limit = 1400) {
  const text = String(value || '').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function buildMaterialBlock(material, index) {
  const analysis = material.analysis || {};
  const keyPoints = Array.isArray(analysis.keyPoints)
    ? analysis.keyPoints.map((point) => `- ${point}`).join('\n')
    : '';
  const questions = Array.isArray(analysis.questions)
    ? analysis.questions.map((question) => `- ${question}`).join('\n')
    : '';
  const studyPlan = Array.isArray(analysis.studyPlan)
    ? analysis.studyPlan.map((item) => `- ${item}`).join('\n')
    : '';

  return [
    `MATERIAL ${index + 1}: ${material.name}`,
    `Tipo: ${material.kind || material.type || 'Arquivo'}`,
    `Resumo: ${trimText(analysis.summary, 1200) || 'Sem resumo.'}`,
    keyPoints ? `Pontos-chave:\n${trimText(keyPoints, 1000)}` : '',
    studyPlan ? `Plano sugerido:\n${trimText(studyPlan, 800)}` : '',
    questions ? `Perguntas:\n${trimText(questions, 800)}` : '',
    analysis.extractedText ? `Trecho extraido:\n${trimText(analysis.extractedText, 1800)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function initMaterialContext() {
  const root = document.getElementById('materialContext');
  const trigger = document.getElementById('btnMaterialContext');
  const count = document.getElementById('materialContextCount');
  const chips = document.getElementById('materialContextChips');
  const menu = document.getElementById('materialContextMenu');
  const list = document.getElementById('materialContextList');
  const empty = document.getElementById('materialContextEmpty');
  const clear = document.getElementById('btnMaterialContextClear');
  const selected = new Set();

  function getSelectedMaterials() {
    const materials = getReadyMaterials();
    return materials.filter((material) => selected.has(material.id));
  }

  function closeMenu() {
    menu?.classList.add('hidden');
  }

  function render() {
    const materials = getReadyMaterials();
    const selectedMaterials = getSelectedMaterials();

    if (count) count.textContent = String(selectedMaterials.length);
    if (empty) empty.classList.toggle('hidden', materials.length > 0);
    root?.classList.toggle('has-selection', selectedMaterials.length > 0);

    if (chips) {
      chips.innerHTML = selectedMaterials
        .map(
          (material) => `
            <button type="button" class="material-context-chip" data-remove-material="${escapeHtml(material.id)}">
              ${escapeHtml(material.name)}
              <span aria-hidden="true">x</span>
            </button>
          `
        )
        .join('');
    }

    if (list) {
      list.innerHTML = materials
        .map(
          (material) => `
            <label class="material-context-option">
              <input type="checkbox" value="${escapeHtml(material.id)}" ${selected.has(material.id) ? 'checked' : ''}>
              <span>
                <strong>${escapeHtml(material.name)}</strong>
                <small>${escapeHtml(material.analysis?.summary || 'Material analisado')}</small>
              </span>
            </label>
          `
        )
        .join('');
    }
  }

  trigger?.addEventListener('click', () => {
    menu?.classList.toggle('hidden');
    render();
  });

  clear?.addEventListener('click', () => {
    selected.clear();
    render();
  });

  chips?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-material]');
    if (!button) return;
    selected.delete(button.dataset.removeMaterial);
    render();
  });

  list?.addEventListener('change', (event) => {
    const input = event.target.closest('input[type="checkbox"]');
    if (!input) return;
    if (input.checked) selected.add(input.value);
    else selected.delete(input.value);
    render();
  });

  document.addEventListener('click', (event) => {
    if (!root?.contains(event.target)) closeMenu();
  });

  window.addEventListener('chronos:materials', render);
  render();

  return {
    render,
    clear: () => {
      selected.clear();
      render();
    },
    getContextText: () => {
      const materials = getSelectedMaterials();
      if (!materials.length) return '';
      return [
        'Contexto de materiais analisados pelo usuario. Use estes dados para responder com precisao e deixe claro quando estiver se baseando neles.',
        ...materials.map(buildMaterialBlock),
      ].join('\n\n');
    },
  };
}
