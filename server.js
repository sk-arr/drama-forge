"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { createHotCache } = require("./lib/cache");
const { createConfigStore, isMaskedApiKey, mergeConfig } = require("./lib/config");
const { loadPrompt, renderPrompt, streamChatCompletion, testAiConnection } = require("./lib/ai");

const HOST = "127.0.0.1";
const PORT = 3900;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const defaultConfigStore = createConfigStore();
const defaultHotService = createHotCache({ dataDir: defaultConfigStore.dataDir });
const defaultAiService = {
  testConnection(config) {
    return testAiConnection(config.ai);
  },
  streamIdeas(config, payload, options) {
    return streamChatCompletion(config.ai, {
      messages: [
        { role: "user", content: payload.prompt },
      ],
      temperature: 0.9,
      maxTokens: 900,
    }, options);
  },
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(text),
  });
  res.end(text);
}

function sendSseHead(res) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function formatHotBoardForPrompt(list) {
  return (Array.isArray(list) ? list : [])
    .slice(0, 10)
    .map((item, index) => {
      const rank = item.rank || index + 1;
      const heat = item.heat ? `（热度:${item.heat}）` : "";
      return `${rank}. ${item.title || ""}${heat}`;
    })
    .filter((line) => line.trim())
    .join("\n");
}

function buildIdeasPrompt(body, configStore) {
  const sourceName = body.sourceName || "今日热点";
  const boardText = formatHotBoardForPrompt(body.list);
  const template = loadPrompt("topic-ideas", {
    rootDir: ROOT_DIR,
    dataDir: configStore.dataDir,
  });
  return renderPrompt(template, {
    "来源": sourceName,
    "榜单": boardText || "暂无榜单数据",
  });
}

async function streamDemoIdeas(res) {
  const chunks = [
    "1. 题目: 保洁阿姨的总裁局\n   一句话逻辑: 借用身份反差热度,把低姿态职业与高权力身份放进开场反转。\n   适配题材: 女频逆袭\n",
    "2. 题目: 逆风翻盘的下班十分钟\n   一句话逻辑: 承接职场情绪榜单,用短时间高压场景制造爽点。\n   适配题材: 都市打脸\n",
    "3. 题目: 萌宝直播认亲夜\n   一句话逻辑: 结合亲子与寻亲讨论度,把认亲动作前置到前三秒。\n   适配题材: 萌宝寻亲",
  ];

  for (const chunk of chunks) {
    writeSse(res, { type: "token", token: chunk });
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  writeSse(res, { type: "done" });
  res.end();
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 1024 * 1024) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new SyntaxError("请求体不是合法 JSON"));
      }
    });

    req.on("error", reject);
  });
}

async function handleApi(req, res, pathname, services) {
  const configStore = services.configStore || defaultConfigStore;
  const aiService = services.aiService || defaultAiService;
  const hotService = services.hotService || (configStore === defaultConfigStore
    ? defaultHotService
    : createHotCache({ dataDir: configStore.dataDir }));
  let body = {};
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      body = await readJsonBody(req);
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(res, 400, { error: "请求体不是合法 JSON" });
        return;
      }
      sendJson(res, 400, { error: error.message || "请求体读取失败" });
      return;
    }
  }

  if (pathname === "/api/config" && req.method === "GET") {
    sendJson(res, 200, configStore.readPublicConfig());
    return;
  }

  if (pathname === "/api/config" && req.method === "POST") {
    configStore.saveConfig(body);
    sendJson(res, 200, configStore.readPublicConfig());
    return;
  }

  if (pathname === "/api/ai/test" && req.method === "POST") {
    const current = configStore.readConfig();
    const candidate = mergeConfig(current, body);
    if (body && body.ai && isMaskedApiKey(body.ai.apiKey)) {
      candidate.ai.apiKey = current.ai.apiKey;
    }

    try {
      const result = await aiService.testConnection(candidate);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, error.statusCode || 502, { error: error.message || "连接测试失败" });
    }
    return;
  }

  if (pathname === "/api/ai/ideas" && req.method === "POST") {
    const config = configStore.readConfig();
    if (!config.demoMode && !(config.ai && config.ai.apiKey)) {
      sendJson(res, 400, { error: "先到设置页配置 API Key" });
      return;
    }

    sendSseHead(res);

    if (config.demoMode) {
      await streamDemoIdeas(res);
      return;
    }

    try {
      const prompt = buildIdeasPrompt(body, configStore);
      const content = await aiService.streamIdeas(config, {
        prompt,
        sourceName: body.sourceName || "",
        list: body.list || [],
      }, {
        onToken(token) {
          writeSse(res, { type: "token", token });
        },
      });
      writeSse(res, { type: "done", content });
      res.end();
    } catch (error) {
      writeSse(res, { type: "error", error: error.message || "选题生成失败" });
      res.end();
    }
    return;
  }

  if (pathname === "/api/hot" && req.method === "GET") {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    const sourceId = url.searchParams.get("source") || "douyin";
    const force = ["1", "true", "yes"].includes(String(url.searchParams.get("force") || "").toLowerCase());
    const config = configStore.readConfig();
    const result = await hotService.fetchHot(sourceId, {
      refreshMinutes: config.refreshMinutes,
      force,
    });
    sendJson(res, 200, result);
    return;
  }

  sendJson(res, 404, { error: "接口不存在" });
}

function resolveStaticPath(pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (error) {
    return null;
  }

  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const normalized = path.normalize(requestedPath).replace(/^([/\\])+/, "");
  const fullPath = path.resolve(PUBLIC_DIR, normalized);

  if (!fullPath.startsWith(PUBLIC_DIR + path.sep) && fullPath !== PUBLIC_DIR) {
    return null;
  }

  return fullPath;
}

function serveStatic(req, res, pathname) {
  const staticPath = resolveStaticPath(pathname);
  if (!staticPath) {
    sendText(res, 400, "Bad request");
    return;
  }

  fs.stat(staticPath, (statError, stat) => {
    if (statError) {
      sendText(res, 404, "Not found");
      return;
    }

    const filePath = stat.isDirectory() ? path.join(staticPath, "index.html") : staticPath;
    fs.readFile(filePath, (readError, content) => {
      if (readError) {
        sendText(res, 404, "Not found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "content-type": MIME_TYPES[ext] || "application/octet-stream",
        "content-length": content.length,
      });
      res.end(req.method === "HEAD" ? undefined : content);
    });
  });
}

function createServer(options) {
  const services = options || {};

  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    const pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      handleApi(req, res, pathname, services).catch((error) => {
        console.error(error);
        sendJson(res, 500, { error: "服务器内部错误" });
      });
      return;
    }

    if (!["GET", "HEAD"].includes(req.method)) {
      sendText(res, 405, "Method not allowed");
      return;
    }

    serveStatic(req, res, pathname);
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`drama-forge running at http://${HOST}:${PORT}`);
  });
}

module.exports = {
  createServer,
  HOST,
  PORT,
};
