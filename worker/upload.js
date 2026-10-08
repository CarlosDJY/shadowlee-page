// Cloudflare Worker：接收上传文件并写入 GitHub 仓库
// 支持 action：
//   pingGithub    诊断：返回 GitHub API 可达性/配置（不含敏感信息）
//   upload        上传表情图片，并写入/更新元数据（多分类、gif 默认归入 gif）
//   upload-voice  上传语音文件
//   setCategories 修改已上传表情的分类
// 部署后需在 Workers & Pages → Settings → Variables 设置：
//   UPLOAD_PASSWORD  （网页管理密码）
//   GITHUB_TOKEN     （GitHub fine-grained token，仓库 contents 读写权限）
//   GITHUB_REPO      （例：lu-91015/shadowlee.github.io）

const META_PATH = '_data/emotes_meta.yml';
const EMOTE_DIR = 'assets/images/emotes';

function b64encodeUtf8(str) {
  // UTF-8 字符串 -> base64（GitHub contents API 要求）
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64decodeUtf8(b64) {
  // base64 -> UTF-8 字符串
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function ghHeaders(env, extra) {
  return Object.assign({
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'shadowlee-upload-worker',
  }, extra || {});
}

// ---------- 极简 YAML（只处理本项目的结构） ----------

function yamlString(s) {
  // 统一用 JSON 双引号，Psych/SafeYAML 都能解析，且对中文安全
  return JSON.stringify(String(s));
}

function dataToYaml(data) {
  const lines = ['items:'];
  for (const item of (data.items || [])) {
    lines.push(`  - file: ${yamlString(item.file)}`);
    lines.push(`    name: ${yamlString(item.name)}`);
    const cats = item.categories || [];
    if (cats.length === 0) {
      lines.push('    categories: []');
    } else {
      lines.push('    categories:');
      for (const c of cats) lines.push(`      - ${yamlString(c)}`);
    }
  }
  return lines.join('\n') + '\n';
}

function parseYamlValue(v) {
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    try { return JSON.parse(v); } catch (e) { return v.slice(1, -1); }
  }
  if (v === '[]') return [];
  return v;
}

function parseYaml(text) {
  const data = { items: [] };
  const lines = text.split(/\r?\n/);
  let item = null;
  let inCategories = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (line === 'items:' || line === 'items: []') continue;
    if (line.startsWith('  - file:')) {
      item = { file: parseYamlValue(line.slice('  - file:'.length)), name: '', categories: [] };
      data.items.push(item);
      inCategories = false;
    } else if (item && line.startsWith('    name:')) {
      item.name = parseYamlValue(line.slice('    name:'.length));
      inCategories = false;
    } else if (item && line.startsWith('    categories:')) {
      const rest = line.slice('    categories:'.length).trim();
      if (rest === '[]') {
        item.categories = [];
        inCategories = false;
      } else {
        inCategories = true;
      }
    } else if (item && inCategories && line.startsWith('      - ')) {
      item.categories.push(parseYamlValue(line.slice('      - '.length)));
    }
  }
  return data;
}

// -----------------------------------------------------

async function readMeta(env) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${META_PATH}`;
  const res = await fetch(url, { headers: await ghHeaders(env) });
  if (res.status === 404) return { data: { items: [] }, sha: null };
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`读取元数据失败: ${res.status} ${t}`);
  }
  const json = await res.json();
  const text = b64decodeUtf8(json.content);
  const data = parseYaml(text);
  return { data, sha: json.sha };
}

async function writeMeta(env, data, sha) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${META_PATH}`;
  const text = dataToYaml(data);
  const body = {
    message: 'Update emotes meta',
    content: b64encodeUtf8(text),
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: await ghHeaders(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`写入元数据失败: ${res.status} ${t}`);
  }
  return res.json();
}

function safeName(name) {
  return (name || 'emote').replace(/[^a-zA-Z0-9一-龥_-]/g, '_');
}

