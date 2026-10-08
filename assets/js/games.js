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

// ========== 合成熊猫（物理合成游戏） ==========
(function () {
  const base = (window.SITE_BASE || '/').replace(/\/$/, '');
  const meta = window.EMOTE_META || { items: [] };
  const allEmotes = meta.items.filter(i => i.file && !i.file.toLowerCase().endsWith('.gif'));
  // 取前 8 个作为合成链（从小到大）
  const chain = allEmotes.slice(0, 8);
  if (chain.length < 3) return;

  const canvas = document.getElementById('panda-merge');
  const startBtn = document.getElementById('merge-start');
  const scoreEl = document.getElementById('merge-score');
  const nextImg = document.getElementById('merge-next-img');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.width;
  const H = canvas.height;
  const floorY = H - 8;
  const wallX = 8;
  const dangerLine = 140;
  const g = 0.25;
  const friction = 0.98;
  const bounce = 0.5;
  const radii = [18, 24, 32, 42, 54, 70, 90, 115];

  let balls = [];
  let score = 0;
  let running = false;
  let dropping = false;
  let nextLevel = 0;
  let currentX = W / 2;
  let gameOver = false;
  let imgCache = {};
  let animationId = null;

  function emoteSrc(idx) {
    return `${base}/assets/images/emotes/${chain[idx].file}`;
  }

  function loadImg(idx) {
    if (imgCache[idx]) return imgCache[idx];
    const img = new Image();
    img.src = emoteSrc(idx);
    imgCache[idx] = img;
    return img;
  }

  chain.forEach((_, i) => loadImg(i));

  function randLevel() {
    // 下一个球 mostly 在前 3 级
    const r = Math.random();
    if (r < 0.5) return 0;
    if (r < 0.8) return 1;
    return 2;
  }

  function reset() {
    balls = [];
    score = 0;
    scoreEl.textContent = score;
    running = true;
    dropping = false;
    gameOver = false;
    nextLevel = randLevel();
    nextImg.src = emoteSrc(nextLevel);
    if (animationId) cancelAnimationFrame(animationId);
    loop();
  }

  function spawnBall(x, level) {
    const r = radii[level] || radii[radii.length - 1];
    balls.push({
      x, y: r + 16,
      vx: 0, vy: 0,
      r,
      level,
      settled: false,
      merged: false,
    });
  }

  function clampX(x, r) {
    return Math.max(wallX + r, Math.min(W - wallX - r, x));
  }

  function resolveBoundaries(b) {
    const r = b.r;
    if (b.x < wallX + r) { b.x = wallX + r; b.vx = Math.abs(b.vx) * bounce; }
    if (b.x > W - wallX - r) { b.x = W - wallX - r; b.vx = -Math.abs(b.vx) * bounce; }
    if (b.y > floorY - r) {
      b.y = floorY - r;
      b.vy = -Math.abs(b.vy) * bounce;
      b.vx *= 0.9;
      if (Math.abs(b.vy) < g * 2) { b.vy = 0; b.settled = true; }
    }
    if (b.y < r + 20) { b.y = r + 20; b.vy = Math.abs(b.vy) * bounce; }
  }

  function resolvePair(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const minD = a.r + b.r;
    if (d === 0 || d >= minD) return;
    const nx = dx / d;
    const ny = dy / d;
    const overlap = minD - d;
    const massA = a.r * a.r;
    const massB = b.r * b.r;
    const totalM = massA + massB;
    a.x -= nx * overlap * (massB / totalM);
    a.y -= ny * overlap * (massB / totalM);
    b.x += nx * overlap * (massA / totalM);
    b.y += ny * overlap * (massA / totalM);

    // 弹性碰撞（简化）
    const dvx = b.vx - a.vx;
    const dvy = b.vy - a.vy;
    const velAlong = dvx * nx + dvy * ny;
    if (velAlong > 0) return;
    const j = -(1 + bounce) * velAlong / (1 / massA + 1 / massB);
    const impulseX = j * nx;
    const impulseY = j * ny;
    a.vx -= impulseX / massA;
    a.vy -= impulseY / massA;
    b.vx += impulseX / massB;
    b.vy += impulseY / massB;
  }

  function tryMerge() {
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.merged) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.merged) continue;
        if (a.level !== b.level) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < a.r + b.r - 2) {
          const newLevel = Math.min(a.level + 1, chain.length - 1);
          const newX = (a.x + b.x) / 2;
          const newY = (a.y + b.y) / 2;
          a.merged = true;
          b.merged = true;
          balls.push({
            x: newX, y: newY,
            vx: 0, vy: 0,
            r: radii[newLevel],
            level: newLevel,
            settled: false,
            merged: false,
          });
          score += (newLevel + 1) * 100;
          scoreEl.textContent = score;
          return true; // 每帧最多一次合并，避免连锁异常
        }
      }
    }
    return false;
  }

  function update() {
    for (const b of balls) {
      if (!b.settled) {
        b.vy += g;
        b.vx *= friction;
        b.vy *= friction;
        b.x += b.vx;
        b.y += b.vy;
      }
      resolveBoundaries(b);
    }
    // 多次迭代碰撞，减少重叠
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          resolvePair(balls[i], balls[j]);
        }
      }
    }
    // 清理已合并
    balls = balls.filter(b => !b.merged);

    // 合并检测
    if (!tryMerge()) {
      // 没有新合并时检查是否稳定
      for (const b of balls) {
        if (Math.abs(b.vy) < 0.5 && Math.abs(b.vx) < 0.5) b.settled = true;
        else b.settled = false;
      }
    }

    // 游戏结束检测
    if (!gameOver) {
      for (const b of balls) {
        if (b.settled && b.y - b.r < dangerLine) {
          gameOver = true;
          running = false;
          break;
        }
      }
    }
  }

  function drawBall(b) {
    const img = imgCache[b.level];
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (img && img.complete && img.naturalWidth) {
      const s = Math.max(img.naturalWidth, img.naturalHeight);
      const scale = (b.r * 2) / s;
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, b.x - w / 2, b.y - h / 2, w, h);
    } else {
      ctx.fillStyle = '#d0e0ff';
      ctx.fill();
    }
    ctx.restore();
    // 边框
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function draw() {
    // 背景
    ctx.fillStyle = '#f0f7ff';
    ctx.fillRect(0, 0, W, H);

    // 警戒线
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wallX, dangerLine);
    ctx.lineTo(W - wallX, dangerLine);
    ctx.stroke();
    ctx.setLineDash([]);

    // 容器边框
    ctx.strokeStyle = 'rgba(47,111,237,0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(wallX, 0);
    ctx.lineTo(wallX, H);
    ctx.moveTo(W - wallX, 0);
    ctx.lineTo(W - wallX, H);
    ctx.stroke();

    // 球
    for (const b of balls) drawBall(b);

    // 预览线
    if (running && !dropping && !gameOver) {
      ctx.strokeStyle = 'rgba(47,111,237,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(currentX, 20);
      ctx.lineTo(currentX, dangerLine);
      ctx.stroke();
      ctx.setLineDash([]);
      const r = radii[nextLevel];
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(currentX, r + 16, r, 0, Math.PI * 2);
      ctx.clip();
      const img = imgCache[nextLevel];
      if (img && img.complete && img.naturalWidth) {
        const s = Math.max(img.naturalWidth, img.naturalHeight);
        const scale = (r * 2) / s;
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(img, currentX - w / 2, r + 16 - h / 2, w, h);
      }
      ctx.restore();
    }

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('游戏结束', W / 2, H / 2 - 12);
      ctx.font = '18px sans-serif';
      ctx.fillText(`最终得分：${score}`, W / 2, H / 2 + 24);
    }
  }

  function loop() {
    if (!running && !gameOver) return;
    update();
    draw();
    animationId = requestAnimationFrame(loop);
  }

  function drop() {
    if (!running || dropping || gameOver) return;
    dropping = true;
    spawnBall(currentX, nextLevel);
    nextLevel = randLevel();
    nextImg.src = emoteSrc(nextLevel);
    // 落下一小段后允许下次操作
    let frames = 0;
    const unlock = () => {
      frames++;
      if (frames < 25) { animationId = requestAnimationFrame(unlock); return; }
      dropping = false;
    };
    animationId = requestAnimationFrame(unlock);
  }

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    currentX = clampX(x, radii[nextLevel]);
  });
  canvas.addEventListener('click', drop);
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * (W / rect.width);
    currentX = clampX(x, radii[nextLevel]);
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    drop();
  });

  if (startBtn) startBtn.addEventListener('click', reset);

  // 初始状态
  nextLevel = randLevel();
  nextImg.src = emoteSrc(nextLevel);
  draw();
})();
