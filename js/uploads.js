const STORAGE_KEY = 'chronos_materials';
const sessionFiles = new Map();

function readMaterials() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMaterials(materials) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
}

function createId() {
  return `mat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getKind(file) {
  const type = file.type || '';
  const name = file.name.toLowerCase();
  if (type.includes('pdf') || name.endsWith('.pdf')) return 'PDF';
  if (type.startsWith('image/')) return 'Imagem';
  if (name.endsWith('.md')) return 'Markdown';
  if (type.startsWith('text/') || name.endsWith('.txt')) return 'Texto';
  return 'Arquivo';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function materialPrompt(material) {
  return [
    `Tenho um material chamado "${material.name}" (${material.kind}).`,
    'Quero transformar isso em estudo pratico.',
    'Monte um resumo, pontos-chave, plano de revisao e perguntas para eu testar meu entendimento.',
  ].join(' ');
}

export function initUploadsView({ ui, onAskChronos }) {
  const input = document.getElementById('materialInput');
  const list = document.getElementById('materialsList');
  const empty = document.getElementById('materialsEmpty');
  const count = document.getElementById('uploadsCount');

  function render() {
    const materials = readMaterials().sort((a, b) => b.uploadedAt - a.uploadedAt);

    if (count) {
      count.textContent = materials.length === 1 ? '1 material' : `${materials.length} materiais`;
    }

    if (empty) empty.classList.toggle('hidden', materials.length > 0);
    if (!list) return;

    list.innerHTML = materials
      .map(
        (material) => `
          <article class="material-card" data-material-id="${escapeHtml(material.id)}">
            <div class="material-card-main">
              <span class="material-kind">${escapeHtml(material.kind)}</span>
              <h3>${escapeHtml(material.name)}</h3>
              <p>${formatBytes(material.size)} adicionados ${new Date(material.uploadedAt).toLocaleDateString('pt-BR')}</p>
            </div>
            <div class="material-actions">
              <button type="button" class="material-action" data-action="ask">Chat</button>
              <button type="button" class="material-action" data-action="preview">Ver</button>
              <button type="button" class="material-action material-action--danger" data-action="delete">Excluir</button>
            </div>
          </article>
        `
      )
      .join('');
  }

  input?.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const current = readMaterials();
    files.forEach((file) => {
      const id = createId();
      sessionFiles.set(id, file);
      current.push({
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        kind: getKind(file),
        uploadedAt: Date.now(),
      });
    });

    saveMaterials(current);
    input.value = '';
    render();
    ui.showToast?.(files.length === 1 ? 'Material adicionado' : 'Materiais adicionados');
  });

  list?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    const card = event.target.closest('[data-material-id]');
    if (!button || !card) return;

    const materialId = card.dataset.materialId;
    const materials = readMaterials();
    const material = materials.find((item) => item.id === materialId);
    if (!material) return;

    if (button.dataset.action === 'delete') {
      saveMaterials(materials.filter((item) => item.id !== materialId));
      sessionFiles.delete(materialId);
      render();
      ui.showToast?.('Material removido');
      return;
    }

    if (button.dataset.action === 'preview') {
      const file = sessionFiles.get(materialId);
      if (!file) {
        ui.showToast?.('Reabra o arquivo nesta sessao para visualizar novamente.', 'error');
        return;
      }
      window.open(URL.createObjectURL(file), '_blank', 'noopener');
      return;
    }

    if (button.dataset.action === 'ask') {
      onAskChronos?.(materialPrompt(material));
    }
  });

  render();
  return { render };
}
