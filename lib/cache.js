"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { fetchSource } = require("./sources");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cacheAgeMs(entry) {
  const timestamp = Date.parse(entry && entry.fetchedAt);
  if (!Number.isFinite(timestamp)) {
    return Infinity;
  }
  return Date.now() - timestamp;
}

function normalizeRefreshMinutes(value) {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
}

function createHotCache(options) {
  const dataDir = options && options.dataDir
    ? options.dataDir
    : path.join(__dirname, "..", "data");
  const cacheDir = path.join(dataDir, "cache");

  function cachePath(sourceId) {
    return path.join(cacheDir, `${sourceId}.json`);
  }

  function readCache(sourceId) {
    try {
      const file = cachePath(sourceId);
      if (!fs.existsSync(file)) {
        return null;
      }
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      return null;
    }
  }

  function writeCache(sourceId, payload) {
    ensureDir(cacheDir);
    fs.writeFileSync(cachePath(sourceId), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  async function fetchHot(sourceId, requestOptions) {
    const opts = requestOptions || {};
    const refreshMinutes = normalizeRefreshMinutes(opts.refreshMinutes);
    const maxAgeMs = refreshMinutes * 60 * 1000;
    const cached = readCache(sourceId);

    if (!opts.force && cached && cacheAgeMs(cached) <= maxAgeMs) {
      return Object.assign({}, cached, {
        stale: false,
        fromCache: true,
      });
    }

    const fetcher = opts.fetcher || ((id) => fetchSource(id, {
      fetchImpl: opts.fetchImpl,
      timeoutMs: opts.timeoutMs || 8000,
    }));

    try {
      const fresh = await fetcher(sourceId);
      const payload = {
        source: fresh.source,
        provider: fresh.provider,
        providerUrl: fresh.providerUrl,
        list: fresh.list || [],
        fetchedAt: fresh.fetchedAt || new Date().toISOString(),
        stale: false,
        example: Boolean(fresh.example),
        note: fresh.note || "",
      };
      writeCache(sourceId, payload);
      return Object.assign({}, payload, { fromCache: false });
    } catch (error) {
      if (cached) {
        return Object.assign({}, cached, {
          stale: true,
          fromCache: true,
          error: error.message || "热点源暂不可用",
        });
      }

      return {
        source: { id: sourceId, name: sourceId },
        provider: "",
        providerUrl: "",
        list: [],
        fetchedAt: null,
        stale: false,
        fromCache: false,
        error: error.message || "热点源暂不可用",
      };
    }
  }

  return {
    cacheDir,
    cachePath,
    fetchHot,
    readCache,
    writeCache,
  };
}

module.exports = {
  createHotCache,
};
