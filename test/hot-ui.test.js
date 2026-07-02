"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "app.js"), "utf8");
const apiJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "api.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "css", "app.css"), "utf8");

test("frontend API wrapper exposes hot and ideas endpoints", () => {
  [
    "/api/hot",
    "/api/ai/ideas",
    "getHot",
    "generateIdeas",
  ].forEach((text) => {
    assert.ok(apiJs.includes(text), `missing API wrapper text: ${text}`);
  });
});

test("hot page renders required sections and states", () => {
  [
    "renderHotPage",
    "TOP 1",
    "红果短剧",
    "AI 选题灵感",
    "生成 3 个选题",
    "该来源暂不可用",
    "使用",
    "小时前缓存",
    "data-action=\"select-hot-source\"",
    "data-action=\"refresh-hot\"",
    "data-action=\"generate-ideas\"",
    "data-action=\"go-copy\"",
  ].forEach((text) => {
    assert.ok(appJs.includes(text), `missing hot UI text: ${text}`);
  });
});

test("hot page css includes top cards, rows, and ideas styles", () => {
  [
    ".hot-toolbar",
    ".hot-top-grid",
    ".hot-card",
    ".hot-card-title",
    ".hot-card-head",
    ".rank-badge",
    ".hot-list-card",
    ".hot-list-row",
    ".row-title-link",
    ".ai-card",
    ".idea-grid",
  ].forEach((selector) => {
    assert.ok(css.includes(selector), `missing css selector: ${selector}`);
  });
});

test("hot page uses text links instead of remote image covers", () => {
  assert.ok(appJs.includes("hot-card-title"), "missing top-card title link markup");
  assert.ok(appJs.includes("row-title-link"), "missing list title link markup");
  assert.doesNotMatch(appJs, /hot-cover/);
  assert.doesNotMatch(appJs, /background-image:url/);
  assert.doesNotMatch(appJs, /height:110px/);
  assert.doesNotMatch(css, /\.hot-cover\b/);
  assert.doesNotMatch(css, /\.play\b/);
});
