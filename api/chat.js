// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — Vercel Edge Function
//  /api/chat — Proxy para Gemini 2.5 Flash
//  Streaming SSE com chave segura no servidor
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

const MODEL = 'gemini-2.5-flash';

// ━━━ Vercel Edge Runtime ━━━
export const config = {
  runtime: 'nodejs',
};

export default async function handler(req) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // API key from environment variable — never exposed to client
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY não configurada no servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { messages } = await req.json();

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Formato de mensagem inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convert internal format → Gemini format
    // Internal: { role: "user"|"assistant", content: "..." }
    // Gemini:   { role: "user"|"model", parts: [{ text: "..." }] }
    const contents = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const requestBody = {
      contents,
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
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

    // Call Gemini API with SSE streaming
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // Handle Gemini errors
    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || `Erro Gemini ${geminiResponse.status}`;

      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: geminiResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Forward the SSE stream directly to the client
    // The Edge Runtime supports streaming natively via Response(body)
    return new Response(geminiResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno do servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
