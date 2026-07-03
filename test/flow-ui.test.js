"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const apiJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "api.js"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "css", "app.css"), "utf8");

test("hot page wires the idea pool workflow", () => {
  for (const text of [
    "getPool",
    "addToPool",
    "removeFromPool",
    "/api/pool",
  ]) {
    assert.ok(apiJs.includes(text), `missing pool API text: ${text}`);
  }

  for (const text of [
    "renderPoolPanel",
    "选题池",
    'data-action="pool-add"',
    'data-action="pool-copy"',
    'data-action="pool-remove"',
    "已收藏到选题池",
  ]) {
    assert.ok(appJs.includes(text), `missing pool UI text: ${text}`);
  }

  for (const text of [".hot-star", ".pool-chip", ".pool-panel"]) {
    assert.ok(css.includes(text), `missing pool CSS: ${text}`);
  }
});

test("copy factory can hand results to the storyboard page", () => {
  for (const text of [
    "handleSendToStoryboard",
    'data-action="send-storyboard"',
    "去分镜",
    "drama-forge:storyboard-seed",
    "hydrateStoryboardFromSeed",
  ]) {
    assert.ok(appJs.includes(text), `missing storyboard handoff text: ${text}`);
  }
});
