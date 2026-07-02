"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const indexHtml = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const apiJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "api.js"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "css", "app.css"), "utf8");

test("index loads export utility before app", () => {
  assert.match(indexHtml, /js\/export\.js/);
});

test("frontend API wrapper exposes copy and storyboard calls", () => {
  for (const text of ["/api/ai/copy", "/api/ai/storyboard", "generateCopy", "generateStoryboard"]) {
    assert.ok(apiJs.includes(text), `missing ${text}`);
  }
});

test("copy factory page includes required workflow controls", () => {
  for (const text of [
    "renderCopyPage",
    "爆款文案工厂",
    "剧名",
    "剧情卖点",
    "女频逆袭",
    "微信小程序",
    "生成文案",
    "停止",
    "复制选中",
    "导出 CSV",
    "展开其余",
    "drama-forge:copy-seed",
    "data-action=\"copy-one\"",
    "data-action=\"copy-selected\"",
    "data-action=\"export-copy\"",
  ]) {
    assert.ok(appJs.includes(text), `missing copy UI text: ${text}`);
  }
});

test("storyboard page includes required controls and table columns", () => {
  for (const text of [
    "renderStoryboardPage",
    "生成分镜",
    "竖屏 9:16",
    "横屏 16:9",
    "镜号",
    "景别",
    "画面描述",
    "台词/音效",
    "时长",
    "data-action=\"generate-storyboard\"",
    "data-action=\"export-storyboard\"",
  ]) {
    assert.ok(appJs.includes(text), `missing storyboard UI text: ${text}`);
  }
});

test("phase three css contains copy and storyboard layout selectors", () => {
  for (const selector of [
    ".copy-form-card",
    ".platform-pills",
    ".copy-results-grid",
    ".copy-group-card",
    ".copy-row",
    ".copy-action-bar",
    ".storyboard-layout",
    ".storyboard-table",
    ".storyboard-empty",
  ]) {
    assert.ok(css.includes(selector), `missing selector ${selector}`);
  }
});
