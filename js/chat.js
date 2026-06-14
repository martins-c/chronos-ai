// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — Chat Manager
//  Message rendering, alive streaming,
//  typing indicator, scroll management
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class ChatManager {
  constructor(elements) {
    this.els = elements;
    this.isStreaming = false;
    this._streamingBubble = null;
    this._streamingEl = null;
    this._fullStreamedText = '';
    this._charQueue = [];
    this._drainRAF = null;
  }

  // ━━━ Render a single message ━━━

  renderMessage(message, animate = true) {
    const el = document.createElement('div');
    el.className = `message message-${message.role === 'assistant' ? 'ai' : 'user'}`;

    if (!animate) {
      el.style.animation = 'none';
      el.style.opacity = '1';
    }

    const avatarContent =
      message.role === 'assistant' ? '⚡' : this._getUserInitial();

    el.innerHTML = `
      <div class="message-avatar">${avatarContent}</div>
      <div class="message-content">
        <div class="message-bubble">${this._formatContent(message.content)}</div>
        <div class="message-time">${this._formatTime(message.timestamp)}</div>
      </div>
    `;

    this.els.chatMessagesInner.appendChild(el);
    return el;
  }

  // ━━━ Render all messages for a conversation ━━━

  renderConversation(messages) {
    this.clearMessages();
    messages.forEach((msg) => this.renderMessage(msg, false));
    this.scrollToBottom(false);
  }

  // ━━━ Clear messages ━━━

  clearMessages() {
    const messages = this.els.chatMessagesInner.querySelectorAll(
      '.message, .typing-indicator'
    );
    messages.forEach((el) => el.remove());
  }

  // ━━━ Typing Indicator ━━━

  showTypingIndicator() {
    this.removeTypingIndicator();

    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typingIndicator';
    el.innerHTML = `
      <div class="message-avatar">⚡</div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;

    this.els.chatMessagesInner.appendChild(el);
    this.scrollToBottom();
  }

  removeTypingIndicator() {
    const existing = document.getElementById('typingIndicator');
    if (existing) existing.remove();
  }

  // ━━━ Streaming — "Alive" Character Buffer ━━━

  startStreaming() {
    this.removeTypingIndicator();
    this.isStreaming = true;
    this._charQueue = [];
    this._fullStreamedText = '';

    const el = document.createElement('div');
    el.className = 'message message-ai message-streaming';
    el.innerHTML = `
      <div class="message-avatar">⚡</div>
      <div class="message-content">
        <div class="message-bubble">
          <span class="streaming-text"></span><span class="streaming-cursor"></span>
        </div>
      </div>
    `;

    this.els.chatMessagesInner.appendChild(el);
    this._streamingBubble = el.querySelector('.streaming-text');
    this._streamingEl = el;
    this.scrollToBottom();

    // Start the character drain loop
    this._startDraining();
    return el;
  }

  /**
   * Character-by-character drain loop.
   * Creates a natural "typing" effect — text appears smoothly
   * even when API sends data in bursts.
   *
   * Adaptive speed:
   *  - Normal: ~2 chars per frame (~120 chars/sec at 60fps)
   *  - Catching up: up to 10 chars per frame when queue is long
   */
  _startDraining() {
    const BASE_SPEED = 2;
    let scrollCounter = 0;

    const drain = () => {
      if (!this.isStreaming && this._charQueue.length === 0) {
        this._drainRAF = null;
        return;
      }

      if (this._charQueue.length > 0 && this._streamingBubble) {
        // Adaptive: drain faster when buffer grows, so we don't fall behind
        const speed = this._charQueue.length > 80
          ? 12
          : this._charQueue.length > 30
            ? 6
            : BASE_SPEED;

        const chars = this._charQueue.splice(0, speed).join('');
        this._streamingBubble.textContent += chars;

        // Scroll periodically, not every frame
        scrollCounter += speed;
        if (scrollCounter >= 15) {
          this.scrollToBottom();
          scrollCounter = 0;
        }
      }

      this._drainRAF = requestAnimationFrame(drain);
    };

    this._drainRAF = requestAnimationFrame(drain);
  }

  appendStreamChunk(chunk) {
    if (!this._charQueue) return;
    this._fullStreamedText += chunk;

    // Push each character into the queue
    for (const char of chunk) {
      this._charQueue.push(char);
    }
  }

  finishStreaming(fullText) {
    this.isStreaming = false;

    // Flush remaining queue immediately
    if (this._streamingBubble && this._charQueue.length > 0) {
      this._streamingBubble.textContent += this._charQueue.join('');
      this._charQueue = [];
    }

    // Cancel drain loop
    if (this._drainRAF) {
      cancelAnimationFrame(this._drainRAF);
      this._drainRAF = null;
    }

    if (this._streamingEl) {
      // Remove streaming glow class
      this._streamingEl.classList.remove('message-streaming');

      const bubble = this._streamingEl.querySelector('.message-bubble');

      // Remove cursor
      const cursor = bubble.querySelector('.streaming-cursor');
      if (cursor) cursor.remove();

      // Replace raw text with formatted content
      bubble.innerHTML = this._formatContent(fullText);

      // Add timestamp
      const timeEl = document.createElement('div');
      timeEl.className = 'message-time';
      timeEl.textContent = this._formatTime(Date.now());
      this._streamingEl.querySelector('.message-content').appendChild(timeEl);
   // No final de finishStreaming(), após adicionar o timeEl:
this._appendFeedbackWidget(this._streamingEl);
 }

    this._streamingBubble = null;
    this._streamingEl = null;
    this._fullStreamedText = '';
  }

  cancelStreaming(options = {}) {
    this.isStreaming = false;
    this._charQueue = [];

    if (this._drainRAF) {
      cancelAnimationFrame(this._drainRAF);
      this._drainRAF = null;
    }

    if (this._streamingEl) {
      if (options.removeBubble) {
        this._streamingEl.remove();
      } else {
        this._streamingEl.classList.remove('message-streaming');
        const cursor = this._streamingEl.querySelector('.streaming-cursor');
        if (cursor) cursor.remove();
      }
    }

    this._streamingBubble = null;
    this._streamingEl = null;
    this._fullStreamedText = '';
  }

  // ━━━ Scroll Management ━━━

  scrollToBottom(smooth = true) {
    const container = this.els.chatMessages;
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant',
      });
    });
  }

  // ━━━ Content Formatting ━━━

  _formatContent(text) {
    if (!text) return '';

    // Escape HTML first
    let html = this._escapeHtml(text);

    // Bold: **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_ (not inside bold)
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Inline code: `text`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Clickable source links
    html = html.replace(
      /(https:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    // Horizontal rule: ━━━ lines or ═══ lines
    html = html.replace(
      /(?:━{3,}|─{3,}|═{3,}|—{3,})/g,
      '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:0.75rem 0;">'
    );

    // Arrow formatting: "19:00 → Subject" — schedule styling
    html = html.replace(
      /(\d{1,2}:\d{2})\s*→\s*(.+?)(?=<br>|$)/g,
      '<span style="font-family:var(--font-mono);color:var(--color-primary);opacity:0.8;font-size:var(--text-sm);">$1</span> <span style="opacity:0.35;margin:0 4px;">→</span> $2'
    );

    return html;
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  _getUserInitial() {
    return '👤';
  }
  _appendFeedbackWidget(messageEl) {
    // Só mostra a cada 3 respostas da IA
    this._feedbackCount = (this._feedbackCount || 0) + 1;
    if (this._feedbackCount % 3 !== 0) return;
  
    const TALLY_URL = 'https://tally.so/r/SUBSTITUA_AQUI'; // ← cole seu link aqui
  
    const widget = document.createElement('div');
    widget.className = 'feedback-widget';
    widget.innerHTML = `
      <span class="feedback-label">Essa resposta te ajudou?</span>
      <div class="feedback-actions">
        <button class="feedback-btn" data-value="sim">👍 Sim</button>
        <button class="feedback-btn" data-value="nao">👎 Não</button>
        <a class="feedback-link" href="${TALLY_URL}" target="_blank">Deixar feedback completo →</a>
      </div>
    `;
  
    // Comportamento dos botões rápidos
    widget.querySelectorAll('.feedback-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        widget.innerHTML = `<span class="feedback-label" style="opacity:0.5;">Obrigado pelo feedback ✓</span>`;
      });
    });
  
    messageEl.querySelector('.message-content').appendChild(widget);
  }
}
