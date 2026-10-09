/**
 * 熊猫大胃王
 * 每只熊猫头顶一个数字。碰到比自己小的就吃掉，对方的数字加到自己身上；碰到比自己大的就被吃，游戏结束。
 * 头顶数字绿色 = 能吃，红色 = 危险。比你大的会追你，比你小的会跑。
 * 场地比屏幕大，镜头跟着自己走，越大镜头拉得越远。
 * 自己是“咬Kmx”表情；场地是一张野餐桌布（粉格子 + 花边 + 散落的竹叶和团子）。
 */
(function () {
  'use strict';

  window.addEventListener('load', () => {
    const canvas = document.getElementById('number-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const GM = window.__gameModal || {};
    const FONT = GM.FONT || 'sans-serif';
    const setNum = (el, v) => { if (!el) return; if (GM.setNum) GM.setNum(el, v); else el.textContent = v; };
    const numEl = document.getElementById('number-value');
    const bestEl = document.getElementById('number-best');
    const eatenEl = document.getElementById('number-eaten');
    const BEST_KEY = 'number_best';
    const base = (window.SITE_BASE || '/').replace(/\/$/, '');

    // 玩家形象：“咬Kmx”表情（找不到就退回画熊猫脸）
    const meItem = ((window.EMOTE_META || {}).items || []).find(i => i.name === '咬Kmx' || /咬kmx/i.test(i.file || ''));
    const meImg = new Image();
    if (meItem) meImg.src = `${base}/assets/images/emotes/${meItem.file}`;

    // 桌布：粉色格子图案（一格 80 单位，两条半透明色带交叉）
    const gingham = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 80;
      const g = c.getContext('2d');
      g.fillStyle = '#fffafc'; g.fillRect(0, 0, 80, 80);
      g.fillStyle = 'rgba(255, 143, 179, 0.16)';
      g.fillRect(0, 0, 40, 80);
      g.fillRect(0, 0, 80, 40);
      g.fillStyle = 'rgba(255, 255, 255, 0.5)';
      g.fillRect(0, 38, 80, 1); g.fillRect(38, 0, 1, 80);
      return ctx.createPattern(c, 'repeat');
    })();

    const WORLD = 1600;           // 正方形场地边长
    const NPC_COUNT = 26;
    const PLAYER_SPEED = 2.7;

    let player, npcs, phase, best, eaten, effects, toasts, view, decos = [], keys = {}, pointer = null;
    try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { best = 0; }

    const radiusOf = (n) => 13 + Math.log2(n + 1) * 5.5;
    const fmt = (n) => (n >= 100000 ? (n / 1000).toFixed(0) + 'k' : n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n));
    const rand = (a, b) => a + Math.random() * (b - a);

    // 按玩家当前数字生成一只 NPC：约 62% 比你小（能吃），38% 比你大（危险）
    function npcNumber(n) {
      if (Math.random() < 0.62) {
        // 比你小：[n×0.15, n) 之间，至少为 1，且一定 < n
        return Math.min(n - 1, Math.max(1, Math.floor(rand(Math.max(1, n * 0.15), n))));
      }
      return Math.max(n + 1, Math.floor(rand(n * 1.15, n * 2.8)));
    }

    function spawnNpc(far) {
      const n = npcNumber(player.n);
      let x, y, tries = 0;
      do {
        x = rand(40, WORLD - 40);
        y = rand(40, WORLD - 40);
        tries++;
        // 新生成的要离玩家足够远（在镜头外），避免一出生就撞脸
      } while (tries < 30 && Math.hypot(x - player.x, y - player.y) < (far ? 420 / view.scale : 260));
      const a = Math.random() * Math.PI * 2;
      return { x, y, n, r: radiusOf(n), dir: a, wanderT: rand(30, 120), hue: Math.floor(Math.random() * 4) };
    }

    function reset() {
      player = { x: WORLD / 2, y: WORLD / 2, n: 3, r: radiusOf(3), vx: 0, vy: 0, face: 1 };
      view = { scale: 1, x: player.x, y: player.y };
      npcs = [];
      // 开局多放一些 1 和 2，保证有东西吃
      for (let i = 0; i < NPC_COUNT; i++) {
        const npc = spawnNpc(false);
        // 开局：10 只 1、6 只 2（都能吃），其余按规则随机；比你大的放远一点
        if (i < 16) {
          npc.n = i < 10 ? 1 : 2;
          npc.r = radiusOf(npc.n);
          const a = Math.random() * Math.PI * 2, d = rand(110, 420); // 能吃的放近一点
          npc.x = player.x + Math.cos(a) * d; npc.y = player.y + Math.sin(a) * d;
        }
        else if (Math.hypot(npc.x - player.x, npc.y - player.y) < 450) { npc.x = (npc.x + WORLD / 2) % WORLD; npc.y = (npc.y + WORLD / 2) % WORLD; }
        npcs.push(npc);
      }
      eaten = 0;
      effects = [];
      // 桌布上的装饰：竹叶和团子，每局随机摆
      decos = Array.from({ length: 70 }, () => ({
        x: rand(40, WORLD - 40), y: rand(40, WORLD - 40),
        rot: rand(0, Math.PI * 2), kind: Math.random() < 0.65 ? 'leaf' : 'dango', s: rand(0.8, 1.3),
      }));
      toasts = [];
      phase = 'ready';
      updateHud();
    }

    function updateHud() {
      setNum(numEl, fmt(player.n));
      setNum(eatenEl, eaten);
      setNum(bestEl, fmt(Math.max(best, player.n)));
    }

    function saveBest() {
      if (player.n > best) {
        best = player.n;
        try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
      }
      updateHud();
    }

    // ---- 输入：鼠标 / 手指指向哪里就往哪里走；也可以用方向键 / WASD ----
    function toWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const sx = (clientX - rect.left) * (W / rect.width);
      const sy = (clientY - rect.top) * (H / rect.height);
      return { x: view.x + (sx - W / 2) / view.scale, y: view.y + (sy - H / 2) / view.scale };
    }
    canvas.addEventListener('pointermove', (e) => { pointer = { cx: e.clientX, cy: e.clientY }; });
    canvas.addEventListener('pointerdown', (e) => {
      pointer = { cx: e.clientX, cy: e.clientY };
      if (phase === 'ready') phase = 'playing';
      else if (phase === 'over') reset();
    });
    canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') pointer = null; });
    canvas.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') pointer = null; });
    const KEYMAP = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' };
    window.addEventListener('keydown', (e) => {
      if (window.__gameModal && !window.__gameModal.wantsKeys('number', e)) return;
      if (KEYMAP[e.key]) {
        e.preventDefault();
        keys[KEYMAP[e.key]] = true;
        if (phase === 'ready') phase = 'playing';
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'ready') phase = 'playing';
        else if (phase === 'over') reset();
      }
    });
    window.addEventListener('keyup', (e) => { if (KEYMAP[e.key]) keys[KEYMAP[e.key]] = false; });
    window.addEventListener('blur', () => { keys = {}; });

    function clampToWorld(o) {
      o.x = Math.max(o.r, Math.min(WORLD - o.r, o.x));
      o.y = Math.max(o.r, Math.min(WORLD - o.r, o.y));
    }

    function eat(npc) {
      player.n += npc.n;
      player.r = radiusOf(player.n);
      eaten++;
      effects.push({ x: npc.x, y: npc.y, r: npc.r, t: 0, text: '+' + fmt(npc.n) });
      // 里程碑提示
      for (const m of [10, 50, 100, 500, 1000, 5000, 10000]) {
        if (player.n - npc.n < m && player.n >= m) toasts.push({ text: `突破 ${fmt(m)}！`, t: 0 });
      }
      updateHud();
    }

    function update() {
      for (const e of effects) e.t++;
      effects = effects.filter(e => e.t < 40);
      for (const t of toasts) t.t++;
      toasts = toasts.filter(t => t.t < 90);

      // 镜头：越大拉得越远
      const targetScale = Math.max(0.42, 1 / (1 + Math.log2(player.n) * 0.07));
      view.scale += (targetScale - view.scale) * 0.03;
      view.x += (player.x - view.x) * 0.12;
      view.y += (player.y - view.y) * 0.12;

      if (phase !== 'playing') return;

      // 玩家移动
      let dx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
      let dy = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
      if (!dx && !dy && pointer) {
        const t = toWorld(pointer.cx, pointer.cy);
        dx = t.x - player.x; dy = t.y - player.y;
        if (Math.hypot(dx, dy) < player.r * 0.5) { dx = 0; dy = 0; }
      }
      const len = Math.hypot(dx, dy);
      const speed = PLAYER_SPEED * (1 - Math.min(0.25, Math.log2(player.n) * 0.015));
      const tvx = len ? (dx / len) * speed : 0, tvy = len ? (dy / len) * speed : 0;
      player.vx += (tvx - player.vx) * 0.25;
      player.vy += (tvy - player.vy) * 0.25;
      player.x += player.vx; player.y += player.vy;
      if (Math.abs(player.vx) > 0.2) player.face = Math.sign(player.vx);
      clampToWorld(player);

      // NPC：比你大的会追（比你慢一点），比你小的会躲（更慢），其余随便逛
      for (const npc of npcs) {
        const ddx = player.x - npc.x, ddy = player.y - npc.y;
        const dist = Math.hypot(ddx, ddy);
        let vx, vy;
        if (npc.n > player.n && dist < 240) {
          vx = (ddx / dist) * speed * 0.8; vy = (ddy / dist) * speed * 0.8;
        } else if (npc.n < player.n && dist < 170) {
          vx = (-ddx / dist) * speed * 0.62; vy = (-ddy / dist) * speed * 0.62;
        } else {
          if (--npc.wanderT <= 0) { npc.dir += rand(-1.5, 1.5); npc.wanderT = rand(40, 140); }
          vx = Math.cos(npc.dir) * speed * 0.35; vy = Math.sin(npc.dir) * speed * 0.35;
        }
        npc.x += vx; npc.y += vy;
        if (Math.abs(vx) > 0.15) npc.face = Math.sign(vx);
        // 撞墙掉头
        if (npc.x < npc.r || npc.x > WORLD - npc.r) npc.dir = Math.PI - npc.dir;
        if (npc.y < npc.r || npc.y > WORLD - npc.r) npc.dir = -npc.dir;
        clampToWorld(npc);
      }

      // 碰撞：中心距离小于较大一方半径的 85% 才算吃到（擦边不算）
      for (let i = npcs.length - 1; i >= 0; i--) {
        const npc = npcs[i];
        const d = Math.hypot(npc.x - player.x, npc.y - player.y);
        if (d > Math.max(npc.r, player.r) * 0.85) continue;
        if (npc.n < player.n) {
          eat(npc);
          npcs.splice(i, 1);
        } else if (npc.n > player.n) {
          phase = 'over';
          effects.push({ x: player.x, y: player.y, r: player.r, t: 0, text: '' });
          saveBest();
          return;
        }
      }

      // 太小的（已经没意义了）慢慢替换掉；保持数量
      for (let i = npcs.length - 1; i >= 0; i--) {
        if (npcs[i].n < player.n * 0.05 && Math.hypot(npcs[i].x - player.x, npcs[i].y - player.y) > 500) npcs.splice(i, 1);
      }
      while (npcs.length < NPC_COUNT) npcs.push(spawnNpc(true));
    }

    // ---- 绘制 ----
    const BODY_TINTS = ['#ffffff', '#fff3f7', '#f3f6ff', '#f6fff2'];

    function drawMe(o) {
      if (!(meImg.complete && meImg.naturalWidth)) { drawPanda(o, true); return; }
      const r = o.r;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.fillStyle = 'rgba(19, 32, 74, 0.14)';
      ctx.beginPath(); ctx.ellipse(0, r * 0.95, r * 0.95, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
      // 跟着移动方向左右翻转
      if ((o.face || 1) < 0) ctx.scale(-1, 1);
      ctx.drawImage(meImg, -r, -r, r * 2, r * 2);
      ctx.restore();
      ctx.lineWidth = Math.max(3, r * 0.1);
      ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = Math.max(2, r * 0.06);
      ctx.strokeStyle = '#2f6fed';
      ctx.beginPath(); ctx.arc(0, 0, r + ctx.lineWidth, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    function drawDeco(d) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.scale(d.s, d.s);
      if (d.kind === 'leaf') {
        // 一小枝竹叶
        ctx.strokeStyle = 'rgba(79, 140, 80, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
        ctx.fillStyle = 'rgba(124, 197, 118, 0.55)';
        for (const [x, a] of [[-6, -0.6], [2, 0.5], [9, -0.4]]) {
          ctx.save(); ctx.translate(x, 0); ctx.rotate(a);
          ctx.beginPath(); ctx.ellipse(8, 0, 9, 2.6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      } else {
        // 三色团子
        ctx.strokeStyle = 'rgba(176, 132, 90, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(16, 0); ctx.stroke();
        const cols = ['rgba(255, 170, 196, 0.75)', 'rgba(255, 255, 255, 0.95)', 'rgba(150, 210, 140, 0.75)'];
        cols.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.arc(-10 + i * 9, 0, 5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(19, 32, 74, 0.12)'; ctx.lineWidth = 1; ctx.stroke();
        });
      }
      ctx.restore();
    }

    function drawPanda(o, isPlayer) {
      const r = o.r;
      ctx.save();
      ctx.translate(o.x, o.y);
      // 影子
      ctx.fillStyle = 'rgba(19, 32, 74, 0.12)';
      ctx.beginPath(); ctx.ellipse(0, r * 0.9, r * 0.9, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      // 耳朵
      ctx.fillStyle = '#1b1b1f';
      ctx.beginPath(); ctx.arc(-r * 0.66, -r * 0.68, r * 0.34, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.66, -r * 0.68, r * 0.34, 0, Math.PI * 2); ctx.fill();
      // 脸
      ctx.fillStyle = isPlayer ? '#ffffff' : BODY_TINTS[o.hue || 0];
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = isPlayer ? 3 : 1.5;
      ctx.strokeStyle = isPlayer ? '#2f6fed' : 'rgba(19, 32, 74, 0.18)';
      ctx.stroke();
      // 眼圈，按朝向稍微偏一点
      const lx = (o.face || 1) * r * 0.08;
      ctx.fillStyle = '#1b1b1f';
      ctx.beginPath(); ctx.ellipse(-r * 0.36 + lx, -r * 0.04, r * 0.22, r * 0.3, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.36 + lx, -r * 0.04, r * 0.22, r * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-r * 0.32 + lx * 1.5, -r * 0.08, r * 0.08, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.32 + lx * 1.5, -r * 0.08, r * 0.08, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1b1f';
      ctx.beginPath(); ctx.ellipse(lx, r * 0.3, r * 0.12, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255, 143, 179, 0.7)';
      ctx.beginPath(); ctx.arc(-r * 0.58, r * 0.34, r * 0.11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.58, r * 0.34, r * 0.11, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawTag(o, isPlayer) {
      // 头顶数字牌：自己蓝色，能吃绿色，危险红色
      const text = fmt(o.n);
      const fs = Math.max(13, Math.min(30, o.r * 0.55)) / Math.max(view.scale, 0.6);
      ctx.font = `600 ${fs}px ${FONT}`;
      const tw = ctx.measureText(text).width;
      const pw = tw + fs * 0.8, ph = fs * 1.35;
      const x = o.x, y = o.y - o.r * 1.08 - ph * 0.6;
      let bg;
      if (isPlayer) bg = '#2f6fed';
      else if (o.n < player.n) bg = '#2f9e5a';
      else if (o.n > player.n) bg = '#e64980';
      else bg = '#8fa3cc';
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.roundRect(x - pw / 2, y - ph / 2, pw, ph, ph / 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y + 1);
      ctx.textBaseline = 'alphabetic';
    }

    function overlay(title, sub, hint) {
      ctx.fillStyle = 'rgba(19, 32, 74, 0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = `600 34px ${FONT}`;
      const ty = H * 0.22; // 文字放在上方，不挡住画面中央的自己
      ctx.fillText(title, W / 2, ty);
      if (sub) {
        ctx.font = `500 17px ${FONT}`;
        ctx.fillStyle = '#dbe6ff';
        sub.split('\n').forEach((line, i) => ctx.fillText(line, W / 2, ty + 36 + i * 24));
      }
      if (hint) {
        ctx.font = `500 15px ${FONT}`;
        ctx.fillStyle = '#aebfe6';
        ctx.fillText(hint, W / 2, ty + 102);
      }
    }

    function draw() {
      // 场地外：浅蓝（和站点主题一致）
      ctx.fillStyle = '#c9d8f6';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(view.scale, view.scale);
      ctx.translate(-view.x, -view.y);

      // 场地：野餐桌布
      const vx0 = view.x - W / 2 / view.scale, vx1 = view.x + W / 2 / view.scale;
      const vy0 = view.y - H / 2 / view.scale, vy1 = view.y + H / 2 / view.scale;
      ctx.fillStyle = 'rgba(19, 32, 74, 0.12)';
      ctx.fillRect(8, 14, WORLD, WORLD);            // 桌布的投影
      ctx.fillStyle = gingham;
      ctx.fillRect(0, 0, WORLD, WORLD);
      // 花边：沿四边一圈白色小半圆
      const SC = 24;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(255, 143, 179, 0.6)';
      ctx.lineWidth = 2;
      const scallop = (x, y) => {
        if (x < vx0 - SC || x > vx1 + SC || y < vy0 - SC || y > vy1 + SC) return;
        ctx.beginPath(); ctx.arc(x, y, SC / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      };
      for (let t = 0; t <= WORLD; t += SC) { scallop(t, 0); scallop(t, WORLD); scallop(0, t); scallop(WORLD, t); }
      ctx.strokeStyle = 'rgba(255, 143, 179, 0.45)';
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3;
      ctx.strokeRect(26, 26, WORLD - 52, WORLD - 52);   // 缝线
      ctx.setLineDash([]);
      for (const d of decos) {
        if (d.x < vx0 - 40 || d.x > vx1 + 40 || d.y < vy0 - 40 || d.y > vy1 + 40) continue;
        drawDeco(d);
      }

      // 小的先画，大的盖在上面
      const all = npcs.slice().sort((a, b) => a.n - b.n);
      for (const npc of all) drawPanda(npc, false);
      if (phase !== 'over') drawMe(player);
      for (const npc of all) drawTag(npc, false);
      if (phase !== 'over') drawTag(player, true);

      // 吃到时的光圈和加分
      for (const e of effects) {
        const k = e.t / 40;
        ctx.strokeStyle = `rgba(47, 158, 90, ${1 - k})`;
        ctx.lineWidth = 3 / view.scale;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + k * 24, 0, Math.PI * 2); ctx.stroke();
        if (e.text) {
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = '#2f9e5a';
          ctx.font = `600 ${18 / view.scale}px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillText(e.text, e.x, e.y - e.r - 10 - k * 30);
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();

      // 里程碑提示
      for (const t of toasts) {
        const a = t.t < 10 ? t.t / 10 : t.t > 70 ? (90 - t.t) / 20 : 1;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#2f6fed';
        ctx.font = `600 24px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(t.text, W / 2, 70);
        ctx.globalAlpha = 1;
      }

      if (phase === 'ready') {
        overlay('熊猫大胃王', '头顶绿色数字的能吃，红色的快躲开\n吃掉谁，谁的数字就加到你身上', '点击画面开始，鼠标 / 手指指哪走哪');
      } else if (phase === 'over') {
        overlay('被吃掉了', `这局长到 ${fmt(player.n)}，吃了 ${eaten} 只\n最高纪录 ${fmt(best)}`, '点击画面再来一局');
      }
    }

    // ---- 循环 ----
    const STEP = 1000 / 60;
    let lastTime = performance.now(), acc = 0;
    function isOpen() { return !window.__gameModal || window.__gameModal.current() === 'number'; }
    function loop(now) {
      requestAnimationFrame(loop);
      const dt = Math.max(0, Math.min(100, now - lastTime));
      lastTime = now;
      if (!isOpen()) { acc = 0; return; }
      acc += dt;
      while (acc >= STEP) { update(); acc -= STEP; }
      draw();
    }

    reset();
    requestAnimationFrame(loop);

    window.__gameHooks = window.__gameHooks || {};
    window.__gameHooks.number = (action) => {
      if (action === 'close' && phase === 'playing') saveBest();
      if (action === 'open' || action === 'close') { keys = {}; pointer = null; reset(); }
    };
  });
})();
