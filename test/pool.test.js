"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../server");
const { createConfigStore } = require("../lib/config");
const { createIdeaPool, MAX_ITEMS } = require("../lib/pool");

function makeDataDir() {
  const dataDir = path.join(__dirname, "..", "data", `pool-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
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

test("idea pool adds, dedupes by title, and removes entries", () => {
  const dataDir = makeDataDir();
  const pool = createIdeaPool({ dataDir });

  try {
    const first = pool.add({ title: "重生之短剧之王", source: "抖音", heat: "1200w" });
    assert.equal(first.duplicated, false);
    assert.equal(first.item.source, "抖音");
    assert.ok(first.item.id);

    const dupe = pool.add({ title: "重生之短剧之王", source: "微博" });
    assert.equal(dupe.duplicated, true);
    assert.equal(dupe.item.id, first.item.id);
    assert.equal(pool.list().length, 1);

    assert.throws(() => pool.add({ title: "   " }), /选题标题不能为空/);

    assert.equal(pool.remove(first.item.id), true);
    assert.equal(pool.remove(first.item.id), false);
    assert.equal(pool.list().length, 0);
  } finally {
    removeDir(dataDir);
  }
});

test("idea pool keeps newest entries first and caps the size", () => {
  const dataDir = makeDataDir();
  const pool = createIdeaPool({ dataDir });

  try {
    for (let index = 0; index < MAX_ITEMS + 5; index += 1) {
      pool.add({ title: `选题 ${index}` });
    }

    const items = pool.list();
    assert.equal(items.length, MAX_ITEMS);
    assert.equal(items[0].title, `选题 ${MAX_ITEMS + 4}`);
  } finally {
    removeDir(dataDir);
  }
});

test("pool API supports list, add, and delete", async () => {
  const dataDir = makeDataDir();
  const configStore = createConfigStore({ dataDir });
  const ideaPool = createIdeaPool({ dataDir });

  const server = createServer({ configStore, ideaPool });
  const port = await listen(server);

  try {
    const added = await fetch(`http://127.0.0.1:${port}/api/pool`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "热词A", source: "抖音", heat: "800w" }),
    });
    assert.equal(added.status, 200);
    const addedBody = await added.json();
    assert.equal(addedBody.duplicated, false);
    assert.equal(addedBody.item.title, "热词A");

    const rejected = await fetch(`http://127.0.0.1:${port}/api/pool`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    assert.equal(rejected.status, 400);

    const listed = await (await fetch(`http://127.0.0.1:${port}/api/pool`)).json();
    assert.equal(listed.list.length, 1);

    const removed = await fetch(`http://127.0.0.1:${port}/api/pool/${addedBody.item.id}`, { method: "DELETE" });
    assert.equal(removed.status, 200);

    const missing = await fetch(`http://127.0.0.1:${port}/api/pool/${addedBody.item.id}`, { method: "DELETE" });
    assert.equal(missing.status, 404);
  } finally {
    await close(server);
    removeDir(dataDir);
  }
});
