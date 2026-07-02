"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  AiConnectionError,
  chatCompletion,
  loadPrompt,
  renderPrompt,
  streamChatCompletion,
  testAiConnection,
} = require("../lib/ai");

test("sends a minimal OpenAI-compatible chat request", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
      text: async () => "",
    };
  };

  const result = await testAiConnection({
    baseUrl: "https://api.deepseek.com/v1/",
    model: "deepseek-chat",
    apiKey: "key-test",
  }, { fetchImpl, timeoutMs: 50 });

  assert.equal(result.ok, true);
  assert.equal(calls[0].url, "https://api.deepseek.com/v1/chat/completions");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.authorization, "Bearer key-test");
  assert.equal(JSON.parse(calls[0].options.body).max_tokens, 1);
});

test("translates invalid key responses into human-readable errors", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 401,
    text: async () => "unauthorized",
  });

  await assert.rejects(
    () => testAiConnection({
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "bad-key",
    }, { fetchImpl, timeoutMs: 50 }),
    (error) => {
      assert.ok(error instanceof AiConnectionError);
      assert.equal(error.statusCode, 401);
      assert.match(error.message, /API Key 无效/);
      return true;
    },
  );
});

test("requires an apiKey before testing the provider", async () => {
  await assert.rejects(
    () => testAiConnection({
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "",
    }),
    /请先填写 API Key/,
  );
});

test("loads user-edited prompt before repository default and renders variables", () => {
  const rootDir = path.join(__dirname, "..");
  const dataDir = path.join(rootDir, "data", `ai-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const promptDir = path.join(rootDir, "prompts");
  const dataPromptDir = path.join(dataDir, "prompts");
  fs.mkdirSync(promptDir, { recursive: true });
  fs.mkdirSync(dataPromptDir, { recursive: true });

  const defaultPrompt = path.join(promptDir, "ai-test.md");
  const userPrompt = path.join(dataPromptDir, "ai-test.md");

  try {
    fs.writeFileSync(defaultPrompt, "默认 {剧名}", "utf8");
    fs.writeFileSync(userPrompt, "用户 {剧名}", "utf8");

    const template = loadPrompt("ai-test", { rootDir, dataDir });
    assert.equal(template, "用户 {剧名}");
    assert.equal(renderPrompt(template, { "剧名": "保洁总裁" }), "用户 保洁总裁");
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(defaultPrompt, { force: true });
  }
});

test("chatCompletion sends OpenAI-compatible payload and returns message content", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "生成结果" } }] }),
      text: async () => "",
    };
  };

  const content = await chatCompletion({
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    apiKey: "key-test",
  }, {
    messages: [{ role: "user", content: "写选题" }],
    temperature: 0.9,
    maxTokens: 256,
  }, { fetchImpl, timeoutMs: 100 });

  assert.equal(content, "生成结果");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.stream, false);
  assert.equal(body.temperature, 0.9);
  assert.equal(body.max_tokens, 256);
});

test("streamChatCompletion parses SSE deltas and emits tokens", async () => {
  const encoder = new TextEncoder();
  const chunks = [
    'data: {"choices":[{"delta":{"content":"题目"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"一"}}]}\n\n',
    "data: [DONE]\n\n",
  ];
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    body: stream,
    text: async () => "",
  });
  const tokens = [];

  const content = await streamChatCompletion({
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    apiKey: "key-test",
  }, {
    messages: [{ role: "user", content: "写选题" }],
  }, {
    fetchImpl,
    idleTimeoutMs: 100,
    onToken(token) {
      tokens.push(token);
    },
  });

  assert.deepEqual(tokens, ["题目", "一"]);
  assert.equal(content, "题目一");
});
