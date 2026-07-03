"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../server");
const { createConfigStore } = require("../lib/config");
const { createHistoryStore } = require("../lib/history");
const { parseIdeaCards, ideasHistoryTitle } = require("../lib/generation");

function makeDataDir() {
  const dataDir = path.join(__dirname, "..", "data", `history-api-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

function removeDir(dataDir) {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

test("GET /api/history returns summaries and supports type filter", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });
  const historyStore = createHistoryStore({ dataDir });
  historyStore.save("copy", "爆款文案 · A · 抖音", {}, { titles: ["x"] });
  historyStore.save("ideas", "选题灵感 · 抖音", {}, { text: "t", cards: [] });

  const server = createServer({ configStore, historyStore });
  const port = await listen(server);

  try {
    const all = await (await fetch(`http://127.0.0.1:${port}/api/history`)).json();
    assert.equal(all.list.length, 2);

    const onlyIdeas = await (await fetch(`http://127.0.0.1:${port}/api/history?type=ideas`)).json();
    assert.equal(onlyIdeas.list.length, 1);
    assert.equal(onlyIdeas.list[0].type, "ideas");
  } finally {
    await close(server);
    removeDir(dataDir);
  }
});

test("GET /api/history/{id} returns full record and 404 for missing", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });
  const historyStore = createHistoryStore({ dataDir });
  const saved = historyStore.save("report", "周报 · 测试", { text: "raw" }, "本周完成\n- 事项");

  const server = createServer({ configStore, historyStore });
  const port = await listen(server);

  try {
    const record = await (await fetch(`http://127.0.0.1:${port}/api/history/${saved.id}`)).json();
    assert.equal(record.id, saved.id);
    assert.equal(record.input.text, "raw");
    assert.ok(record.output.includes("本周完成"));

    const missing = await fetch(`http://127.0.0.1:${port}/api/history/not-there`);
    assert.equal(missing.status, 404);
  } finally {
    await close(server);
    removeDir(dataDir);
  }
});

test("DELETE /api/history/{id} moves the record to trash and 404s for missing", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });
  const historyStore = createHistoryStore({ dataDir });
  const saved = historyStore.save("copy", "爆款文案 · 待删除 · 抖音", {}, { titles: ["x"] });

  const server = createServer({ configStore, historyStore });
  const port = await listen(server);

  try {
    const deleted = await fetch(`http://127.0.0.1:${port}/api/history/${saved.id}`, { method: "DELETE" });
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), { ok: true });
    assert.equal(historyStore.get(saved.id), null);

    const again = await fetch(`http://127.0.0.1:${port}/api/history/${saved.id}`, { method: "DELETE" });
    assert.equal(again.status, 404);

    const remaining = await (await fetch(`http://127.0.0.1:${port}/api/history`)).json();
    assert.equal(remaining.list.length, 0);

    const trash = await (await fetch(`http://127.0.0.1:${port}/api/history/trash`)).json();
    assert.equal(trash.list.length, 1);
    assert.equal(trash.list[0].id, saved.id);
    assert.ok(trash.list[0].deletedAt);
  } finally {
    await close(server);
    removeDir(dataDir);
  }
});

test("trash restore and empty endpoints work end to end", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });
  const historyStore = createHistoryStore({ dataDir });
  const first = historyStore.save("copy", "第一条", {}, { titles: ["x"] });
  const second = historyStore.save("report", "第二条", {}, "内容");
  historyStore.remove(first.id);
  historyStore.remove(second.id);

  const server = createServer({ configStore, historyStore });
  const port = await listen(server);

  try {
    const restored = await fetch(`http://127.0.0.1:${port}/api/history/trash/restore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: first.id }),
    });
    assert.equal(restored.status, 200);
    assert.equal(historyStore.get(first.id).title, "第一条");

    const missing = await fetch(`http://127.0.0.1:${port}/api/history/trash/restore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "not-there" }),
    });
    assert.equal(missing.status, 404);

    const emptied = await fetch(`http://127.0.0.1:${port}/api/history/trash`, { method: "DELETE" });
    assert.equal(emptied.status, 200);
    assert.deepEqual(await emptied.json(), { ok: true, removed: 1 });
    assert.equal(historyStore.listTrash().length, 0);
  } finally {
    await close(server);
    removeDir(dataDir);
  }
});

test("demo ideas stream writes an ideas history record", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });
  configStore.saveConfig({ demoMode: true });
  const historyStore = createHistoryStore({ dataDir });

  const server = createServer({ configStore, historyStore });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/ai/ideas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceName: "抖音", list: [{ rank: 1, title: "热词" }] }),
    });
    assert.equal(response.status, 200);
    await response.text();

    const records = historyStore.list("ideas");
    assert.equal(records.length, 1);
    assert.ok(records[0].title.includes("选题灵感"));

    const detail = historyStore.get(records[0].id);
    assert.ok(detail.output.text.includes("题目"));
    assert.equal(detail.output.cards.length, 3);
  } finally {
    await close(server);
    removeDir(dataDir);
  }
});

test("parseIdeaCards extracts three cards from numbered text", () => {
  const text = [
    "1. 题目: A",
    "   一句话逻辑: 逻辑A",
    "   适配题材: 女频逆袭",
    "2. 题目: B",
    "   一句话逻辑: 逻辑B",
    "   适配题材: 都市打脸",
  ].join("\n");

  const cards = parseIdeaCards(text);
  assert.equal(cards.length, 2);
  assert.deepEqual(cards[0], { title: "A", logic: "逻辑A", genre: "女频逆袭" });
  assert.equal(ideasHistoryTitle("抖音"), "选题灵感 · 抖音");
});
