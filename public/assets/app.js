const APP_VERSION = '0.3.0-cloudflare-pages';
const STORAGE_KEYS = {
  files: 'daisy_ai_files_v1',
  settings: 'daisy_ai_settings_v1',
  history: 'daisy_ai_history_v1'
};

const DEFAULT_FILES = [
  'content/knowledge/brand.json',
  'content/knowledge/forbidden-words.json',
  'content/knowledge/products.json',
  'content/prompts/analyzer.md',
  'content/prompts/title.md',
  'content/prompts/copywriter.md',
  'content/prompts/comments.md',
  'content/prompts/review.md',
  'content/skills/xiaohongshu-style.md',
  'content/skills/humanize.md',
  'content/skills/compliance.md',
  'content/workflows/xhs-article.json'
];

const DEFAULT_FORM = {
  product: '内衣洗液',
  contentType: '小红书爆文笔记',
  audience: '20-35 岁注重贴身衣物护理的女生',
  topic: '贴身衣物洗护这件小事，真的会影响生活感',
  reference: '',
  extra: '不要医疗化，不要夸张功效，不要官方口吻。'
};

const state = {
  route: 'studio',
  ready: false,
  loading: false,
  files: {},
  filePaths: [],
  selectedFile: 'content/knowledge/brand.json',
  result: null,
  history: [],
  form: { ...DEFAULT_FORM },
  settings: {
    provider: 'mock',
    apiBaseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: '',
    saveApiKey: false
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const safeJsonParse = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};
const pretty = (value) => JSON.stringify(value, null, 2);
const nowText = () => new Date().toLocaleString('zh-CN', { hour12: false });

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function slugRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  return hash === 'admin' ? 'admin' : 'studio';
}

function setRoute(route) {
  location.hash = `/${route}`;
}

async function bootstrap() {
  state.route = slugRoute();
  state.settings = { ...state.settings, ...safeJsonParse(localStorage.getItem(STORAGE_KEYS.settings), {}) };
  if (!state.settings.saveApiKey) state.settings.apiKey = '';
  state.history = safeJsonParse(localStorage.getItem(STORAGE_KEYS.history), []);

  const localFiles = safeJsonParse(localStorage.getItem(STORAGE_KEYS.files), null);
  if (localFiles && typeof localFiles === 'object') {
    state.files = localFiles;
    state.filePaths = Object.keys(localFiles).sort();
  } else {
    await loadDefaultFiles();
  }
  state.ready = true;
  render();
}

async function loadDefaultFiles() {
  let manifest = DEFAULT_FILES;
  try {
    const res = await fetch('content/manifest.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) manifest = data;
    }
  } catch {}

  const entries = await Promise.all(manifest.map(async (path) => {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      return [path, res.ok ? await res.text() : ''];
    } catch {
      return [path, ''];
    }
  }));
  state.files = Object.fromEntries(entries);
  state.filePaths = Object.keys(state.files).sort();
  state.selectedFile = state.filePaths[0] || state.selectedFile;
}

function persistFiles() {
  localStorage.setItem(STORAGE_KEYS.files, JSON.stringify(state.files));
}

function persistSettings() {
  const next = { ...state.settings };
  if (!next.saveApiKey) next.apiKey = '';
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next));
}

function persistHistory() {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history.slice(0, 20)));
}

function fileText(path) {
  return state.files[path] || '';
}

function fileJson(path, fallback) {
  return safeJsonParse(fileText(path), fallback);
}

function getBrand() { return fileJson('content/knowledge/brand.json', {}); }
function getProducts() { return fileJson('content/knowledge/products.json', []); }
function getForbiddenWords() { return fileJson('content/knowledge/forbidden-words.json', []); }

function interpolate(template, vars) {
  return String(template || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
    return vars[key] == null ? '' : String(vars[key]);
  });
}

