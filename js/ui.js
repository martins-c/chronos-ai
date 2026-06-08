// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — UI Manager
//  Sidebar, welcome screen, input effects,
//  chat list, modal, toast
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class UIManager {
  constructor(elements) {
    this.els = elements;
    this._toastTimer = null;
  }

  // ━━━ Welcome Screen ━━━

  showWelcome() {
    this.els.welcomeScreen.classList.remove('hidden');
    this.els.app.classList.remove('active');
    this.els.app.style.display = 'none';
  }

  hideWelcome() {
    this.els.welcomeScreen.classList.add('hidden');
    document.getElementById('earlyAccessScreen')?.style.setProperty('display', 'none');
    this.els.app.style.display = 'flex';
    this.els.app.classList.add('active');
  }

  // ━━━ Sidebar ━━━

  openSidebar() {
    this.els.sidebar.classList.add('open');
    this.els.sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeSidebar() {
    this.els.sidebar.classList.remove('open');
    this.els.sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggleSidebar() {
    if (this.els.sidebar.classList.contains('open')) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  // ━━━ Chat History List ━━━

  renderChatList(conversations, activeId) {
    const container = this.els.sidebarChats;
    const empty = this.els.sidebarEmpty;

    // Remove old chat items (keep empty state)
    container.querySelectorAll('.chat-item').forEach((el) => el.remove());

    if (conversations.length === 0) {
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';

    conversations.forEach((convo) => {
      const item = document.createElement('div');
      item.className = `chat-item${convo.id === activeId ? ' active' : ''}`;
      item.dataset.id = convo.id;

      item.innerHTML = `
        <svg class="chat-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path>
        </svg>
        <span class="chat-item-text" title="${this._escapeHtml(convo.title)}">${this._escapeHtml(convo.title)}</span>
        <button class="chat-item-delete" aria-label="Excluir conversa" data-delete-id="${convo.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

      container.insertBefore(item, empty);
    });
  }

  // ━━━ Empty State ━━━

  showEmptyState() {
    this.els.emptyState.classList.remove('hidden');
  }

  hideEmptyState() {
    this.els.emptyState.classList.add('hidden');
  }

  // ━━━ Input Auto-resize ━━━

  autoResizeInput(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  }

  resetInput(textarea) {
    textarea.value = '';
    textarea.style.height = 'auto';
  }

  // ━━━ Send Button State ━━━

  updateSendButton(hasText) {
    this.els.btnSend.classList.toggle('active', hasText);
  }

  // ━━━ API Key Modal ━━━

  showApiKeyModal() {
    if (!this.els.apiKeyModal || !this.els.apiKeyInput) {
      this.showToast('Configurações de API ainda não estão disponíveis.', 'error');
      return;
    }
    this.els.apiKeyModal.classList.add('active');
    setTimeout(() => this.els.apiKeyInput.focus(), 100);
  }

  hideApiKeyModal() {
    if (!this.els.apiKeyModal || !this.els.apiKeyInput) return;
    this.els.apiKeyModal.classList.remove('active');
    this.els.apiKeyInput.value = '';
  }

  getApiKeyFromModal() {
    if (!this.els.apiKeyInput) return '';
    return this.els.apiKeyInput.value.trim();
  }

  // ━━━ Toast ━━━

  showToast(message, type = 'info', duration = 3500) {
    const toast = this.els.toast;
    toast.textContent = message;
    toast.className = 'toast active';
    if (type === 'error') toast.classList.add('error');

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('active');
    }, duration);
  }

  // ━━━ Disable/Enable Input ━━━

  setInputDisabled(disabled) {
    this.els.messageInput.disabled = disabled;
    this.els.btnSend.disabled = disabled;
    if (disabled) {
      this.els.inputContainer.style.opacity = '0.6';
    } else {
      this.els.inputContainer.style.opacity = '';
      this.els.messageInput.focus();
    }
  }

  // ━━━ Utilities ━━━

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
