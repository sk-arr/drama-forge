"use strict";

const { requestJson } = require("./common");

const API_URL = "https://www.52api.cn/api/hg_new_top";
const DEFAULT_CELL_ID = "ugc_rank_list_vote";
const SOURCE = { id: "duanju", name: "红果短剧" };
const KEY_ENV_NAMES = ["HONGGUO_API_KEY", "HG_NEW_TOP_KEY", "API_52_KEY", "FIFTY_TWO_API_KEY"];

function searchUrl(title) {
  return `https://www.baidu.com/s?wd=${encodeURIComponent(`${title} 红果短剧`)}`;
}

const sampleList = [
  {
    rank: 1,
    title: "保洁阿姨竟是集团总裁",
    heat: "示例 · 1284w",
    cover: "",
    url: searchUrl("保洁阿姨竟是集团总裁"),
  },
  {
    rank: 2,
    title: "离婚后她惊艳全场",
    heat: "示例 · 986w",
    cover: "",
    url: searchUrl("离婚后她惊艳全场"),
  },
  {
    rank: 3,
    title: "战神归来发现女儿住狗窝",
    heat: "示例 · 851w",
    cover: "",
    url: searchUrl("战神归来发现女儿住狗窝"),
  },
  {
    rank: 4,
    title: "重回1998把日子过成诗",
    heat: "示例 · 720w",
    cover: "",
    url: searchUrl("重回1998把日子过成诗"),
  },
  {
    rank: 5,
    title: "萌宝替妈咪认亲",
    heat: "示例 · 653w",
    cover: "",
    url: searchUrl("萌宝替妈咪认亲"),
  },
  {
    rank: 6,
    title: "闪婚后大叔天天掉马",
    heat: "示例 · 601w",
    cover: "",
    url: searchUrl("闪婚后大叔天天掉马"),
  },
  {
    rank: 7,
    title: "婆婆逼我净身出户",
    heat: "示例 · 548w",
    cover: "",
    url: searchUrl("婆婆逼我净身出户"),
  },
  {
    rank: 8,
    title: "替嫁当天我成了白月光",
    heat: "示例 · 512w",
    cover: "",
    url: searchUrl("替嫁当天我成了白月光"),
  },
  {
    rank: 9,
    title: "总裁把外卖员宠上天",
    heat: "示例 · 489w",
    cover: "",
    url: searchUrl("总裁把外卖员宠上天"),
  },
  {
    rank: 10,
    title: "穿成恶毒女配后我爆红了",
    heat: "示例 · 451w",
    cover: "",
    url: searchUrl("穿成恶毒女配后我爆红了"),
  },
];

function toText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function parseMaybeJson(value) {
  if (typeof value !== "string") {
    return value;
  }
  const text = value.trim();
  if (!text) {
    return value;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return value;
  }
}

function firstTextFrom(value, keys, depth) {
  const currentDepth = depth || 0;
  const parsed = parseMaybeJson(value);
  if (!parsed || typeof parsed !== "object") {
    return "";
  }

  for (const key of keys) {
    const text = toText(parsed[key]);
    if (text) {
      return text;
    }
  }

  if (currentDepth >= 2) {
    return "";
  }

  for (const child of Object.values(parsed)) {
    if (child && typeof child === "object") {
      const text = firstTextFrom(child, keys, currentDepth + 1);
      if (text) {
        return text;
      }
    }
  }

  return "";
}

function findList(value, depth) {
  const currentDepth = depth || 0;
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (!parsed || typeof parsed !== "object" || currentDepth > 4) {
    return [];
  }

  const keys = ["list", "data", "items", "rows", "result", "results", "rank_list", "rankList", "books", "videos"];
  for (const key of keys) {
    const child = parseMaybeJson(parsed[key]);
    if (Array.isArray(child)) {
      return child;
    }
    if (child && typeof child === "object") {
      const nested = findList(child, currentDepth + 1);
      if (nested.length) {
        return nested;
      }
    }
  }

  for (const child of Object.values(parsed)) {
    if (child && typeof child === "object") {
      const nested = findList(child, currentDepth + 1);
      if (nested.length) {
        return nested;
      }
    }
  }

  return [];
}