function buildPrompt(stepId, form, previous = {}) {
  const promptPathByStep = {
    analyzer: 'content/prompts/analyzer.md',
    title: 'content/prompts/title.md',
    copywriter: 'content/prompts/copywriter.md',
    comments: 'content/prompts/comments.md',
    review: 'content/prompts/review.md'
  };
  const skillText = [
    fileText('content/skills/xiaohongshu-style.md'),
    fileText('content/skills/humanize.md'),
    fileText('content/skills/compliance.md')
  ].filter(Boolean).join('\n\n---\n\n');

  const brand = getBrand();
  const products = getProducts();
  const product = products.find((item) => item.name === form.product) || products[0] || {};
  const vars = {
    product: form.product,
    contentType: form.contentType,
    audience: form.audience,
    topic: form.topic,
    reference: form.reference || '未提供参考爆文',
    extra: form.extra || '无',
    brand: pretty(brand),
    productInfo: pretty(product),
    analysis: previous.analysis || '',
    titles: previous.titles || '',
    body: previous.body || '',
    comments: previous.comments || ''
  };

  const base = fileText(promptPathByStep[stepId]);
  return [
    `你正在执行 DAISY AI Studio 工作流步骤：${stepId}`,
    '【品牌知识库】', pretty(brand),
    '【产品信息】', pretty(product),
    '【风格与合规 Skill】', skillText,
    '【用户输入】', pretty(form),
    '【当前步骤 Prompt】', interpolate(base, vars),
    '【上一步输出】', pretty(previous),
    '请只输出当前步骤需要的结果，不要解释你在执行什么。'
  ].join('\n\n');
}

function buildAllInOnePrompt(form) {
  const brand = getBrand();
  const products = getProducts();
  const product = products.find((item) => item.name === form.product) || products[0] || {};
  const skills = [
    fileText('content/skills/xiaohongshu-style.md'),
    fileText('content/skills/humanize.md'),
    fileText('content/skills/compliance.md')
  ].join('\n\n');
  const prompts = [
    fileText('content/prompts/analyzer.md'),
    fileText('content/prompts/title.md'),
    fileText('content/prompts/copywriter.md'),
    fileText('content/prompts/comments.md'),
    fileText('content/prompts/review.md')
  ].join('\n\n---\n\n');

  return [
    '你是 DAISY AI Studio，小红书内容生产工作流。',
    '请按顺序输出：1）爆文结构拆解 2）10个标题 3）正文 4）10条评论 5）合规与AI味审核。',
    '要求：活人感、低广告感、低AI味、符合小红书表达，不使用医疗化/绝对化宣传。',
    '【品牌资料】', pretty(brand),
    '【产品资料】', pretty(product),
    '【用户输入】', pretty(form),
    '【Skill】', skills,
    '【Prompt Library】', prompts
  ].join('\n\n');
}

async function callAI(prompt, stepId) {
  if (state.settings.provider === 'cloudflare') {
    return callCloudflareFunction(prompt, stepId);
  }
  if (state.settings.provider === 'direct') {
    return callOpenAICompatible(prompt, stepId);
  }
  return mockAI(prompt, stepId);
}

