/**
 * 合成熊猫 - 基于开源 suikagame (MIT) 改造
 * 物理掉落 + 相同表情合并
 */
(function () {
  const base = (window.SITE_BASE || '/').replace(/\/$/, '');

  const gameLogger = {
    info: (msg) => console.log('[合成熊猫]', msg),
    warning: (msg) => console.warn('[合成熊猫]', msg),
    error: (msg) => console.error('[合成熊猫]', msg)
  };

  class PandaMergeGame {
    constructor(canvasId = 'merge-canvas') {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) {
        gameLogger.error('Canvas not found: ' + canvasId);
        return;
      }
      this.ctx = this.canvas.getContext('2d');

      this.emoteImages = [];
      this.imagesLoaded = false;

      const meta = window.EMOTE_META || { items: [] };
      const items = [];
      const all = meta.items.filter(i => i.file);
      if (!all.length) all.push({ file: '', name: '' });
      for (let i = 0; i < 11; i++) {
        items.push(all[i % all.length]);
      }
      this.emoteTypes = items.map((item, idx) => ({
        name: item.name || `Lv.${idx + 1}`,
        radius: [20, 25, 32, 40, 50, 62, 76, 92, 110, 132, 158][idx],
        color: ['#FF6B6B', '#FF8E72', '#F9C66B', '#A8D46B', '#6BD4A8', '#6BBCD4', '#6B8CD4', '#8C6BD4', '#D46BB8', '#D46B7A', '#5A6B7C'][idx],
        points: idx + 1,
        file: item.file
      }));

      this.fruits = [];
      this.nextFruit = null;
      this.nextFruitX = this.canvas.width / 2;
      this.score = 0;
      try {
        this.highScore = parseInt(localStorage.getItem('panda_merge_high_score') || '0', 10) || 0;
      } catch (e) { this.highScore = 0; }
      this.lastDropTime = 0;
      this.DROP_COOLDOWN = 450;   // 两次掉落之间的最短间隔（毫秒）
      this.OVER_FRAMES = 90;      // 球在危险线上方停留约 1.5 秒才判负
      this.gameOver = false;
      this.mergeEffects = [];
      this.lastFrameTime = 0;
      this.isPaused = false;

      this.gravity = 0.2;
      this.friction = 0.5;
      this.containerWidth = this.canvas.width;
      this.containerHeight = this.canvas.height;
      this.containerLeft = 0;
      this.containerRight = this.canvas.width;
      this.containerBottom = this.canvas.height;
      this.dropZoneHeight = 100;

      this.loadImages();
      this.setupEventListeners();
      this.init();

      this.STEP = 1000 / 60;      // 固定 60Hz 物理步长，高刷屏下速度不变
      this.acc = 0;
      this.lastFrameTime = performance.now();
      this.boundLoop = this.gameLoop.bind(this);
      requestAnimationFrame(this.boundLoop);
      gameLogger.info('游戏初始化完成');
    }

    loadImages() {
      const uniqueFiles = [...new Set(this.emoteTypes.map(t => t.file))];
      let loadedCount = 0;
      const total = uniqueFiles.length;

      uniqueFiles.forEach((file, index) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          if (loadedCount === total) {
            this.imagesLoaded = true;
            gameLogger.info('所有表情图片加载完成');
          }
        };
        img.onerror = () => {
          loadedCount++;
          gameLogger.error('表情图片加载失败: ' + file);
          if (loadedCount === total) this.imagesLoaded = true;
        };
        img.src = `${base}/assets/images/emotes/${file}`;
        this.emoteImages[index] = img;
      });

      this.emoteTypes.forEach((type) => {
        type.imageIndex = uniqueFiles.indexOf(type.file);
      });

      setTimeout(() => {
        if (!this.imagesLoaded) {
          this.imagesLoaded = true;
          gameLogger.warning('图片加载超时，使用默认圆圈渲染');
        }
      }, 3000);
    }

    setupEventListeners() {
      this.canvas.addEventListener('mousemove', (e) => {
        if (this.gameOver || !this.nextFruit || this.isPaused) return;
        const rect = this.canvas.getBoundingClientRect();
        this.nextFruitX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        this.nextFruitX = Math.max(
          this.nextFruit.radius,
          Math.min(this.containerWidth - this.nextFruit.radius, this.nextFruitX)
        );
        this.nextFruit.x = this.nextFruitX;
      });

      this.canvas.addEventListener('click', () => {
        if (this.gameOver) {
          this.init();
        } else if (this.isPaused) {
          this.togglePause();
        } else {
          this.dropFruit();
        }
      });

      window.addEventListener('keydown', (e) => {
        if (window.__gameModal && !window.__gameModal.wantsKeys('merge', e)) return;
        if (e.key === 'p' || e.key === 'P') {
          this.togglePause();
        }
      });

      window.addEventListener('blur', () => {
        if (!this.isOpen()) return;
        if (!this.gameOver && !this.isPaused) {
          this.togglePause();
        }
      });
    }

    init() {
      this.score = 0;
      this.fruits = [];
      this.gameOver = false;
      this.mergeEffects = [];
      this.isPaused = false;
      this.createNextFruit();
      gameLogger.info('游戏重新开始');
    }

    createNextFruit() {
      const fruitIndex = Math.floor(Math.random() * 3);
      this.nextFruit = {
        type: fruitIndex,
        x: this.nextFruitX,
        y: 50,
        vx: 0,
        vy: 0,
        radius: this.emoteTypes[fruitIndex].radius,
        color: this.emoteTypes[fruitIndex].color
      };
    }

    isOpen() {
      return !window.__gameModal || window.__gameModal.current() === 'merge';
    }

    dropFruit() {
      if (this.gameOver || !this.nextFruit || this.isPaused) return;
      const now = performance.now();
      if (now - this.lastDropTime < this.DROP_COOLDOWN) return;
      this.lastDropTime = now;
      this.fruits.push({
        type: this.nextFruit.type,
        x: this.nextFruit.x,
        y: this.nextFruit.y,
        vx: 0,
        vy: 1,
        radius: this.nextFruit.radius,
        color: this.nextFruit.color
      });
      this.createNextFruit();
    }

    togglePause() {
      if (this.gameOver) return;
      this.isPaused = !this.isPaused;
      gameLogger.info(this.isPaused ? '游戏暂停' : '游戏继续');
    }

    update(deltaTime) {
      this.mergeEffects = this.mergeEffects.filter(effect => {
        effect.radius += 2;
        effect.alpha -= 0.05;
        return effect.alpha > 0;
      });

      for (let i = 0; i < this.fruits.length; i++) {
        const fruit = this.fruits[i];
        fruit.vy += this.gravity;
        fruit.x += fruit.vx;
        fruit.y += fruit.vy;

        if (fruit.x - fruit.radius < this.containerLeft) {
          fruit.x = fruit.radius;
          fruit.vx *= -this.friction;
        } else if (fruit.x + fruit.radius > this.containerRight) {
          fruit.x = this.containerRight - fruit.radius;
          fruit.vx *= -this.friction;
        }

        if (fruit.y + fruit.radius > this.containerBottom) {
          fruit.y = this.containerBottom - fruit.radius;
          fruit.vy *= -this.friction;
          fruit.vx *= this.friction;
        }
      }

      for (let i = 0; i < this.fruits.length; i++) {
        for (let j = i + 1; j < this.fruits.length; j++) {
          const fruitA = this.fruits[i];
          const fruitB = this.fruits[j];
          if (fruitA.toRemove || fruitB.toRemove) continue;

          const dx = fruitB.x - fruitA.x;
          const dy = fruitB.y - fruitA.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = fruitA.radius + fruitB.radius;

          if (distance < minDistance) {
            const angle = Math.atan2(dy, dx);
            const overlap = minDistance - distance;
            const moveX = Math.cos(angle) * overlap * 0.5;
            const moveY = Math.sin(angle) * overlap * 0.5;

            fruitA.x -= moveX;
            fruitA.y -= moveY;
            fruitB.x += moveX;
            fruitB.y += moveY;

            const totalMass = fruitA.radius + fruitB.radius;
            const force = 1;
            fruitA.vx -= (moveX * force * fruitB.radius) / totalMass;
            fruitA.vy -= (moveY * force * fruitB.radius) / totalMass;
            fruitB.vx += (moveX * force * fruitA.radius) / totalMass;
            fruitB.vy += (moveY * force * fruitA.radius) / totalMass;

            if (fruitA.type === fruitB.type && fruitA.type < this.emoteTypes.length - 1) {
              const newType = fruitA.type + 1;
              const newX = (fruitA.x + fruitB.x) / 2;
              const newY = (fruitA.y + fruitB.y) / 2;
              this.fruits.push({
                type: newType,
                x: newX,
                y: newY,
                vx: (fruitA.vx + fruitB.vx) / 2,
                vy: (fruitA.vy + fruitB.vy) / 2,
                radius: this.emoteTypes[newType].radius,
                color: this.emoteTypes[newType].color
              });

              this.mergeEffects.push({
                x: newX,
                y: newY,
                radius: this.emoteTypes[newType].radius,
                color: this.emoteTypes[newType].color,
                alpha: 1
              });

              this.score += this.emoteTypes[newType].points;
              fruitA.toRemove = true;
              fruitB.toRemove = true;

              if (newType === this.emoteTypes.length - 1) {
                gameLogger.info('恭喜！合成出了最大的表情！');
              }
            }
          }
        }
      }

      this.fruits = this.fruits.filter(fruit => !fruit.toRemove);

      // 球顶超过危险线并持续一段时间才判负（避免弹跳瞬间误判）
      const gameOverThreshold = this.dropZoneHeight;
      this.danger = 0;
      for (const fruit of this.fruits) {
        if (fruit.y - fruit.radius < gameOverThreshold) {
          fruit.overFrames = (fruit.overFrames || 0) + 1;
        } else {
          fruit.overFrames = 0;
        }
        this.danger = Math.max(this.danger, fruit.overFrames / this.OVER_FRAMES);
        if (fruit.overFrames > this.OVER_FRAMES && !this.gameOver) {
          this.gameOver = true;
          if (this.score > this.highScore) {
            this.highScore = this.score;
            try { localStorage.setItem('panda_merge_high_score', this.highScore.toString()); } catch (e) {}
          }
          gameLogger.warning('游戏结束');
          break;
        }
      }
    }

    draw() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.ctx.fillStyle = '#FFF8E1';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      this.ctx.beginPath();
      this.ctx.moveTo(0, this.dropZoneHeight);
      this.ctx.lineTo(this.canvas.width, this.dropZoneHeight);
      this.ctx.strokeStyle = '#FF6B6B';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.fillStyle = '#FF6B6B';
      this.ctx.font = '12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('危险区：表情球堆过这条线就游戏结束', this.canvas.width / 2, this.dropZoneHeight - 8);

      for (const effect of this.mergeEffects) {
        this.ctx.beginPath();
        this.ctx.arc(effect.x, effect.y, effect.radius + 10, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${effect.alpha})`;
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${effect.alpha})`;
        this.ctx.lineWidth = 4;
        this.ctx.stroke();
      }

      for (const fruit of this.fruits) {
        this.drawFruit(fruit);
      }

      if (this.nextFruit && !this.gameOver && !this.isPaused) {
        this.drawFruit(this.nextFruit);
        this.ctx.beginPath();
        this.ctx.setLineDash([5, 5]);
        this.ctx.moveTo(this.nextFruit.x, this.nextFruit.y + this.nextFruit.radius);
        this.ctx.lineTo(this.nextFruit.x, this.containerHeight);
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }

      this.ctx.fillStyle = '#333';
      this.ctx.font = '18px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`得分: ${this.score}`, 10, 28);
      this.ctx.textAlign = 'right';
      this.ctx.fillText(`最高分: ${this.highScore}`, this.canvas.width - 10, 28);

      if (this.isPaused && !this.gameOver) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '36px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('暂停中', this.canvas.width / 2, this.canvas.height / 2 - 30);
        this.ctx.font = '16px sans-serif';
        this.ctx.fillText('点击画面继续', this.canvas.width / 2, this.canvas.height / 2 + 10);
      }

      if (this.gameOver) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '40px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('游戏结束', this.canvas.width / 2, this.canvas.height / 2 - 40);
        this.ctx.font = '20px sans-serif';
        this.ctx.fillText(`最终得分: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.fillText('点击画面重新开始', this.canvas.width / 2, this.canvas.height / 2 + 36);
      }
    }

    drawFruit(fruit) {
      this.ctx.beginPath();
      this.ctx.arc(fruit.x + 3, fruit.y + 3, fruit.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      this.ctx.fill();

      if (this.imagesLoaded) {
        const imageIndex = this.emoteTypes[fruit.type].imageIndex;
        const img = this.emoteImages[imageIndex];
        if (img && img.complete) {
          const size = fruit.radius * 2;
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.arc(fruit.x, fruit.y, fruit.radius, 0, Math.PI * 2);
          this.ctx.closePath();
          this.ctx.clip();
          this.ctx.drawImage(img, fruit.x - fruit.radius, fruit.y - fruit.radius, size, size);
          this.ctx.restore();

          this.ctx.beginPath();
          this.ctx.arc(fruit.x, fruit.y, fruit.radius, 0, Math.PI * 2);
          this.ctx.strokeStyle = '#000';
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
        } else {
          this.drawDefaultFruit(fruit);
        }
      } else {
        this.drawDefaultFruit(fruit);
      }
    }

    drawDefaultFruit(fruit) {
      this.ctx.beginPath();
      this.ctx.arc(fruit.x, fruit.y, fruit.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = fruit.color;
      this.ctx.fill();
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(fruit.x - fruit.radius * 0.3, fruit.y - fruit.radius * 0.3, fruit.radius * 0.3, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.fill();
    }

    gameLoop(timestamp) {
      // 循环始终保持运行（只有一条），暂停 / 弹窗关闭时只是跳过物理更新
      requestAnimationFrame(this.boundLoop);
      const dt = Math.min(100, timestamp - this.lastFrameTime);
      this.lastFrameTime = timestamp;
      if (!this.isOpen()) { this.acc = 0; return; }
      if (!this.isPaused && !this.gameOver) {
        this.acc += dt;
        while (this.acc >= this.STEP) { this.update(this.STEP); this.acc -= this.STEP; }
      } else {
        this.acc = 0;
      }
      this.draw();
    }
  }

  window.addEventListener('load', () => {
    const game = new PandaMergeGame();
    window.__gameHooks.merge = (action) => {
      if (action === 'open') game.init();
    };
  });
})();