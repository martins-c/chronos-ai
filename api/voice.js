const DEFAULT_ADAM_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';
const MODEL = 'eleven_multilingual_v2';

export const config = { runtime: 'edge' };

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return json({ error: 'ElevenLabs nao configurado.' }, 503);

  try {
    const { text } = await req.json();
    const cleanText = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1400);
    if (!cleanText) return json({ error: 'Texto vazio.' }, 400);

    const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_ADAM_VOICE_ID;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: MODEL,
          language_code: 'pt',
          voice_settings: {
            stability: 0.42,
            similarity_boost: 0.82,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return json({ error: error?.detail?.message || error?.detail || `Erro ElevenLabs ${response.status}` }, response.status);
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error.name === 'AbortError') return json({ error: 'A voz demorou demais para responder.' }, 504);
    return json({ error: error.message || 'Erro ao gerar voz.' }, 500);
  }
}
