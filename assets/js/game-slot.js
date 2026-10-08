/**
 * 熊猫老虎机 - 三种难度模式
 * 简单 3 图 / 普通 4 图 / 困难 5 图，累计到 1000 分胜利
 */
(function () {
  'use strict';
  const base = (window.SITE_BASE || '/').replace(/\/$/, '');

  window.addEventListener('load', () => {
    const META = window.EMOTE_META || { items: [] };
    const all = META.items.filter(i => i.file && !i.file.toLowerCase().endsWith('.gif'));
    if (all.length < 2) return;

    const reelsRoot = document.getElementById('slot-reels');
    const scoreEl = document.getElementById('slot-score');
    const spinBtn = document.getElementById('slot-spin');
    const resetBtn = document.getElementById('slot-reset');
    const resultEl = document.getElementById('slot-result');
    const modeBtns = document.querySelectorAll('.slot-mode');
    if (!reelsRoot || !spinBtn || !scoreEl) return;

    const TARGET = 1000;
    const MODES = {
      easy: { reels: 3, name: '简单', matchAll: 200, matchSome: 20, none: 5 },
      normal: { reels: 4, name: '普通', matchAll: 400, matchSome: 25, none: 5 },
      hard: { reels: 5, name: '困难', matchAll: 600, matchSome: 30, none: 5 },
    };

    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const symbolSrc = (s) => `${base}/assets/images/emotes/${s.file}`;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    let mode = 'easy';
    let score = 0;
    let isSpinning = false;
    let won = false;
    let reels = [];

    function buildReels() {
      const count = MODES[mode].reels;
      // 4 图用 2x2 布局，3/5 图保持 3 列（5 图为 3+2）
      reelsRoot.style.gridTemplateColumns = (count === 4) ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)';
      reelsRoot.innerHTML = Array.from({ length: count }, (_, i) =>
        `<div class="slot-reel"><img id="slot-r${i}" src="${symbolSrc(rand(all))}" alt="reel"></div>`
      ).join('');
      reels = Array.from({ length: count }, (_, i) => document.getElementById(`slot-r${i}`));
    }

    function setMode(name) {
      if (isSpinning) return;
      mode = name;
      modeBtns.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-mode') === name));
      resetGame();
    }

    function resetGame() {
      score = 0;
      won = false;
      scoreEl.textContent = '0';
      resultEl.textContent = '';
      spinBtn.disabled = false;
      spinBtn.textContent = '旋转';
      buildReels();
    }

    function calcScore(results) {
      const counts = {};
      results.forEach(s => { counts[s.file] = (counts[s.file] || 0) + 1; });
      const maxCount = Math.max(...Object.values(counts));
      const cfg = MODES[mode];

      if (maxCount === results.length) return { points: cfg.matchAll, msg: `🎉 ${cfg.name}大奖 +${cfg.matchAll}！` };
      if (maxCount >= 2) return { points: maxCount * cfg.matchSome, msg: `✨ ${maxCount} 连！+${maxCount * cfg.matchSome}` };
      return { points: cfg.none, msg: `💨 再来一次 +${cfg.none}` };
    }

    async function spinReel(el, ticks) {
      for (let i = 0; i < ticks; i++) {
        el.src = symbolSrc(rand(all));
        await sleep(65);
      }
      const final = rand(all);
      el.src = symbolSrc(final);
      return final;
    }

    async function spin() {
      if (isSpinning || won) return;
      isSpinning = true;
      resultEl.textContent = '';
      spinBtn.disabled = true;

      const cfg = MODES[mode];
      const ticks = Array.from({ length: cfg.reels }, (_, i) => 12 + i * 4);
      const results = [];
      for (let i = 0; i < cfg.reels; i++) {
        results.push(await spinReel(reels[i], ticks[i]));
      }

      const outcome = calcScore(results);
      score += outcome.points;
      scoreEl.textContent = score;
      resultEl.textContent = outcome.msg;

      if (score >= TARGET) {
        won = true;
        resultEl.textContent = `🏆 恭喜！达到 ${TARGET} 分，你赢了！`;
        spinBtn.textContent = '已通关';
      } else {
        spinBtn.disabled = false;
      }
      isSpinning = false;
    }

    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.getAttribute('data-mode')));
    });
    spinBtn.addEventListener('click', spin);
    resetBtn.addEventListener('click', resetGame);

    buildReels();

    window.__gameHooks.slot = (action) => {
      if (action === 'open') resetGame();
    };
  });
})();