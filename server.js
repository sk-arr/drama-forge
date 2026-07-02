"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = 3900;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

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

async function handleApi(req, res, pathname) {
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
    sendJson(res, 501, { error: "配置接口尚未实现" });
    return;
  }

  if (pathname === "/api/config" && req.method === "POST") {
    void body;
    sendJson(res, 501, { error: "配置接口尚未实现" });
    return;
  }

  if (pathname === "/api/ai/test" && req.method === "POST") {
    void body;
    sendJson(res, 501, { error: "连接测试接口尚未实现" });
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

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    const pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      handleApi(req, res, pathname).catch((error) => {
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
