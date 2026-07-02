"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const apiJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "api.js"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "css", "app.css"), "utf8");

test("frontend API wrapper exposes local file operations", () => {
  for (const text of [
    "/api/files/browse",
    "/api/files/scan",
    "/api/files/execute",
    "/api/files/undo",
    "browseFiles",
    "scanFiles",
    "executeFiles",
    "undoFiles",
  ]) {
    assert.ok(apiJs.includes(text), `missing ${text}`);
  }
});

test("files page includes required safe workflow controls", () => {
  for (const text of [
    "renderFilesPage",
    "素材批量整理",
    "纯本地运行",
    "选择…",
    "按拍摄日期",
    "按类型",
    "重命名模板",
    "预览",
    "执行整理",
    "撤销本次",
    "扫描到",
    "预览成功前不可执行",
    "只扫描所选目录第一层文件",
    "data-action=\"open-folder-picker\"",
    "data-action=\"preview-files\"",
    "data-action=\"execute-files\"",
    "data-action=\"undo-files\"",
  ]) {
    assert.ok(appJs.includes(text), `missing files UI text: ${text}`);
  }
});

test("files page css contains layout selectors", () => {
  for (const selector of [
    ".files-layout",
    ".files-local-badge",
    ".folder-picker",
    ".files-rule-card",
    ".file-preview-card",
    ".file-preview-row",
    ".file-result-card",
    ".file-failure-list",
  ]) {
    assert.ok(css.includes(selector), `missing selector ${selector}`);
  }
});
