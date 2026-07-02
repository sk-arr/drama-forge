"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "app.js"), "utf8");
const apiJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "api.js"), "utf8");

test("settings page includes provider presets and required cards", () => {
  [
    "DeepSeek",
    "https://api.deepseek.com/v1",
    "deepseek-chat",
    "Kimi",
    "https://api.moonshot.cn/v1",
    "moonshot-v1-8k",
    "通义千问",
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "qwen-plus",
    "模型连接",
    "演示模式",
    "今日热点来源",
    "Key 仅保存在本机 data 目录",
  ].forEach((text) => {
    assert.ok(appJs.includes(text), `missing settings text: ${text}`);
  });
});

test("settings page declares all nine hot source switches", () => {
  [
    "douyin",
    "kuaishou",
    "weibo",
    "duanju",
    "xiaohongshu",
    "bilibili",
    "baidu",
    "toutiao",
    "zhihu",
  ].forEach((source) => {
    assert.ok(appJs.includes(source), `missing source ${source}`);
  });
});

test("frontend API wrapper exposes config and connection-test calls", () => {
  [
    "/api/config",
    "/api/ai/test",
    "getConfig",
    "saveConfig",
    "testConnection",
  ].forEach((text) => {
    assert.ok(apiJs.includes(text), `missing API wrapper text: ${text}`);
  });
});
