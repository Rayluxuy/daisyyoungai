# DAISY AI Studio · Cloudflare Pages 版

这是一个可直接部署到 Cloudflare Pages 的小红书内容生产工作台。

## 包含内容

- 纯静态前端：`index.html`、`assets/`、`content/`
- Cloudflare Pages Function：`functions/api/chat.js`
- Pages 配置文件：`_headers`、`_redirects`、`wrangler.toml`
- 浏览器本地后台：Prompt、Skill、品牌资料会保存到当前浏览器 `localStorage`

## Cloudflare Pages 部署

推荐用 Git integration 或 Wrangler CLI 部署。因为本包包含 `functions/api/chat.js`，Cloudflare Dashboard 的 Direct Upload 不支持 Pages Functions；如果只用 Mock 模式，才可以把静态文件当普通静态站上传。

### 方式 A：Git integration

1. 把本目录作为仓库根目录推到 GitHub/GitLab。
2. 新建 Cloudflare Pages 项目并连接该仓库。
3. Framework preset 选 `None`。
4. Build command 留空。
5. Build output directory 填 `.` 或 `/`。
6. 部署后先用默认 Mock 模式测试页面。
7. 需要真实 AI 时，在 Cloudflare Pages 的 Settings -> Environment variables 配置：

```text
OPENAI_API_KEY=你的 API Key
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

然后进入页面后台，把 Provider 改为 `Cloudflare Function`。

### 方式 B：Wrangler CLI

```bash
npx wrangler pages deploy . --project-name daisy-ai-studio
npx wrangler pages secret put OPENAI_API_KEY --project-name daisy-ai-studio
```

## 本地预览

静态页面可以直接用任意静态服务器预览，例如：

```bash
npx wrangler pages dev .
```

如果只打开 `index.html`，Mock 模式可用；`Cloudflare Function` 模式需要通过 Cloudflare Pages 或 `wrangler pages dev` 运行。
