"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const promptPath = path.join(__dirname, "..", "prompts", "topic-ideas.md");

test("topic ideas prompt exists with method notes and required variables", () => {
  const prompt = fs.readFileSync(promptPath, "utf8");

  assert.match(prompt, /用途/);
  assert.match(prompt, /变量/);
  assert.match(prompt, /设计思路/);
  assert.match(prompt, /\{榜单\}/);
  assert.match(prompt, /3 个选题/);
});
