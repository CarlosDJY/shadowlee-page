---
layout: default
title: 沙按钮
description: 点击按钮播放语音 / 浏览表情
---

<!-- 全屏背景图层（space 背景图，由脚本随机切换） -->
<div class="bg-layer" id="bg-layer"></div>

<!-- 顶部导航栏 -->
<nav class="navbar">
  <div class="nav-container">
    <div class="nav-left">
      <a href="/" class="site-title">
        <span>沙按钮</span>
      </a>
    </div>
    <div class="nav-right">
      <div class="nav-item">
        <a href="https://space.bilibili.com/1703797642/" target="_blank" rel="noopener" class="bilibili-link" title="B站空间">
          <svg class="bilibili-icon" viewBox="0 0 24 24" width="18" height="18">
            <path fill="#FB7299" d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
          </svg>
        </a>
      </div>
      <div class="nav-item volume-hint">请注意音量大小</div>
      <div class="nav-item">
        <a href="https://www.bilibili.com/video/BV12c411D7j4" target="_blank" rel="noopener" class="listen-song">点我听歌</a>
      </div>
      <div class="nav-item">
        <a href="https://www.bilibili.com/video/BV1Z2bpznEag" target="_blank" rel="noopener" class="listen-song">支持百合厨女子的恋爱理论</a>
      </div>
      <div class="nav-item">
        <button id="admin-toggle" class="admin-link">管理登录</button>
      </div>
    </div>
  </div>
</nav>

<!-- Tab 切换 -->
<div class="tab-bar">
  <button class="tab-btn active" data-tab="emotes">表情</button>
  <button class="tab-btn" data-tab="voices">语音</button>
  <button class="tab-btn" data-tab="games">游戏</button>
</div>

