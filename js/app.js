// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — App Entry Point
//  Initialization, event wiring, coordination
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import {
  getConversations,
  getConversation,
  saveConversation,
  deleteConversation,
  clearAllConversations,
  getActiveConversationId,
  setActiveConversationId,
  getSettings,
  saveSettings,
  hasBeenWelcomed,
  setWelcomed,
  createConversation,
} from './storage.js';

import { sendMessage } from './ai.js';
import { UIManager } from './ui.js';
import { ChatManager } from './chat.js';
import { initFocusMode } from './focus.js';
import { initNavigation } from './navigation.js';
import { initDashboard } from './dashboard.js';
import { initPlanView } from './plan.js';
import { initTasksView } from './tasks.js';

// ━━━ DOM References ━━━

const elements = {
  welcomeScreen: document.getElementById('welcomeScreen'),
  btnStart: document.getElementById('btnStart'),
  app: document.getElementById('app'),
  sidebar: document.getElementById('sidebar'),
  sidebarNav: document.getElementById('sidebarNav'),
  sidebarChatPanel: document.getElementById('sidebarChatPanel'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  sidebarChats: document.getElementById('sidebarChats'),
  sidebarEmpty: document.getElementById('sidebarEmpty'),
  btnMenu: document.getElementById('btnMenu'),
  btnNewChat: document.getElementById('btnNewChat'),
  btnClearHistory: document.getElementById('btnClearHistory'),
  placeholderTitle: document.getElementById('placeholderTitle'),
  placeholderSubtitle: document.getElementById('placeholderSubtitle'),
  chatMessages: document.getElementById('chatMessages'),
  chatMessagesInner: document.getElementById('chatMessagesInner'),
  emptyState: document.getElementById('emptyState'),
  quickActions: document.getElementById('quickActions'),
  inputContainer: document.getElementById('inputContainer'),
  messageInput: document.getElementById('messageInput'),
  btnSend: document.getElementById('btnSend'),
  btnSettings: document.getElementById('btnSettings'),
  btnFocus: document.getElementById('btnFocus'),
  focusOverlay: document.getElementById('focusOverlay'),
  btnFocusClose: document.getElementById('btnFocusClose'),
  focusTimer: document.getElementById('focusTimer'),
  focusTimerLabel: document.getElementById('focusTimerLabel'),
  btnFocusPrimary: document.getElementById('btnFocusPrimary'),
  btnFocusReset: document.getElementById('btnFocusReset'),
  btnFocusFinish: document.getElementById('btnFocusFinish'),
  apiKeyModal: document.getElementById('apiKeyModal'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  btnModalCancel: document.getElementById('btnModalCancel'),
  btnModalSave: document.getElementById('btnModalSave'),
  toast: document.getElementById('toast'),
};

// ━━━ Managers ━━━

const ui = new UIManager(elements);
const chat = new ChatManager(elements);
const focusMode = initFocusMode({ elements, ui });

const planView = initPlanView({ ui });
const tasksView = initTasksView({ ui });

const navigation = initNavigation({
  elements,
  focusMode,
  ui,
  onViewChange: (view) => {
    if (view === 'chat') {
      setTimeout(() => elements.messageInput?.focus(), 150);
    }
    if (view === 'plano') planView.render?.();
    if (view === 'tarefas') tasksView.render?.();
  },
});

initDashboard({ focusMode, navigation });

// ━━━ State ━━━

let currentConversation = null;
let currentAbortController = null;

// ━━━ Initialization ━━━

function init() {
  if (hasBeenWelcomed()) {
    ui.hideWelcome();
    loadLastConversation();
    navigation.setView('home');
  } else {
    ui.showWelcome();
  }

  refreshChatList();
  bindEvents();
}

// ━━━ Load Last Conversation ━━━

function loadLastConversation() {
  const activeId = getActiveConversationId();

  if (activeId) {
    const convo = getConversation(activeId);
    if (convo) {
      loadConversation(convo);
      return;
    }
  }

  currentConversation = null;
  chat.clearMessages();
  ui.showEmptyState();
}

// ━━━ Load Conversation ━━━

function loadConversation(convo) {
  currentConversation = convo;
  setActiveConversationId(convo.id);

  if (convo.messages.length > 0) {
    ui.hideEmptyState();
    chat.renderConversation(convo.messages);
  } else {
    chat.clearMessages();
    ui.showEmptyState();
  }

  refreshChatList();
}

// ━━━ New Conversation ━━━

function startNewConversation() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
    chat.cancelStreaming();
    ui.setInputDisabled(false);
  }

  currentConversation = null;
  chat.clearMessages();
  ui.showEmptyState();
  ui.closeSidebar();
  elements.messageInput.focus();
  refreshChatList();
}

// ━━━ Send Message ━━━

