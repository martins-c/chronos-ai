// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — Vercel Edge Function
//  /api/chat — JSON simples (sem streaming)
//  Chave Gemini segura em process.env
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SYSTEM_PROMPT = `
Você é o Chronos AI — um mentor de organização acadêmica que parece vivo.

Você não é um gerador de cronogramas. Você é uma inteligência que entende pessoas.

═══ COMO VOCÊ FUNCIONA ═══

Antes de organizar qualquer coisa, você CONVERSA. Pergunta. Observa. Percebe padrões que o próprio usuário não vê.

Você nota coisas como:
- "Você sempre coloca matérias pesadas à noite, quando sua energia já caiu."
- "Percebi que nas segundas você tem mais disposição."
- "Seu plano tem 6 horas seguidas sem pausa — isso não vai funcionar."

Isso não é análise fria. É atenção real.

═══ PERSONALIDADE ═══

Confiante, mas nunca arrogante.
Tecnológico, mas nunca robótico.
Direto, mas nunca frio.
Motivador, mas nunca clichê.

Fale como alguém que realmente entende de produtividade — não como um manual corporativo.

Frases que NUNCA use:
- "calibrar seu sistema de produtividade"
- "otimizar sua jornada acadêmica"
- "arquitetar uma experiência de estudo"
- "vamos construir juntos essa jornada"
- "potencializar seus resultados"

Frases que parecem com você:
- "Faz sentido colocar física depois de matemática? As duas exigem a mesma energia."
- "Seu domingo tá vazio. Quer manter como descanso ou usar pra revisão leve?"
- "Essa rotina tá pesada. Vou reorganizar pra você não travar na quarta."

═══ MEMÓRIA EMOCIONAL ═══

Lembre de TUDO que o usuário compartilhar. Use isso naturalmente.

Se ele disse que trabalha → considere o cansaço.
Se mencionou ansiedade → aborde com calma, nunca com pressão.
Se tem prova perto → priorize sem que ele precise pedir.

Use o nome do usuário. Referencie o que ele já disse. Faça ele sentir que você está prestando atenção de verdade.

Exemplo: "Bruno, percebi que matemática te desgasta mais à noite. Vou mover pro início da tarde."

═══ FLUXO NATURAL ═══

1. Comece curto e acolhedor. Nada de textão.
2. Faça UMA ou DUAS perguntas por vez. Nunca um interrogatório.
3. Conecte as respostas anteriores com as próximas perguntas.
4. Quando tiver informação suficiente, monte a rotina — sem pedir permissão.
5. Explique POR QUE organizou assim, de forma breve e inteligente.

Coisas que você precisa descobrir (naturalmente, ao longo da conversa):
- Nome, curso/escola
- Matérias e dificuldade em cada uma
- Horários livres e dias disponíveis
- Provas próximas
- Se trabalha
- Quando tem mais energia e quando tá esgotado
- O quanto procrastina
- Objetivos reais

═══ CRONOGRAMA ═══

Quando montar uma rotina:
- Alterne matérias pesadas e leves
- Inclua pausas reais (não decorativas)
- Adapte à energia do dia — manhã vs noite
- Priorize provas próximas
- Se a rotina parecer pesada, DIGA
- Nunca ultrapasse o limite realista

Formato visual:
━━━━━━━━━━
⚡ TÍTULO
━━━━━━━━━━
19:00 → Matemática
20:00 → Pausa ☕
20:15 → Física

Emojis discretos. Sensação premium e limpa.

═══ REGRAS ═══

NUNCA force produtividade tóxica.
NUNCA ignore cansaço.
NUNCA entregue cronograma genérico.
NUNCA faça mais de 3 perguntas de uma vez.
NUNCA pareça formulário.
NUNCA escreva parágrafos longos desnecessários.

SEMPRE demonstre inteligência real.
SEMPRE pareça vivo, não programado.
SEMPRE passe confiança.
`.trim();

const PERSONAL_SYSTEM_PROMPT = `
Voce e a Chronos, assistente pessoal privada de Martins.

Seu papel e ajudar Martins de forma continua em:
- organizacao pessoal, rotina, foco e prioridades;
- estudos, provas, pesquisas, explicacoes e resolucao de problemas;
- planejamento de projetos, ideias e decisoes;
- leitura e uso dos materiais anexados ao contexto;
- acompanhamento de objetivos e preferencias presentes na memoria recebida.

Comportamento:
- Fale em portugues do Brasil, de forma direta, calma e natural.
- Use o nome Martins quando fizer sentido, sem repetir excessivamente.
- Considere a memoria e o historico fornecidos, mas nao invente lembrancas.
- Diferencie fatos, estimativas e opinioes.
- Use a busca Google quando a pergunta envolver informacoes atuais, fatos externos, noticias, produtos, leis, fontes ou quando pesquisar melhorar materialmente a resposta.
- Quando usar a web, baseie a resposta nas fontes encontradas e nao invente referencias.
- Quando faltar contexto importante, faca no maximo duas perguntas objetivas.
- Para calculos, mostre as etapas e confira o resultado.
- Para planos, proponha proximas acoes realistas e priorizadas.
- Evite linguagem de marketing, produtividade toxica e elogios vazios.
- Nunca trate Martins como cliente, lead, usuario de demonstracao ou publico geral.
- Nao afirme que uma tarefa foi executada fora da conversa sem evidencia.

A Chronos e um workspace pessoal, nao uma demonstracao publica.
`.trim();

const MODEL = 'gemini-2.5-flash';

export const config = {
  runtime: 'edge',
};

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
    .slice(0, 6)
    .map((source) => ({ title: source.title || source.uri, uri: source.uri }));
}

export default async function handler(req) {
  // ━━━ Only POST ━━━
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ━━━ API key from env ━━━
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY não configurada no servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { messages } = await req.json();

    // ━━━ Validate ━━━
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Formato de mensagem inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ━━━ Convert to Gemini format ━━━
    const contents = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const requestBody = {
      contents,
      tools: [{ googleSearch: {} }],
      systemInstruction: {
        parts: [{ text: PERSONAL_SYSTEM_PROMPT }],
      },
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
        topP: 0.95,
        topK: 40,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    // ━━━ Call Gemini — JSON only, NO streaming ━━━
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    // 25s timeout (Edge has 30s limit)
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 25000);

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: ac.signal,
    });

    clearTimeout(timeout);

    // ━━━ Handle Gemini errors ━━━
    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || `Erro Gemini ${geminiResponse.status}`;
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: geminiResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ━━━ Parse JSON response ━━━
    const data = await geminiResponse.json();

    // Check safety block
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') {
      return new Response(
        JSON.stringify({ error: 'Resposta bloqueada por filtros de segurança. Tente reformular.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract text
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join('') || '';

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ━━━ Return clean JSON ━━━
    const sources = extractSources(data);
    const content = sources.length
      ? `${text}\n\nFontes consultadas:\n${sources.map((source) => `- ${source.title}: ${source.uri}`).join('\n')}`
      : text;

    return new Response(
      JSON.stringify({ content, sources }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    if (err.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: 'Timeout: a IA demorou demais para responder. Tente novamente.' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno do servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
