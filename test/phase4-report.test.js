"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const reportPrompt = fs.readFileSync(path.join(__dirname, "..", "prompts", "report.md"), "utf8");

test("report prompt documents method notes and fixed sections", () => {
  for (const text of [
    "用途:",
    "变量:",
    "设计思路:",
    "{记录}",
    "{类型}",
    "{日期范围}",
    "本周完成",
    "数据亮点",
    "下周计划",
    "风险与需要支持",
    "今日完成",
    "明日计划",
    "保留原文里的数字",
    "不要编造",
    "- ",
  ]) {
    assert.ok(reportPrompt.includes(text), `report.md missing ${text}`);
  }
});