async function callCloudflareFunction(prompt, stepId) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      stepId,
      model: state.settings.model,
      temperature: 0.85
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Cloudflare Function 调用失败：${res.status}`);
  }
  return data.content || `[${stepId}] AI 没有返回内容`;
}

async function callOpenAICompatible(prompt, stepId) {
  const apiKey = state.settings.apiKey.trim();
  const baseUrl = state.settings.apiBaseUrl.trim().replace(/\/$/, '');
  if (!apiKey) throw new Error('还没有填写 API Key。浏览器直连模式会把 Key 保存在你自己的浏览器里。');
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: state.settings.model,
      messages: [
        { role: 'system', content: '你是一个谨慎的小红书内容工作流助手，输出中文。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.85
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI 接口失败：${res.status} ${text.slice(0, 260)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || `[${stepId}] AI 没有返回内容`;
}

function mockAI(prompt, stepId) {
  const form = state.form;
  const product = form.product || '产品';
  const topic = form.topic || '日常护理';
  const map = {
    analyzer: `标题钩子：从“我以前没注意的小事”切入。\n第一句：用真实后悔/突然意识到开场。\n痛点：贴身衣物洗护容易被忽略，但女生会在细节里感受到不舒服。\n情绪：不是恐吓，而是“我后来才发现”的生活复盘。\n产品出现位置：正文中后段自然带出，不要第一段硬广。\n节奏：短句、停顿、生活细节、最后用轻 CTA 收尾。`,
    title: `1. 以前真的没把贴身衣物洗护当回事\n2. 原来女生的生活感藏在这种小细节里\n3. 这个小习惯，我后悔没有早点养成\n4. 内衣别再随手一洗了…真的不一样\n5. 不是精致，是终于开始认真照顾自己\n6. 最近被一个洗护小东西拿捏了\n7. 贴身衣物洗完有干净感这件事太重要了\n8. 我现在洗内衣会单独用它\n9. 有些舒服，是从看不见的地方开始的\n10. 这瓶${product}，有点像生活里的小安全感`,
    copywriter: `我以前真的很随便。\n\n贴身衣物就是顺手洗一洗，觉得“洗干净了就行”。后来才发现，有些东西不是肉眼看到干净就够了，尤其是每天贴着自己的那一层。\n\n最近我开始把这件事单独拎出来做。不是突然变精致，也不是给自己加很多步骤，就是洗内衣的时候会用专门的${product}。\n\n它给我的感觉不是那种很冲的香，也不是洗完滑滑假假的感觉。更像是洗完晾起来的时候，心里会觉得：嗯，这件小事终于被认真对待了。\n\n我还挺喜欢这种变化的。没有多隆重，但每天都会碰到。\n\n女生有时候真的不是需要多贵的东西，就是一些很小的细节，让你觉得自己被照顾到了。\n\n如果你也和我以前一样，觉得贴身衣物随便洗洗就好，可以从这件小事开始试试看。`,
    comments: `1. 我也是最近才开始分开洗，真的安心很多\n2. 这种小细节太懂女生了\n3. 想问味道会不会很重？\n4. 贴身衣物真的不能太随便\n5. “被照顾到”这句好戳\n6. 我之前一直用普通洗衣液，现在有点想换\n7. 洗完有干净感真的很重要\n8. 这个分享好像朋友在聊天\n9. 求问适合手洗吗？\n10. 收藏了，准备下次试试`,
    review: `活人感：8.8/10\n广告感：2.1/10\nAI味：2.4/10\n合规风险：低\n建议：标题可再口语一点，正文避免继续增加功效描述。`
  };
  return new Promise((resolve) => setTimeout(() => resolve(map[stepId] || `Mock output for ${stepId}: ${topic}`), 260));
}

function runCompliance(text) {
  const words = getForbiddenWords();
  const hits = [];
  for (const item of words) {
    if (!item || !item.word) continue;
    if (text.includes(item.word)) hits.push(item);
  }
  const high = hits.filter((x) => x.level === 'high').length;
  const medium = hits.filter((x) => x.level === 'medium').length;
  const score = Math.max(0, 10 - high * 3 - medium * 1.5 - Math.max(0, hits.length - high - medium));
  return { hits, score: Number(score.toFixed(1)) };
}

function estimateHumanScore(body) {
  const badPatterns = ['首先', '其次', '最后', '总而言之', '综上所述', '对于', '值得一试', '建议大家', '不仅', '而且'];
  const badCount = badPatterns.reduce((n, word) => n + (body.includes(word) ? 1 : 0), 0);
  const shortLines = body.split('\n').filter((line) => line.trim().length > 0 && line.trim().length < 32).length;
  const score = Math.max(0, Math.min(10, 7.8 + shortLines * .18 - badCount * .8));
  return Number(score.toFixed(1));
}

async function generate() {
  state.loading = true;
  state.result = null;
  syncFormFromDom();
  render();

  const trace = [];
  const previous = {};
  try {
    for (const step of ['analyzer', 'title', 'copywriter', 'comments', 'review']) {
      const prompt = buildPrompt(step, state.form, previous);
      trace.push({ step, status: 'running', prompt });
      renderResultSkeleton(trace);
      const output = await callAI(prompt, step);
      if (step === 'analyzer') previous.analysis = output;
      if (step === 'title') previous.titles = output;
      if (step === 'copywriter') previous.body = output;
      if (step === 'comments') previous.comments = output;
      if (step === 'review') previous.review = output;
      trace[trace.length - 1] = { step, status: 'done', prompt, output };
    }

    const combined = [previous.titles, previous.body, previous.comments].join('\n\n');
    const compliance = runCompliance(combined);
    const humanScore = estimateHumanScore(previous.body || '');
    state.result = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: nowText(),
      form: { ...state.form },
      analysis: previous.analysis || '',
      titles: previous.titles || '',
      body: previous.body || '',
      comments: previous.comments || '',
      review: previous.review || '',
      compliance,
      scores: {
        human: humanScore,
        compliance: compliance.score,
        ad: Number(Math.max(0, 10 - humanScore + compliance.hits.length * .3).toFixed(1)),
        ai: Number(Math.max(0, 10 - humanScore + .8).toFixed(1))
      },
      allInOnePrompt: buildAllInOnePrompt(state.form),
      trace
    };
    state.history.unshift(state.result);
    state.history = state.history.slice(0, 20);
    persistHistory();
  } catch (error) {
    state.result = {
      error: error.message || String(error),
      allInOnePrompt: buildAllInOnePrompt(state.form),
      trace
    };
  } finally {
    state.loading = false;
    render();
  }
}

function syncFormFromDom() {
  const form = $('#studio-form');
  if (!form) return;
  state.form = {
    product: form.product.value.trim(),
    contentType: form.contentType.value.trim(),
    audience: form.audience.value.trim(),
    topic: form.topic.value.trim(),
    reference: form.reference.value.trim(),
    extra: form.extra.value.trim()
  };
}

function render() {
  const app = $('#app');
  if (!state.ready) {
    app.innerHTML = `<main class="main"><div class="card">正在加载 DAISY AI Studio...</div></main>`;
    return;
  }

  app.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="logo">
          <div class="logo-mark">D</div>
          <div>
            <div class="logo-title">DAISY AI Studio</div>
            <div class="logo-sub">Cloudflare Pages 版</div>
          </div>
        </div>
        <nav class="nav">
          <a href="#/studio" class="${state.route === 'studio' ? 'active' : ''}">小红书生成窗口</a>
          <a href="#/admin" class="${state.route === 'admin' ? 'active' : ''}">后台控制页面</a>
        </nav>
        <div class="sidebar-footer">
          <div>v${APP_VERSION}</div>
          <div>配置保存在当前浏览器 localStorage。后台修改不会自动写回 GitHub 仓库。</div>
        </div>
      </aside>
      <main class="main">
        ${state.route === 'admin' ? renderAdmin() : renderStudio()}
      </main>
    </div>
  `;
  bindEvents();
}

