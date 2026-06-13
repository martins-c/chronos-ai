const VOICE_KEY = 'chronos_voice_settings';

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

export function speakChronos(text, force = false) {
  if (!('speechSynthesis' in window) || (!force && !readSettings().speakResponses)) return;
  const clean = String(text || '')
    .replace(/[*_`#>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1800);
  if (!clean) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'pt-BR';
  utterance.rate = 1;
  utterance.pitch = 0.95;
  const voice = window.speechSynthesis.getVoices().find((item) => item.lang?.toLowerCase().startsWith('pt-br'));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
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
