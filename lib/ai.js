"use strict";

class AiConnectionError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "AiConnectionError";
    this.statusCode = statusCode || 502;
  }
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function translateProviderError(status, detail) {
  const normalized = String(detail || "").toLowerCase();

  if (status === 401 || status === 403) {
    return new AiConnectionError("API Key 无效，请检查后重试", 401);
  }

  if (status === 402 || normalized.includes("insufficient") || normalized.includes("quota") || normalized.includes("余额")) {
    return new AiConnectionError("余额不足或账户受限，请检查服务商后台", 402);
  }

  return new AiConnectionError(`连接失败（HTTP ${status}）`, 502);
}

async function testAiConnection(aiConfig, options) {
  const config = aiConfig || {};
  const fetchImpl = options && options.fetchImpl ? options.fetchImpl : fetch;
  const timeoutMs = options && options.timeoutMs ? options.timeoutMs : 15000;

  if (!config.apiKey) {
    throw new AiConnectionError("请先填写 API Key", 400);
  }

  if (!config.baseUrl) {
    throw new AiConnectionError("请先填写接口地址", 400);
  }

  if (!config.model) {
    throw new AiConnectionError("请先填写模型名", 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "user", content: "ping" },
        ],
        max_tokens: 1,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const detail = typeof response.text === "function" ? await response.text() : "";
      throw translateProviderError(response.status, detail);
    }

    return {
      ok: true,
      latencyMs: Math.max(1, latencyMs),
    };
  } catch (error) {
    if (error instanceof AiConnectionError) {
      throw error;
    }

    if (error && error.name === "AbortError") {
      throw new AiConnectionError("连接超时，请检查网络或接口地址", 504);
    }

    throw new AiConnectionError("网络不通，请检查接口地址或代理", 502);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  AiConnectionError,
  testAiConnection,
};