function renderStudio() {
  const products = getProducts();
  const productOptions = products.length
    ? products.map((p) => `<option value="${escapeHtml(p.name)}" ${p.name === state.form.product ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')
    : `<option value="${escapeHtml(state.form.product)}">${escapeHtml(state.form.product)}</option>`;

  return `
    <div class="topbar">
      <div>
        <h1 class="h1">小红书内容工作台</h1>
        <p class="lead">输入产品、选题和参考爆文，生成标题、正文、评论和审核结果。</p>
      </div>
      <div class="inline">
        <span class="pill ${state.settings.provider === 'mock' ? 'ok' : 'warn'}">${state.settings.provider === 'mock' ? 'Mock 模式' : state.settings.provider === 'cloudflare' ? 'Cloudflare Function' : '浏览器直连 AI'}</span>
        <button class="btn ghost small" data-action="route-admin">模型设置</button>
      </div>
    </div>

    <div class="grid">
      <section class="card">
        <div class="card-title"><h2>输入</h2><button class="btn ghost small" data-action="reset-form">重置</button></div>
        <form id="studio-form" class="form">
          <div class="two">
            <div class="row">
              <label>产品</label>
              <select class="select" name="product">${productOptions}</select>
            </div>
            <div class="row">
              <label>内容类型</label>
              <input class="input" name="contentType" value="${escapeHtml(state.form.contentType)}" />
            </div>
          </div>
          <div class="row">
            <label>目标人群</label>
            <input class="input" name="audience" value="${escapeHtml(state.form.audience)}" />
          </div>
          <div class="row">
            <label>选题</label>
            <input class="input" name="topic" value="${escapeHtml(state.form.topic)}" />
          </div>
          <div class="row">
            <label>参考爆文 / 竞品模板</label>
            <textarea class="textarea" name="reference" placeholder="粘贴小红书爆文、竞品文案或你自己的模板...">${escapeHtml(state.form.reference)}</textarea>
          </div>
          <div class="row">
            <label>额外要求</label>
            <textarea class="textarea" name="extra">${escapeHtml(state.form.extra)}</textarea>
          </div>
          <button type="submit" class="btn primary" ${state.loading ? 'disabled' : ''}>
            ${state.loading ? '<span class="inline"><span class="spinner"></span> 生成中</span>' : '生成小红书内容'}
          </button>
          <button type="button" class="btn ghost" data-action="copy-all-in-one">复制完整 Prompt 到 ChatGPT</button>
        </form>
      </section>

      <section id="result-area">
        ${renderResult()}
      </section>
    </div>
  `;
}

function renderResultSkeleton(trace) {
  const area = $('#result-area');
  if (!area) return;
  area.innerHTML = `
    <section class="card">
      <div class="card-title"><h2>生成进度</h2><span class="pill warn">运行中</span></div>
      <div class="output mono">${escapeHtml(trace.map((x) => `${x.step}: ${x.status}`).join('\n'))}</div>
    </section>
  `;
}

function renderResult() {
  const r = state.result;
  if (!r) {
    return `
      <section class="card">
        <div class="card-title"><h2>输出</h2><span class="pill">等待输入</span></div>
        <div class="notice info">当前是 Cloudflare Pages 版。默认 Mock 模式可以先测试流程；需要真实 AI 时，在后台选择 Cloudflare Function，并在 Cloudflare Pages 环境变量里配置模型接口。</div>
      </section>
      ${renderHistoryCard()}
    `;
  }
  if (r.error) {
    return `
      <section class="card">
        <div class="card-title"><h2>生成失败</h2><span class="pill danger">Error</span></div>
        <div class="notice"><strong>原因：</strong>${escapeHtml(r.error)}</div>
        <div class="footer-actions">
          <button class="btn" data-copy="${escapeHtml(r.allInOnePrompt)}">复制完整 Prompt</button>
          <button class="btn ghost" data-action="route-admin">检查模型设置</button>
        </div>
      </section>
      ${renderTrace(r.trace || [])}
    `;
  }

  const hits = r.compliance.hits || [];
  return `
    <section class="card">
      <div class="card-title">
        <h2>质量评分</h2>
        <span class="pill ${hits.length ? 'warn' : 'ok'}">${hits.length ? `${hits.length} 个风险词` : '未命中风险词'}</span>
      </div>
      <div class="score-grid">
        <div class="score"><b>${r.scores.human}</b><span>活人感</span></div>
        <div class="score"><b>${r.scores.compliance}</b><span>合规安全</span></div>
        <div class="score"><b>${r.scores.ai}</b><span>AI 味风险</span></div>
        <div class="score"><b>${r.scores.ad}</b><span>广告感风险</span></div>
      </div>
      ${hits.length ? `<div class="notice" style="margin-top:12px;">命中：${hits.map((x) => `${escapeHtml(x.word)} → ${escapeHtml(x.suggestion || '建议替换')}`).join('；')}</div>` : ''}
    </section>

    ${sectionOutput('标题候选', r.titles)}
    ${sectionOutput('正文', r.body)}
    ${sectionOutput('评论', r.comments)}
    ${sectionOutput('审核', r.review)}
    ${sectionOutput('爆文拆解', r.analysis)}

    <section class="card">
      <div class="card-title"><h2>操作</h2><span class="pill">${escapeHtml(r.createdAt)}</span></div>
      <div class="footer-actions">
        <button class="btn primary" data-action="copy-markdown">复制 Markdown</button>
        <button class="btn" data-action="download-markdown">导出 Markdown</button>
        <button class="btn ghost" data-action="copy-all-in-one">复制完整 Prompt</button>
      </div>
    </section>
    ${renderTrace(r.trace || [])}
  `;
}

function sectionOutput(title, text) {
  return `
    <section class="card">
      <div class="card-title"><h2>${escapeHtml(title)}</h2><button class="btn ghost small" data-copy="${escapeHtml(text)}">复制</button></div>
      <div class="output">${escapeHtml(text || '暂无内容')}</div>
    </section>
  `;
}

function renderTrace(trace) {
  if (!trace.length) return '';
  return `
    <section class="card">
      <div class="card-title"><h2>Workflow Trace</h2><span class="pill">${trace.length} steps</span></div>
      <div class="output mono">${escapeHtml(trace.map((x) => `[${x.status}] ${x.step}`).join('\n'))}</div>
    </section>
  `;
}

function renderHistoryCard() {
  if (!state.history.length) return '';
  return `
    <section class="card">
      <div class="card-title"><h2>最近生成</h2><button class="btn ghost small" data-action="clear-history">清空</button></div>
      <div class="history-list">
        ${state.history.slice(0, 5).map((item, index) => `
          <button class="history-item" data-history-index="${index}">
            <strong>${escapeHtml(item.form?.topic || '未命名选题')}</strong>
            <span>${escapeHtml(item.createdAt || '')} · ${escapeHtml(item.form?.product || '')}</span>
          </button>
        `).join('')}
      </div>
    </section>
  `;
}

function renderAdmin() {
  const selected = state.selectedFile || state.filePaths[0];
  const current = fileText(selected);
  return `
    <div class="topbar">
      <div>
        <h1 class="h1">后台控制页面</h1>
        <p class="lead">管理 Prompt、Skill、品牌知识库、Workflow 和模型设置。静态版会保存到当前浏览器。</p>
      </div>
      <button class="btn primary" data-action="route-studio">回到生成窗口</button>
    </div>

    <div class="grid-3">
      <section class="card">
        <div class="card-title"><h2>配置文件</h2><span class="pill">${state.filePaths.length}</span></div>
        <div class="file-list">
          ${state.filePaths.map((path) => `<button class="file-item ${path === selected ? 'active' : ''}" data-file="${escapeHtml(path)}">${escapeHtml(path)}</button>`).join('')}
        </div>
        <div class="footer-actions">
          <button class="btn ghost small" data-action="add-file">新增文件</button>
          <button class="btn ghost small" data-action="delete-file">删除当前</button>
        </div>
      </section>

      <section class="card">
        <div class="card-title"><h2>编辑器</h2><span class="pill">${escapeHtml(selected || '无文件')}</span></div>
        <div class="form">
          <div class="row">
            <label>文件路径</label>
            <input class="input" id="file-path" value="${escapeHtml(selected || '')}" />
          </div>
          <div class="row">
            <label>内容</label>
            <textarea class="textarea" id="file-content" style="min-height:52vh;font-family:var(--mono);font-size:13px;">${escapeHtml(current)}</textarea>
          </div>
          <div class="footer-actions">
            <button class="btn primary" data-action="save-file">保存到浏览器</button>
            <button class="btn" data-action="format-json">格式化 JSON</button>
            <button class="btn ghost" data-copy="${escapeHtml(current)}">复制当前文件</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-title"><h2>部署/模型</h2><span class="pill">Pages</span></div>
        <div class="form">
          <div class="notice">Cloudflare Pages 已包含 /api/chat Function，可在服务端读取 OPENAI_API_KEY、OPENAI_API_BASE_URL、OPENAI_MODEL。浏览器直连模式只建议临时调试使用。</div>
          <div class="row">
            <label>Provider</label>
            <select class="select" id="provider">
              <option value="mock" ${state.settings.provider === 'mock' ? 'selected' : ''}>Mock，本地测试</option>
              <option value="cloudflare" ${state.settings.provider === 'cloudflare' ? 'selected' : ''}>Cloudflare Function，推荐部署后使用</option>
              <option value="direct" ${state.settings.provider === 'direct' ? 'selected' : ''}>浏览器直连 OpenAI-compatible</option>
            </select>
          </div>
          <div class="row">
            <label>API Base URL</label>
            <input class="input" id="api-base-url" value="${escapeHtml(state.settings.apiBaseUrl)}" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="row">
            <label>Model</label>
            <input class="input" id="model" value="${escapeHtml(state.settings.model)}" />
          </div>
          <div class="row">
            <label>API Key（仅浏览器直连模式使用）</label>
            <input class="input" id="api-key" type="password" value="${escapeHtml(state.settings.apiKey)}" placeholder="sk-..." />
          </div>
          <label class="inline muted"><input type="checkbox" id="save-api-key" ${state.settings.saveApiKey ? 'checked' : ''} /> 保存 API Key 到 localStorage</label>
          <div class="footer-actions">
            <button class="btn primary" data-action="save-settings">保存模型设置</button>
            <button class="btn ghost" data-action="reset-default-files">恢复默认配置</button>
          </div>
        </div>

        <hr style="border:0;border-top:1px solid var(--line);margin:18px 0;" />
        <div class="card-title"><h2>导入/导出</h2></div>
        <div class="footer-actions">
          <button class="btn" data-action="export-config">导出配置包</button>
          <label class="btn ghost" for="import-config">导入配置包</label>
          <input class="hidden" id="import-config" type="file" accept="application/json,.json" />
        </div>
      </section>
    </div>
  `;
}

function bindEvents() {
  window.onhashchange = () => {
    state.route = slugRoute();
    render();
  };

  $('#studio-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    generate();
  });

  $$('[data-action]').forEach((el) => {
    el.addEventListener('click', async (event) => {
      const action = event.currentTarget.dataset.action;
      await handleAction(action);
    });
  });

  $$('[data-copy]').forEach((el) => {
    el.addEventListener('click', () => copyText(el.dataset.copy || ''));
  });

  $$('[data-file]').forEach((el) => {
    el.addEventListener('click', () => {
      state.selectedFile = el.dataset.file;
      render();
    });
  });

  $$('[data-history-index]').forEach((el) => {
    el.addEventListener('click', () => {
      const item = state.history[Number(el.dataset.historyIndex)];
      if (item) {
        state.result = item;
        state.form = { ...DEFAULT_FORM, ...(item.form || {}) };
        render();
      }
    });
  });

  $('#import-config')?.addEventListener('change', importConfig);
}

async function handleAction(action) {
  switch (action) {
    case 'route-admin': setRoute('admin'); break;
    case 'route-studio': setRoute('studio'); break;
    case 'reset-form':
      state.form = { ...DEFAULT_FORM };
      render();
      break;
    case 'copy-all-in-one':
      syncFormFromDom();
      await copyText(buildAllInOnePrompt(state.form));
      break;
    case 'copy-markdown':
      await copyText(resultMarkdown());
      break;
    case 'download-markdown':
      downloadFile(`daisy-xhs-${Date.now()}.md`, resultMarkdown(), 'text/markdown;charset=utf-8');
      break;
    case 'clear-history':
      state.history = [];
      persistHistory();
      render();
      break;
    case 'save-file':
      saveCurrentFile();
      break;
    case 'format-json':
      formatCurrentJson();
      break;
    case 'add-file':
      addFile();
      break;
    case 'delete-file':
      deleteFile();
      break;
    case 'save-settings':
      saveSettingsFromDom();
      break;
    case 'reset-default-files':
      if (confirm('确定恢复默认配置？这会清除浏览器里保存的 Prompt/Skill 修改。')) {
        localStorage.removeItem(STORAGE_KEYS.files);
        await loadDefaultFiles();
        render();
      }
      break;
    case 'export-config':
      exportConfig();
      break;
  }
}

function saveCurrentFile() {
  const oldPath = state.selectedFile;
  const newPath = $('#file-path').value.trim();
  const content = $('#file-content').value;
  if (!newPath) return alert('文件路径不能为空');
  if (oldPath && oldPath !== newPath) delete state.files[oldPath];
  state.files[newPath] = content;
  state.filePaths = Object.keys(state.files).sort();
  state.selectedFile = newPath;
  persistFiles();
  render();
  toast('已保存到浏览器');
}

function formatCurrentJson() {
  const textarea = $('#file-content');
  try {
    textarea.value = JSON.stringify(JSON.parse(textarea.value), null, 2);
  } catch {
    alert('当前内容不是合法 JSON，无法格式化。');
  }
}

function addFile() {
  const base = 'content/prompts/new-prompt.md';
  let path = base;
  let i = 2;
  while (state.files[path] != null) path = `content/prompts/new-prompt-${i++}.md`;
  state.files[path] = '# New Prompt\n\n在这里写提示词。';
  state.filePaths = Object.keys(state.files).sort();
  state.selectedFile = path;
  persistFiles();
  render();
}

function deleteFile() {
  if (!state.selectedFile) return;
  if (!confirm(`删除 ${state.selectedFile}？`)) return;
  delete state.files[state.selectedFile];
  state.filePaths = Object.keys(state.files).sort();
  state.selectedFile = state.filePaths[0] || '';
  persistFiles();
  render();
}

function saveSettingsFromDom() {
  state.settings = {
    provider: $('#provider').value,
    apiBaseUrl: $('#api-base-url').value.trim() || 'https://api.openai.com/v1',
    model: $('#model').value.trim() || 'gpt-4o-mini',
    apiKey: $('#api-key').value.trim(),
    saveApiKey: $('#save-api-key').checked
  };
  persistSettings();
  render();
  toast('模型设置已保存');
}

function exportConfig() {
  const payload = {
    app: 'DAISY AI Studio',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    files: state.files,
    settings: { ...state.settings, apiKey: '' }
  };
  downloadFile(`daisy-ai-config-${Date.now()}.json`, pretty(payload), 'application/json;charset=utf-8');
}

async function importConfig(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const payload = safeJsonParse(text, null);
  if (!payload?.files || typeof payload.files !== 'object') {
    alert('配置包格式不正确');
    return;
  }
  state.files = payload.files;
  state.filePaths = Object.keys(state.files).sort();
  state.selectedFile = state.filePaths[0] || '';
  if (payload.settings) state.settings = { ...state.settings, ...payload.settings, apiKey: state.settings.apiKey };
  persistFiles();
  persistSettings();
  render();
}

function resultMarkdown() {
  const r = state.result;
  if (!r || r.error) return r?.allInOnePrompt || buildAllInOnePrompt(state.form);
  return [
    `# ${r.form.topic}`,
    `生成时间：${r.createdAt}`,
    `产品：${r.form.product}`,
    '',
    '## 标题候选', r.titles,
    '',
    '## 正文', r.body,
    '',
    '## 评论', r.comments,
    '',
    '## 审核', r.review,
    '',
    '## 爆文拆解', r.analysis,
    '',
    '## 合规命中',
    (r.compliance.hits || []).length ? r.compliance.hits.map((x) => `- ${x.word} → ${x.suggestion || ''}`).join('\n') : '无'
  ].join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制');
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    toast('已复制');
  }
}

function downloadFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toast(message) {
  const node = document.createElement('div');
  node.textContent = message;
  node.style.cssText = 'position:fixed;right:20px;bottom:20px;background:#231f20;color:#fff;border-radius:999px;padding:10px 14px;z-index:1000;box-shadow:0 10px 30px rgba(0,0,0,.2);';
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 1600);
}

bootstrap();
