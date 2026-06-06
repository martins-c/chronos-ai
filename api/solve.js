const MODEL = 'gemini-2.5-flash';

export const config = {
  runtime: 'edge',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function cleanJsonText(text) {
  return String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function asArray(value, limit = 12) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function normalizeSolution(raw, fallbackTitle) {
  return {
    title: String(raw.title || fallbackTitle || 'Resolucao guiada').slice(0, 140),
    subject: String(raw.subject || 'Geral').slice(0, 80),
    level: String(raw.level || '').slice(0, 60),
    finalAnswer: String(raw.finalAnswer || '').slice(0, 1600),
    conceptExplanation: String(raw.conceptExplanation || '').slice(0, 3000),
    steps: asArray(raw.steps, 10).map((step, index) => ({
      title: String(step?.title || `Passo ${index + 1}`).slice(0, 100),
      body: String(step?.body || step || '').slice(0, 1800),
    })),
    formulas: asArray(raw.formulas, 8).map(String),
    commonMistakes: asArray(raw.commonMistakes, 6).map(String),
    quiz: asArray(raw.quiz, 6).map((item) => ({
      question: String(item?.question || '').slice(0, 500),
      options: asArray(item?.options, 5).map(String),
      correctIndex: Math.max(0, Math.min(Number(item?.correctIndex) || 0, 4)),
      explanation: String(item?.explanation || '').slice(0, 900),
    })),
    sourceSummary: String(raw.sourceSummary || '').slice(0, 1200),
  };
}

function parseSolution(text, fallbackTitle) {
  try {
    return normalizeSolution(JSON.parse(cleanJsonText(text)), fallbackTitle);
  } catch {
    return normalizeSolution(
      {
        title: fallbackTitle,
        finalAnswer: text,
        conceptExplanation: text,
        steps: [{ title: 'Resolucao', body: text }],
        quiz: [],
      },
      fallbackTitle
    );
  }
}

function extractSources(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set();
  return chunks
    .map((chunk) => chunk.web || chunk.retrievedContext || {})
    .filter((source) => source.uri)
    .filter((source) => {
      if (seen.has(source.uri)) return false;
      seen.add(source.uri);
      return true;
    })
    .slice(0, 8)
    .map((source) => ({
      title: source.title || source.uri,
      uri: source.uri,
    }));
}

function buildPrompt({ question, subject, level }) {
  return `
Voce e o Chronos AI em modo resolvedor escolar.

Tarefa do usuario:
${question}

Materia indicada: ${subject || 'nao informada'}
Nivel: ${level || 'adaptar ao problema'}

Use conhecimento matematico, cientifico e educacional confiavel. Quando o tema depender de fatos, definicoes ou dados externos, use fontes da web via Google Search grounding. Para calculos, resolva com rigor, mostre as etapas e confira a resposta.

Responda em portugues do Brasil e somente em JSON valido, sem markdown fora do JSON:
{
  "title": "titulo curto",
  "subject": "materia",
  "level": "nivel estimado",
  "finalAnswer": "resposta final objetiva",
  "conceptExplanation": "explicacao do conteudo antes da resolucao",
  "steps": [
    { "title": "Passo 1", "body": "como resolver este passo" }
  ],
  "formulas": ["formula usada, se houver"],
  "commonMistakes": ["erro comum que o aluno deve evitar"],
  "quiz": [
    {
      "question": "questao curta para testar entendimento",
      "options": ["alternativa A", "alternativa B", "alternativa C", "alternativa D"],
      "correctIndex": 0,
      "explanation": "por que a correta esta certa e as outras nao"
    }
  ],
  "sourceSummary": "resumo breve das fontes consultadas"
}

Regras:
- Gere de 3 a 5 questoes no quiz.
- Cada questao deve ter exatamente 4 alternativas.
- correctIndex e baseado em zero.
- Se a pergunta original for uma conta, inclua verificacao da resposta.
- Se nao houver fonte web util para uma conta simples, explique que a resolucao usa raciocinio matematico direto.
- Nao invente fonte. As fontes clicaveis serao extraidas dos metadados de grounding.
`.trim();
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Metodo nao permitido' }, 405);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: 'GEMINI_API_KEY nao configurada no servidor.' }, 500);
  }

  try {
    const { question, subject, level } = await req.json();
    const trimmedQuestion = String(question || '').trim();

    if (trimmedQuestion.length < 3) {
      return json({ error: 'Digite uma questao ou problema para resolver.' }, 400);
    }

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: buildPrompt({ question: trimmedQuestion, subject, level }) }],
        },
      ],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 28000);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: ac.signal,
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return json(
        { error: errorData?.error?.message || `Erro Gemini ${response.status}` },
        response.status
      );
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .filter(Boolean)
        .join('') || '';

    if (!text) {
      return json({ error: 'Nao consegui gerar uma resolucao para esse problema.' }, 422);
    }

    return json({
      solution: parseSolution(text, trimmedQuestion.slice(0, 80)),
      sources: extractSources(data),
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return json({ error: 'A resolucao demorou demais. Tente dividir o problema.' }, 504);
    }
    return json({ error: err.message || 'Erro interno ao resolver problema.' }, 500);
  }
}
