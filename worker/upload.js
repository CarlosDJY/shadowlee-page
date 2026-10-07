// Cloudflare Worker：接收上传文件并写入 GitHub 仓库
// 部署后需要在 Workers & Pages → Settings → Variables 里设置：
//   UPLOAD_PASSWORD  （网页管理密码）
//   GITHUB_TOKEN     （GitHub fine-grained token，仓库 contents 读写权限）
//   GITHUB_REPO      （例：lu-91015/shadowlee.github.io）

const ALLOWED_PATHS = [
  /^assets\/images\/emotes\//,
  /^assets\/audio\//,
];

function isAllowedPath(path) {
  return ALLOWED_PATHS.some((re) => re.test(path));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 仅允许你的 GitHub Pages 站点跨域调用（本地开发用 * 也可以）
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-upload-password',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    // 密码校验
    const password = request.headers.get('x-upload-password');
    if (!env.UPLOAD_PASSWORD || password !== env.UPLOAD_PASSWORD) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
      return new Response('Server config missing', { status: 500, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    const { path, content } = body || {};
    if (!path || typeof content !== 'string' || !content) {
      return new Response('Missing path or content', { status: 400, headers: corsHeaders });
    }

    if (!isAllowedPath(path)) {
      return new Response('Path not allowed', { status: 403, headers: corsHeaders });
    }

    const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${encodeURIComponent(path)}`;
    const authHeaders = {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'shadowlee-upload-worker',
    };

    // 若文件已存在，需要传 sha 才能更新
    let sha;
    try {
      const checkRes = await fetch(apiUrl, { headers: authHeaders });
      if (checkRes.status === 200) {
        const data = await checkRes.json();
        sha = data.sha;
      }
    } catch (e) {
      // 忽略查询失败，继续尝试创建
    }

    const commitBody = {
      message: `Upload ${path}`,
      content,
      ...(sha ? { sha } : {}),
    };

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commitBody),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      return new Response(`GitHub API error ${putRes.status}: ${errText}`, {
        status: 502,
        headers: corsHeaders,
      });
    }

    const result = await putRes.json();
    return new Response(
      JSON.stringify({ ok: true, path, commit: result.commit?.sha }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  },
};
