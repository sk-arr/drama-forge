"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseCopyOutput,
  parseStoryboardJson,
  platformPromptName,
} = require("../lib/generation");

test("maps copy platforms to prompt template names", () => {
  assert.equal(platformPromptName("douyin"), "copy-douyin");
  assert.equal(platformPromptName("kuaishou"), "copy-kuaishou");
  assert.equal(platformPromptName("weixin"), "copy-weixin");
  assert.equal(platformPromptName("微信小程序"), "copy-weixin");
});

test("parses marked copy output into structured groups", () => {
  const parsed = parseCopyOutput([
    "===TITLES===",
    "- 标题一",
    "- 标题二",
    "===HOOKS===",
    "- 钩子一",
    "===INTROS===",
    "- 简介一",
    "===TAGS===",
    "- #短剧 #逆袭 #反转",
  ].join("\n"));

  assert.deepEqual(parsed.titles, ["标题一", "标题二"]);
  assert.deepEqual(parsed.hooks, ["钩子一"]);
  assert.deepEqual(parsed.intros, ["简介一"]);
  assert.deepEqual(parsed.tags, ["#短剧", "#逆袭", "#反转"]);
});

test("parses storyboard JSON even when wrapped in markdown prose", () => {
  const parsed = parseStoryboardJson([
    "```json",
    '[{"shot":1,"scale":"近景","visual":"林晚推门","audio":"林晚: 我回来了","duration":"3"}]',
    "```",
  ].join("\n"));

  assert.deepEqual(parsed, [
    {
      shot: 1,
      scale: "近景",
      visual: "林晚推门",
      audio: "林晚: 我回来了",
      duration: 3,
    },
  ]);
});

test("rejects storyboard rows with missing required fields", () => {
  assert.throws(
    () => parseStoryboardJson('[{"shot":1,"visual":"缺字段"}]'),
    /分镜字段不完整/,
  );
});
