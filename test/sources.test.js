"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  SOURCE_IDS,
  fetchSource,
  getSource,
  listSources,
  normalizeHotList,
  searchUrlFor,
} = require("../lib/sources");

test("registers the nine configured hot sources", () => {
  assert.deepEqual(SOURCE_IDS, [
    "douyin",
    "kuaishou",
    "weibo",
    "duanju",
    "xiaohongshu",
    "bilibili",
    "baidu",
    "toutiao",
    "zhihu",
  ]);
  assert.equal(listSources().length, 9);
  assert.equal(getSource("douyin").name, "抖音");
});

test("normalizes UApiPro response into the shared list shape", () => {
  const list = normalizeHotList("uapis", {
    list: [
      {
        index: 1,
        title: "热榜词条",
        hot_value: "943w",
        cover: "https://example.com/a.png",
        url: "https://example.com/item",
      },
    ],
  });

  assert.deepEqual(list, [
    {
      rank: 1,
      title: "热榜词条",
      heat: "943w",
      cover: "https://example.com/a.png",
      url: "https://example.com/item",
    },
  ]);
});

test("normalizes Guiguiya response into the shared list shape", () => {
  const list = normalizeHotList("guiguiya", {
    data: [
      {
        index: 2,
        title: "备用词条",
        hot: "129.1万",
        pic: "https://example.com/b.png",
        url: "https://example.com/backup",
      },
    ],
  });

  assert.deepEqual(list, [
    {
      rank: 2,
      title: "备用词条",
      heat: "129.1万",
      cover: "https://example.com/b.png",
      url: "https://example.com/backup",
    },
  ]);
});

test("fetches a source through primary candidate and reports provider metadata", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      list: [
        { index: 1, title: "真实热榜", hot_value: "100w", url: "https://example.com/hot" },
      ],
    }),
  });

  const result = await fetchSource("douyin", { fetchImpl, timeoutMs: 100 });

  assert.equal(result.source.id, "douyin");
  assert.equal(result.provider, "UApiPro");
  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].title, "真实热榜");
  assert.match(result.fetchedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("uses source search URL templates when item url is missing", () => {
  assert.equal(searchUrlFor("douyin", "保洁阿姨竟是总裁"), "https://www.douyin.com/search/%E4%BF%9D%E6%B4%81%E9%98%BF%E5%A7%A8%E7%AB%9F%E6%98%AF%E6%80%BB%E8%A3%81");
  assert.equal(searchUrlFor("kuaishou", "保洁阿姨竟是总裁"), "https://www.kuaishou.com/search/video?searchKey=%E4%BF%9D%E6%B4%81%E9%98%BF%E5%A7%A8%E7%AB%9F%E6%98%AF%E6%80%BB%E8%A3%81");
  assert.equal(searchUrlFor("weibo", "保洁阿姨竟是总裁"), "https://s.weibo.com/weibo?q=%E4%BF%9D%E6%B4%81%E9%98%BF%E5%A7%A8%E7%AB%9F%E6%98%AF%E6%80%BB%E8%A3%81");
});
