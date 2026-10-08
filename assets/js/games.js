(function () {
  const base = (window.SITE_BASE || '/').replace(/\/$/, '');
  const meta = window.EMOTE_META || { items: [] };
  const emotes = meta.items.filter(i => i.file).map(i => ({
    name: i.name,
    src: `${base}/assets/images/emotes/${i.file}`
  }));

  // ========== 熊猫老虎机 ==========
  const reels = [0, 1, 2].map(i => document.getElementById(`reel-${i}`));
  const spinBtn = document.getElementById('slot-spin');
  const balanceEl = document.getElementById('slot-balance');
  const currentBetEl = document.getElementById('slot-current-bet');
  const resultEl = document.getElementById('slot-result');
  const betBtns = document.querySelectorAll('.bet-btn');
  let balance = 1000;
  let currentBet = 50;
  let spinning = false;

  function randomEmote() {
    return emotes[Math.floor(Math.random() * emotes.length)];
  }

  function setReel(reelIdx, emote) {
    const img = reels[reelIdx];
    img.src = emote.src;
    img.alt = emote.name;
  }

  function updateBetButtons() {
    betBtns.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.bet, 10) === currentBet);
    });
    currentBetEl.textContent = currentBet;
  }

  betBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (spinning) return;
      currentBet = parseInt(btn.dataset.bet, 10);
      updateBetButtons();
    });
  });

  function spin() {
    if (spinning) return;
    if (balance < currentBet) {
      resultEl.textContent = '余额不足，请减少押注或刷新页面重置';
      return;
    }
    spinning = true;
    spinBtn.disabled = true;
    resultEl.textContent = '滚动中...';
    balance -= currentBet;
    balanceEl.textContent = balance;

    const results = [randomEmote(), randomEmote(), randomEmote()];
    let completed = 0;

    reels.forEach((img, idx) => {
      let count = 0;
      const interval = setInterval(() => {
        setReel(idx, randomEmote());
        count++;
        if (count >= 10 + idx * 5) {
          clearInterval(interval);
          setReel(idx, results[idx]);
          completed++;
          if (completed === 3) settle(results);
        }
      }, 60 + idx * 20);
    });
  }

  function settle(results) {
    const name0 = results[0].name;
    const name1 = results[1].name;
    const name2 = results[2].name;
    let win = 0;
    let msg = '';
    if (name0 === name1 && name1 === name2) {
      win = currentBet * 10;
      msg = `🎉 三个相同！获得 ${win} 筹码`;
    } else if (name0 === name1 || name1 === name2 || name0 === name2) {
      win = currentBet * 3;
      msg = `✌️ 两个相同，获得 ${win} 筹码`;
    } else {
      msg = '💨 没有中奖，再试一次';
    }
    balance += win;
    balanceEl.textContent = balance;
    resultEl.textContent = msg;
    spinning = false;
    spinBtn.disabled = false;
  }

  if (spinBtn) spinBtn.addEventListener('click', spin);

  // 初始化显示
  reels.forEach((_, idx) => setReel(idx, randomEmote()));

  // ========== 熊猫三维弹球 ==========
  const canvas = document.getElementById('panda-pinball');
  const startBtn = document.getElementById('pinball-start');
  const scoreEl = document.getElementById('pinball-score');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let gameId = null;
  let score = 0;
  let running = false;

  // 桌面参数
  const tableTopY = 80;
  const tableBottomY = 560;
  const tableTopW = 200;
  const tableBottomW = 400;
  const cx = canvas.width / 2;
  const ballR = 14;

  // 挡板
  const paddle = { w: 80, h: 12, x: cx };

  // 球
  let ball = { x: cx, y: tableBottomY - 60, vx: 3, vy: -6, r: ballR };

  function project(x, y) {
    const t = (y - tableTopY) / (tableBottomY - tableTopY);
    const w = tableTopW + (tableBottomW - tableTopW) * t;
    return { x: cx + (x - cx) * (w / tableBottomW), y };
  }

  function drawTable() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 桌面背景
    const grad = ctx.createLinearGradient(0, tableTopY, 0, tableBottomY);
    grad.addColorStop(0, '#2a3b55');
    grad.addColorStop(1, '#4a6fa5');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - tableTopW / 2, tableTopY);
    ctx.lineTo(cx + tableTopW / 2, tableTopY);
    ctx.lineTo(cx + tableBottomW / 2, tableBottomY);
    ctx.lineTo(cx - tableBottomW / 2, tableBottomY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8fb8ff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 顶部分数区
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('顶部得分区 +100', cx, tableTopY + 30);
  }

  function drawPaddle() {
    const py = tableBottomY - 20;
    ctx.fillStyle = '#00d2ff';
    ctx.beginPath();
    ctx.roundRect(paddle.x - paddle.w / 2, py, paddle.w, paddle.h, 6);
    ctx.fill();
  }

  function drawBall() {
    const p = project(ball.x, ball.y);
    // 透视缩放
    const t = (ball.y - tableTopY) / (tableBottomY - tableTopY);
    const r = ball.r * (0.6 + 0.4 * t);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    // 熊猫耳朵/眼睛简化
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(p.x - r * 0.35, p.y - r * 0.2, r * 0.2, 0, Math.PI * 2);
    ctx.arc(p.x + r * 0.35, p.y - r * 0.2, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(p.x - r * 0.2, p.y + r * 0.05, r * 0.12, 0, Math.PI * 2);
    ctx.arc(p.x + r * 0.2, p.y + r * 0.05, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  function getTableWidthAt(y) {
    const t = (y - tableTopY) / (tableBottomY - tableTopY);
    return tableTopW + (tableBottomW - tableTopW) * t;
  }

  function clampX(x, y) {
    const halfW = getTableWidthAt(y) / 2 - ball.r;
    return Math.max(cx - halfW, Math.min(cx + halfW, x));
  }

  function update() {
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vy += 0.15; // 重力

    const halfW = getTableWidthAt(ball.y) / 2;

    // 碰左右边界
    if (ball.x - ball.r < cx - halfW) {
      ball.x = cx - halfW + ball.r;
      ball.vx = Math.abs(ball.vx) * 0.95;
    } else if (ball.x + ball.r > cx + halfW) {
      ball.x = cx + halfW - ball.r;
      ball.vx = -Math.abs(ball.vx) * 0.95;
    }

    // 碰顶
    if (ball.y - ball.r < tableTopY) {
      ball.y = tableTopY + ball.r;
      ball.vy = Math.abs(ball.vy) * 0.95;
      score += 100;
      scoreEl.textContent = score;
    }

    // 碰挡板
    const py = tableBottomY - 20;
    if (ball.y + ball.r > py && ball.y - ball.r < py + paddle.h) {
      if (ball.x > paddle.x - paddle.w / 2 && ball.x < paddle.x + paddle.w / 2) {
        ball.y = py - ball.r;
        ball.vy = -Math.abs(ball.vy) * 1.02;
        const hitOffset = (ball.x - paddle.x) / (paddle.w / 2);
        ball.vx += hitOffset * 2;
      }
    }

    // 落到底部
    if (ball.y > tableBottomY + 40) {
      running = false;
      cancelAnimationFrame(gameId);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('游戏结束', cx, canvas.height / 2);
      ctx.font = '18px sans-serif';
      ctx.fillText(`最终得分：${score}`, cx, canvas.height / 2 + 36);
      startBtn.textContent = '重新开始';
      return;
    }
  }

  function loop() {
    if (!running) return;
    drawTable();
    drawPaddle();
    update();
    drawBall();
    gameId = requestAnimationFrame(loop);
  }

  function startGame() {
    if (running) return;
    score = 0;
    scoreEl.textContent = score;
    ball = { x: cx + (Math.random() - 0.5) * 100, y: tableBottomY - 80, vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 3, r: ballR };
    running = true;
    startBtn.textContent = '游戏中';
    loop();
  }

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    paddle.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    paddle.x = Math.max(cx - tableBottomW / 2 + paddle.w / 2, Math.min(cx + tableBottomW / 2 - paddle.w / 2, paddle.x));
  });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    paddle.x = (touch.clientX - rect.left) * (canvas.width / rect.width);
    paddle.x = Math.max(cx - tableBottomW / 2 + paddle.w / 2, Math.min(cx + tableBottomW / 2 - paddle.w / 2, paddle.x));
  }, { passive: false });

  if (startBtn) startBtn.addEventListener('click', startGame);

  drawTable();
})();
