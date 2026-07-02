"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createHotCache } = require("../lib/cache");

function makeDataDir() {
  const dataDir = path.join(__dirname, "..", "data", `cache-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

function removeDir(dataDir) {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

test("writes hot source results to data/cache and reuses fresh cache", async () => {
  const dataDir = makeDataDir();
  const cache = createHotCache({ dataDir });
  let calls = 0;

  try {
    const fetcher = async () => {
      calls += 1;
      return {
        source: { id: "douyin", name: "抖音" },
        provider: "Test",
        providerUrl: "https://example.com",
        fetchedAt: new Date().toISOString(),
        list: [{ rank: 1, title: "热榜", heat: "100w", cover: "", url: "" }],
      };
    };

    const first = await cache.fetchHot("douyin", { refreshMinutes: 30, fetcher });
    const second = await cache.fetchHot("douyin", { refreshMinutes: 30, fetcher });

    assert.equal(calls, 1);
    assert.equal(first.stale, false);
    assert.equal(second.fromCache, true);
    assert.equal(second.list[0].title, "热榜");
    assert.equal(fs.existsSync(path.join(dataDir, "cache", "douyin.json")), true);
  } finally {
    removeDir(dataDir);
  }
});

test("bypasses cache when force refresh is requested", async () => {
  const dataDir = makeDataDir();
  const cache = createHotCache({ dataDir });
  let calls = 0;

  try {
    const fetcher = async () => ({
      source: { id: "douyin", name: "抖音" },
      provider: "Test",
      providerUrl: "https://example.com",
      fetchedAt: new Date().toISOString(),
      list: [{ rank: 1, title: `热榜 ${++calls}`, heat: "100w", cover: "", url: "" }],
    });

    await cache.fetchHot("douyin", { refreshMinutes: 30, fetcher });
    const refreshed = await cache.fetchHot("douyin", { refreshMinutes: 30, force: true, fetcher });

    assert.equal(calls, 2);
    assert.equal(refreshed.list[0].title, "热榜 2");
  } finally {
    removeDir(dataDir);
  }
});

test("falls back to stale cache when source request fails", async () => {
  const dataDir = makeDataDir();
  const cache = createHotCache({ dataDir });

  try {
    await cache.fetchHot("weibo", {
      refreshMinutes: 30,
      fetcher: async () => ({
        source: { id: "weibo", name: "微博" },
        provider: "Test",
        providerUrl: "https://example.com",
        fetchedAt: new Date().toISOString(),
        list: [{ rank: 1, title: "旧缓存", heat: "90w", cover: "", url: "" }],
      }),
    });

    const stale = await cache.fetchHot("weibo", {
      refreshMinutes: 30,
      force: true,
      fetcher: async () => {
        throw new Error("网络不通");
      },
    });

    assert.equal(stale.stale, true);
    assert.equal(stale.error, "网络不通");
    assert.equal(stale.list[0].title, "旧缓存");
  } finally {
    removeDir(dataDir);
  }
});

test("returns an error structure when source fails with no cache", async () => {
  const dataDir = makeDataDir();
  const cache = createHotCache({ dataDir });

  try {
    const result = await cache.fetchHot("zhihu", {
      refreshMinutes: 30,
      fetcher: async () => {
        throw new Error("接口暂不可用");
      },
    });

    assert.deepEqual(result.list, []);
    assert.equal(result.stale, false);
    assert.equal(result.error, "接口暂不可用");
  } finally {
    removeDir(dataDir);
  }
});
