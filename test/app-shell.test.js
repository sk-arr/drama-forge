"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "app.js"), "utf8");

test("declares the eight stage-one hash routes", () => {
  [
    "#/hot",
    "#/storyboard",
    "#/copy",
    "#/files",
    "#/report",
    "#/prompts",
    "#/history",
    "#/settings",
  ].forEach((hash) => {
    assert.ok(appJs.includes(hash), `missing route ${hash}`);
  });
});

test("declares sidebar groups and labels from the design document", () => {
  [
    "今日热点",
    "内容生产",
    "剧本转分镜",
    "投放增长",
    "爆款文案工厂",
    "团队效率",
    "素材批量整理",
    "AI 周报",
    "沉淀",
    "提示词库",
    "历史记录",
    "API 设置",
  ].forEach((label) => {
    assert.ok(appJs.includes(label), `missing label ${label}`);
  });
});

test("renders placeholders for pages delivered in later phases", () => {
  assert.ok(appJs.includes("阶段 2 交付"));
  assert.ok(appJs.includes("阶段 3 交付"));
  assert.ok(appJs.includes("阶段 4 交付"));
  assert.ok(appJs.includes("阶段 5 交付"));
});

test("updates active navigation state on hash changes", () => {
  assert.match(appJs, /hashchange/);
  assert.match(appJs, /active/);
});