function rankFrom(value, fallbackRank) {
  const text = toText(value);
  const match = text.match(/\d+/);
  const number = Number(match ? match[0] : text || fallbackRank);
  return Number.isFinite(number) && number > 0 ? number : fallbackRank;
}

function compactHongguoItem(item, fallbackRank) {
  const title = firstTextFrom(item, [
    "title",
    "name",
    "book_name",
    "bookName",
    "drama_name",
    "dramaName",
    "album_name",
    "video_name",
    "playlet_name",
    "show_name",
    "desc",
  ]);
  if (!title) {
    return null;
  }

  const heat = firstTextFrom(item, [
    "hot_value",
    "hot",
    "heat",
    "score",
    "play_count",
    "playCount",
    "view_count",
    "viewCount",
    "views",
    "read_count",
    "popularity",
    "rank_score",
  ]);
  const cover = firstTextFrom(item, [
    "cover",
    "cover_url",
    "coverUrl",
    "thumb_url",
    "thumbUrl",
    "poster",
    "poster_url",
    "pic",
    "image",
    "img",
    "book_cover",
    "vertical_cover",
  ]);
  const url = firstTextFrom(item, ["share_url", "shareUrl", "url", "link", "href", "open_url", "schema"]);
  const rank = rankFrom(firstTextFrom(item, ["rank", "index", "no", "order"]), fallbackRank);

  return {
    rank,
    title,
    heat,
    cover,
    url,
  };
}

function normalizeHongguoList(payload) {
  return findList(payload)
    .map((item, index) => compactHongguoItem(item || {}, index + 1))
    .filter(Boolean)
    .slice(0, 100);
}

function readApiKey(options) {
  if (options && options.hongguoApiKey) {
    return toText(options.hongguoApiKey);
  }

  const env = options && options.env ? options.env : process.env;
  for (const name of KEY_ENV_NAMES) {
    const value = toText(env && env[name]);
    if (value) {
      return value;
    }
  }
  return "";
}

function sampleResult(note) {
  return {
    source: SOURCE,
    provider: "内置示例",
    providerUrl: "local:hongguo-sample",
    list: sampleList,
    fetchedAt: new Date().toISOString(),
    example: true,
    note,
  };
}

function providerUrlFor(url) {
  const copy = new URL(url);
  if (copy.searchParams.has("key")) {
    copy.searchParams.set("key", "已隐藏");
  }
  return copy.toString();
}

async function fetchHongguo(options) {
  const runtimeOptions = options || {};
  const apiKey = readApiKey(runtimeOptions);
  if (!apiKey) {
    return sampleResult("未配置 HONGGUO_API_KEY，使用示例数据");
  }

  const url = new URL(API_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("type", "list");
  url.searchParams.set("cell_id", toText(runtimeOptions.hongguoCellId) || DEFAULT_CELL_ID);
  if (runtimeOptions.hongguoSubCellId) {
    url.searchParams.set("sub_cell_id", toText(runtimeOptions.hongguoSubCellId));
  }
  if (runtimeOptions.page) {
    url.searchParams.set("page", toText(runtimeOptions.page));
  }

  try {
    const payload = await requestJson(url.toString(), runtimeOptions);
    const list = normalizeHongguoList(payload);
    if (!list.length) {
      throw new Error(toText(payload && payload.msg) || "接口返回空榜单");
    }

    return {
      source: SOURCE,
      provider: "52api 红果榜",
      providerUrl: providerUrlFor(url.toString()),
      list,
      fetchedAt: new Date().toISOString(),
      example: false,
    };
  } catch (error) {
    return sampleResult(`红果榜 API 暂不可用，使用示例数据：${error.message}`);
  }
}

async function fetchList(options) {
  const result = await fetchHongguo(options || {});
  return result.list;
}

module.exports = {
  id: SOURCE.id,
  name: SOURCE.name,
  sampleList,
  apiUrl: API_URL,
  defaultCellId: DEFAULT_CELL_ID,
  fetch: fetchHongguo,
  fetchList,
  normalizeHongguoList,
};
