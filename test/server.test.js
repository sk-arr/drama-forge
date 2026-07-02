"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { once } = require("node:events");

const { createServer } = require("../server");

async function withServer(fn) {
  const server = createServer();
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
