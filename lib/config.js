"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CONFIG = {
  ai: {
    provider: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    apiKey: "",
  },
  demoMode: false,
  sources: {
    douyin: true,
    kuaishou: true,
    weibo: true,
    duanju: true,
    xiaohongshu: true,
    bilibili: true,
    baidu: false,
    toutiao: false,
    zhihu: false,
  },
  refreshMinutes: 30,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeConfig(base, patch) {
  const output = clone(base);
  if (!isPlainObject(patch)) {
    return output;
  }

  Object.keys(patch).forEach((key) => {
    const patchValue = patch[key];
    const baseValue = output[key];

    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
      output[key] = mergeConfig(baseValue, patchValue);
      return;
    }

    if (patchValue !== undefined) {
      output[key] = patchValue;
    }
  });

  return output;
}

function maskApiKey(apiKey) {
  if (!apiKey) {
    return "";
  }

  if (apiKey.length <= 8) {
    return "••••";
  }

  return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}

function isMaskedApiKey(apiKey) {
  return typeof apiKey === "string" && (apiKey.includes("••••") || apiKey.includes("****"));
}

function createConfigStore(options) {
  const dataDir = options && options.dataDir
    ? options.dataDir
    : path.join(__dirname, "..", "data");
  const configPath = path.join(dataDir, "config.json");

  function ensureDataDir() {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  function readConfigFile() {
    ensureDataDir();
    if (!fs.existsSync(configPath)) {
      return {};
    }

    try {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (error) {
      throw new Error("配置文件不是合法 JSON");
    }
  }

  function readConfig() {
    return mergeConfig(DEFAULT_CONFIG, readConfigFile());
  }

  function readPublicConfig() {
    const config = readConfig();
    config.ai.apiKey = maskApiKey(config.ai.apiKey);
    return config;
  }

  function saveConfig(nextConfig) {
    const existing = readConfig();
    const incomingKey = nextConfig && nextConfig.ai ? nextConfig.ai.apiKey : undefined;
    const normalizedPatch = clone(nextConfig || {});

    if (normalizedPatch.ai && isMaskedApiKey(incomingKey)) {
      normalizedPatch.ai.apiKey = existing.ai.apiKey;
    }

    const merged = mergeConfig(existing, normalizedPatch);
    ensureDataDir();
    fs.writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    return merged;
  }

  return {
    configPath,
    dataDir,
    readConfig,
    readPublicConfig,
    saveConfig,
  };
}

module.exports = {
  DEFAULT_CONFIG,
  createConfigStore,
  isMaskedApiKey,
  maskApiKey,
  mergeConfig,
};
