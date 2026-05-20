// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — AI Integration Module
//  Google Gemini 2.5 Flash — Streaming API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const SYSTEM_PROMPT = `
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

/**
 * Build the Gemini API URL for streaming.
 * Uses SSE streaming via alt=sse query param.
 */
function buildApiUrl(apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;
}

/**
 * Convert internal message format ({role, content}) to Gemini format.
 *
 * Gemini uses:
 *  - role: "user" | "model"  (no "assistant" or "system")
 *  - parts: [{ text: "..." }]
 *  - system prompt goes in systemInstruction
 */
function toGeminiMessages(messages) {
  return messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));
}

/**
 * Send a message to Gemini and stream the response.
 *
 * @param {Array} messages - Array of {role, content} objects (internal format)
 * @param {string} apiKey - Google AI Studio API key
 * @param {function} onChunk - Called with each text chunk (chunk, fullTextSoFar)
 * @param {function} onDone - Called when stream finishes (full text)
 * @param {function} onError - Called on error (error message string)
 * @returns {AbortController} - Call .abort() to cancel the stream
 */
export function sendMessage(messages, apiKey, onChunk, onDone, onError) {
  const controller = new AbortController();

  const geminiContents = toGeminiMessages(messages);

  const requestBody = {
    contents: geminiContents,
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

  (async () => {
    try {
      const response = await fetch(buildApiUrl(apiKey), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg =
          errorData?.error?.message || `Erro HTTP ${response.status}`;

        if (response.status === 400) {
          // API key format issues or bad request
          if (errorMsg.toLowerCase().includes('api key')) {
            onError('Chave da API inválida. Verifique sua chave do Google AI Studio.');
          } else {
            onError(`Erro na requisição: ${errorMsg}`);
          }
        } else if (response.status === 401 || response.status === 403) {
          onError('Chave da API inválida ou sem permissão. Verifique sua chave do Google AI Studio.');
        } else if (response.status === 429) {
          onError('Limite de requisições atingido. Aguarde alguns segundos e tente novamente.');
        } else if (response.status === 404) {
          onError('Modelo não encontrado. Verifique se o Gemini 2.5 Flash está disponível na sua região.');
        } else {
          onError(errorMsg);
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          // Gemini SSE format: "data: { ... }"
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);

          try {
            const parsed = JSON.parse(data);

            // Extract text from Gemini response structure:
            // { candidates: [{ content: { parts: [{ text: "..." }] } }] }
            const parts = parsed?.candidates?.[0]?.content?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.text) {
                  fullText += part.text;
                  onChunk(part.text, fullText);
                }
              }
            }

            // Check for finish reason
            const finishReason = parsed?.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
              // Safety block or other termination
              if (finishReason === 'SAFETY') {
                onError('A resposta foi bloqueada por filtros de segurança. Tente reformular sua pergunta.');
                return;
              }
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }

      onDone(fullText);
    } catch (err) {
      if (err.name === 'AbortError') return;
      onError(err.message || 'Erro de conexão. Verifique sua internet.');
    }
  })();

  return controller;
}
