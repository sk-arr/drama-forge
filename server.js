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
  parseCopyOutput,
  parseStoryboardJson,
  platformLabel,
  platformPromptName,
  storyboardHistoryTitle,
} = require("./lib/generation");
const { createHistoryStore } = require("./lib/history");

const HOST = "127.0.0.1";
const PORT = 3900;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const defaultConfigStore = createConfigStore();
const defaultHotService = createHotCache({ dataDir: defaultConfigStore.dataDir });
const defaultHistoryStore = createHistoryStore({ dataDir: defaultConfigStore.dataDir });
const defaultFileOrganizer = createFileOrganizer({ historyStore: defaultHistoryStore });
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

function demoCopyOutput(platform) {
  if (platform === "kuaishou") {
    return [
      "===TITLES===",
      "- 老铁别眨眼，她真不是普通保洁",
      "- 这一巴掌，替她憋屈了三年",
      "- 全公司笑她穷，下一秒都慌了",
      "===HOOKS===",
      "- 谁懂啊，她刚拖完地就被董事会点名了",
      "- 老铁你看完再骂，她真有苦衷",
      "- 别欺负老实人，这次她要讨回公道",
      "===INTROS===",
      "- 被羞辱的保洁阿姨转身亮出身份，替自己讨回尊严。",
      "- 她忍了三年，只为等到今天让真相大白。",
      "- 一场公司大会，把所有看不起她的人都打醒了。",
      "===TAGS===",
      "- #短剧 #快手短剧 #女频逆袭 #身份反转 #老铁追剧 #打脸 #爽文 #家庭情感",
    ].join("\n");
  }

  if (platform === "weixin" || platform === "微信小程序") {
    return [
      "===TITLES===",
      "- 保洁阿姨被逼离职后，总裁身份藏不住了",
      "- 她替女儿忍辱三年，终于等来翻身那一刻",
      "- 全公司都在等她出丑，只有董事长知道真相",
      "===HOOKS===",
      "- 她只是来打扫办公室，却被亲手赶出自己公司",
      "- 女儿病危那晚，她决定不再隐藏身份",
      "- 看不起她的人不知道，下一集她就要收回集团",
      "===INTROS===",
      "- 林晚为保护女儿隐藏总裁身份，却在被羞辱后不得不重回董事会，继续看她如何一步步夺回公司。",
      "- 一张离职单牵出十年前的股权秘密，她的反击才刚开始。",
      "- 她不是没人撑腰，她自己就是最大的靠山。下一集,她将亲手揭开背叛者。",
      "===TAGS===",
      "- #短剧 #微信短剧 #女频逆袭 #追剧 #付费短剧 #身份反转 #都市情感 #爽剧",
    ].join("\n");
  }

  return [
    "===TITLES===",
    "- 保洁阿姨摊牌那一刻",
    "- 全公司都跪着叫她总裁",
    "- 她扫的不是地，是全场脸面",
    "===HOOKS===",
    "- 别叫我阿姨，叫我董事长",
    "- 她刚被开除，集团印章就送到了",
    "- 所有人都笑她穷，下一秒笑不出来了",
    "===INTROS===",
    "- 被羞辱的保洁阿姨亮出真实身份，反手收回整家公司。",
    "- 她忍辱三年，只为查清丈夫背叛的真相。",
    "- 一场会议，让所有看不起她的人当场道歉。",
    "===TAGS===",
    "- #短剧 #抖音短剧 #女频逆袭 #身份反转 #打脸 #爽剧 #总裁 #追剧",
  ].join("\n");
}

function demoStoryboardList() {
  return [
    { shot: 1, scale: "近景", visual: "林晚穿着保洁服推开会议室门,手里还拿着拖把。", audio: "门轴轻响,会议室瞬间安静。", duration: 3 },
    { shot: 2, scale: "中景", visual: "主管挡在她面前,把离职单拍到桌上。", audio: "主管: 这里不是你该来的地方。", duration: 4 },
    { shot: 3, scale: "特写", visual: "林晚低头看离职单,指尖慢慢攥紧。", audio: "纸张被捏皱的声音。", duration: 3 },
    { shot: 4, scale: "近景", visual: "董事会秘书快步进门,双手递上集团印章。", audio: "秘书: 林总,董事会都在等您。", duration: 4 },
    { shot: 5, scale: "特写", visual: "主管脸色瞬间僵住,离职单从手里滑落。", audio: "离职单落地声。", duration: 2 },
  ];
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
  const historyStore = services.historyStore || (configStore === defaultConfigStore
    ? defaultHistoryStore
    : createHistoryStore({ dataDir: configStore.dataDir }));
  const fileOrganizer = services.fileOrganizer || (configStore === defaultConfigStore
    ? defaultFileOrganizer
    : createFileOrganizer({ historyStore }));
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
        content = demoCopyOutput(body.platform);
        for (const chunk of content.split(/(?=\n===|\n- )/)) {
          if (chunk) {
            writeSse(res, { type: "token", token: chunk });
          }
        }
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
      historyStore.save("copy", copyHistoryTitle(body), body, parsed);
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
        list = demoStoryboardList();
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

      historyStore.save("storyboard", storyboardHistoryTitle(body), body, list);
      sendJson(res, 200, { list });
    } catch (error) {
      sendJson(res, 502, { error: error.message || "分镜生成失败" });
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
