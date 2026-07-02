"use strict";

class HotSourceError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "HotSourceError";
    this.details = details || [];
  }
}

const USER_AGENT = "drama-forge/0.2 (+local demo)";

function uapisCandidate(type) {
  return {
    provider: "UApiPro",
    url: `https://uapis.cn/api/v1/misc/hotboard?type=${encodeURIComponent(type)}`,
    format: "uapis",
  };
}

function guiguiyaCandidate(type) {
  return {
    provider: "Guiguiya",
    url: `https://api.guiguiya.com/api/hotlist?type=${encodeURIComponent(type)}`,
    format: "guiguiya",
  };
}

function toText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function coverFromExtra(extra) {
  if (!extra || typeof extra !== "object") {
    return "";
  }
  return toText(extra.cover || extra.coverUrl || extra.cover_url || extra.pic || extra.image || extra.thumbnail || extra.icon);
}

function compactItem(item, fallbackRank) {
  const title = toText(item.title || item.name || item.keyword || item.word || item.hotWord || item.desc);
  if (!title) {
    return null;
  }

  const heat = toText(item.hot_value || item.hot || item.heat || item.score || item.views || item.view);
  const cover = toText(item.cover || item.coverUrl || item.cover_url || item.image || item.pic || item.thumbnail || item.icon || coverFromExtra(item.extra));
  const url = toText(item.url || item.link || item.mobilUrl || item.mobileUrl || item.href);
  const rank = Number(item.rank || item.index || item.no || fallbackRank);

  return {
    rank: Number.isFinite(rank) && rank > 0 ? rank : fallbackRank,
    title,
    heat,
    cover,
    url,
  };
}

function findList(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const keys = ["list", "data", "items", "result", "results", "news", "hot"];
  for (const key of keys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
    if (value[key] && typeof value[key] === "object") {
      const nested = findList(value[key]);
      if (nested.length) {
        return nested;
      }
    }
  }

  return [];
}

function normalizeHotList(format, payload) {
  void format;
  const rawList = findList(payload);
  return rawList
    .map((item, index) => compactItem(item || {}, index + 1))
    .filter(Boolean)
    .slice(0, 100);
}

async function requestJson(url, options) {
  const fetchImpl = options && options.fetchImpl ? options.fetchImpl : fetch;
  const timeoutMs = options && options.timeoutMs ? options.timeoutMs : 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json,text/plain,*/*",
      },
      signal: controller.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error("返回内容不是合法 JSON");
    }
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("请求超时");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromCandidates(source, options) {
  if (source.sampleList) {
    return {
      source: { id: source.id, name: source.name },
      provider: "内置示例",
      providerUrl: "local:duanju-sample",
      list: source.sampleList,
      fetchedAt: new Date().toISOString(),
      example: true,
      note: "示例数据",
    };
  }

  const errors = [];
  for (const candidate of source.candidates || []) {
    try {
      const payload = await requestJson(candidate.url, options);
      const list = normalizeHotList(candidate.format, payload);
      if (!list.length) {
        throw new Error("接口返回空榜单");
      }

      return {
        source: { id: source.id, name: source.name },
        provider: candidate.provider,
        providerUrl: candidate.url,
        list,
        fetchedAt: new Date().toISOString(),
        example: false,
      };
    } catch (error) {
      errors.push({
        provider: candidate.provider,
        url: candidate.url,
        error: error.message,
      });
    }
  }

  throw new HotSourceError(`${source.name} 暂不可用`, errors);
}

function createSource(definition) {
  const source = Object.assign({}, definition);
  source.fetch = function fetchSource(options) {
    return fetchFromCandidates(source, options || {});
  };
  source.fetchList = async function fetchList(options) {
    const result = await source.fetch(options || {});
    return result.list;
  };
  return source;
}

module.exports = {
  HotSourceError,
  createSource,
  guiguiyaCandidate,
  normalizeHotList,
  requestJson,
  uapisCandidate,
};
