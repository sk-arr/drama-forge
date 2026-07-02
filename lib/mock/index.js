"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SOURCE_NAMES = {
  douyin: "抖音热榜",
  kuaishou: "快手热榜",
  weibo: "微博热搜",
  duanju: "红果短剧",
  xiaohongshu: "小红书热点",
  bilibili: "B站热门",
  baidu: "百度热搜",
  toutiao: "头条热榜",
  zhihu: "知乎热榜",
};

const HOT_FILES = new Set(["douyin", "kuaishou", "weibo", "duanju", "xiaohongshu", "bilibili"]);

const cache = new Map();

function readJson(name) {
  if (!cache.has(name)) {
    cache.set(name, JSON.parse(fs.readFileSync(path.join(__dirname, `${name}.json`), "utf8")));
  }
  return cache.get(name);
}

function hotMock(sourceId) {
  const id = SOURCE_NAMES[sourceId] ? sourceId : "douyin";
  const file = HOT_FILES.has(id) ? `hot-${id}` : "hot-generic";
  return {
    source: { id, name: SOURCE_NAMES[id] },
    provider: "演示模式",
    providerUrl: "",
    list: readJson(file),
    fetchedAt: new Date().toISOString(),
    stale: false,
    fromCache: false,
    example: true,
    note: "演示模式示例数据",
  };
}

function ideasText() {
  return readJson("ideas").lines.join("\n");
}

function copyPlatformKey(platform) {
  if (platform === "kuaishou") {
    return "kuaishou";
  }
  if (platform === "weixin" || platform === "微信小程序") {
    return "weixin";
  }
  return "douyin";
}

function copyText(platform) {
  const data = readJson("copy")[copyPlatformKey(platform)];
  return [
    "===TITLES===",
    ...data.titles.map((line) => `- ${line}`),
    "===HOOKS===",
    ...data.hooks.map((line) => `- ${line}`),
    "===INTROS===",
    ...data.intros.map((line) => `- ${line}`),
    "===TAGS===",
    `- ${data.tags.join(" ")}`,
  ].join("\n");
}

function storyboardList() {
  return readJson("storyboard").map((row) => Object.assign({}, row));
}

function reportText(type) {
  return readJson("report")[type === "day" ? "day" : "week"].join("\n");
}

module.exports = {
  copyText,
  hotMock,
  ideasText,
  reportText,
  storyboardList,
};
