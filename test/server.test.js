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
            apiKey: "key-abcdef123456",
          },
        }),
      });
      const savedPublic = await saveResponse.json();

      assert.equal(saveResponse.status, 200);
      assert.equal(savedPublic.ai.apiKey, "key-••••3456");

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
      assert.equal(configStore.readConfig().ai.apiKey, "key-abcdef123456");
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
        apiKey: "key-existing-1234",
      },
    });

    const aiService = {
      async testConnection(config) {
        assert.equal(config.ai.provider, "Kimi");
        assert.equal(config.ai.baseUrl, "https://api.moonshot.cn/v1");
        assert.equal(config.ai.model, "moonshot-v1-8k");
        assert.equal(config.ai.apiKey, "key-existing-1234");
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
            apiKey: "key-••••1234",
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

test("serves a single hot source through /api/hot", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });
  const hotService = {
    async fetchHot(sourceId, options) {
      assert.equal(sourceId, "douyin");
      assert.equal(options.refreshMinutes, 30);
      assert.equal(options.force, true);
      return {
        source: { id: "douyin", name: "抖音" },
        provider: "Test",
        list: [{ rank: 1, title: "热榜", heat: "100w", cover: "", url: "" }],
        fetchedAt: "2026-07-02T12:00:00.000Z",
        stale: false,
      };
    },
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/hot?source=douyin&force=1`);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.source.id, "douyin");
      assert.equal(body.list[0].title, "热榜");
      assert.equal(body.stale, false);
    }, { configStore, hotService });
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("streams topic ideas through /api/ai/ideas", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });
  configStore.saveConfig({
    ai: {
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "key-ideas",
    },
  });

  const aiService = {
    async testConnection() {
      return { ok: true, latencyMs: 1 };
    },
    async streamIdeas(config, payload, options) {
      assert.equal(config.ai.apiKey, "key-ideas");
      assert.match(payload.prompt, /保洁阿姨竟是总裁/);
      options.onToken("题目: 反差总裁");
      options.onToken("\\n逻辑: 身份反转");
      return "题目: 反差总裁\n逻辑: 身份反转";
    },
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ai/ideas`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceName: "抖音",
          list: [
            { rank: 1, title: "保洁阿姨竟是总裁", heat: "100w" },
          ],
        }),
      });
      const text = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /text\/event-stream/);
      assert.match(text, /反差总裁/);
      assert.match(text, /"type":"done"/);
    }, { configStore, aiService });
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("rejects topic ideas when apiKey is missing and demo mode is off", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ai/ideas`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ list: [] }),
      });
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.error, "先到设置页配置 API Key");
    }, { configStore });
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("streams copy generation and writes history", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });
  configStore.saveConfig({
    ai: {
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "key-copy",
    },
  });

  const aiService = {
    async testConnection() {
      return { ok: true, latencyMs: 1 };
    },
    async streamCopy(config, payload, options) {
      assert.equal(config.ai.apiKey, "key-copy");
      assert.match(payload.prompt, /保洁阿姨竟是总裁/);
      const text = [
        "===TITLES===",
        "- 她扫地那天全公司跪了",
        "===HOOKS===",
        "- 别叫我阿姨，叫我董事长",
        "===INTROS===",
        "- 保洁阿姨被羞辱后亮出真实身份。",
        "===TAGS===",
        "- #短剧 #逆袭 #反转",
      ].join("\n");
      options.onToken(text);
      return text;
    },
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ai/copy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "保洁阿姨竟是总裁",
          genre: "女频逆袭",
          selling: "保洁身份反转",
          platform: "douyin",
        }),
      });
      const text = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /text\/event-stream/);
      assert.match(text, /"type":"final"/);
      assert.match(text, /她扫地那天全公司跪了/);

      const historyFiles = fs.readdirSync(path.join(dataDir, "history"));
      assert.equal(historyFiles.length, 1);
      const record = JSON.parse(fs.readFileSync(path.join(dataDir, "history", historyFiles[0]), "utf8"));
      assert.equal(record.type, "copy");
      assert.match(record.title, /爆款文案 · 保洁阿姨竟是总裁 · 抖音/);
    }, { configStore, aiService });
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("returns storyboard table and writes history", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });
  configStore.saveConfig({
    ai: {
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "key-storyboard",
    },
  });

  const aiService = {
    async testConnection() {
      return { ok: true, latencyMs: 1 };
    },
    async storyboard(config, payload) {
      assert.equal(config.ai.apiKey, "key-storyboard");
      assert.match(payload.prompt, /林晚/);
      return '[{"shot":1,"scale":"近景","visual":"林晚推门","audio":"林晚: 我回来了","duration":3}]';
    },
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ai/storyboard`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          script: "林晚推门: 我回来了。",
          ratio: "竖屏 9:16",
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.list[0].visual, "林晚推门");
      assert.equal(body.list[0].duration, 3);

      const historyFiles = fs.readdirSync(path.join(dataDir, "history"));
      assert.equal(historyFiles.length, 1);
      const record = JSON.parse(fs.readFileSync(path.join(dataDir, "history", historyFiles[0]), "utf8"));
      assert.equal(record.type, "storyboard");
      assert.match(record.title, /剧本转分镜/);
    }, { configStore, aiService });
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("retries storyboard once after invalid JSON", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });
  configStore.saveConfig({
    ai: {
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "key-storyboard",
    },
  });

  let attempts = 0;
  const aiService = {
    async storyboard() {
      attempts += 1;
      if (attempts === 1) {
        return "不是 JSON";
      }
      return '[{"shot":1,"scale":"特写","visual":"戒指落地","audio":"叮","duration":2}]';
    },
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ai/storyboard`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          script: "戒指落地。",
          ratio: "竖屏 9:16",
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(attempts, 2);
      assert.equal(body.list[0].scale, "特写");
    }, { configStore, aiService });
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
