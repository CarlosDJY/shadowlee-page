/**
 * 游戏卡片 + 弹窗逻辑
 */
(function () {
  const modal = document.getElementById('game-modal');
  const modalBody = document.getElementById('game-modal-body');
  const cards = document.querySelectorAll('.game-card');
  const instances = document.querySelectorAll('.game-instance');

  let openGame = null;

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
  }

  function openModal(name) {
    showGame(name);
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
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
    if (e.key === 'Escape' && modal.style.display === 'block') {
      hideModal();
    }
  });

  // 暴露给其他脚本
  window.__gameModal = { open: openModal, close: hideModal };
})();