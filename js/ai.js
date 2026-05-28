// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — AI Client Module
//  Simple JSON fetch to /api/chat
//  Zero streaming, zero API key no frontend
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Send messages to the server-side API and get AI response.
 * Simple JSON — no streaming, no SSE, no ReadableStream.
 *
 * @param {Array} messages - Array of {role, content} objects
 * @param {function} onChunk - Called with (text, fullText) when response arrives
 * @param {function} onDone - Called with (fullText) when complete
 * @param {function} onError - Called with (errorMessage) on failure
 * @returns {AbortController} - Call .abort() to cancel
 */
export function sendMessage(messages, onChunk, onDone, onError) {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });

      // Parse JSON response
      const data = await response.json();

      // Handle errors
      if (!response.ok) {
        onError(data.error || `Erro ${response.status}`);
        return;
      }

      // Validate content
      if (!data.content) {
        onError('Resposta vazia da IA.');
        return;
      }

      // Deliver response — chat.js char buffer handles the typing effect
      onChunk(data.content, data.content);
      onDone(data.content);
    } catch (err) {
      if (err.name === 'AbortError') return;
      onError(err.message || 'Erro de conexão. Verifique sua internet.');
    }
  })();

  return controller;
}