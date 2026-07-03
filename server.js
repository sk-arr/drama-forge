"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { createHotCache } = require("./lib/cache");
const { createConfigStore, isMaskedApiKey, mergeConfig } = require("./lib/config");
const { createFileOrganizer } = require("./lib/files");
const { chatCompletion, loadPrompt, renderPrompt, streamChatCompletion, testAiConnection } = require("./lib/ai");
const {
  copyHistoryTitle,
  ideasHistoryTitle,
  parseCopyOutput,
  parseIdeaCards,
  parseStoryboardJson,
  platformLabel,
  platformPromptName,
  storyboardHistoryTitle,
} = require("./lib/generation");
const { createHistoryStore } = require("./lib/history");
const { createIdeaPool } = require("./lib/pool");
const { createPromptLibrary } = require("./lib/prompts");
const demoMock = require("./lib/mock");

const HOST = "127.0.0.1";
const PORT = 3900;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const defaultConfigStore = createConfigStore();
const defaultHotService = createHotCache({ dataDir: defaultConfigStore.dataDir });
const defaultHistoryStore = createHistoryStore({ dataDir: defaultConfigStore.dataDir });
const defaultFileOrganizer = createFileOrganizer({ historyStore: defaultHistoryStore });
const defaultPromptLibrary = createPromptLibrary({ rootDir: ROOT_DIR, dataDir: defaultConfigStore.dataDir });
const defaultIdeaPool = createIdeaPool({ dataDir: defaultConfigStore.dataDir });
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
  streamCopy(config, payload, options) {
    return streamChatCompletion(config.ai, {
      messages: [
        { role: "user", content: payload.prompt },
      ],
      temperature: 0.9,
      maxTokens: 1600,
    }, options);
  },
  storyboard(config, payload) {
    return chatCompletion(config.ai, {
      messages: [
        { role: "user", content: payload.prompt },
      ],
      temperature: 0.3,
      maxTokens: 1800,
    }, { timeoutMs: 60000 });
  },
  streamReport(config, payload, options) {
    return streamChatCompletion(config.ai, {
      messages: [
        { role: "user", content: payload.prompt },
      ],
      temperature: 0.4,
      maxTokens: 1100,
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

function buildCopyPrompt(body, configStore) {
  const templateName = platformPromptName(body.platform);
  const template = loadPrompt(templateName, {
    rootDir: ROOT_DIR,
    dataDir: configStore.dataDir,
  });
  return renderPrompt(template, {
    "剧名": body.title || "",
    "题材": body.genre || "",
    "卖点": body.selling || "",
  });
}

function buildStoryboardPrompt(body, configStore) {
  const template = loadPrompt("storyboard", {
    rootDir: ROOT_DIR,
    dataDir: configStore.dataDir,
  });
  return renderPrompt(template, {
    "剧本": body.script || "",
    "画幅": body.ratio || "竖屏 9:16",
  });
}

function formatChineseDate(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const offset = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - offset);
  return result;
}

function reportTypeLabel(type) {
  return type === "day" ? "日报" : "周报";
}

function reportDateRange(type, now) {
  const current = now || new Date();
  if (type === "day") {
    return formatChineseDate(current);
  }
  const start = startOfWeek(current);
  return `${formatChineseDate(start)}—${formatChineseDate(current)}`;
}

function buildReportPrompt(body, configStore) {
  const type = body.type === "day" ? "day" : "week";
  const dateRange = reportDateRange(type);
  const template = loadPrompt("report", {
    rootDir: ROOT_DIR,
    dataDir: configStore.dataDir,
  });
  return {
    dateRange,
    type,
    prompt: renderPrompt(template, {
      "记录": body.text || "",
      "类型": type,
      "日期范围": dateRange,
    }),
  };
}

function demoDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function demoTitle(title) {
  return `(演示) ${title}`;
}

async function streamDemoText(res, content) {
  const lines = String(content || "").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const token = index < lines.length - 1 ? `${lines[index]}\n` : lines[index];
    if (token) {
      writeSse(res, { type: "token", token });
    }
    await demoDelay(120 + Math.floor(Math.random() * 130));
  }
  return content;
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
  const historyStore = services.historyStore || (configStore === defaultConfigStore
    ? defaultHistoryStore
    : createHistoryStore({ dataDir: configStore.dataDir }));
  const fileOrganizer = services.fileOrganizer || (configStore === defaultConfigStore
    ? defaultFileOrganizer
    : createFileOrganizer({ historyStore }));
  const hotService = services.hotService || (configStore === defaultConfigStore
    ? defaultHotService
    : createHotCache({ dataDir: configStore.dataDir }));
  const promptLibrary = services.promptLibrary || (configStore === defaultConfigStore
    ? defaultPromptLibrary
    : createPromptLibrary({ rootDir: ROOT_DIR, dataDir: configStore.dataDir }));
  const ideaPool = services.ideaPool || (configStore === defaultConfigStore
    ? defaultIdeaPool
    : createIdeaPool({ dataDir: configStore.dataDir }));
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

  if (pathname === "/api/prompts" && req.method === "GET") {
    try {
      sendJson(res, 200, { list: promptLibrary.list() });
    } catch (error) {
      sendJson(res, 500, { error: error.message || "读取提示词模板失败" });
    }
    return;
  }

  if (pathname === "/api/prompts/save" && req.method === "POST") {
    try {
      sendJson(res, 200, promptLibrary.save(body.name, body.content));
    } catch (error) {
      sendJson(res, 400, { error: error.message || "保存提示词失败" });
    }
    return;
  }

  if (pathname === "/api/prompts/reset" && req.method === "POST") {
    try {
      sendJson(res, 200, promptLibrary.reset(body.name));
    } catch (error) {
      sendJson(res, 400, { error: error.message || "恢复默认失败" });
    }
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

    try {
      let content = "";
      if (config.demoMode) {
        content = await streamDemoText(res, demoMock.ideasText());
      } else {
        const prompt = buildIdeasPrompt(body, configStore);
        content = await aiService.streamIdeas(config, {
          prompt,
          sourceName: body.sourceName || "",
          list: body.list || [],
        }, {
          onToken(token) {
            writeSse(res, { type: "token", token });
          },
        });
      }

      const ideasTitle = ideasHistoryTitle(body.sourceName);
      historyStore.save("ideas", config.demoMode ? demoTitle(ideasTitle) : ideasTitle, {
        sourceName: body.sourceName || "",
        list: (body.list || []).slice(0, 10),
      }, {
        text: content,
        cards: parseIdeaCards(content),
      });
      writeSse(res, { type: "done", content });
      res.end();
    } catch (error) {
      writeSse(res, { type: "error", error: error.message || "选题生成失败" });
      res.end();
    }
    return;
  }

  if (pathname === "/api/ai/copy" && req.method === "POST") {
    const config = configStore.readConfig();
    if (!config.demoMode && !(config.ai && config.ai.apiKey)) {
      sendJson(res, 400, { error: "先到设置页配置 API Key" });
      return;
    }

    sendSseHead(res);

    try {
      let content = "";
      if (config.demoMode) {
        content = await streamDemoText(res, demoMock.copyText(body.platform));
      } else {
        const prompt = buildCopyPrompt(body, configStore);
        content = await aiService.streamCopy(config, {
          prompt,
          input: body,
        }, {
          onToken(token) {
            writeSse(res, { type: "token", token });
          },
        });
      }

      const parsed = parseCopyOutput(content);
      const copyTitle = copyHistoryTitle(body);
      historyStore.save("copy", config.demoMode ? demoTitle(copyTitle) : copyTitle, body, parsed);
      writeSse(res, { type: "final", result: parsed });
      res.end();
    } catch (error) {
      writeSse(res, { type: "error", error: error.message || "文案生成失败" });
      res.end();
    }
    return;
  }

  if (pathname === "/api/ai/storyboard" && req.method === "POST") {
    const config = configStore.readConfig();
    if (!config.demoMode && !(config.ai && config.ai.apiKey)) {
      sendJson(res, 400, { error: "先到设置页配置 API Key" });
      return;
    }

    try {
      let list;
      if (config.demoMode) {
        await demoDelay(1500);
        list = demoMock.storyboardList();
      } else {
        const prompt = buildStoryboardPrompt(body, configStore);
        let lastError = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const raw = await aiService.storyboard(config, {
              prompt,
              input: body,
              attempt: attempt + 1,
            });
            list = parseStoryboardJson(raw);
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
          }
        }
        if (lastError) {
          throw lastError;
        }
      }

      const storyboardTitle = storyboardHistoryTitle(body);
      historyStore.save("storyboard", config.demoMode ? demoTitle(storyboardTitle) : storyboardTitle, body, list);
      sendJson(res, 200, { list });
    } catch (error) {
      sendJson(res, 502, { error: error.message || "分镜生成失败" });
    }
    return;
  }

  if (pathname === "/api/ai/report" && req.method === "POST") {
    const config = configStore.readConfig();
    if (!config.demoMode && !(config.ai && config.ai.apiKey)) {
      sendJson(res, 400, { error: "先到设置页配置 API Key" });
      return;
    }
    if (!String(body.text || "").trim()) {
      sendJson(res, 400, { error: "先粘贴工作记录" });
      return;
    }

    const reportPayload = buildReportPrompt(body, configStore);
    sendSseHead(res);

    try {
      let content = "";
      if (config.demoMode) {
        content = await streamDemoText(res, demoMock.reportText(reportPayload.type));
      } else {
        content = await aiService.streamReport(config, {
          prompt: reportPayload.prompt,
          input: body,
        }, {
          onToken(token) {
            writeSse(res, { type: "token", token });
          },
        });
      }

      const reportTitle = `${reportTypeLabel(reportPayload.type)} · ${reportPayload.dateRange}`;
      historyStore.save("report", config.demoMode ? demoTitle(reportTitle) : reportTitle, {
        text: body.text || "",
        type: reportPayload.type,
        dateRange: reportPayload.dateRange,
      }, content);
      writeSse(res, { type: "done", content, dateRange: reportPayload.dateRange });
      res.end();
    } catch (error) {
      writeSse(res, { type: "error", error: error.message || "周报生成失败" });
      res.end();
    }
    return;
  }

  if (pathname === "/api/files/browse" && req.method === "GET") {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    try {
      const result = fileOrganizer.browse(url.searchParams.get("path") || "");
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "读取文件夹失败" });
    }
    return;
  }

  if (pathname === "/api/files/scan" && req.method === "POST") {
    try {
      const result = fileOrganizer.scan(body);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "扫描失败" });
    }
    return;
  }

  if (pathname === "/api/files/execute" && req.method === "POST") {
    try {
      const result = fileOrganizer.execute(body);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "执行整理失败" });
    }
    return;
  }

  if (pathname === "/api/files/undo" && req.method === "POST") {
    try {
      const result = fileOrganizer.undo(body);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "撤销失败" });
    }
    return;
  }

  if (pathname === "/api/history" && req.method === "GET") {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    const type = url.searchParams.get("type") || "";
    sendJson(res, 200, {
      list: historyStore.list(type || undefined),
      trashCount: historyStore.listTrash().length,
    });
    return;
  }

  if (pathname === "/api/pool" && req.method === "GET") {
    sendJson(res, 200, { list: ideaPool.list() });
    return;
  }

  if (pathname === "/api/pool" && req.method === "POST") {
    try {
      const result = ideaPool.add(body || {});
      sendJson(res, 200, { ok: true, duplicated: result.duplicated, item: result.item });
    } catch (error) {
      sendJson(res, 400, { error: error.message || "加入选题池失败" });
    }
    return;
  }

  if (pathname.startsWith("/api/pool/") && req.method === "DELETE") {
    let id = "";
    try {
      id = decodeURIComponent(pathname.slice("/api/pool/".length));
    } catch (error) {
      sendJson(res, 400, { error: "编号不合法" });
      return;
    }

    if (!ideaPool.remove(id)) {
      sendJson(res, 404, { error: "选题池里没有这条记录" });
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/history/trash" && req.method === "GET") {
    sendJson(res, 200, { list: historyStore.listTrash() });
    return;
  }

  if (pathname === "/api/history/trash/restore" && req.method === "POST") {
    const id = body && body.id ? String(body.id) : "";
    if (!historyStore.restore(id)) {
      sendJson(res, 404, { error: "回收站里没有这条记录" });
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/history/trash" && req.method === "DELETE") {
    sendJson(res, 200, { ok: true, removed: historyStore.emptyTrash() });
    return;
  }

  if (pathname.startsWith("/api/history/") && req.method === "GET") {
    let id = "";
    try {
      id = decodeURIComponent(pathname.slice("/api/history/".length));
    } catch (error) {
      sendJson(res, 400, { error: "记录编号不合法" });
      return;
    }

    const record = historyStore.get(id);
    if (!record) {
      sendJson(res, 404, { error: "历史记录不存在或已被清理" });
      return;
    }
    sendJson(res, 200, record);
    return;
  }

  if (pathname.startsWith("/api/history/") && req.method === "DELETE") {
    let id = "";
    try {
      id = decodeURIComponent(pathname.slice("/api/history/".length));
    } catch (error) {
      sendJson(res, 400, { error: "记录编号不合法" });
      return;
    }

    if (!historyStore.remove(id)) {
      sendJson(res, 404, { error: "历史记录不存在或已被清理" });
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/hot" && req.method === "GET") {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    const sourceId = url.searchParams.get("source") || "douyin";
    const force = ["1", "true", "yes"].includes(String(url.searchParams.get("force") || "").toLowerCase());
    const config = configStore.readConfig();
    if (config.demoMode) {
      sendJson(res, 200, demoMock.hotMock(sourceId));
      return;
    }
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
