/**
 * 李豆沙 Flappy - 熊猫版 Flappy Bird
 * 小鸟使用「魔法熊猫」表情，难度随得分逐步提升
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
    const BIRD_R = 32; // 比原来更大
    const GRAVITY = 0.35;
    const JUMP = -6.5;
    const PIPE_W = 60;
    const GAP_BASE = 190; // 初始缺口更大，更简单
    const PIPE_SPEED_BASE = 2.0;
    const PIPE_INTERVAL_BASE = 115; // 管道间隔更大

    const HIT_R = BIRD_R * 0.78; // 碰撞半径略小于图片，表情图四周有留白

    let bird, pipes, score, best, frame, running, gameOver, rafId, nextPipeIn;
    try { best = parseInt(localStorage.getItem('flappy_best') || '0', 10) || 0; } catch (e) { best = 0; }

    function reset() {
      bird = { y: H / 2, vy: 0, rot: 0 };
      pipes = [];
      score = 0;
      frame = 0;
      nextPipeIn = 60; // 开局约 1 秒后出第一根管道
      running = true;
      gameOver = false;
    }

    function jump() {
      if (gameOver) { reset(); return; }
      if (!running) return;
      bird.vy = JUMP;
    }

    // 难度随得分越来越高
    function difficulty() {
      return {
        speed: PIPE_SPEED_BASE + score * 0.06,
        gap: Math.max(120, GAP_BASE - score * 2.5),
        interval: Math.max(70, PIPE_INTERVAL_BASE - score * 1.5),
      };
    }

    function spawnPipe() {
      const d = difficulty();
      const margin = 60;
      const gapTop = margin + Math.random() * (H - GROUND_H - d.gap - margin * 2);
      pipes.push({ x: W, gapTop, gap: d.gap });
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
      bird.rot = Math.max(-0.5, Math.min(1.2, bird.vy / 12));

      const d = difficulty();
      // 用倒计时生成管道：间隔随难度变化时不会出现两根管道挤在一起
      if (--nextPipeIn <= 0) { spawnPipe(); nextPipeIn = Math.round(d.interval); }

      for (const p of pipes) {
        p.x -= d.speed;
        // 计分：鸟越过管道中心
        if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.passed = true;
          score++;
        }
        // 碰撞
        const hitTop = rectHit(BIRD_X, bird.y, HIT_R, p.x, 0, PIPE_W, p.gapTop);
        const hitBottom = rectHit(BIRD_X, bird.y, HIT_R, p.x, p.gapTop + p.gap, PIPE_W, H - GROUND_H - (p.gapTop + p.gap));
        if (hitTop || hitBottom) die();
      }
      pipes = pipes.filter(p => p.x + PIPE_W > -10);

      // 地面 / 天花板
      if (bird.y + HIT_R >= H - GROUND_H) { bird.y = H - GROUND_H - HIT_R; die(); }
      if (bird.y - BIRD_R <= 0) { bird.y = BIRD_R; bird.vy = 0; }
    }

    function die() {
      if (gameOver) return;
      gameOver = true;
      running = false;
      if (score > best) { best = score; try { localStorage.setItem('flappy_best', String(best)); } catch (e) {} }
    }

    function draw() {
      // 天空
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#aee7ff'); g.addColorStop(1, '#e7f7ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // 管道
      const d = difficulty();
      ctx.fillStyle = '#5bbf5b';
      ctx.strokeStyle = '#3a8f3a';
      ctx.lineWidth = 3;
      for (const p of pipes) {
        ctx.fillRect(p.x, 0, PIPE_W, p.gapTop);
        ctx.strokeRect(p.x, 0, PIPE_W, p.gapTop);
        const bottomY = p.gapTop + p.gap;
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

    // 固定 60Hz 逻辑步长：高刷屏下速度不再变快
    const STEP = 1000 / 60;
    let lastTime = performance.now(), acc = 0;
    function isOpen() { return !window.__gameModal || window.__gameModal.current() === 'flappy'; }
    function loop(now) {
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(100, now - lastTime);
      lastTime = now;
      if (!isOpen()) { acc = 0; return; }
      acc += dt;
      while (acc >= STEP) { update(); acc -= STEP; }
      draw();
    }

    canvas.addEventListener('click', () => {
      if (!running && !gameOver) reset();
      jump();
    });
    window.addEventListener('keydown', (e) => {
      if (window.__gameModal && !window.__gameModal.wantsKeys('flappy', e)) return;
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!running && !gameOver) reset();
        jump();
      }
    });

    reset();
    running = false; // 等待第一次点击开始
    rafId = requestAnimationFrame(loop);

    if (window.__gameHooks) {
      window.__gameHooks.flappy = (action) => {
        if (action === 'close' && running && !gameOver) die(); // 中途关闭也记录最高分
        if (action === 'open' || action === 'close') { reset(); running = false; }
      };
    }
  });
})();