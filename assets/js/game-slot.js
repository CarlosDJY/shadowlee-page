/**
 * 熊猫老虎机 - 三种难度模式
 * 初始 500 分，每次旋转扣除底注；3 个相同 +3×底注，2 个相同 +1×底注
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

    const START_SCORE = 500;
    const TARGET = 1000;
    const MODES = {
      easy:   { reels: 3, name: '简单', baseBet: 10 },
      normal: { reels: 4, name: '普通', baseBet: 20 },
      hard:   { reels: 5, name: '困难', baseBet: 30 },
    };

    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const symbolSrc = (s) => `${base}/assets/images/emotes/${s.file}`;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    let mode = 'easy';
    let score = START_SCORE;
    let isSpinning = false;
    let won = false;
    let reels = [];
    let round = 0; // 每次重开 +1，用来作废还在转的上一局

    function buildReels() {
      const count = MODES[mode].reels;
      // 4 图用 2x2，3/5 图保持 3 列（5 图为 3+2）
      reelsRoot.style.gridTemplateColumns = (count === 4) ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)';
      reelsRoot.innerHTML = Array.from({ length: count }, (_, i) =>
        `<div class="slot-reel"><img id="slot-r${i}" src="${symbolSrc(rand(all))}" alt="reel"></div>`
      ).join('');
      reels = Array.from({ length: count }, (_, i) => document.getElementById(`slot-r${i}`));
    }

    function updateScoreDisplay() {
      scoreEl.textContent = score;
    }

    function setMode(name) {
      if (isSpinning) return;
      mode = name;
      modeBtns.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-mode') === name));
      resetGame();
    }

    function resetGame() {
      round++;
      isSpinning = false;
      score = START_SCORE;
      won = false;
      updateScoreDisplay();
      resultEl.textContent = '';
      spinBtn.disabled = false;
      spinBtn.textContent = '旋转';
      buildReels();
    }

    function calcOutcome(results) {
      const counts = {};
      results.forEach(s => { counts[s.file] = (counts[s.file] || 0) + 1; });
      const maxCount = Math.max(...Object.values(counts));
      const cfg = MODES[mode];
      const bet = cfg.baseBet;

      // 先扣底注
      let change = -bet;
      let msg = `-${bet} 底注`;

      if (maxCount === results.length) {
        const win = bet * 3;
        change += win;
        msg += ` · 🎉 ${cfg.name}大奖 +${win}`;
      } else if (maxCount >= 2) {
        const win = bet;
        change += win;
        msg += ` · ✨ ${maxCount} 连 +${win}`;
      } else {
        msg += ' · 💨 未中奖';
      }

      return { change, msg };
    }

    async function spinReel(el, ticks, myRound) {
      for (let i = 0; i < ticks; i++) {
        if (myRound !== round) return null;
        el.src = symbolSrc(rand(all));
        await sleep(65);
      }
      const final = rand(all);
      el.src = symbolSrc(final);
      return final;
    }

    async function spin() {
      if (isSpinning || won) return;
      if (score < MODES[mode].baseBet) {
        resultEl.textContent = '💸 分数不足，请重开';
        return;
      }

      isSpinning = true;
      const myRound = round;
      resultEl.textContent = `-${MODES[mode].baseBet} 底注…`;
      spinBtn.disabled = true;

      const cfg = MODES[mode];
      const ticks = Array.from({ length: cfg.reels }, (_, i) => 12 + i * 4);
      const results = [];
      for (let i = 0; i < cfg.reels; i++) {
        const r = await spinReel(reels[i], ticks[i], myRound);
        if (myRound !== round) return; // 转动途中重开 / 关闭了，丢弃这次结果
        results.push(r);
      }

      const outcome = calcOutcome(results);
      score += outcome.change;
      updateScoreDisplay();
      resultEl.textContent = outcome.msg;

      if (score >= TARGET) {
        won = true;
        resultEl.textContent = `🏆 恭喜！达到 ${TARGET} 分，你赢了！`;
        spinBtn.textContent = '已通关';
      } else if (score <= 0) {
        won = true; // 结束
        resultEl.textContent = '💸 分数耗尽，游戏结束';
        spinBtn.textContent = '已结束';
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
    updateScoreDisplay();

    window.__gameHooks.slot = (action) => {
      if (action === 'open' || action === 'close') resetGame();
    };
  });
})();
