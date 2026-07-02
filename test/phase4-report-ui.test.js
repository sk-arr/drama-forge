"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const apiJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "api.js"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "css", "app.css"), "utf8");

test("frontend API wrapper exposes report streaming call", () => {
  for (const text of ["/api/ai/report", "generateReport", "onDone(event.content || \"\", event)"]) {
    assert.ok(apiJs.includes(text), `missing ${text}`);
  }
});

test("report page includes required workflow controls", () => {
  for (const text of [
    "renderReportPage",
    "这周干了啥,随便记",
    "周报",
    "日报",
    "生成",
    "复制",
    "导出 .md",
    "本周完成",
    "数据亮点",
    "下周计划",
    "风险与需要支持",
    "周报_YYYYMMDD.md",
    "data-action=\"generate-report\"",
    "data-action=\"copy-report\"",
    "data-action=\"export-report\"",
  ]) {
    assert.ok(appJs.includes(text), `missing report UI text: ${text}`);
  }
});

test("report page css contains layout selectors", () => {
  for (const selector of [
    ".report-layout",
    ".report-input-card",
    ".report-preview-card",
    ".report-toolbar",
    ".report-body",
    ".report-section-title",
    ".report-bullet",
    ".report-empty",
  ]) {
    assert.ok(css.includes(selector), `missing selector ${selector}`);
  }
});
