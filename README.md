# DAISY AI Studio · Cloudflare Pages 版

这是一个可直接部署到 Cloudflare Pages 的小红书内容生产工作台。

## 目录结构

```text
public/                 静态站点输出目录，Cloudflare Pages 发布这里
  index.html
  assets/
  content/
  _headers
  _redirects
functions/api/chat.js   Cloudflare Pages Function，用于服务端调用模型
wrangler.toml           Cloudflare Pages 配置
```

## Cloudflare Pages 设置

如果你用 GitHub 仓库部署：

```text
Framework preset: None
Build command: 留空
Build output directory: public
Root directory: /
```

`wrangler.toml` 里已经设置：

```toml
pages_build_output_dir = "./public"
```

需要真实 AI 时，在 Cloudflare Pages 的 Settings -> Environment variables 配置：

```text
OPENAI_API_KEY=你的 API Key
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

部署后进入页面后台，把 Provider 改为 `Cloudflare Function`。

## 重要说明

Cloudflare Dashboard 的 Direct Upload 不适合这个完整包，因为 Direct Upload 不支持 Pages Functions。要使用 `/api/chat`，请用 Git integration 或 Wrangler CLI。

Wrangler 部署命令：

```bash
npx wrangler pages deploy public --project-name daisy-ai-studio
npx wrangler pages secret put OPENAI_API_KEY --project-name daisy-ai-studio
```