async function uploadEmote(env, { name, ext, content, categories }) {
  const base = safeName(name);
  let fileName = `${base}.${ext}`;
  // 文件名冲突则追加时间戳
  const checkUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${EMOTE_DIR}/${encodeURIComponent(fileName)}`;
  const chk = await fetch(checkUrl, { headers: await ghHeaders(env) });
  if (chk.status === 200) {
    fileName = `${base}_${Date.now()}.${ext}`;
  }

  // 写入图片文件
  const putUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${EMOTE_DIR}/${encodeURIComponent(fileName)}`;
  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: await ghHeaders(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message: `Upload ${fileName}`, content }),
  });
  if (!putRes.ok) {
    const t = await putRes.text();
    throw new Error(`上传图片失败: ${putRes.status} ${t}`);
  }

  // 更新元数据
  const { data, sha } = await readMeta(env);
  data.items = data.items || [];
  let cats = Array.isArray(categories) ? [...new Set(categories)] : [];
  if (ext === 'gif' && !cats.includes('gif')) cats.push('gif'); // gif 默认归入 gif 分类
  data.items.push({ file: fileName, name: name || base, categories: cats });
  await writeMeta(env, data, sha);
  return fileName;
}

async function setCategories(env, { file, categories }) {
  const { data, sha } = await readMeta(env);
  const item = (data.items || []).find(i => i.file === file);
  if (!item) throw new Error(`未找到表情: ${file}`);
  let cats = Array.isArray(categories) ? [...new Set(categories)] : [];
  if (file.toLowerCase().endsWith('.gif') && !cats.includes('gif')) cats.push('gif'); // gif 默认保留 gif 分类
  item.categories = cats;
  await writeMeta(env, data, sha);
  return file;
}

async function updateMeta(env, { file, name, categories }) {
  const { data, sha } = await readMeta(env);
  const item = (data.items || []).find(i => i.file === file);
  if (!item) throw new Error(`未找到表情: ${file}`);
  if (typeof name === 'string' && name.trim()) item.name = name.trim();
  let cats = Array.isArray(categories) ? [...new Set(categories)] : [];
  if (file.toLowerCase().endsWith('.gif') && !cats.includes('gif')) cats.push('gif'); // gif 默认保留 gif 分类
  item.categories = cats;
  await writeMeta(env, data, sha);
  return file;
}

export default {
  async fetch(request, env) {
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

    // 密码校验（明文比对）
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

    const action = body.action;
    try {
      // 诊断端点：检查 GitHub 配置与可达性
      if (action === 'pingGithub') {
        const info = { hasToken: !!env.GITHUB_TOKEN, repo: env.GITHUB_REPO, metaPath: META_PATH };
        try {
          const u = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${META_PATH}`;
          const r = await fetch(u, { headers: await ghHeaders(env) });
          info.githubStatus = r.status;
          info.githubBody = (await r.text()).slice(0, 800);
        } catch (e) {
          info.fetchError = String(e && e.stack ? e.stack : e);
        }
        return new Response(JSON.stringify(info, null, 2), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'upload') {
        const { name, ext, content, categories } = body;
        if (!content || typeof content !== 'string') {
          return new Response('Missing content', { status: 400, headers: corsHeaders });
        }
        const fileName = await uploadEmote(env, { name, ext, content, categories });
        return new Response(JSON.stringify({ ok: true, file: fileName }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (action === 'setCategories') {
        const { file, categories } = body;
        if (!file) return new Response('Missing file', { status: 400, headers: corsHeaders });
        const updated = await setCategories(env, { file, categories });
        return new Response(JSON.stringify({ ok: true, file: updated }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (action === 'updateMeta') {
        const { file, name, categories } = body;
        if (!file) return new Response('Missing file', { status: 400, headers: corsHeaders });
        const updated = await updateMeta(env, { file, name, categories });
        return new Response(JSON.stringify({ ok: true, file: updated }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (action === 'upload-voice') {
        const { name, ext, content, categories } = body;
        if (!content || typeof content !== 'string') {
          return new Response('Missing content', { status: 400, headers: corsHeaders });
        }
        const cat = (Array.isArray(categories) && categories[0]) || 'other';
        const safeCat = safeName(cat);
        const base = safeName(name);
        const fileName = `${base}.${ext}`;
        const putUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/assets/audio/${safeCat}/${encodeURIComponent(fileName)}`;
        const putRes = await fetch(putUrl, {
          method: 'PUT',
          headers: await ghHeaders(env, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ message: `Upload voice ${fileName}`, content }),
        });
        if (!putRes.ok) {
          const t = await putRes.text();
          throw new Error(`上传语音失败: ${putRes.status} ${t}`);
        }
        return new Response(JSON.stringify({ ok: true, file: `assets/audio/${safeCat}/${fileName}` }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        return new Response('Unknown action', { status: 400, headers: corsHeaders });
      }
    } catch (e) {
      return new Response(`Error: ${e && e.message ? e.message : String(e)}`, { status: 502, headers: corsHeaders });
    }
  },
};
