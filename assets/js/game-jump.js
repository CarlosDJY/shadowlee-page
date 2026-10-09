/**
 * 熊猫跳一跳
 * 按住蓄力，松开起跳，跳到下一个台子上。落在台子正中心算“完美”，连续完美得分翻倍递增（+2、+4、+6…）。
 * 等距视角：世界坐标 (x, y) 在地面上，z 向上；下一个台子只会出现在 +x（屏幕右上）或 +y（屏幕左上）方向。
 */
(function () {
  'use strict';

  window.addEventListener('load', () => {
    const canvas = document.getElementById('jump-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const GM = window.__gameModal || {};
    const FONT = GM.FONT || 'sans-serif';
    const setNum = (el, v) => { if (!el) return; if (GM.setNum) GM.setNum(el, v); else el.textContent = v; };
    const scoreEl = document.getElementById('jump-score');
    const comboEl = document.getElementById('jump-combo');
    const bestEl = document.getElementById('jump-best');
    const BEST_KEY = 'jump_best';

    // ---- 参数 ----
    const COS30 = Math.cos(Math.PI / 6), SIN30 = 0.5;
    const DEPTH = 34;            // 台子侧面高度（屏幕像素）
    const CHARGE_MAX_MS = 1300;  // 蓄力上限
    const DIST_PER_MS = 0.2;     // 每毫秒蓄力对应的跳跃距离
    const JUMP_FRAMES = 32;      // 一次跳跃的时长（帧）
    const JUMP_HEIGHT = 90;
    const PERFECT_R = 0.28;      // 落点离中心 < 台子半宽 × 这个比例 算完美
    const PANDA_R = 15;

    // 台子配色：站点粉 / 紫 / 蓝 + 竹桩
    const BOX_COLORS = [
      { top: '#ffd1df', left: '#ff9fbd', right: '#f07ea3' },
      { top: '#e3d4ff', left: '#c4abf5', right: '#a98be6' },
      { top: '#d6e4ff', left: '#9dbcff', right: '#7aa0f2' },
      { top: '#ffffff', left: '#d9e3f7', right: '#bccbea' },
    ];

    let platforms, cur, next, panda, phase, score, combo, best, cam, camTarget;
    let chargeStart = 0, charge = 0, jump = null, popups = [], fallT = 0;
    try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { best = 0; }

    // 世界坐标 -> 屏幕坐标
    function proj(x, y, z = 0) {
      return {
        x: (x - y) * COS30 - cam.x + W / 2,
        y: -(x + y) * SIN30 - z - cam.y + H * 0.56,
      };
    }
    function camFor(a, b) {
      // 让当前台和下一个台的中点落在屏幕中下部
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      return { x: (mx - my) * COS30, y: -(mx + my) * SIN30 };
    }

    function platformSize() {
      // 越往后台子越小
      return Math.max(20, 42 - score * 0.35) + Math.random() * 10;
    }

    function makeNext(from) {
      const dir = Math.random() < 0.5 ? 'x' : 'y';
      const h = platformSize();
      const gap = from.h + h + 30 + Math.random() * (90 + Math.min(score, 40) * 1.5);
      const round = Math.random() < 0.3;
      return {
        x: from.x + (dir === 'x' ? gap : 0),
        y: from.y + (dir === 'y' ? gap : 0),
        h,
        round,
        colors: BOX_COLORS[Math.floor(Math.random() * BOX_COLORS.length)],
        squash: 0,
      };
    }

    function reset() {
      score = 0;
      combo = 0;
      const first = { x: 0, y: 0, h: 44, round: false, colors: BOX_COLORS[3], squash: 0 };
      platforms = [first];
      cur = first;
      next = makeNext(first);
      platforms.push(next);
      panda = { x: 0, y: 0, z: 0, squash: 0, tilt: 0, alpha: 1 };
      cam = camFor(cur, next);
      camTarget = { ...cam };
      phase = 'ready';
      popups = [];
      jump = null;
      updateHud();
    }

    function updateHud() {
      setNum(scoreEl, score);
      setNum(comboEl, combo);
      setNum(bestEl, Math.max(best, score));
    }

    function saveBest() {
      if (score > best) {
        best = score;
        try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
      }
      updateHud();
    }

    // ---- 输入：按住蓄力，松开起跳 ----
    function press() {
      if (phase === 'over') { reset(); return; }
      if (phase !== 'ready' && phase !== 'idle') return;
      phase = 'charging';
      chargeStart = performance.now();
    }
    function release() {
      if (phase !== 'charging') return;
      const held = Math.min(CHARGE_MAX_MS, performance.now() - chargeStart);
      const dist = held * DIST_PER_MS;
      // 朝下一个台子中心的方向跳（和原版一样会自动修正横向偏差）
      let dx = next.x - panda.x, dy = next.y - panda.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      jump = { sx: panda.x, sy: panda.y, tx: panda.x + dx * dist, ty: panda.y + dy * dist, t: 0 };
      phase = 'jumping';
      charge = 0;
    }

    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('keydown', (e) => {
      if (window.__gameModal && !window.__gameModal.wantsKeys('jump', e)) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!e.repeat) press();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') release();
    });

    function onPlatform(p, x, y, pad = 0) {
      if (p.round) return Math.hypot(x - p.x, y - p.y) <= p.h + pad;
      return Math.abs(x - p.x) <= p.h + pad && Math.abs(y - p.y) <= p.h + pad;
    }

    function land() {
      const { x, y } = panda;
      if (onPlatform(next, x, y)) {
        const d = Math.hypot(x - next.x, y - next.y);
        let gain;
        if (d < next.h * PERFECT_R) {
          combo++;
          gain = combo * 2;
          popups.push({ x, y, text: combo > 1 ? `完美 ×${combo}  +${gain}` : `完美  +${gain}`, t: 0, pink: true });
        } else {
          combo = 0;
          gain = 1;
          popups.push({ x, y, text: '+1', t: 0 });
        }
        score += gain;
        next.squash = 1;
        cur = next;
        next = makeNext(cur);
        platforms.push(next);
        if (platforms.length > 6) platforms.shift();
        camTarget = camFor(cur, next);
        phase = 'idle';
        updateHud();
      } else if (onPlatform(cur, x, y)) {
        // 没跳出当前台子，原地落下，不扣分
        phase = 'idle';
      } else {
        // 掉下去了
        phase = 'falling';
        fallT = 0;
        // 落点擦着台子边缘时往外倒
        const edge = onPlatform(next, x, y, PANDA_R) ? next : (onPlatform(cur, x, y, PANDA_R) ? cur : null);
        panda.tilt = edge ? Math.sign((x - edge.x) - (y - edge.y) || 1) * 0.05 : 0;
      }
    }

    function update() {
      // 镜头平滑跟随
      cam.x += (camTarget.x - cam.x) * 0.08;
      cam.y += (camTarget.y - cam.y) * 0.08;

      for (const p of platforms) p.squash = Math.max(0, p.squash - 0.08);
      for (const q of popups) q.t++;
      popups = popups.filter(q => q.t < 60);

      if (phase === 'charging') {
        charge = Math.min(1, (performance.now() - chargeStart) / CHARGE_MAX_MS);
        panda.squash = charge * 0.4;
        cur.squash = Math.max(cur.squash, charge * 0.8); // 台子也被压下去一点
      } else if (phase === 'jumping') {
        jump.t++;
        const k = jump.t / JUMP_FRAMES;
        panda.x = jump.sx + (jump.tx - jump.sx) * k;
        panda.y = jump.sy + (jump.ty - jump.sy) * k;
        panda.z = Math.sin(Math.PI * k) * JUMP_HEIGHT;
        panda.squash = Math.max(-0.15, panda.squash - 0.06) * (k < 0.9 ? 1 : 0);
        panda.flip = k * Math.PI * 2; // 空中转一圈
        if (jump.t >= JUMP_FRAMES) {
          panda.z = 0;
          panda.flip = 0;
          land();
        }
      } else if (phase === 'falling') {
        fallT++;
        panda.z -= 2 + fallT * 0.35;
        panda.tilt += panda.tilt ? Math.sign(panda.tilt) * 0.06 : 0;
        panda.alpha = Math.max(0, 1 - fallT / 40);
        if (fallT > 40) {
          phase = 'over';
          saveBest();
        }
      } else {
        panda.squash *= 0.7;
      }
    }

    // ---- 绘制 ----
    function drawBox(p) {
      const h = p.h, dz = -p.squash * 6;
      const T = (x, y) => proj(p.x + x, p.y + y, dz);
      const a = T(h, h), b = T(h, -h), c = T(-h, -h), d = T(-h, h);
      // 上表面：a(远) b(右) c(近) d(左)
      // 左侧面（朝 -y）: c -> b 往下
      ctx.fillStyle = p.colors.left;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x, c.y + DEPTH); ctx.lineTo(d.x, d.y + DEPTH);
      ctx.closePath(); ctx.fill();
      // 右侧面（朝 -x）
      ctx.fillStyle = p.colors.right;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y + DEPTH); ctx.lineTo(c.x, c.y + DEPTH);
      ctx.closePath(); ctx.fill();
      // 顶面
      ctx.fillStyle = p.colors.top;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
      ctx.closePath(); ctx.fill();
      // 中心靶点（提示完美落点）
      const m = proj(p.x, p.y, dz);
      ctx.fillStyle = 'rgba(19, 32, 74, 0.08)';
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, h * PERFECT_R * COS30 * 2, h * PERFECT_R, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawStump(p) {
      // 竹桩：圆柱
      const r = p.h, dz = -p.squash * 6;
      const m = proj(p.x, p.y, dz);
      const rx = r * COS30 * Math.SQRT2, ry = r * SIN30 * Math.SQRT2;
      const g = ctx.createLinearGradient(m.x - rx, 0, m.x + rx, 0);
      g.addColorStop(0, '#5fb760'); g.addColorStop(0.5, '#86cf7f'); g.addColorStop(1, '#3f8f4a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(m.x - rx, m.y);
      ctx.lineTo(m.x - rx, m.y + DEPTH);
      ctx.ellipse(m.x, m.y + DEPTH, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(m.x + rx, m.y);
      ctx.closePath();
      ctx.fill();
      // 竹节
      ctx.strokeStyle = 'rgba(40, 92, 50, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(m.x, m.y + DEPTH * 0.55, rx, ry, 0, 0, Math.PI); ctx.stroke();
      // 顶面（年轮）
      ctx.fillStyle = '#e9f6d8';
      ctx.beginPath(); ctx.ellipse(m.x, m.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(95, 183, 96, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(m.x, m.y, rx * 0.62, ry * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(19, 32, 74, 0.08)';
      ctx.beginPath(); ctx.ellipse(m.x, m.y, rx * PERFECT_R, ry * PERFECT_R, 0, 0, Math.PI * 2); ctx.fill();
    }

    function drawPanda() {
      const onTop = phase !== 'jumping' && phase !== 'falling';
      const p = proj(panda.x, panda.y, panda.z - (onTop ? cur.squash * 6 : 0));
      // 影子（只在台子上方时画）
      if (phase !== 'falling') {
        const s = proj(panda.x, panda.y, 0);
        ctx.fillStyle = `rgba(19, 32, 74, ${0.18 * (1 - panda.z / (JUMP_HEIGHT * 1.6))})`;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, PANDA_R * 1.1, PANDA_R * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.save();
      ctx.globalAlpha = panda.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(panda.tilt + (panda.flip ? Math.sin(panda.flip / 2) * 0.25 : 0));
      const sy = 1 - panda.squash, sx = 1 + panda.squash * 0.6;
      ctx.scale(sx, sy);
      const r = PANDA_R;
      // 身体
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(0, -r * 0.9, r * 0.95, r * 1.0, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1b1f';
      ctx.beginPath(); ctx.ellipse(-r * 0.75, -r * 0.6, r * 0.32, r * 0.5, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.75, -r * 0.6, r * 0.32, r * 0.5, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.02, r * 0.3, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.4, -r * 0.02, r * 0.3, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      // 头
      const hy = -r * 2.15;
      ctx.beginPath(); ctx.arc(-r * 0.62, hy - r * 0.62, r * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.62, hy - r * 0.62, r * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, hy, r * 0.92, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(19, 32, 74, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#1b1b1f';
      ctx.beginPath(); ctx.ellipse(-r * 0.36, hy - r * 0.02, r * 0.22, r * 0.29, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.36, hy - r * 0.02, r * 0.22, r * 0.29, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-r * 0.32, hy - r * 0.07, r * 0.08, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.32, hy - r * 0.07, r * 0.08, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1b1f';
      ctx.beginPath(); ctx.ellipse(0, hy + r * 0.3, r * 0.12, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255, 143, 179, 0.75)';
      ctx.beginPath(); ctx.arc(-r * 0.58, hy + r * 0.34, r * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.58, hy + r * 0.34, r * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function overlay(title, sub, hint) {
      ctx.fillStyle = 'rgba(19, 32, 74, 0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = `600 34px ${FONT}`;
      ctx.fillText(title, W / 2, H * 0.24);
      if (sub) {
        ctx.font = `500 18px ${FONT}`;
        ctx.fillStyle = '#dbe6ff';
        ctx.fillText(sub, W / 2, H * 0.24 + 34);
      }
      if (hint) {
        ctx.font = `500 15px ${FONT}`;
        ctx.fillStyle = '#aebfe6';
        ctx.fillText(hint, W / 2, H * 0.24 + 64);
      }
    }

    function draw() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#f4f8ff');
      g.addColorStop(1, '#d4e2ff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // 远的先画：x + y 越大越远
      const order = platforms.slice().sort((a, b) => (b.x + b.y) - (a.x + a.y));
      const pandaDepth = panda.x + panda.y;
      let pandaDrawn = false;
      for (const p of order) {
        // 熊猫掉落时画在它前方台子的后面
        if (!pandaDrawn && phase === 'falling' && (p.x + p.y) < pandaDepth - 1) { drawPanda(); pandaDrawn = true; }
        if (p.round) drawStump(p); else drawBox(p);
      }
      if (!pandaDrawn) drawPanda();

      // 蓄力条
      if (phase === 'charging') {
        const bw = 120, bx = W / 2 - bw / 2, by = H - 34;
        ctx.fillStyle = 'rgba(19, 32, 74, 0.12)';
        ctx.beginPath(); ctx.roundRect(bx, by, bw, 8, 4); ctx.fill();
        ctx.fillStyle = charge < 1 ? '#2f6fed' : '#ff6f9c';
        ctx.beginPath(); ctx.roundRect(bx, by, bw * charge, 8, 4); ctx.fill();
      }

      // 飘字
      ctx.textAlign = 'center';
      for (const q of popups) {
        const s = proj(q.x, q.y, 70 + q.t * 0.8);
        ctx.globalAlpha = 1 - q.t / 60;
        ctx.font = `600 ${q.pink ? 20 : 18}px ${FONT}`;
        ctx.fillStyle = q.pink ? '#e64980' : '#2f6fed';
        ctx.fillText(q.text, s.x, s.y);
      }
      ctx.globalAlpha = 1;

      if (phase === 'ready') {
        overlay('熊猫跳一跳', '按住蓄力，松开起跳', '落在台子正中心有连击加分');
      } else if (phase === 'over') {
        overlay('掉下去了', `得分 ${score}　最高 ${best}`, '点击画面再来一局');
      }
    }

    // ---- 循环：固定 60Hz，弹窗没打开时不运算 ----
    const STEP = 1000 / 60;
    let lastTime = performance.now(), acc = 0;
    function isOpen() { return !window.__gameModal || window.__gameModal.current() === 'jump'; }
    function loop(now) {
      requestAnimationFrame(loop);
      const dt = Math.min(100, now - lastTime);
      lastTime = now;
      if (!isOpen()) { acc = 0; return; }
      acc += dt;
      while (acc >= STEP) { update(); acc -= STEP; }
      draw();
    }

    reset();
    requestAnimationFrame(loop);

    window.__gameHooks = window.__gameHooks || {};
    window.__gameHooks.jump = (action) => {
      if (action === 'close' && phase !== 'ready' && phase !== 'over') saveBest();
      if (action === 'open' || action === 'close') reset();
    };
  });
})();