async function handleSendMessage(text) {
  if (!text.trim() || chat.isStreaming) return;

  const trimmedText = text.trim();

  if (!currentConversation) {
    currentConversation = createConversation();
    currentConversation.title =
      trimmedText.length > 50
        ? trimmedText.substring(0, 50) + '...'
        : trimmedText;
  }

  ui.hideEmptyState();

  const userMessage = {
    role: 'user',
    content: trimmedText,
    timestamp: Date.now(),
  };
  currentConversation.messages.push(userMessage);
  saveConversation(currentConversation);
  refreshChatList();

  chat.renderMessage(userMessage);
  chat.scrollToBottom();

  ui.resetInput(elements.messageInput);
  ui.updateSendButton(false);

  chat.showTypingIndicator();
  ui.setInputDisabled(true);

  const apiMessages = currentConversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  chat.removeTypingIndicator();
  chat.startStreaming();

  currentAbortController = sendMessage(
    apiMessages,
    (chunk, _fullText) => {
      chat.appendStreamChunk(chunk);
    },
    (fullText) => {
      const aiMessage = {
        role: 'assistant',
        content: fullText,
        timestamp: Date.now(),
      };
      currentConversation.messages.push(aiMessage);
      saveConversation(currentConversation);
      refreshChatList();

      chat.finishStreaming(fullText);
      ui.setInputDisabled(false);
      currentAbortController = null;
    },
    (errorMsg) => {
      ui.showToast(errorMsg, 'error', 5000);
      ui.setInputDisabled(false);
      currentAbortController = null;
    }
  );
}

// ━━━ Refresh Sidebar ━━━

function refreshChatList() {
  const conversations = getConversations();
  const activeId = currentConversation?.id || getActiveConversationId();
  ui.renderChatList(conversations, activeId);
}

// ━━━ Event Binding ━━━

function bindEvents() {
  elements.btnStart.addEventListener('click', () => {
    setWelcomed();
    ui.hideWelcome();
    loadLastConversation();
    navigation.setView('home');
  });

  elements.sidebarOverlay.addEventListener('click', () => ui.closeSidebar());

  elements.btnNewChat.addEventListener('click', () => {
    navigation.setView('chat');
    startNewConversation();
  });

  elements.btnClearHistory.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar todo o histórico?')) {
      clearAllConversations();
      startNewConversation();
      ui.showToast('Histórico limpo');
    }
  });

  elements.sidebarChats.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.chat-item-delete');
    if (deleteBtn) {
      e.stopPropagation();
      const id = deleteBtn.dataset.deleteId;
      deleteConversation(id);
      if (currentConversation?.id === id) startNewConversation();
      refreshChatList();
      return;
    }

    const item = e.target.closest('.chat-item');
    if (item) {
      const convo = getConversation(item.dataset.id);
      if (convo) {
        navigation.setView('chat');
        loadConversation(convo);
        ui.closeSidebar();
      }
    }
  });

  elements.quickActions.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) {
      const prompt = chip.dataset.prompt;
      if (prompt) {
        elements.messageInput.value = prompt;
        ui.autoResizeInput(elements.messageInput);
        ui.updateSendButton(true);
        handleSendMessage(prompt);
      }
    }
  });

  elements.messageInput.addEventListener('input', () => {
    ui.autoResizeInput(elements.messageInput);
    ui.updateSendButton(elements.messageInput.value.trim().length > 0);
  });

  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(elements.messageInput.value);
    }
  });

  elements.btnSend.addEventListener('click', () => {
    handleSendMessage(elements.messageInput.value);
  });

  elements.btnSettings?.addEventListener('click', () => {
    ui.showApiKeyModal?.();
  });
  
  elements.btnModalCancel?.addEventListener('click', () => {
    ui.hideApiKeyModal?.();
  });
  
  elements.btnModalSave?.addEventListener('click', () => {
    const key = ui.getApiKeyFromModal?.();
    if (key) {
      saveSettings({ apiKey: key });
      ui.hideApiKeyModal?.();
      ui.showToast('Chave salva com sucesso! ✓');
    } else {
      ui.showToast('Insira uma chave válida', 'error');
    }
  });
  
  elements.apiKeyInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') elements.btnModalSave?.click();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (focusMode.isOpen()) {
        focusMode.close();
      } else if (elements.apiKeyModal.classList.contains('active')) {
        ui.hideApiKeyModal();
      } else if (elements.sidebar.classList.contains('open')) {
        ui.closeSidebar();
      }
    }
  });

  // ━━━ Early Access Login ━━━

  const SAVED_USER_KEY = 'chronos_user';
  const earlyAccessScreen = document.getElementById('earlyAccessScreen');
  const enterChronosBtn = document.getElementById('enterChronosBtn');
  const earlyAccessName = document.getElementById('earlyAccessName');
  const appContainer = document.getElementById('app');

  function updateChronosUsername(name) {
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) heroTitle.innerHTML = `Boa noite, ${name} ⚡`;
  }

  function enterChronos(name) {
    const username = name?.trim() || 'Estudante';
    localStorage.setItem(SAVED_USER_KEY, JSON.stringify({ name: username }));
    if (earlyAccessScreen) earlyAccessScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
    document.body.style.overflow = 'auto';
    updateChronosUsername(username);
  }

  function loadChronosUser() {
    const savedUser = localStorage.getItem(SAVED_USER_KEY);
    if (!savedUser) return;
    try {
      const user = JSON.parse(savedUser);
      if (earlyAccessScreen) earlyAccessScreen.style.display = 'none';
      if (appContainer) appContainer.style.display = 'flex';
      updateChronosUsername(user.name);
    } catch (error) {
      console.error(error);
    }
  }

  enterChronosBtn?.addEventListener('click', () => enterChronos(earlyAccessName?.value));
  earlyAccessName?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enterChronos(earlyAccessName.value);
  });

  loadChronosUser();
}

// ━━━ Launch ━━━
init();