"use strict";

const { normalizeHotList } = require("./common");

const SOURCE_IDS = [
  "douyin",
  "kuaishou",
  "weibo",
  "duanju",
  "xiaohongshu",
  "bilibili",
  "baidu",
  "toutiao",
  "zhihu",
];

const sources = SOURCE_IDS.map((id) => require(`./${id}`));
const sourceMap = new Map(sources.map((source) => [source.id, source]));

const SEARCH_TEMPLATES = {
  douyin: (keyword) => `https://www.douyin.com/search/${keyword}`,
  kuaishou: (keyword) => `https://www.kuaishou.com/search/video?searchKey=${keyword}`,
  weibo: (keyword) => `https://s.weibo.com/weibo?q=${keyword}`,
  bilibili: (keyword) => `https://search.bilibili.com/all?keyword=${keyword}`,
  xiaohongshu: (keyword) => `https://www.xiaohongshu.com/search_result?keyword=${keyword}`,
  baidu: (keyword) => `https://www.baidu.com/s?wd=${keyword}`,
  toutiao: (keyword) => `https://so.toutiao.com/search?keyword=${keyword}`,
  zhihu: (keyword) => `https://www.zhihu.com/search?type=content&q=${keyword}`,
  duanju: (keyword) => `https://www.douyin.com/search/${keyword}`,
};

function listSources() {
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    candidates: source.candidates || [],
    example: Boolean(source.sampleList),
  }));
}

function getSource(id) {
  const source = sourceMap.get(id);
  if (!source) {
    throw new Error("未知热点来源");
  }
  return source;
}

function searchUrlFor(sourceId, title) {
  const keyword = encodeURIComponent(String(title || ""));
  const template = SEARCH_TEMPLATES[sourceId] || SEARCH_TEMPLATES.baidu;
  return template(keyword);
}

async function fetchSource(sourceId, options) {
  const source = getSource(sourceId);
  return source.fetch(options || {});
}

module.exports = {
  SOURCE_IDS,
  fetchSource,
  getSource,
  listSources,
  normalizeHotList,
  searchUrlFor,
};
