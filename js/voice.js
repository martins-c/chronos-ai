const VOICE_KEY = 'chronos_voice_settings';
let currentAudio = null;
let currentAudioUrl = '';

function readSettings() {
  try {
    return { speakResponses: false, ...JSON.parse(localStorage.getItem(VOICE_KEY) || '{}') };
  } catch {
    return { speakResponses: false };
  }
}

export function getVoiceSettings() {
  return readSettings();
}

export function saveVoiceSettings(patch) {
  localStorage.setItem(VOICE_KEY, JSON.stringify({ ...readSettings(), ...patch }));
}

function stopCurrentVoice() {
  window.speechSynthesis?.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = '';
  }
}

function speakWithDevice(clean) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'pt-BR';
  utterance.rate = 0.98;
  utterance.pitch = 0.92;
  const voice = window.speechSynthesis.getVoices().find((item) => item.lang?.toLowerCase().startsWith('pt-br'));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export async function speakChronos(text, force = false) {
  if (!force && !readSettings().speakResponses) return;
  const clean = String(text || '')
    .replace(/[*_`#>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1800);
  if (!clean) return;

  stopCurrentVoice();
  try {
    const response = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean }),
    });
    if (!response.ok) throw new Error(`Voice ${response.status}`);
    const blob = await response.blob();
    currentAudioUrl = URL.createObjectURL(blob);
    currentAudio = new Audio(currentAudioUrl);
    currentAudio.onended = stopCurrentVoice;
    currentAudio.onerror = () => {
      stopCurrentVoice();
      speakWithDevice(clean);
    };
    await currentAudio.play();
  } catch {
    stopCurrentVoice();
    speakWithDevice(clean);
  }
}

export function initVoiceInput({ button, input, ui, onTranscript }) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!button) return;
  if (!Recognition) {
    button.hidden = true;
    return;
  }

  const recognition = new Recognition();
  recognition.lang = 'pt-BR';
  recognition.interimResults = true;
  recognition.continuous = false;
  let listening = false;

  function setListening(value) {
    listening = value;
    button.classList.toggle('is-listening', value);
    button.setAttribute('aria-label', value ? 'Parar de ouvir' : 'Falar com a Chronos');
    input.placeholder = value ? 'Ouvindo...' : 'Digite ou fale com a Chronos...';
  }

  button.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
    } catch {
      ui.showToast?.('O microfone ainda esta iniciando.', 'error');
    }
  });

  recognition.onstart = () => setListening(true);
  recognition.onend = () => setListening(false);
  recognition.onerror = (event) => {
    setListening(false);
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      ui.showToast?.('Nao consegui acessar ou entender o microfone.', 'error');
    }
  };
  recognition.onresult = (event) => {
    let transcript = '';
    let finalResult = false;
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript;
      finalResult ||= event.results[index].isFinal;
    }
    input.value = transcript.trim();
    ui.autoResizeInput(input);
    ui.updateSendButton(Boolean(input.value));
    if (finalResult && input.value) onTranscript(input.value);
  };
}
