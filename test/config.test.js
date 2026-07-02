"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  DEFAULT_CONFIG,
  createConfigStore,
  maskApiKey,
} = require("../lib/config");

function makeDataDir() {
  const dataDir = path.join(__dirname, "..", "data", `test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

function removeDir(dataDir) {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

test("reads default config and creates data directory when missing", () => {
  const dataDir = makeDataDir();
  removeDir(dataDir);
  const store = createConfigStore({ dataDir });

  try {
    const config = store.readConfig();

    assert.deepEqual(config, DEFAULT_CONFIG);
    assert.equal(fs.existsSync(dataDir), true);
  } finally {
    removeDir(dataDir);
  }
});

test("saves config and returns apiKey masked for public reads", () => {
  const dataDir = makeDataDir();
  const store = createConfigStore({ dataDir });

  try {
    store.saveConfig({
      ai: {
        provider: "DeepSeek",
        baseUrl: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        apiKey: "key-1234567890abcd",
      },
      demoMode: true,
      refreshMinutes: 15,
    });

    assert.equal(store.readConfig().ai.apiKey, "key-1234567890abcd");
    assert.equal(store.readPublicConfig().ai.apiKey, "key-••••abcd");
    assert.equal(store.readPublicConfig().demoMode, true);
    assert.equal(store.readPublicConfig().refreshMinutes, 15);
  } finally {
    removeDir(dataDir);
  }
});

test("keeps the existing apiKey when the public mask is posted back", () => {
  const dataDir = makeDataDir();
  const store = createConfigStore({ dataDir });

  try {
    store.saveConfig({
      ai: {
        apiKey: "live-secret-9999",
      },
    });

    store.saveConfig({
      ai: {
        provider: "Kimi",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "moonshot-v1-8k",
        apiKey: maskApiKey("live-secret-9999"),
      },
    });

    const config = store.readConfig();
    assert.equal(config.ai.provider, "Kimi");
    assert.equal(config.ai.apiKey, "live-secret-9999");
  } finally {
    removeDir(dataDir);
  }
});
