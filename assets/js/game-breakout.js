/**
 * 熊猫打砖块 - 经典 Breakout
 * 关卡越多，砖块行数越多，球速越快
 */
(function () {
  'use strict';

  window.addEventListener('load', () => {
    const canvas = document.getElementById('breakout-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('breakout-score');

    const W = canvas.width, H = canvas.height;
    const PADDLE_W_BASE = 96, PADDLE_H = 16, PADDLE_Y = H - 50;
    const BALL_R = 8, BALL_SPEED_BASE = 4.4;
    const BRICK_COLS = 7, BRICK_H = 28, BRICK_GAP = 6;
    const MARGIN_X = 16, MARGIN_TOP = 100;
    const BEST_KEY = 'breakout-best';

    const colors = ['#ff5e5e', '#ff9e5e', '#ffd85e', '#5eff7a', '#5ee2ff', '#5e8cff', '#d45eff'];

    let state = 'ready'; // ready | playing | won | over
    let level = 1, score = 0, lives = 3, best = 0;
    let paddle = { x: W / 2, w: PADDLE_W_BASE };
    let ball = null;
    let bricks = [];
    let rafId;

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function readBest() {
      try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { best = 0; }
    }

    function saveBest() {
      if (score > best) { best = score; try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {} }
    }

    function brickRows() { return clamp(3 + level, 4, 9); }

    function buildBricks() {
      const rows = brickRows();
      const totalGapX = (BRICK_COLS - 1) * BRICK_GAP;
      const brickW = (W - MARGIN_X * 2 - totalGapX) / BRICK_COLS;
      bricks = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          bricks.push({
            x: MARGIN_X + c * (brickW + BRICK_GAP),
            y: MARGIN_TOP + r * (BRICK_H + BRICK_GAP),
            w: brickW,
            h: BRICK_H,
            color: colors[r % colors.length],
            broken: false,
          });
        }
      }
    }

    function resetGame() {
      level = 1;
      score = 0;
      lives = 3;
      state = 'ready';
      buildBricks();
      resetBall();
      draw();
      updateScore();
    }

    function resetBall() {
      paddle.w = Math.max(56, PADDLE_W_BASE - level * 4);
      paddle.x = clamp(paddle.x, paddle.w / 2, W - paddle.w / 2);
      ball = {
        x: paddle.x,
        y: PADDLE_Y - BALL_R - 4,
        r: BALL_R,
        vx: 0,
        vy: 0,
        speed: BALL_SPEED_BASE + level * 0.35,
      };
    }

    function launchBall() {
      if (state === 'over' || state === 'won') { resetGame(); state = 'ready'; }
      if (ball && ball.vx === 0 && ball.vy === 0) {
        const angle = -Math.PI / 2 + (Math.random() * 0.4 - 0.2);
        ball.vx = Math.cos(angle) * ball.speed;
        ball.vy = Math.sin(angle) * ball.speed;
        state = 'playing';
      } else if (state === 'ready') {
        state = 'playing';
      }
    }

    function circleRectHit(b, r) {
      const cx = clamp(b.x, r.x, r.x + r.w);
      const cy = clamp(b.y, r.y, r.y + r.h);
      const dx = b.x - cx;
      const dy = b.y - cy;
      return (dx * dx + dy * dy) <= (b.r * b.r);
    }

    function reflectOffBrick(brick) {
      const cx = clamp(ball.x, brick.x, brick.x + brick.w);
      const cy = clamp(ball.y, brick.y, brick.y + brick.h);
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      if (Math.abs(dx) > Math.abs(dy)) {
        ball.vx *= -1;
        ball.x += Math.sign(dx) * (ball.r + 1);
      } else {
        ball.vy *= -1;
        ball.y += Math.sign(dy) * (ball.r + 1);
      }
    }

    function update() {
      if (state !== 'playing') return;

      ball.x += ball.vx;
      ball.y += ball.vy;

      // 墙壁
      if (ball.x - ball.r <= 0) { ball.x = ball.r; ball.vx *= -1; }
      if (ball.x + ball.r >= W) { ball.x = W - ball.r; ball.vx *= -1; }
      if (ball.y - ball.r <= 0) { ball.y = ball.r; ball.vy *= -1; }

      // 挡板
      if (ball.vy > 0
          && ball.y + ball.r >= PADDLE_Y - PADDLE_H / 2 && ball.y - ball.r <= PADDLE_Y + PADDLE_H / 2
          && ball.x + ball.r >= paddle.x - paddle.w / 2 && ball.x - ball.r <= paddle.x + paddle.w / 2) {
        const t = clamp((ball.x - (paddle.x - paddle.w / 2)) / paddle.w, 0, 1); // 0..1
        const angle = -Math.PI * 0.85 + t * Math.PI * 0.7; // 范围约 150°
        ball.vx = Math.cos(angle) * ball.speed;
        ball.vy = Math.sin(angle) * ball.speed;
        ball.y = PADDLE_Y - PADDLE_H / 2 - ball.r - 1;
      }

      // 砖块
      for (const b of bricks) {
        if (b.broken) continue;
        if (circleRectHit(ball, b)) {
          b.broken = true;
          score += 10;
          reflectOffBrick(b);
          updateScore();
          break;
        }
      }

      // 掉底
      if (ball.y - ball.r > H) {
        lives--;
        if (lives <= 0) {
          state = 'over';
          saveBest();
          // game over
        } else {
          resetBall();
          state = 'ready';
        }
        return;
      }

      // 过关
      if (bricks.every(b => b.broken)) {
        level++;
        buildBricks();
        resetBall();
        state = 'ready';
        // next level ready
      }
    }

    function updateScore() {
      if (scoreEl) scoreEl.textContent = `${score}  生命：${lives}  关卡：${level}`;
    }

    function draw() {
      // 背景
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#2a2320'); g.addColorStop(1, '#1a1512');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // 石墙纹理装饰线
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 2;
      for (let y = 0; y < H; y += 80) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // 关卡标题
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`第 ${level} 关`, W / 2, 34);
      ctx.font = '14px sans-serif';
      ctx.fillText(brickRows() + ' 行砖块', W / 2, 56);

      // 砖块
      for (const b of bricks) {
        if (b.broken) continue;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 挡板
      ctx.fillStyle = '#ff6b4a';
      ctx.beginPath();
      ctx.roundRect(paddle.x - paddle.w / 2, PADDLE_Y - PADDLE_H / 2, paddle.w, PADDLE_H, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(paddle.x - paddle.w / 2 + 6, PADDLE_Y - PADDLE_H / 2 + 3, paddle.w - 12, 4);

      // 球
      if (ball) {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fillStyle = '#f8f8f8';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 开始提示
      if (state === 'ready') {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('点击开始 / 空格发球', W / 2, H / 2 - 10);
      }

      if (state === 'over') {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText('游戏结束', W / 2, H / 2 - 16);
        ctx.font = '18px sans-serif';
        ctx.fillText(`得分：${score}   最高：${best}`, W / 2, H / 2 + 18);
        ctx.font = '15px sans-serif';
        ctx.fillText('点击再来一次', W / 2, H / 2 + 48);
      }
    }

    // 固定 60Hz 逻辑步长：高刷屏（120/144Hz）下速度不再变快
    const STEP = 1000 / 60;
    let lastTime = performance.now(), acc = 0;
    function isOpen() { return !window.__gameModal || window.__gameModal.current() === 'breakout'; }
    function loop(now) {
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(100, now - lastTime);
      lastTime = now;
      if (!isOpen()) { acc = 0; return; }
      acc += dt;
      while (acc >= STEP) { update(); acc -= STEP; }
      draw();
      updateScore();
    }

    function movePaddle(clientX) {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * (W / rect.width);
      paddle.x = clamp(x, paddle.w / 2, W - paddle.w / 2);
      if (state === 'ready' && ball) {
        ball.x = paddle.x;
        ball.y = PADDLE_Y - BALL_R - 4;
      }
    }

    canvas.addEventListener('mousemove', e => movePaddle(e.clientX));
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches[0]) movePaddle(e.touches[0].clientX);
    }, { passive: false });
    canvas.addEventListener('click', onStartBtn);
    window.addEventListener('keydown', e => {
      if (window.__gameModal && !window.__gameModal.wantsKeys('breakout', e)) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onStartBtn();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const step = (e.key === 'ArrowLeft' ? -1 : 1) * 24;
        movePaddle((paddle.x / W) * canvas.getBoundingClientRect().width + step + canvas.getBoundingClientRect().left);
      }
    });

    function onStartBtn() {
      if (state === 'ready') launchBall();
      else if (state === 'over' || state === 'won') resetGame();
    }

    readBest();
    resetGame();
    updateScore();
    rafId = requestAnimationFrame(loop);

    if (window.__gameHooks) {
      window.__gameHooks.breakout = (action) => {
        if (action === 'open') resetGame();
        if (action === 'close' && state === 'playing') { saveBest(); }
      };
    }
  });
})();