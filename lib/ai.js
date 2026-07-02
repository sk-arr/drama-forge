"use strict";

const fs = require("node:fs");
const path = require("node:path");

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

function ensureAiConfig(aiConfig) {
  const config = aiConfig || {};

  if (!config.apiKey) {
    throw new AiConnectionError("请先填写 API Key", 400);
  }

  if (!config.baseUrl) {
    throw new AiConnectionError("请先填写接口地址", 400);
  }

  if (!config.model) {
    throw new AiConnectionError("请先填写模型名", 400);
  }

  return config;
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
  const config = ensureAiConfig(aiConfig);
  const fetchImpl = options && options.fetchImpl ? options.fetchImpl : fetch;
  const timeoutMs = options && options.timeoutMs ? options.timeoutMs : 15000;

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

function buildChatBody(config, request, stream) {
  const payload = request || {};
  return {
    model: config.model,
    messages: payload.messages || [],
    temperature: payload.temperature === undefined ? 0.7 : payload.temperature,
    max_tokens: payload.maxTokens || payload.max_tokens || 1024,
    stream: Boolean(stream),
  };
}

async function chatCompletion(aiConfig, request, options) {
  const config = ensureAiConfig(aiConfig);
  const fetchImpl = options && options.fetchImpl ? options.fetchImpl : fetch;
  const timeoutMs = options && options.timeoutMs ? options.timeoutMs : 60000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(buildChatBody(config, request, false)),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = typeof response.text === "function" ? await response.text() : "";
      throw translateProviderError(response.status, detail);
    }

    const payload = await response.json();
    return String(payload && payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content || "");
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

function extractSseDataBlocks(buffer) {
  const blocks = [];
  let rest = buffer;
  let index = rest.indexOf("\n\n");

  while (index >= 0) {
    const rawBlock = rest.slice(0, index);
    rest = rest.slice(index + 2);
    const data = rawBlock
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (data) {
      blocks.push(data);
    }
    index = rest.indexOf("\n\n");
  }

  return { blocks, rest };
}

async function streamChatCompletion(aiConfig, request, options) {
  const config = ensureAiConfig(aiConfig);
  const fetchImpl = options && options.fetchImpl ? options.fetchImpl : fetch;
  const connectionTimeoutMs = options && options.connectionTimeoutMs ? options.connectionTimeoutMs : 30000;
  const idleTimeoutMs = options && options.idleTimeoutMs ? options.idleTimeoutMs : 30000;
  const onToken = options && options.onToken ? options.onToken : function noop() {};
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), connectionTimeoutMs);
  let content = "";

  function resetIdleTimer() {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), idleTimeoutMs);
  }

  try {
    const response = await fetchImpl(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(buildChatBody(config, request, true)),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const detail = typeof response.text === "function" ? await response.text() : "";
      throw translateProviderError(response.status, detail);
    }

    if (!response.body || typeof response.body.getReader !== "function") {
      throw new AiConnectionError("服务商未返回可读取的流式响应", 502);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = false;
    resetIdleTimer();

    while (!done) {
      const chunk = await reader.read();
      resetIdleTimer();
      if (chunk.done) {
        break;
      }

      buffer += decoder.decode(chunk.value, { stream: true });
      const parsed = extractSseDataBlocks(buffer);
      buffer = parsed.rest;

      for (const block of parsed.blocks) {
        if (block === "[DONE]") {
          done = true;
          break;
        }

        try {
          const payload = JSON.parse(block);
          const token = payload && payload.choices && payload.choices[0] && payload.choices[0].delta && payload.choices[0].delta.content;
          if (token) {
            content += token;
            onToken(token);
          }
        } catch (error) {
          continue;
        }
      }
    }

    return content;
  } catch (error) {
    if (error instanceof AiConnectionError) {
      throw error;
    }
    if (error && error.name === "AbortError") {
      throw new AiConnectionError("流式响应超时，请稍后重试", 504);
    }
    throw new AiConnectionError("网络不通，请检查接口地址或代理", 502);
  } finally {
    clearTimeout(timer);
  }
}

function promptFileName(name) {
  const safeName = String(name || "").replace(/\.md$/i, "");
  return `${safeName}.md`;
}

function loadPrompt(name, options) {
  const rootDir = options && options.rootDir ? options.rootDir : path.join(__dirname, "..");
  const dataDir = options && options.dataDir ? options.dataDir : path.join(rootDir, "data");
  const fileName = promptFileName(name);
  const userPath = path.join(dataDir, "prompts", fileName);
  const defaultPath = path.join(rootDir, "prompts", fileName);

  if (fs.existsSync(userPath)) {
    return fs.readFileSync(userPath, "utf8");
  }

  if (fs.existsSync(defaultPath)) {
    return fs.readFileSync(defaultPath, "utf8");
  }

  throw new AiConnectionError(`提示词模板不存在：${fileName}`, 500);
}

function renderPrompt(template, variables) {
  const data = variables || {};
  return String(template || "").replace(/\{([^{}]+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(data, key) ? String(data[key]) : match;
  });
}

module.exports = {
  AiConnectionError,
  chatCompletion,
  loadPrompt,
  renderPrompt,
  streamChatCompletion,
  testAiConnection,
};
