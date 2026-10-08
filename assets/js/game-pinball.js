/**
 * 熊猫弹球 - 基于开源 html5-game-pinball (MIT) 改造
 * 把小球换成表情图片
 */
(function () {
  'use strict';
  const base = (window.SITE_BASE || '/').replace(/\/$/, '');

  window.addEventListener('load', () => {
    const canvas = document.getElementById('pinball-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('pinball-score');
    const startEl = document.getElementById('pinball-start');
    const restartEl = document.getElementById('pinball-restart');

    const W = canvas.width, H = canvas.height;
    const BEST_KEY = 'pinball-best';
    const GRAV = 0.22, BALL_R = 16;

    let ball, flippers, bumpers, score, balls, best, running, left, right, ballImg, ballLoaded = false;

    // 选一个表情当球
    const meta = window.EMOTE_META || { items: [] };
    const all = meta.items.filter(i => i.file);
    const ballItem = all.find(i => /魔法|熊猫|巫师/.test(i.name || '')) || all[0];
    if (ballItem) {
      ballImg = new Image();
      ballImg.onload = () => { ballLoaded = true; };
      ballImg.src = `${base}/assets/images/emotes/${ballItem.file}`;
    }

    function bestKey() { try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { return 0; } }

    function newGame() {
      score = 0; balls = 3; best = bestKey();
      if (scoreEl) scoreEl.textContent = '0';
      bumpers = [
        { x: W / 2, y: 180, r: 28, flash: 0 },
        { x: W / 2 - 90, y: 270, r: 22, flash: 0 },
        { x: W / 2 + 90, y: 270, r: 22, flash: 0 },
      ];
      flippers = [
        { px: 110, py: 540, len: 80, base: 0.5, ang: 0.5, side: 1 },
        { px: 310, py: 540, len: 80, base: Math.PI - 0.5, ang: Math.PI - 0.5, side: -1 },
      ];
      running = false; ball = null; left = false; right = false;
      draw();
    }

    function launch() {
      if (ball) return;
      if (balls <= 0) newGame();
      ball = { x: 200, y: H - 40, vx: (Math.random() * 2 - 1) * 2, vy: -9 };
      running = true;
    }

    function flipperTip(f) {
      return { x: f.px + Math.cos(f.ang) * f.len * f.side, y: f.py + Math.sin(f.ang) * f.len };
    }

    function collideFlipper(f) {
      const tip = flipperTip(f);
      const ax = f.px, ay = f.py, bx = tip.x, by = tip.y;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = ((ball.x - ax) * dx + (ball.y - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + dx * t, cy = ay + dy * t;
      const ddx = ball.x - cx, ddy = ball.y - cy;
      const d = Math.hypot(ddx, ddy);
      const R = BALL_R + 6;
      if (d < R) {
        const nx = ddx / (d || 1), ny = ddy / (d || 1);
        ball.x = cx + nx * R; ball.y = cy + ny * R;
        const dot = ball.vx * nx + ball.vy * ny;
        ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny;
        const boost = f.ang !== f.base ? 4 : 1;
        ball.vx *= boost; ball.vy *= boost;
      }
    }

    function update() {
      if (!ball) return;
      ball.vy += GRAV;
      ball.x += ball.vx; ball.y += ball.vy;

      if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx *= -0.8; }
      if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx *= -0.8; }
      if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy *= -0.8; }
      const slope = (W / 2 - 60 - 30) / (H - 220);
      if (ball.y > 220 && ball.y < H - 80) {
        const leftWallX = 30 + (ball.y - 220) * slope;
        const rightWallX = W - 30 - (ball.y - 220) * slope;
        if (ball.x < leftWallX + BALL_R) { ball.x = leftWallX + BALL_R; ball.vx += 0.6; }
        if (ball.x > rightWallX - BALL_R) { ball.x = rightWallX - BALL_R; ball.vx -= 0.6; }
      }

      for (const b of bumpers) {
        const d = Math.hypot(ball.x - b.x, ball.y - b.y);
        if (d < b.r + BALL_R) {
          const nx = (ball.x - b.x) / (d || 1), ny = (ball.y - b.y) / (d || 1);
          ball.x = b.x + nx * (b.r + BALL_R); ball.y = b.y + ny * (b.r + BALL_R);
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny;
          ball.vx *= 1.05; ball.vy *= 1.05;
          score += 50; if (scoreEl) scoreEl.textContent = String(score); b.flash = 1;
        }
        if (b.flash > 0) b.flash -= 0.08;
      }

      collideFlipper(flippers[0]);
      collideFlipper(flippers[1]);

      if (ball.y > H - 10) { balls--; ball = null; running = false; if (balls <= 0) endGame(); else { if (startEl) startEl.textContent = '发射 (' + balls + ')'; } }
    }

    function endGame() {
      if (score > best) { best = score; try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {} }
      if (startEl) startEl.textContent = '重开';
    }

    function draw() {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#1a1038'); g.addColorStop(1, '#0c0820');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(120,140,255,0.4)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(30, 220); ctx.lineTo(W / 2 - 60, H - 80); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W - 30, 220); ctx.lineTo(W / 2 + 60, H - 80); ctx.stroke();

      for (const b of bumpers) {
        ctx.save(); ctx.shadowBlur = 16; ctx.shadowColor = b.flash > 0 ? '#ffe66d' : '#ff5e7e';
        ctx.fillStyle = b.flash > 0 ? '#ffe66d' : '#ff5e7e';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }

      for (const f of flippers) {
        const tip = flipperTip(f);
        ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = '#80ed99'; ctx.strokeStyle = '#80ed99'; ctx.lineWidth = 12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.px, f.py); ctx.lineTo(tip.x, tip.y); ctx.stroke(); ctx.restore();
      }

      if (ball) {
        if (ballLoaded && ballImg && ballImg.complete) {
          ctx.save();
          ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
          ctx.drawImage(ballImg, ball.x - BALL_R, ball.y - BALL_R, BALL_R * 2, BALL_R * 2);
          ctx.restore();
          ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        } else {
          ctx.save(); ctx.shadowBlur = 14; ctx.shadowColor = '#4cc9f0'; ctx.fillStyle = '#f0f4ff';
          ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }
    }

    function loop() {
      if (running && ball) update();
      draw();
      requestAnimationFrame(loop);
    }

    function setFlipper(on) {
      flippers[0].ang = on ? -0.35 : 0.5;
      flippers[1].ang = on ? Math.PI + 0.35 : Math.PI - 0.5;
    }

    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') left = true;
      else if (e.key === 'ArrowRight') right = true;
      else return;
      setFlipper(left || right);
    });
    window.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft') left = false;
      else if (e.key === 'ArrowRight') right = false;
      else return;
      setFlipper(left || right);
    });

    if (startEl) startEl.addEventListener('click', () => { launch(); if (startEl) startEl.textContent = '发射 (' + balls + ')'; });
    if (restartEl) restartEl.addEventListener('click', () => { newGame(); if (startEl) startEl.textContent = '发射 (3)'; });

    newGame();
    requestAnimationFrame(loop);

    if (window.__gameHooks) {
      window.__gameHooks.pinball = (action) => {
        if (action === 'open') { newGame(); if (startEl) startEl.textContent = '发射 (3)'; }
      };
    }
  });
})();