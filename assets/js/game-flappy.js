/**
 * 李豆沙 Flappy - 熊猫版 Flappy Bird
 * 小鸟使用「魔法熊猫」表情，纯前端实现
 */
(function () {
  'use strict';
  const base = (window.SITE_BASE || '/').replace(/\/$/, '');

  window.addEventListener('load', () => {
    const canvas = document.getElementById('flappy-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    // 小鸟图片：优先用「魔法熊猫」，否则取第一个表情
    const meta = window.EMOTE_META || { items: [] };
    const all = meta.items.filter(i => i.file);
    const birdItem = all.find(i => /魔法|巫师|小巫师/.test(i.name || '')) || all[0];
    let birdImg = null;
    if (birdItem) {
      birdImg = new Image();
      birdImg.src = `${base}/assets/images/emotes/${birdItem.file}`;
    }

    const GROUND_H = 60;
    const BIRD_X = 80;
    const BIRD_R = 18;
    const GRAVITY = 0.45;
    const JUMP = -7.5;
    const PIPE_W = 60;
    const GAP = 160;
    const PIPE_SPEED = 2.6;
    const PIPE_INTERVAL = 95; // 帧

    let bird, pipes, score, best, frame, running, gameOver, rafId;
    best = parseInt(localStorage.getItem('flappy_best') || '0', 10);

    function reset() {
      bird = { y: H / 2, vy: 0, rot: 0 };
      pipes = [];
      score = 0;
      frame = 0;
      running = true;
      gameOver = false;
    }

    function jump() {
      if (gameOver) { reset(); return; }
      if (!running) return;
      bird.vy = JUMP;
    }

    function spawnPipe() {
      const margin = 60;
      const gapTop = margin + Math.random() * (H - GROUND_H - GAP - margin * 2);
      pipes.push({ x: W, gapTop });
    }

    function rectHit(bx, by, br, rx, ry, rw, rh) {
      const cx = Math.max(rx, Math.min(bx, rx + rw));
      const cy = Math.max(ry, Math.min(by, ry + rh));
      const dx = bx - cx, dy = by - cy;
      return (dx * dx + dy * dy) < (br * br);
    }

    function update() {
      if (!running || gameOver) return;
      frame++;
      bird.vy += GRAVITY;
      bird.y += bird.vy;
      bird.rot = Math.max(-0.5, Math.min(1.2, bird.vy / 10));

      if (frame % PIPE_INTERVAL === 0) spawnPipe();

      for (const p of pipes) {
        p.x -= PIPE_SPEED;
        // 计分：鸟越过管道中心
        if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.passed = true;
          score++;
        }
        // 碰撞
        const hitTop = rectHit(BIRD_X, bird.y, BIRD_R, p.x, 0, PIPE_W, p.gapTop);
        const hitBottom = rectHit(BIRD_X, bird.y, BIRD_R, p.x, p.gapTop + GAP, PIPE_W, H - GROUND_H - (p.gapTop + GAP));
        if (hitTop || hitBottom) die();
      }
      pipes = pipes.filter(p => p.x + PIPE_W > -10);

      // 地面 / 天花板
      if (bird.y + BIRD_R >= H - GROUND_H) { bird.y = H - GROUND_H - BIRD_R; die(); }
      if (bird.y - BIRD_R <= 0) { bird.y = BIRD_R; bird.vy = 0; }
    }

    function die() {
      if (gameOver) return;
      gameOver = true;
      running = false;
      if (score > best) { best = score; localStorage.setItem('flappy_best', String(best)); }
    }

    function draw() {
      // 天空
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#aee7ff'); g.addColorStop(1, '#e7f7ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // 管道
      ctx.fillStyle = '#5bbf5b';
      ctx.strokeStyle = '#3a8f3a';
      ctx.lineWidth = 3;
      for (const p of pipes) {
        ctx.fillRect(p.x, 0, PIPE_W, p.gapTop);
        ctx.strokeRect(p.x, 0, PIPE_W, p.gapTop);
        const bottomY = p.gapTop + GAP;
        ctx.fillRect(p.x, bottomY, PIPE_W, H - GROUND_H - bottomY);
        ctx.strokeRect(p.x, bottomY, PIPE_W, H - GROUND_H - bottomY);
      }

      // 地面
      ctx.fillStyle = '#c9a36a';
      ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
      ctx.fillStyle = '#7ec850';
      ctx.fillRect(0, H - GROUND_H, W, 12);

      // 小鸟
      ctx.save();
      ctx.translate(BIRD_X, bird.y);
      ctx.rotate(bird.rot);
      if (birdImg && birdImg.complete && birdImg.naturalWidth) {
        const s = BIRD_R * 2;
        ctx.drawImage(birdImg, -s / 2, -s / 2, s, s);
      } else {
        ctx.fillStyle = '#f5c542';
        ctx.beginPath(); ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(BIRD_R / 2, -BIRD_R / 3, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // 分数
      ctx.fillStyle = '#333';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('得分: ' + score, W / 2, 44);
      ctx.font = '16px sans-serif';
      ctx.fillText('最高: ' + best, W / 2, 68);

      if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText('游戏结束', W / 2, H / 2 - 20);
        ctx.font = '20px sans-serif';
        ctx.fillText('得分: ' + score, W / 2, H / 2 + 16);
        ctx.font = '16px sans-serif';
        ctx.fillText('点击或按空格重新开始', W / 2, H / 2 + 48);
      } else if (!running) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = '20px sans-serif';
        ctx.fillText('点击或按空格开始', W / 2, H / 2);
      }
    }

    function loop() {
      update();
      draw();
      rafId = requestAnimationFrame(loop);
    }

    canvas.addEventListener('click', () => {
      if (!running && !gameOver) reset();
      jump();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!running && !gameOver) reset();
        jump();
      }
    });

    reset();
    running = false; // 等待第一次点击开始
    loop();

    if (window.__gameHooks) {
      window.__gameHooks.flappy = (action) => {
        if (action === 'open') { reset(); running = false; }
      };
    }
  });
})();