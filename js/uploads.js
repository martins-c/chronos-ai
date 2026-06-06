const STORAGE_KEY = 'chronos_materials';
const MAX_FILE_BYTES = 4 * 1024 * 1024;
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

function getMimeType(file) {
  const name = file.name.toLowerCase();
  if (file.type) return file.type;
  if (name.endsWith('.md')) return 'text/markdown';
  if (name.endsWith('.txt')) return 'text/plain';
  if (name.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
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
  if (material.analysis) {
    const points = Array.isArray(material.analysis.keyPoints)
      ? material.analysis.keyPoints.map((point) => `- ${point}`).join('\n')
      : '';
    const questions = Array.isArray(material.analysis.questions)
      ? material.analysis.questions.map((question) => `- ${question}`).join('\n')
      : '';

    return [
      `Analise comigo o material "${material.name}".`,
      '',
      `Resumo extraido:\n${material.analysis.summary || 'Sem resumo disponivel.'}`,
      points ? `\nPontos-chave:\n${points}` : '',
      questions ? `\nPerguntas sugeridas:\n${questions}` : '',
      '',
      'Agora transforme isso em uma explicacao clara, um plano de revisao e um quiz curto para eu praticar.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Tenho um material chamado "${material.name}" (${material.kind}).`,
    material.status === 'error'
      ? `A analise automatica falhou: ${material.error || 'erro desconhecido'}.`
      : 'Ainda nao tenho conteudo extraido desse material.',
    'Quero transformar isso em estudo pratico.',
    'Monte um resumo, pontos-chave, plano de revisao e perguntas para eu testar meu entendimento.',
  ].join(' ');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',').pop() : result);
    };
    reader.onerror = () => reject(new Error('Nao consegui ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

async function analyzeFile(file) {
  const data = await fileToBase64(file);
  const response = await fetch('/api/materials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file: {
        name: file.name,
        mimeType: getMimeType(file),
        size: file.size,
        data,
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Erro ${response.status}`);
  }
  return payload.analysis;
}

function updateMaterial(id, patch) {
  const materials = readMaterials();
  const index = materials.findIndex((item) => item.id === id);
  if (index < 0) return null;
  materials[index] = { ...materials[index], ...patch };
  saveMaterials(materials);
  return materials[index];
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
        (material) => {
          const status = material.status || (material.analysis ? 'ready' : 'pending');
          return `
          <article class="material-card material-card--${escapeHtml(status)}" data-material-id="${escapeHtml(material.id)}">
            <div class="material-card-main">
              <div class="material-card-top">
                <span class="material-kind">${escapeHtml(material.kind)}</span>
                <span class="material-status">${getStatusLabel(material)}</span>
              </div>
              <h3>${escapeHtml(material.name)}</h3>
              <p>${formatBytes(material.size)} adicionados ${new Date(material.uploadedAt).toLocaleDateString('pt-BR')}</p>
              ${material.analysis?.summary ? `<small class="material-summary">${escapeHtml(material.analysis.summary)}</small>` : ''}
              ${material.error ? `<small class="material-error">${escapeHtml(material.error)}</small>` : ''}
            </div>
            <div class="material-actions">
              <button type="button" class="material-action" data-action="ask" ${material.status === 'processing' ? 'disabled' : ''}>Chat</button>
              <button type="button" class="material-action" data-action="preview">Ver</button>
              <button type="button" class="material-action" data-action="retry" ${material.status !== 'error' ? 'hidden' : ''}>Tentar</button>
              <button type="button" class="material-action material-action--danger" data-action="delete">Excluir</button>
            </div>
          </article>
        `;
        }
      )
      .join('');
  }

  function getStatusLabel(material) {
    const labels = {
      processing: 'Analisando',
      ready: 'Pronto',
      error: 'Erro',
      pending: 'Pendente',
    };
    const status = material.status || (material.analysis ? 'ready' : 'pending');
    return labels[status] || 'Pendente';
  }

  async function processMaterial(id, file) {
    try {
      updateMaterial(id, { status: 'processing', error: '', analysis: null });
      render();
      const analysis = await analyzeFile(file);
      updateMaterial(id, { status: 'ready', analysis, processedAt: Date.now() });
      ui.showToast?.('Material analisado');
    } catch (error) {
      updateMaterial(id, { status: 'error', error: error.message || 'Falha ao analisar material.' });
      ui.showToast?.(error.message || 'Falha ao analisar material.', 'error');
    } finally {
      render();
    }
  }

  input?.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const current = readMaterials();
    files.forEach((file) => {
      const id = createId();
      sessionFiles.set(id, file);
      const tooLarge = file.size > MAX_FILE_BYTES;
      current.push({
        id,
        name: file.name,
        type: getMimeType(file),
        size: file.size,
        kind: getKind(file),
        uploadedAt: Date.now(),
        status: tooLarge ? 'error' : 'processing',
        error: tooLarge ? 'Arquivo acima de 4 MB neste preview.' : '',
        analysis: null,
      });
      if (!tooLarge) {
        setTimeout(() => processMaterial(id, file), 50);
      }
    });

    saveMaterials(current);
    input.value = '';
    render();
    ui.showToast?.(files.length === 1 ? 'Material enviado para analise' : 'Materiais enviados para analise');
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

    if (button.dataset.action === 'retry') {
      const file = sessionFiles.get(materialId);
      if (!file) {
        ui.showToast?.('Reabra o arquivo para tentar analisar novamente.', 'error');
        return;
      }
      processMaterial(materialId, file);
      return;
    }

    if (button.dataset.action === 'ask') {
      onAskChronos?.(materialPrompt(material));
    }
  });

  render();
  return { render };
}
