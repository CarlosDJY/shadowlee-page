/**
 * 游戏卡片 + 弹窗逻辑
 */
(function () {
  window.__gameHooks = window.__gameHooks || {};
  const modal = document.getElementById('game-modal');
  const modalBody = document.getElementById('game-modal-body');
  const cards = document.querySelectorAll('.game-card');
  const instances = document.querySelectorAll('.game-instance');

  let openGame = null;
  let lastFocus = null;
  const content = modal.querySelector('.game-modal-content');
  if (content) content.setAttribute('tabindex', '-1');

  function showGame(name) {
    instances.forEach(inst => {
      inst.style.display = (inst.getAttribute('data-game') === name) ? 'block' : 'none';
    });
    // 通知对应游戏开始（如果定义了）
    if (window.__gameHooks && typeof window.__gameHooks[name] === 'function') {
      window.__gameHooks[name]('open');
    }
    openGame = name;
  }

  function hideModal() {
    if (openGame && window.__gameHooks && typeof window.__gameHooks[openGame] === 'function') {
      window.__gameHooks[openGame]('close');
    }
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    openGame = null;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }

  function openModal(name) {
    if (openGame === name) return; // 已经打开（比如焦点还在卡片上又按了一次空格）
    // 只有键盘操作打开时才在关闭后把焦点还给卡片；鼠标点开的就不还，避免之后按空格又把游戏打开
    const a = document.activeElement;
    lastFocus = (a && a.matches && a.matches(':focus-visible')) ? a : null;
    if (!lastFocus && a && a.blur && a !== document.body) a.blur();
    showGame(name);
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    // 把焦点移进弹窗，空格 / 回车交给游戏，而不是背后的卡片
    if (content) content.focus({ preventScroll: true });
  }

  cards.forEach(card => {
    const name = card.getAttribute('data-game');
    card.addEventListener('click', () => openModal(name));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(name);
      }
    });
  });

  modal.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', hideModal);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openGame) {
      hideModal();
    }
  });

  // 当前打开的游戏名（没打开时为 null）
  function current() { return openGame; }

  // 键盘事件是否应交给游戏：弹窗里打开的是 name，且焦点不在输入框里
  function wantsKeys(name, e) {
    if (openGame !== name) return false;
    if (e && e.defaultPrevented) return false; // 例如在卡片上按回车打开游戏的那一下
    const t = e && e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return false;
    return true;
  }

  // 暴露给其他脚本
  window.__gameModal = { open: openModal, close: hideModal, current, wantsKeys };
})();