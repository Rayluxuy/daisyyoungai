const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders
  });
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: jsonHeaders
  });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "请求体不是合法 JSON" }, 400);
  }

  const prompt = String(body?.prompt || "").trim();
  if (!prompt) {
    return json({ ok: false, error: "缺少 prompt" }, 400);
  }

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ ok: false, error: "Cloudflare Pages 环境变量 OPENAI_API_KEY 未配置" }, 500);
  }

  const baseUrl = String(env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = String(env.OPENAI_MODEL || body?.model || "gpt-4o-mini");
  const temperature = Number.isFinite(Number(body?.temperature)) ? Number(body.temperature) : 0.85;

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: "你是 DAISY AI Studio 的小红书内容工作流助手，输出中文。" },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return json({
      ok: false,
      error: `AI 接口失败：${upstream.status} ${text.slice(0, 500)}`
    }, 502);
  }

  const data = await upstream.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    return json({ ok: false, error: "AI 接口没有返回 content" }, 502);
  }

  return json({ ok: true, content });
}

export function onRequestGet() {
  return json({ ok: false, error: "Method Not Allowed" }, 405);
}

export function onRequestPut() {
  return json({ ok: false, error: "Method Not Allowed" }, 405);
}

export function onRequestDelete() {
  return json({ ok: false, error: "Method Not Allowed" }, 405);
}
