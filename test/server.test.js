"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { once } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");

const { createServer } = require("../server");
const { createConfigStore } = require("../lib/config");

async function withServer(fn, options) {
  const server = createServer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await fn(baseUrl);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function makeDataDir() {
  const dataDir = path.join(__dirname, "..", "data", `server-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

test("serves the static homepage from public/index.html", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(body, /短剧工坊 drama-forge/);
  });
});

test("returns JSON 404 for unknown API routes", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/missing`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.equal(body.error, "接口不存在");
  });
});

test("rejects malformed JSON bodies with a human-readable error", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/config`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{broken",
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "请求体不是合法 JSON");
  });
});

test("keeps stage-one API routes reserved", async () => {
  await withServer(async (baseUrl) => {
    const configResponse = await fetch(`${baseUrl}/api/config`);
    const testResponse = await fetch(`${baseUrl}/api/ai/test`, { method: "POST" });

    assert.notEqual(configResponse.status, 404);
    assert.notEqual(testResponse.status, 404);
  });
});

test("reads and saves config through API while preserving masked apiKey", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });

  try {
    await withServer(async (baseUrl) => {
      const saveResponse = await fetch(`${baseUrl}/api/config`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ai: {
            provider: "DeepSeek",
            baseUrl: "https://api.deepseek.com/v1",
            model: "deepseek-chat",
            apiKey: "sk-abcdef123456",
          },
        }),
      });
      const savedPublic = await saveResponse.json();

      assert.equal(saveResponse.status, 200);
      assert.equal(savedPublic.ai.apiKey, "sk-a••••3456");

      const mask = savedPublic.ai.apiKey;
      const updateResponse = await fetch(`${baseUrl}/api/config`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ai: {
            provider: "Kimi",
            baseUrl: "https://api.moonshot.cn/v1",
            model: "moonshot-v1-8k",
            apiKey: mask,
          },
        }),
      });
      const updatedPublic = await updateResponse.json();

      assert.equal(updateResponse.status, 200);
      assert.equal(updatedPublic.ai.provider, "Kimi");
      assert.equal(configStore.readConfig().ai.apiKey, "sk-abcdef123456");
    }, { configStore });
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("tests AI connection through injected service using posted settings", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });

  try {
    configStore.saveConfig({
      ai: {
        provider: "DeepSeek",
        baseUrl: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        apiKey: "sk-existing-1234",
      },
    });

    const aiService = {
      async testConnection(config) {
        assert.equal(config.ai.provider, "Kimi");
        assert.equal(config.ai.baseUrl, "https://api.moonshot.cn/v1");
        assert.equal(config.ai.model, "moonshot-v1-8k");
        assert.equal(config.ai.apiKey, "sk-existing-1234");
        return { ok: true, latencyMs: 18 };
      },
    };

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ai/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ai: {
            provider: "Kimi",
            baseUrl: "https://api.moonshot.cn/v1",
            model: "moonshot-v1-8k",
            apiKey: "sk-e••••1234",
          },
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.latencyMs, 18);
    }, { configStore, aiService });
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
