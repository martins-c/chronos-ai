import { requireActiveSession } from './auth.js';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderList(items, className) {
  if (!Array.isArray(items) || !items.length) return '';
  return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderSources(sources) {
  if (!Array.isArray(sources) || !sources.length) {
    return `
      <section class="solver-card">
        <h3>Fontes</h3>
        <p class="solver-muted">Para contas simples, a resolução pode usar raciocínio direto. Quando houver fontes web úteis, elas aparecem aqui.</p>
      </section>
    `;
  }

  return `
    <section class="solver-card">
      <h3>Fontes consultadas</h3>
      <div class="solver-sources">
        ${sources
          .map(
            (source) => `
              <a href="${escapeHtml(source.uri)}" target="_blank" rel="noopener noreferrer">
                <span>${escapeHtml(source.title)}</span>
                <small>${escapeHtml(source.uri)}</small>
              </a>
            `
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderQuiz(quiz) {
  if (!Array.isArray(quiz) || !quiz.length) return '';

  return `
    <section class="solver-card solver-quiz-card">
      <h3>Teste rápido</h3>
      <div class="solver-quiz">
        ${quiz
          .map(
            (item, questionIndex) => `
              <article class="solver-quiz-item" data-question-index="${questionIndex}" data-correct-index="${Number(item.correctIndex) || 0}">
                <strong>${questionIndex + 1}. ${escapeHtml(item.question)}</strong>
                <div class="solver-options">
                  ${(item.options || [])
                    .map(
                      (option, optionIndex) => `
                        <button type="button" class="solver-option" data-option-index="${optionIndex}">
                          ${escapeHtml(option)}
                        </button>
                      `
                    )
                    .join('')}
                </div>
                <p class="solver-feedback hidden">${escapeHtml(item.explanation)}</p>
              </article>
            `
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderSolution(solution, sources) {
  const steps = Array.isArray(solution.steps) ? solution.steps : [];

  return `
    <section class="solver-hero-result">
      <span>${escapeHtml(solution.subject || 'Estudo')} · ${escapeHtml(solution.level || 'nível adaptado')}</span>
      <h2>${escapeHtml(solution.title)}</h2>
      <p>${escapeHtml(solution.finalAnswer)}</p>
    </section>

    <section class="solver-card">
      <h3>Explicação do conteúdo</h3>
      <p>${escapeHtml(solution.conceptExplanation)}</p>
    </section>

    <section class="solver-card">
      <h3>Passo a passo</h3>
      <div class="solver-steps">
        ${steps
          .map(
            (step, index) => `
              <article class="solver-step">
                <span>${index + 1}</span>
                <div>
                  <strong>${escapeHtml(step.title)}</strong>
                  <p>${escapeHtml(step.body)}</p>
                </div>
              </article>
            `
          )
          .join('')}
      </div>
    </section>

    ${
      solution.formulas?.length || solution.commonMistakes?.length
        ? `
          <section class="solver-grid">
            <article class="solver-card">
              <h3>Fórmulas úteis</h3>
              ${renderList(solution.formulas, 'solver-list')}
            </article>
            <article class="solver-card">
              <h3>Erros comuns</h3>
              ${renderList(solution.commonMistakes, 'solver-list')}
            </article>
          </section>
        `
        : ''
    }

    ${renderQuiz(solution.quiz)}
    ${renderSources(sources)}
  `;
}

export function initSolverView({ ui }) {
  const form = document.getElementById('solverForm');
  const question = document.getElementById('solverQuestion');
  const subject = document.getElementById('solverSubject');
  const level = document.getElementById('solverLevel');
  const submit = document.getElementById('solverSubmit');
  const loading = document.getElementById('solverLoading');
  const result = document.getElementById('solverResult');

  function setLoading(isLoading) {
    submit.disabled = isLoading;
    submit.textContent = isLoading ? 'Resolvendo...' : 'Resolver agora';
    loading?.classList.toggle('hidden', !isLoading);
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = question?.value?.trim();
    if (!text) {
      ui.showToast?.('Digite uma questão para resolver.', 'error');
      question?.focus();
      return;
    }

    setLoading(true);
    result?.classList.add('hidden');

    try {
      const response = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          subject: subject?.value || '',
          level: level?.value || '',
        }),
      });
      if (requireActiveSession(response)) return;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Erro ${response.status}`);

      result.innerHTML = renderSolution(payload.solution, payload.sources);
      result.classList.remove('hidden');
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      ui.showToast?.(error.message || 'Nao consegui resolver agora.', 'error');
    } finally {
      setLoading(false);
    }
  });

  result?.addEventListener('click', (event) => {
    const option = event.target.closest('.solver-option');
    if (!option) return;

    const item = option.closest('.solver-quiz-item');
    const correctIndex = Number(item.dataset.correctIndex);
    const selectedIndex = Number(option.dataset.optionIndex);
    const buttons = item.querySelectorAll('.solver-option');

    buttons.forEach((button) => {
      const index = Number(button.dataset.optionIndex);
      button.disabled = true;
      button.classList.toggle('is-correct', index === correctIndex);
      button.classList.toggle('is-wrong', index === selectedIndex && index !== correctIndex);
    });

    const feedback = item.querySelector('.solver-feedback');
    feedback?.classList.remove('hidden');
  });

  return {
    render: () => {},
  };
}
