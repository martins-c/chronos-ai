const MODEL = 'gemini-2.5-flash';
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/markdown',
];

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

function parseAnalysis(text) {
  const cleaned = cleanJsonText(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      title: 'Material analisado',
      summary: cleaned.slice(0, 1200),
      keyPoints: [],
      studyPlan: [],
      questions: [],
      extractedText: cleaned,
    };
  }
}

function normalizeAnalysis(raw, fallbackTitle) {
  return {
    title: String(raw.title || fallbackTitle || 'Material analisado').slice(0, 120),
    summary: String(raw.summary || '').slice(0, 2000),
    keyPoints: Array.isArray(raw.keyPoints) ? raw.keyPoints.map(String).slice(0, 8) : [],
    studyPlan: Array.isArray(raw.studyPlan) ? raw.studyPlan.map(String).slice(0, 6) : [],
    questions: Array.isArray(raw.questions) ? raw.questions.map(String).slice(0, 8) : [],
    extractedText: String(raw.extractedText || '').slice(0, 8000),
  };
}

function createPrompt(fileName, mimeType) {
  return `
Voce e o Chronos AI analisando um material de estudo enviado pelo usuario.

Arquivo: ${fileName}
Tipo: ${mimeType}

Leia o conteudo do arquivo. Se for imagem, faca OCR e descreva apenas o que ajuda no estudo. Se for PDF, extraia os pontos centrais. Se alguma parte estiver ilegivel, diga isso sem inventar.

Responda somente em JSON valido, sem markdown, neste formato:
{
  "title": "titulo curto do material",
  "summary": "resumo objetivo em portugues",
  "keyPoints": ["ponto importante"],
  "studyPlan": ["acao de estudo pratica"],
  "questions": ["pergunta de revisao"],
  "extractedText": "texto/conteudo relevante extraido, resumido quando for muito longo"
}
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
    const { file } = await req.json();

    if (!file?.name || !file?.mimeType || !file?.data) {
      return json({ error: 'Arquivo invalido.' }, 400);
    }

    if (Number(file.size) > MAX_FILE_BYTES) {
      return json({ error: 'Arquivo muito grande. Envie arquivos de ate 4 MB neste preview.' }, 413);
    }

    if (!ALLOWED_TYPES.includes(file.mimeType) && !file.mimeType.startsWith('image/')) {
      return json({ error: 'Tipo de arquivo nao suportado.' }, 415);
    }

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: file.mimeType,
                data: file.data,
              },
            },
            { text: createPrompt(file.name, file.mimeType) },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 25000);
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
      return json({ error: 'Nao consegui extrair conteudo deste material.' }, 422);
    }

    const analysis = normalizeAnalysis(parseAnalysis(text), file.name);
    return json({ analysis });
  } catch (err) {
    if (err.name === 'AbortError') {
      return json({ error: 'Analise demorou demais. Tente um arquivo menor.' }, 504);
    }
    return json({ error: err.message || 'Erro interno ao analisar material.' }, 500);
  }
}
