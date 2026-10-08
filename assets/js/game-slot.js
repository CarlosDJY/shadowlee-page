/**
 * 熊猫老虎机 - 基于开源 jsubroto/slot-machine (MIT) 改造
 * 符号换成表情图片
 */
(function () {
  'use strict';
  const base = (window.SITE_BASE || '/').replace(/\/$/, '');

  window.addEventListener('load', () => {
    const COST = 5;
    const START_COINS = 100;
    const REEL_COUNT = 3;

    const meta = window.EMOTE_META || { items: [] };
    const all = meta.items.filter(i => i.file && !i.file.toLowerCase().endsWith('.gif'));
    const symbols = all.slice(0, 6);
    if (symbols.length < 3) return;

    const payouts = {};
    const payValues = [10, 15, 20, 30, 50, 100];
    symbols.forEach((s, i) => { payouts[s.file] = payValues[i % payValues.length]; });

    const randSymbol = () => symbols[Math.floor(Math.random() * symbols.length)];
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const reelsRoot = document.getElementById('slot-reels');
    if (!reelsRoot) return;

    reelsRoot.innerHTML = Array.from({ length: REEL_COUNT }, (_, i) =>
      `<div class="slot-reel"><img id="slot-r${i + 1}" src="" alt="reel"></div>`
    ).join('');

    const reels = Array.from({ length: REEL_COUNT }, (_, i) => document.getElementById(`slot-r${i + 1}`));
    const msg = document.getElementById('slot-result');
    const coinsEl = document.getElementById('slot-coins');
    const spinBtn = document.getElementById('slot-spin');

    let coins = START_COINS;
    let isSpinning = false;

    function symbolSrc(s) { return `${base}/assets/images/emotes/${s.file}`; }

    reels.forEach(el => { el.src = symbolSrc(randSymbol()); });
    coinsEl.textContent = coins;
    spinBtn.textContent = `旋转 (${COST})`;

    async function spin() {
      if (isSpinning) return;
      if (coins < COST) { msg.textContent = '余额不足，刷新重置'; return; }
      coins -= COST;
      coinsEl.textContent = coins;
      isSpinning = true;
      spinBtn.disabled = true;
      msg.textContent = '转动中…';

      const results = await Promise.all(reels.map((el, i) => spinReel(el, 12 + i * 4)));
      endSpin(results);
    }

    function endSpin(results) {
      if (results.every(s => s.file === results[0].file)) {
        const symbol = results[0];
        const payout = payouts[symbol.file] || 10;
        coins += payout;
        coinsEl.textContent = coins;
        msg.textContent = `🎉 三个相同！赢得 ${payout} 币（${symbol.name}）`;
      } else {
        msg.textContent = '没有连线，再试一次！';
      }
      isSpinning = false;
      spinBtn.disabled = false;
    }

    async function spinReel(el, ticks) {
      for (let i = 0; i < ticks; i++) {
        const s = randSymbol();
        el.src = symbolSrc(s);
        await sleep(70);
      }
      const final = randSymbol();
      el.src = symbolSrc(final);
      return final;
    }

    if (spinBtn) spinBtn.addEventListener('click', spin);

    if (window.__gameHooks) {
      window.__gameHooks.slot = (action) => {
        if (action === 'open') {
          coins = START_COINS;
          coinsEl.textContent = coins;
          reels.forEach(el => { el.src = symbolSrc(randSymbol()); });
          msg.textContent = '';
          isSpinning = false;
          if (spinBtn) { spinBtn.disabled = false; spinBtn.textContent = `旋转 (${COST})`; }
        }
      };
    }
  });
})();