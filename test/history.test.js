"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createHistoryStore } = require("../lib/history");

function makeDataDir() {
  const dataDir = path.join(__dirname, "..", "data", `history-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

function removeDir(dataDir) {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

test("saves generation history as JSON under data/history", () => {
  const dataDir = makeDataDir();
  const store = createHistoryStore({ dataDir });

  try {
    const saved = store.save("copy", "爆款文案 · 保洁阿姨竟是总裁 · 抖音", { title: "保洁阿姨竟是总裁" }, { titles: ["反差总裁"] });
    const filePath = path.join(dataDir, "history", `${saved.id}.json`);
    const record = JSON.parse(fs.readFileSync(filePath, "utf8"));

    assert.equal(record.type, "copy");
    assert.equal(record.title, "爆款文案 · 保洁阿姨竟是总裁 · 抖音");
    assert.deepEqual(record.input, { title: "保洁阿姨竟是总裁" });
    assert.deepEqual(record.output, { titles: ["反差总裁"] });
  } finally {
    removeDir(dataDir);
  }
});

test("lists history summaries in reverse chronological order with optional type filter", async () => {
  const dataDir = makeDataDir();
  const store = createHistoryStore({ dataDir });

  try {
    store.save("copy", "第一条", {}, { items: [1, 2] });
    await new Promise((resolve) => setTimeout(resolve, 2));
    store.save("storyboard", "第二条", {}, [{ shot: 1 }]);
    await new Promise((resolve) => setTimeout(resolve, 2));
    store.save("copy", "第三条", {}, { items: [1] });

    const all = store.list();
    const copyOnly = store.list("copy");

    assert.equal(all[0].title, "第三条");
    assert.equal(all[1].title, "第二条");
    assert.deepEqual(copyOnly.map((item) => item.title), ["第三条", "第一条"]);
    assert.equal(copyOnly[0].count, 1);
  } finally {
    removeDir(dataDir);
  }
});

test("remove moves a record into the trash and rejects unsafe ids", () => {
  const dataDir = makeDataDir();
  const store = createHistoryStore({ dataDir });

  try {
    const saved = store.save("copy", "待删除", {}, { titles: ["x"] });
    const kept = store.save("report", "保留", {}, "内容");

    assert.equal(store.remove(saved.id), true);
    assert.equal(store.get(saved.id), null);
    assert.equal(fs.existsSync(path.join(dataDir, "history", `${saved.id}.json`)), false);
    assert.deepEqual(store.list().map((item) => item.id), [kept.id]);

    const trashed = store.listTrash();
    assert.equal(trashed.length, 1);
    assert.equal(trashed[0].id, saved.id);
    assert.ok(trashed[0].deletedAt);

    assert.equal(store.remove(saved.id), false);
    assert.equal(store.remove(""), false);
    assert.equal(store.remove("../config"), false);
  } finally {
    removeDir(dataDir);
  }
});

test("restore moves a trashed record back and drops deletedAt", () => {
  const dataDir = makeDataDir();
  const store = createHistoryStore({ dataDir });

  try {
    const saved = store.save("copy", "先删后恢复", {}, { titles: ["x"] });
    store.remove(saved.id);

    assert.equal(store.restore(saved.id), true);
    const record = store.get(saved.id);
    assert.equal(record.title, "先删后恢复");
    assert.equal(record.deletedAt, undefined);
    assert.equal(store.listTrash().length, 0);

    assert.equal(store.restore(saved.id), false);
    assert.equal(store.restore("../config"), false);
  } finally {
    removeDir(dataDir);
  }
});

test("emptyTrash deletes everything in the trash permanently", () => {
  const dataDir = makeDataDir();
  const store = createHistoryStore({ dataDir });

  try {
    const first = store.save("copy", "一", {}, { titles: ["x"] });
    const second = store.save("report", "二", {}, "内容");
    store.remove(first.id);
    store.remove(second.id);

    assert.equal(store.emptyTrash(), 2);
    assert.equal(store.listTrash().length, 0);
    assert.equal(store.restore(first.id), false);
  } finally {
    removeDir(dataDir);
  }
});

test("trash entries older than 30 days are purged automatically", () => {
  const dataDir = makeDataDir();
  const store = createHistoryStore({ dataDir });

  try {
    const fresh = store.save("copy", "新删除", {}, { titles: ["x"] });
    store.remove(fresh.id);

    const staleId = "20250101000000000-stale";
    const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(
      path.join(store.trashDir, `${staleId}.json`),
      JSON.stringify({ id: staleId, type: "copy", title: "过期", createdAt: staleDate, deletedAt: staleDate, input: {}, output: null }),
      "utf8"
    );

    const trashed = store.listTrash();
    assert.deepEqual(trashed.map((item) => item.id), [fresh.id]);
    assert.equal(fs.existsSync(path.join(store.trashDir, `${staleId}.json`)), false);
  } finally {
    removeDir(dataDir);
  }
});

test("keeps at most 200 history records by deleting the oldest files", () => {
  const dataDir = makeDataDir();
  const store = createHistoryStore({ dataDir });

  try {
    for (let index = 0; index < 205; index += 1) {
      store.save("copy", `记录 ${index}`, {}, { items: [index] });
    }

    const files = fs.readdirSync(path.join(dataDir, "history")).filter((name) => name.endsWith(".json"));
    const list = store.list();

    assert.equal(files.length, 200);
    assert.equal(list.length, 200);
    assert.equal(list.some((item) => item.title === "记录 0"), false);
  } finally {
    removeDir(dataDir);
  }
});
