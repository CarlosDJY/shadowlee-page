# GitHub Pages 文件上传方案（Cloudflare Worker）

本项目部署在 GitHub Pages，没有后端。要让网页上传表情/音频并真正保存，需要借助 Cloudflare Worker 作为中间层，把文件写回 GitHub 仓库。

## 原理

1. 访客在网页输入管理密码，选择表情/音频上传。
2. 前端把文件转成 base64，POST 到 Cloudflare Worker。
3. Worker 校验密码，调用 GitHub Contents API 把文件写入仓库对应目录。
4. 仓库更新后，GitHub Pages 自动重新构建部署，新资源上线。

## 准备工作

### 1. 创建 GitHub Token

1. 打开 GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**。
2. 点击 **Generate new token**。
3. Token name：例如 `shadowlee-upload`。
4. Expiration：按需选择（建议 90 天或更久）。
5. Repository access：选择 **Only select repositories**，勾选 `lu-91015/shadowlee.github.io`。
6. Permissions → **Repository permissions**：找到 **Contents**，选择 **Read and write**。
7. 点击 Generate token，复制 token（只显示一次）。

### 2. 创建 Cloudflare Worker

1. 打开 [dash.cloudflare.com](https://dash.cloudflare.com)，登录账号。
2. 左侧菜单点击 **Compute** → **Workers & Pages**。
3. 点击 **Create application** → **Create Worker**。
4. 输入 Worker name，例如 `lidousha-upload`。
5. 点击 **Deploy**，然后再点击 **Edit code**。
6. 把 `worker/upload.js` 的内容粘贴进去，替换默认代码。
7. 点击 **Deploy**。

### 3. 设置环境变量

1. 在 Worker 详情页，点击 **Settings** → **Variables and Secrets**。
2. 添加以下变量：
   - `UPLOAD_PASSWORD`：网页管理密码（例如自己设的强密码）。
   - `GITHUB_TOKEN`：刚才复制的 GitHub fine-grained token。
   - `GITHUB_REPO`：仓库名，例如 `lu-91015/shadowlee.github.io`。
3. 点击 **Save**。

### 4. 配置前端

在 `index.markdown` 末尾的内联脚本里，把 Worker 地址填进去：

```html
<script>
  window.SITE_BASE = "{{ '/' | relative_url }}";
  window.UPLOAD_WORKER_URL = "https://lidousha-upload.你的子域.workers.dev";
</script>
```

具体地址在 Worker 详情页可见（Triggers 标签下的 URL）。

## 限制

- GitHub Contents API 单个文件上限约 **1MB**。表情包通常没问题；较长的 MP3 语音可能超过，遇到这种情况会报错，需要改用 Git LFS 或 Git Blob API。
- 上传后 GitHub Pages 重新部署通常需要 **30 秒 ~ 2 分钟**，新资源不会立刻显示。
