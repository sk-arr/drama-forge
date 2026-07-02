"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { AiConnectionError, testAiConnection } = require("../lib/ai");

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