<!-- 主内容区域 -->
<div class="main-content">

  <!-- 表情面板 -->
  <section id="emotes-panel" class="tab-panel active">
    <!-- 大图预览 -->
    <div class="emote-preview">
      <div class="emote-preview-title" id="emote-preview-title">请选择表情</div>
      <div class="emote-preview-img">
        <img id="emote-preview-img" alt="表情预览" style="display:none;">
        <div id="emote-preview-placeholder" class="preview-placeholder">暂无预览</div>
      </div>
    </div>

    <!-- 分类筛选（根据 meta 中的实际分类动态生成） -->
    {% assign meta = site.data.emotes_meta %}
    {% assign dynamic_categories = "" | split: "" %}
    {% for item in meta.items %}
      {% for cat in item.categories %}
        {% unless dynamic_categories contains cat %}
          {% assign dynamic_categories = dynamic_categories | push: cat %}
        {% endunless %}
      {% endfor %}
    {% endfor %}
    <div class="filter-bar">
      <span class="filter-label">按分类筛选：</span>
      <div class="filter-tags" id="emote-filters">
        <button class="filter-tag active" data-filter="all">全部</button>
        {% for cat in dynamic_categories %}
          <button class="filter-tag" data-filter="{{ cat }}">{{ cat }}</button>
        {% endfor %}
        <button class="filter-tag" data-filter="other">其他</button>
      </div>
      <button class="refresh-btn" id="refresh-emotes" title="随机挑选一个表情包到上面">↻</button>
    </div>

    <!-- 表情网格 -->
    <div class="emotes-grid" id="emotes-grid">
      {% if meta and meta.items and meta.items.size > 0 %}
        {% for item in meta.items %}
          <div class="emote-card" data-categories="{% if item.categories and item.categories.size > 0 %}{{ item.categories | join: ',' }}{% else %}other{% endif %}" data-name="{{ item.name }}" data-src="{{ '/assets/images/emotes/' | append: item.file | relative_url }}">
            <div class="emote-thumb">
              <img src="{{ '/assets/images/emotes/' | append: item.file | relative_url }}" alt="{{ item.name }}" loading="lazy">
            </div>
            <div class="emote-name">{{ item.name }}</div>
          </div>
        {% endfor %}
      {% else %}
        <div class="empty-hint">
          还没有表情图片~<br>
          登录管理面板上传，或在 <code>assets/images/emotes/</code> 放入图片。
        </div>
      {% endif %}
    </div>
  </section>

  <!-- 语音面板 -->
  <section id="voices-panel" class="tab-panel">
    <!-- 待播放条 -->
    <div class="now-playing-bar">
      <span class="now-playing-label">待播放：</span>
      <span class="now-playing-text" id="now-playing">暂无播放</span>
    </div>

    <!-- 控制区 -->
    <div class="voice-controls">
      <button id="random-btn" class="control-btn">帮我选一个</button>
      <button id="stop-btn" class="control-btn">停止</button>
      <label class="checkbox-label">
        <input type="checkbox" id="allow-overlap">
        <span>允许声音重叠</span>
      </label>
      <label class="checkbox-label">
        <input type="checkbox" id="dont-stop">
        <span>播放不要停下来</span>
      </label>
    </div>

    <!-- 语音分类 -->
    <div class="voices-container">
      {% for cat in site.data.voices.categories %}
        {% capture path_match %}/assets/audio/{{ cat.id }}/{% endcapture %}
        {% assign files = site.static_files | where_exp:"file", "file.path contains path_match" %}
        {% if files.size > 0 %}
          <section class="voice-category" data-dir="{{ cat.id }}">
            <h3>{{ cat.name }}</h3>
            <div class="buttons-grid">
              {% for file in files %}
                {% assign name = file.name | split: "." | first %}
                <button class="voice-btn" data-audio="{{ file.path | relative_url }}">{{ name }}</button>
              {% endfor %}
            </div>
          </section>
        {% endif %}
      {% endfor %}
    </div>
  </section>

  <!-- 游戏面板 -->
  <section id="games-panel" class="tab-panel">
    <div class="games-grid">
      <div class="game-card" data-game="slot" tabindex="0" role="button" aria-label="打开熊猫老虎机">
        <div class="game-card-icon">🎰</div>
        <h3>熊猫老虎机</h3>
        <p>拉动拉杆，三个相同表情赢大奖</p>
      </div>
      <div class="game-card" data-game="pinball" tabindex="0" role="button" aria-label="打开熊猫弹球">
        <div class="game-card-icon">🎱</div>
        <h3>熊猫弹球</h3>
        <p>弹球碰撞，挑战最高分</p>
      </div>
      <div class="game-card" data-game="merge" tabindex="0" role="button" aria-label="打开合成熊猫">
        <div class="game-card-icon">🐼</div>
        <h3>合成熊猫</h3>
        <p>相同表情合成更大的球</p>
      </div>
      <div class="game-card" data-game="flappy" tabindex="0" role="button" aria-label="打开李豆沙 Flappy">
        <div class="game-card-icon">🪽</div>
        <h3>李豆沙 Flappy</h3>
        <p>扇动翅膀穿过管道</p>
      </div>
    </div>
  </section>

  <!-- 游戏弹窗 -->
  <div id="game-modal" class="game-modal" style="display:none;" aria-hidden="true">
    <div class="game-modal-backdrop" data-close-modal></div>
    <div class="game-modal-content">
      <button class="game-modal-close" data-close-modal aria-label="关闭">&times;</button>
      <div class="game-modal-body" id="game-modal-body">
        <div class="game-instance" id="game-slot" data-game="slot">
          <h2 class="game-title">熊猫老虎机</h2>
          <div class="slot-machine">
            <div class="slot-reels" id="slot-reels"></div>
            <div class="slot-controls">
              <div class="slot-info">余额：<span id="slot-coins">100</span></div>
              <button id="slot-spin" class="control-btn big">旋转 (5)</button>
              <div id="slot-result" class="slot-result"></div>
            </div>
          </div>
        </div>

        <div class="game-instance" id="game-pinball" data-game="pinball">
          <h2 class="game-title">熊猫弹球</h2>
          <canvas id="pinball-canvas" width="420" height="620"></canvas>
          <div class="pinball-controls">
            <button id="pinball-start" class="control-btn big">发射</button>
            <button id="pinball-restart" class="control-btn big">重开</button>
            <div class="pinball-score">得分：<span id="pinball-score">0</span></div>
          </div>
          <p class="pinball-tip">点击发射，用 ← → 键控制挡板，不要让球掉下去。</p>
        </div>

        <div class="game-instance" id="game-merge" data-game="merge">
          <h2 class="game-title">合成熊猫</h2>
          <canvas id="merge-canvas" width="400" height="600"></canvas>
          <p class="merge-tip">移动鼠标选位置，点击掉落；相同表情球碰撞会合成更大的球。</p>
        </div>

        <div class="game-instance" id="game-flappy" data-game="flappy">
          <h2 class="game-title">李豆沙 Flappy</h2>
          <canvas id="flappy-canvas" width="400" height="600"></canvas>
          <p class="flappy-tip">点击或按空格键跳跃，避开管道。</p>
        </div>
      </div>
    </div>
  </div>

  <!-- 管理上传面板（默认隐藏，登录后显示） -->
  <section id="admin-panel" class="admin-panel" style="display:none;">
    <div class="admin-header">
      <h3>本地管理</h3>
      <button id="admin-logout" class="control-btn small">退出登录</button>
    </div>
    <p class="admin-tip">此功能把文件暂存在当前浏览器中，仅本地可见。如需永久保存，请把文件放进仓库后重新部署。</p>

    <div class="upload-tabs">
      <button class="upload-tab active" data-upload="emote">上传表情</button>
      <button class="upload-tab" data-upload="voice">上传语音</button>
    </div>

    <div class="upload-form active" id="upload-emote-form">
      <label>分类前缀（用于筛选，多分类用逗号分隔）：</label>
      <input type="text" id="upload-emote-category" placeholder="cute">
      <label>选择图片（可多选批量上传，名称取文件名）：</label>
      <input type="file" id="upload-emote-file" accept="image/*" multiple>
      <button id="upload-emote-btn" class="control-btn">批量上传表情</button>
    </div>

    <div class="upload-form" id="upload-voice-form">
      <label>分类目录（如 cute / 日常）：</label>
      <input type="text" id="upload-voice-category" placeholder="日常">
      <label>语音名称：</label>
      <input type="text" id="upload-voice-name" placeholder="拜拜，快滚吧">
      <label>选择音频：</label>
      <input type="file" id="upload-voice-file" accept="audio/*">
      <button id="upload-voice-btn" class="control-btn">上传语音</button>
    </div>

    <div class="local-files">
      <h4>本地缓存列表</h4>
      <ul id="local-files-list"></ul>
      <button id="clear-local" class="control-btn small danger">清空本地缓存</button>
    </div>

    <div class="manage-categories">
      <h4>管理表情（支持改名与多分类，用逗号分隔）</h4>
      <div id="manage-cat-list"></div>
    </div>
  </section>

  <!-- 密码弹窗 -->
  <div id="login-modal" class="modal" style="display:none;">
    <div class="modal-content">
      <h3>管理员登录</h3>
      <input type="password" id="login-password" placeholder="输入密码">
      <div class="modal-actions">
        <button id="login-cancel" class="control-btn small">取消</button>
        <button id="login-submit" class="control-btn small">登录</button>
      </div>
    </div>
  </div>

  <!-- 底部信息区域 -->
  <footer class="simple-footer">
    <p>音频与表情来源直播和B站投稿</p>
    <p class="footer-links-line">友情链接: 暂无</p>
    <p class="github-line">
      <a href="https://github.com/lu-91015/shadowlee.github.io" target="_blank" rel="noopener">本项目</a>
      请在GitHub参与翻译、增补音频或提出建议
    </p>
    <p class="disclaimer-line">本站为爱好者作品，和PSPLIVE官方没有关联</p>
  </footer>
</div>

<link rel="stylesheet" href="{{ '/assets/css/style.css' | relative_url }}">
<script>
  window.SITE_BASE = "{{ '/' | relative_url }}";
  // Cloudflare Worker 上传服务地址
  window.UPLOAD_WORKER_URL = "https://shadowlee.1557852185.workers.dev";
  // 表情元数据（构建时注入），用于分类管理与多分类渲染
  window.EMOTE_META = {{ site.data.emotes_meta | jsonify }};
</script>
<script src="{{ '/assets/js/player.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/game-modal.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/game-slot.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/game-pinball.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/game-merge.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/game-flappy.js' | relative_url }}" defer></script>
