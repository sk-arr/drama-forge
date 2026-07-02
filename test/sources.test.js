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
const duanjuSource = require("../lib/sources/duanju");

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
  assert.equal(getSource("duanju").name, "红果短剧");
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

test("normalizes nested extra image fields into cover urls", () => {
  const list = normalizeHotList("uapis", {
    list: [
      {
        index: 1,
        title: "B站热榜词条",
        hot_value: "923.2万",
        extra: {
          pic: "https://example.com/bilibili.jpg",
        },
        url: "https://example.com/bilibili",
      },
    ],
  });

  assert.equal(list[0].cover, "https://example.com/bilibili.jpg");
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

test("short drama source falls back to marked sample data without Hongguo key", async () => {
  const result = await duanjuSource.fetch({ env: {} });

  assert.equal(result.source.name, "红果短剧");
  assert.equal(result.provider, "内置示例");
  assert.equal(result.providerUrl, "local:hongguo-sample");
  assert.equal(result.example, true);
  assert.match(result.note, /HONGGUO_API_KEY/);
  assert.ok(result.list.length >= 10);
});

test("short drama source requests Hongguo ranking API when key is configured", async () => {
  let requestedUrl = "";
  const fetchImpl = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        code: 200,
        msg: "ok",
        data: {
          list: [
            {
              rank: 1,
              book_name: "红果爆款短剧",
              play_count: "1088.6万",
              cover_url: "https://example.com/hongguo.jpg",
              share_url: "https://example.com/hongguo",
            },
          ],
        },
      }),
    };
  };

  const result = await duanjuSource.fetch({
    env: {},
    fetchImpl,
    hongguoApiKey: "test-key",
    timeoutMs: 100,
  });
  const url = new URL(requestedUrl);

  assert.equal(url.origin + url.pathname, "https://www.52api.cn/api/hg_new_top");
  assert.equal(url.searchParams.get("key"), "test-key");
  assert.equal(url.searchParams.get("type"), "list");
  assert.equal(url.searchParams.get("cell_id"), "ugc_rank_list_vote");
  assert.equal(result.provider, "52api 红果榜");
  assert.equal(result.example, false);
  assert.deepEqual(result.list[0], {
    rank: 1,
    title: "红果爆款短剧",
    heat: "1088.6万",
    cover: "https://example.com/hongguo.jpg",
    url: "https://example.com/hongguo",
  });
});

test("uses source search URL templates when item url is missing", () => {
  assert.equal(searchUrlFor("douyin", "保洁阿姨竟是总裁"), "https://www.douyin.com/search/%E4%BF%9D%E6%B4%81%E9%98%BF%E5%A7%A8%E7%AB%9F%E6%98%AF%E6%80%BB%E8%A3%81");
  assert.equal(searchUrlFor("kuaishou", "保洁阿姨竟是总裁"), "https://www.kuaishou.com/search/video?searchKey=%E4%BF%9D%E6%B4%81%E9%98%BF%E5%A7%A8%E7%AB%9F%E6%98%AF%E6%80%BB%E8%A3%81");
  assert.equal(searchUrlFor("weibo", "保洁阿姨竟是总裁"), "https://s.weibo.com/weibo?q=%E4%BF%9D%E6%B4%81%E9%98%BF%E5%A7%A8%E7%AB%9F%E6%98%AF%E6%80%BB%E8%A3%81");
  assert.equal(searchUrlFor("duanju", "保洁阿姨竟是总裁"), "https://www.baidu.com/s?wd=%E4%BF%9D%E6%B4%81%E9%98%BF%E5%A7%A8%E7%AB%9F%E6%98%AF%E6%80%BB%E8%A3%81%20%E7%BA%A2%E6%9E%9C%E7%9F%AD%E5%89%A7");
});
