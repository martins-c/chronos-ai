// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — Storage Module
//  localStorage persistence for chats & settings
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STORAGE_KEYS = {
  CONVERSATIONS: 'chronos_conversations',
  ACTIVE_CHAT: 'chronos_active_chat',
  SETTINGS: 'chronos_settings',
  WELCOMED: 'chronos_welcomed',
};

// ━━━ Helpers ━━━

function safeGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[Chronos Storage] Falha ao salvar:', e);
  }
}

// ━━━ Conversations ━━━

export function getConversations() {
  return safeGet(STORAGE_KEYS.CONVERSATIONS, []);
}

export function getConversation(id) {
  const convos = getConversations();
  return convos.find((c) => c.id === id) || null;
}

export function saveConversation(conversation) {
  const convos = getConversations();
  const index = convos.findIndex((c) => c.id === conversation.id);

  conversation.updatedAt = Date.now();

  if (index >= 0) {
    convos[index] = conversation;
  } else {
    convos.unshift(conversation);
  }

  safeSet(STORAGE_KEYS.CONVERSATIONS, convos);
}

export function deleteConversation(id) {
  const convos = getConversations().filter((c) => c.id !== id);
  safeSet(STORAGE_KEYS.CONVERSATIONS, convos);

  // If deleted was active, clear active
  if (getActiveConversationId() === id) {
    setActiveConversationId(null);
  }
}

export function clearAllConversations() {
  safeSet(STORAGE_KEYS.CONVERSATIONS, []);
  setActiveConversationId(null);
}

// ━━━ Active Conversation ━━━

export function getActiveConversationId() {
  return safeGet(STORAGE_KEYS.ACTIVE_CHAT, null);
}

export function setActiveConversationId(id) {
  safeSet(STORAGE_KEYS.ACTIVE_CHAT, id);
}

// ━━━ Settings ━━━

const DEFAULT_SETTINGS = {
  apiKey: '',
};

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...safeGet(STORAGE_KEYS.SETTINGS, {}) };
}

export function saveSettings(settings) {
  safeSet(STORAGE_KEYS.SETTINGS, { ...getSettings(), ...settings });
}

// ━━━ Welcome Flag ━━━

export function hasBeenWelcomed() {
  return safeGet(STORAGE_KEYS.WELCOMED, false);
}

export function setWelcomed() {
  safeSet(STORAGE_KEYS.WELCOMED, true);
}

// ━━━ Create New Conversation ━━━

export function createConversation() {
  const conversation = {
    id: generateId(),
    title: 'Nova conversa',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveConversation(conversation);
  setActiveConversationId(conversation.id);
  return conversation;
}

// ━━━ Utilities ━━━

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
