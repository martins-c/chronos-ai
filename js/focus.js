// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHRONOS AI — Focus Mode
//  Open/close overlay only (static UI for now)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function initFocusMode(elements) {
  const { focusOverlay, btnFocus, btnFocusClose } = elements;

  function open() {
    focusOverlay.classList.add('active');
    focusOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    focusOverlay.classList.remove('active');
    focusOverlay.setAttribute('aria-hidden', 'true');
    if (!elements.sidebar?.classList.contains('open')) {
      document.body.style.overflow = '';
    }
  }

  function isOpen() {
    return focusOverlay.classList.contains('active');
  }

  btnFocus.addEventListener('click', open);
  btnFocusClose.addEventListener('click', close);

  return { open, close, isOpen };
}
