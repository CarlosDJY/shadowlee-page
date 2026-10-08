/**
 * 合成熊猫 - 基于 suikagame (MIT) 改编
 * 物理掉落 + 相同表情合并
 */
(function () {
  const base = (window.SITE_BASE || '/').replace(/\/$/, '');

  // 简化的日志（不依赖 DOM）
  const gameLogger = {
    info: (msg) => console.log('[合成熊猫]', msg),
    warning: (msg) => console.warn('[合成熊猫]', msg),
    error: (msg) => console.error('[合成熊猫]', msg)
  };

  class PandaMergeGame {
    constructor(canvasId = 'panda-merge-canvas') {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) {
        gameLogger.error('Canvas not found: ' + canvasId);
        return;
      }
      this.ctx = this.canvas.getContext('2d');

      this.emoteImages = [];
      this.imagesLoaded = false;

      const meta = window.EMOTE_META || { items: [] };
      // 取前 11 个有文件的表情；不足则循环补齐
      const items = [];
      const all = meta.items.filter(i => i.file);
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
      this.highScore = parseInt(localStorage.getItem('panda_merge_high_score') || '0', 10);
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

      this.lastFrameTime = performance.now();
      requestAnimationFrame(this.gameLoop.bind(this));
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

      // 建立 emoteType -> image 映射
      this.emoteTypes.forEach((type, i) => {
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

      this.canvas.addEventListener('click', (e) => {
        if (this.gameOver) {
          this.init();
        } else if (!this.isPaused) {
          this.dropFruit();
        }
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'p' || e.key === 'P') {
          this.togglePause();
        }
      });

      window.addEventListener('blur', () => {
        if (!this.gameOver && !this.isPaused) {
          this.togglePause();
        }
      });

      const startBtn = document.getElementById('merge-start');
      if (startBtn) startBtn.addEventListener('click', () => this.init());
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
      gameLogger.info('下一个表情: ' + this.emoteTypes[fruitIndex].name);
    }

    dropFruit() {
      if (this.gameOver || !this.nextFruit || this.isPaused) return;
      this.fruits.push({
        type: this.nextFruit.type,
        x: this.nextFruit.x,
        y: this.nextFruit.y,
        vx: 0,
        vy: 1,
        radius: this.nextFruit.radius,
        color: this.nextFruit.color
      });
      gameLogger.info('掉落: ' + this.emoteTypes[this.nextFruit.type].name);
      this.createNextFruit();
    }

    togglePause() {
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        gameLogger.info('游戏暂停');
      } else {
        gameLogger.info('游戏继续');
        this.lastFrameTime = performance.now();
        requestAnimationFrame(this.gameLoop.bind(this));
      }
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

              gameLogger.info(`${this.emoteTypes[fruitA.type].name} × 2 合成 ${this.emoteTypes[newType].name}`);
              if (newType === this.emoteTypes.length - 1) {
                gameLogger.info('恭喜！合成出了最大的表情！');
              }
            }
          }
        }
      }

      this.fruits = this.fruits.filter(fruit => !fruit.toRemove);

      const gameOverThreshold = this.dropZoneHeight;
      for (const fruit of this.fruits) {
        if (fruit.y - fruit.radius < gameOverThreshold && Math.abs(fruit.vy) < 0.2) {
          if (!this.gameOver) {
            this.gameOver = true;
            if (this.score > this.highScore) {
              this.highScore = this.score;
              localStorage.setItem('panda_merge_high_score', this.highScore.toString());
            }
            gameLogger.warning('游戏结束');
          }
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
        this.ctx.fillText('按 P 键或点击画面继续', this.canvas.width / 2, this.canvas.height / 2 + 10);
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

      this.ctx.fillStyle = '#FFF';
      this.ctx.font = `bold ${Math.max(10, fruit.radius / 3)}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      this.ctx.lineWidth = 3;
      const name = this.emoteTypes[fruit.type].name;
      this.ctx.strokeText(name, fruit.x, fruit.y);
      this.ctx.fillText(name, fruit.x, fruit.y);
      this.ctx.textBaseline = 'alphabetic';
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
      if (this.isPaused) {
        this.draw();
        return;
      }
      const deltaTime = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;
      if (!this.gameOver) {
        this.update(deltaTime);
      }
      this.draw();
      requestAnimationFrame(this.gameLoop.bind(this));
    }
  }

  window.addEventListener('load', () => {
    new PandaMergeGame();
  });
})();