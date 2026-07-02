"use strict";

const fs = require("node:fs");
const path = require("node:path");

const TEMPLATES = [
  { name: "topic-ideas", label: "选题灵感", feature: "今日热点 · AI 选题灵感" },
  { name: "copy-douyin", label: "文案 - 抖音", feature: "爆款文案工厂 · 抖音" },
  { name: "copy-kuaishou", label: "文案 - 快手", feature: "爆款文案工厂 · 快手" },
  { name: "copy-weixin", label: "文案 - 微信小程序", feature: "爆款文案工厂 · 微信小程序" },
  { name: "storyboard", label: "分镜", feature: "剧本转分镜" },
  { name: "report", label: "周报", feature: "AI 周报" },
];

const templateMap = new Map(TEMPLATES.map((item) => [item.name, item]));

function parsePromptMeta(content) {
  const meta = {
    usage: "",
    variables: [],
    design: [],
  };
  const match = String(content || "").match(/^\s*<!--([\s\S]*?)-->/);
  if (!match) {
    return meta;
  }

  const lines = match[1].split(/\r?\n/);
  let section = "";

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    const usageMatch = line.match(/^用途[:：]\s*(.*)$/);
    if (usageMatch) {
      meta.usage = usageMatch[1].trim();
      section = "";
      return;
    }
    if (/^变量[:：]?$/.test(line)) {
      section = "variables";
      return;
    }
    if (/^设计思路[:：]?$/.test(line)) {
      section = "design";
      return;
    }

    const item = line.replace(/^-\s*/, "").trim();
    if (!item) {
      return;
    }

    if (section === "variables") {
      const varMatch = item.match(/^(\{[^{}]+\})[:：]?\s*(.*)$/);
      meta.variables.push({
        name: varMatch ? varMatch[1] : item,
        desc: varMatch ? varMatch[2].trim() : "",
      });
      return;
    }

    if (section === "design") {
      meta.design.push(item);
    }
  });

  return meta;
}

function createPromptLibrary(options) {
  const rootDir = options && options.rootDir
    ? options.rootDir
    : path.join(__dirname, "..");
  const dataDir = options && options.dataDir
    ? options.dataDir
    : path.join(rootDir, "data");
  const defaultDir = path.join(rootDir, "prompts");
  const userDir = path.join(dataDir, "prompts");

  function assertKnownName(name) {
    const entry = templateMap.get(String(name || ""));
    if (!entry) {
      throw new Error("提示词模板不存在");
    }
    return entry;
  }

  function defaultPath(name) {
    return path.join(defaultDir, `${name}.md`);
  }

  function userPath(name) {
    return path.join(userDir, `${name}.md`);
  }

  function readTemplate(name) {
    const entry = assertKnownName(name);
    const customPath = userPath(entry.name);
    const isModified = fs.existsSync(customPath);
    const filePath = isModified ? customPath : defaultPath(entry.name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`提示词模板文件缺失：${entry.name}.md`);
    }
    const content = fs.readFileSync(filePath, "utf8");
    const meta = parsePromptMeta(content);

    return {
      name: entry.name,
      label: entry.label,
      feature: entry.feature,
      usage: meta.usage,
      variables: meta.variables,
      design: meta.design,
      content,
      isModified,
    };
  }

  function list() {
    return TEMPLATES.map((entry) => readTemplate(entry.name));
  }

  function save(name, content) {
    const entry = assertKnownName(name);
    const text = String(content === undefined || content === null ? "" : content);
    if (!text.trim()) {
      throw new Error("提示词内容不能为空");
    }

    fs.mkdirSync(userDir, { recursive: true });
    fs.writeFileSync(userPath(entry.name), text.endsWith("\n") ? text : `${text}\n`, "utf8");
    return readTemplate(entry.name);
  }

  function reset(name) {
    const entry = assertKnownName(name);
    fs.rmSync(userPath(entry.name), { force: true });
    return readTemplate(entry.name);
  }

  return {
    defaultDir,
    list,
    readTemplate,
    reset,
    save,
    userDir,
  };
}

module.exports = {
  TEMPLATES,
  createPromptLibrary,
  parsePromptMeta,
};
