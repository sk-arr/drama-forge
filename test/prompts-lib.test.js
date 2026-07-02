"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { TEMPLATES, createPromptLibrary, parsePromptMeta } = require("../lib/prompts");

function makeDataDir() {
  const dataDir = path.join(__dirname, "..", "data", `prompts-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

function removeDir(dataDir) {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

test("registers exactly the six shipped templates", () => {
  assert.deepEqual(TEMPLATES.map((item) => item.name), [
    "topic-ideas",
    "copy-douyin",
    "copy-kuaishou",
    "copy-weixin",
    "storyboard",
    "report",
  ]);
});

test("parses usage, variables and design notes from header comment", () => {
  const meta = parsePromptMeta([
    "<!--",
    "用途: 测试用途。",
    "变量:",
    "- {剧名}: 短剧名字。",
    "- {卖点}: 剧情卖点。",
    "设计思路:",
    "- 第一条思路。",
    "-->",
    "正文",
  ].join("\n"));

  assert.equal(meta.usage, "测试用途。");
  assert.deepEqual(meta.variables.map((item) => item.name), ["{剧名}", "{卖点}"]);
  assert.equal(meta.variables[0].desc, "短剧名字。");
  assert.deepEqual(meta.design, ["第一条思路。"]);
});

test("lists all templates with metadata and default content", () => {
  const dataDir = makeDataDir();
  const library = createPromptLibrary({ dataDir });

  try {
    const list = library.list();
    assert.equal(list.length, 6);
    list.forEach((item) => {
      assert.ok(item.label);
      assert.ok(item.usage, `${item.name} 缺少用途说明`);
      assert.ok(item.variables.length > 0, `${item.name} 缺少变量说明`);
      assert.ok(item.design.length > 0, `${item.name} 缺少设计思路`);
      assert.ok(item.content.includes("<!--"));
      assert.equal(item.isModified, false);
    });
  } finally {
    removeDir(dataDir);
  }
});

test("save writes user override and reset restores default", () => {
  const dataDir = makeDataDir();
  const library = createPromptLibrary({ dataDir });

  try {
    const custom = "<!--\n用途: 自定义版本。\n变量:\n- {剧名}: x\n设计思路:\n- y\n-->\n自定义正文 {剧名}";
    const saved = library.save("copy-douyin", custom);
    assert.equal(saved.isModified, true);
    assert.ok(saved.content.includes("自定义正文"));
    assert.ok(fs.existsSync(path.join(dataDir, "prompts", "copy-douyin.md")));

    const fromList = library.list().find((item) => item.name === "copy-douyin");
    assert.equal(fromList.isModified, true);

    const restored = library.reset("copy-douyin");
    assert.equal(restored.isModified, false);
    assert.ok(!fs.existsSync(path.join(dataDir, "prompts", "copy-douyin.md")));
    assert.ok(!restored.content.includes("自定义正文"));
  } finally {
    removeDir(dataDir);
  }
});

test("rejects unknown template names and empty content", () => {
  const dataDir = makeDataDir();
  const library = createPromptLibrary({ dataDir });

  try {
    assert.throws(() => library.save("not-a-template", "x"), /提示词模板不存在/);
    assert.throws(() => library.reset("../etc/passwd"), /提示词模板不存在/);
    assert.throws(() => library.save("report", "   "), /不能为空/);
  } finally {
    removeDir(dataDir);
  }
});
