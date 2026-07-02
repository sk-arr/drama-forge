"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const promptDir = path.join(__dirname, "..", "prompts");

function readPrompt(name) {
  return fs.readFileSync(path.join(promptDir, name), "utf8");
}

test("copy prompts include method notes, variables, markers, and platform style", () => {
  const prompts = [
    { file: "copy-douyin.md", style: "悬念前置" },
    { file: "copy-kuaishou.md", style: "老铁感" },
    { file: "copy-weixin.md", style: "付费钩子" },
  ];

  for (const prompt of prompts) {
    const text = readPrompt(prompt.file);
    for (const required of [
      "用途",
      "变量",
      "设计思路",
      "{剧名}",
      "{题材}",
      "{卖点}",
      "===TITLES===",
      "===HOOKS===",
      "===INTROS===",
      "===TAGS===",
      "10 条标题",
      "10 条前 3 秒钩子",
      "3 条简介",
      "8~12 个",
      "- ",
      "不许输出任何多余说明文字",
      prompt.style,
    ]) {
      assert.ok(text.includes(required), `${prompt.file} missing ${required}`);
    }
  }
});

test("storyboard prompt enforces strict JSON output and required fields", () => {
  const text = readPrompt("storyboard.md");

  for (const required of [
    "用途",
    "变量",
    "设计思路",
    "{剧本}",
    "{画幅}",
    "只输出 JSON",
    "不要围栏",
    "shot",
    "scale",
    "visual",
    "audio",
    "duration",
    "全景|中景|近景|特写",
    "2~5s",
    "台词保留原文",
  ]) {
    assert.ok(text.includes(required), `storyboard.md missing ${required}`);
  }
});
