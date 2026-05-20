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

// ━━━ DOM References ━━━

const elements = {
  // Welcome
  welcomeScreen: document.getElementById('welcomeScreen'),
  btnStart: document.getElementById('btnStart'),

  // App
  app: document.getElementById('app'),

  // Sidebar
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  sidebarChats: document.getElementById('sidebarChats'),
  sidebarEmpty: document.getElementById('sidebarEmpty'),
  btnMenu: document.getElementById('btnMenu'),
  btnNewChat: document.getElementById('btnNewChat'),
  btnClearHistory: document.getElementById('btnClearHistory'),

  // Chat
  chatMessages: document.getElementById('chatMessages'),
  chatMessagesInner: document.getElementById('chatMessagesInner'),
  emptyState: document.getElementById('emptyState'),
  quickActions: document.getElementById('quickActions'),

  // Input
  inputContainer: document.getElementById('inputContainer'),
  messageInput: document.getElementById('messageInput'),
  btnSend: document.getElementById('btnSend'),

  // Settings
  btnSettings: document.getElementById('btnSettings'),

  // Modal
  apiKeyModal: document.getElementById('apiKeyModal'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  btnModalCancel: document.getElementById('btnModalCancel'),
  btnModalSave: document.getElementById('btnModalSave'),

  // Toast
  toast: document.getElementById('toast'),
};

// ━━━ Managers ━━━

const ui = new UIManager(elements);
const chat = new ChatManager(elements);

// ━━━ State ━━━

let currentConversation = null;
let currentAbortController = null;

// ━━━ Initialization ━━━

function init() {
  // Check if user has been welcomed
  if (hasBeenWelcomed()) {
    ui.hideWelcome();
    loadLastConversation();
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

  // No active conversation — show empty state
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
  // Abort any ongoing stream
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

  // Create conversation if needed
  if (!currentConversation) {
    currentConversation = createConversation();
    // Set title from first message
    currentConversation.title =
      trimmedText.length > 50
        ? trimmedText.substring(0, 50) + '...'
        : trimmedText;
  }

  // Hide empty state
  ui.hideEmptyState();

  // Add user message
  const userMessage = {
    role: 'user',
    content: trimmedText,
    timestamp: Date.now(),
  };
  currentConversation.messages.push(userMessage);
  saveConversation(currentConversation);
  refreshChatList();

  // Render user message
  chat.renderMessage(userMessage);
  chat.scrollToBottom();

  // Clear input
  ui.resetInput(elements.messageInput);
  ui.updateSendButton(false);

  // Show typing indicator
  chat.showTypingIndicator();
  ui.setInputDisabled(true);

  // Prepare messages for API (only role + content)
  const apiMessages = currentConversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Start streaming
  chat.removeTypingIndicator();
  chat.startStreaming();

  currentAbortController = sendMessage(
      apiMessages,
      (chunk, _fullText) => {
        chat.appendStreamChunk(chunk);
      },
      (fullText) => {
        chat.finishStreaming(fullText);
        ui.setInputDisabled(false);
        currentAbortController = null;
      },
      (error) => {
        chat.showError(error.message || 'Erro ao conectar com a Chronos AI.');
        ui.setInputDisabled(false);
        currentAbortController = null;
      }
  );
    // onChunk
    (chunk, _fullText) => {
      chat.appendStreamChunk(chunk);
    },
    // onDone
    (fullText) => {
      chat.finishStreaming(fullText);
      ui.setInputDisabled(false);
      currentAbortController = null;

      // Save AI response
      const aiMessage = {
        role: 'assistant',
        content: fullText,
        timestamp: Date.now(),
      };
      currentConversation.messages.push(aiMessage);
      saveConversation(currentConversation);
      refreshChatList();
    },
    // onError
    (errorMsg) =>  {
      ui.showToast(errorMsg, 'error', 5000);
      chat.addMessage('assistant', errorMsg);
      ui.setInputDisabled(false);
      currentAbortController = null;
    }
}

// ━━━ Refresh Sidebar ━━━

function refreshChatList() {
  const conversations = getConversations();
  const activeId = currentConversation?.id || getActiveConversationId();
  ui.renderChatList(conversations, activeId);
}

// ━━━ Event Binding ━━━

function bindEvents() {
  // Welcome — Start button
  elements.btnStart.addEventListener('click', () => {
    setWelcomed();
    ui.hideWelcome();
    loadLastConversation();
    elements.messageInput.focus();
  });

  // Sidebar — Menu toggle
  elements.btnMenu.addEventListener('click', () => ui.toggleSidebar());
  elements.sidebarOverlay.addEventListener('click', () => ui.closeSidebar());

  // Sidebar — New chat
  elements.btnNewChat.addEventListener('click', startNewConversation);

  // Sidebar — Clear history
  elements.btnClearHistory.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar todo o histórico?')) {
      clearAllConversations();
      startNewConversation();
      ui.showToast('Histórico limpo');
    }
  });

  // Sidebar — Click chat item or delete
  elements.sidebarChats.addEventListener('click', (e) => {
    // Delete button
    const deleteBtn = e.target.closest('.chat-item-delete');
    if (deleteBtn) {
      e.stopPropagation();
      const id = deleteBtn.dataset.deleteId;
      deleteConversation(id);

      if (currentConversation?.id === id) {
        startNewConversation();
      }

      refreshChatList();
      return;
    }

    // Chat item click
    const item = e.target.closest('.chat-item');
    if (item) {
      const convo = getConversation(item.dataset.id);
      if (convo) {
        loadConversation(convo);
        ui.closeSidebar();
      }
    }
  });

  // Quick actions (chips)
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

  // Input — typing
  elements.messageInput.addEventListener('input', () => {
    ui.autoResizeInput(elements.messageInput);
    ui.updateSendButton(elements.messageInput.value.trim().length > 0);
  });

  // Input — Enter to send (Shift+Enter for new line)
  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(elements.messageInput.value);
    }
  });

  // Send button
  elements.btnSend.addEventListener('click', () => {
    handleSendMessage(elements.messageInput.value);
  });

  // Settings — API Key modal
  elements.btnSettings.addEventListener('click', () => {
    ui.showApiKeyModal();
  });

  elements.btnModalCancel.addEventListener('click', () => {
    ui.hideApiKeyModal();
  });

  elements.btnModalSave.addEventListener('click', () => {
    const key = ui.getApiKeyFromModal();
    if (key) {
      saveSettings({ apiKey: key });
      ui.hideApiKeyModal();
      ui.showToast('Chave salva com sucesso! ✓');
    } else {
      ui.showToast('Insira uma chave válida', 'error');
    }
  });

  // Modal — Enter to save
  elements.apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      elements.btnModalSave.click();
    }
  });

  // Escape — close modal/sidebar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (elements.apiKeyModal.classList.contains('active')) {
        ui.hideApiKeyModal();
      } else if (elements.sidebar.classList.contains('open')) {
        ui.closeSidebar();
      }
    }
  });
}

// ━━━ Launch ━━━
init();
