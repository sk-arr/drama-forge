"use strict";

const COPY_SECTIONS = {
  "===TITLES===": "titles",
  "===HOOKS===": "hooks",
  "===INTROS===": "intros",
  "===TAGS===": "tags",
};

const PLATFORM_PROMPTS = {
  douyin: "copy-douyin",
  kuaishou: "copy-kuaishou",
  weixin: "copy-weixin",
  "微信小程序": "copy-weixin",
};

const PLATFORM_LABELS = {
  douyin: "抖音",
  kuaishou: "快手",
  weixin: "微信小程序",
  "微信小程序": "微信小程序",
};

const VALID_SCALES = new Set(["全景", "中景", "近景", "特写"]);

function platformPromptName(platform) {
  return PLATFORM_PROMPTS[platform] || PLATFORM_PROMPTS.douyin;
}

function platformLabel(platform) {
  return PLATFORM_LABELS[platform] || "抖音";
}

function normalizeLine(line) {
  return String(line || "").trim().replace(/^-\s*/, "").trim();
}

function parseCopyOutput(text) {
  const result = {
    titles: [],
    hooks: [],
    intros: [],
    tags: [],
  };
  let current = null;

  String(text || "").split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    if (COPY_SECTIONS[line]) {
      current = COPY_SECTIONS[line];
      return;
    }

    if (!current || !line.startsWith("-")) {
      return;
    }

    const value = normalizeLine(line);
    if (!value) {
      return;
    }

    if (current === "tags") {
      result.tags.push.apply(result.tags, value.split(/\s+/).filter(Boolean));
      return;
    }

    result[current].push(value);
  });

  result.tags = Array.from(new Set(result.tags));
  return result;
}

function extractJsonArray(text) {
  let value = String(text || "").trim();
  value = value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = value.indexOf("[");
  const end = value.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new Error("AI 没有返回可解析的分镜 JSON");
  }
  return value.slice(start, end + 1);
}

function parseStoryboardJson(text) {
  const rawJson = extractJsonArray(text);
  let rows;
  try {
    rows = JSON.parse(rawJson);
  } catch (error) {
    throw new Error("AI 返回的分镜 JSON 格式不正确");
  }

  if (!Array.isArray(rows)) {
    throw new Error("AI 返回的分镜不是数组");
  }

  return rows.map((row, index) => {
    const shot = Number(row.shot || index + 1);
    const scale = String(row.scale || "").trim();
    const visual = String(row.visual || "").trim();
    const audio = row.audio === undefined || row.audio === null ? "" : String(row.audio).trim();
    const duration = Number(row.duration);

    if (!Number.isFinite(shot) || !scale || !visual || !Number.isFinite(duration)) {
      throw new Error("分镜字段不完整");
    }

    if (!VALID_SCALES.has(scale)) {
      throw new Error("分镜景别不符合要求");
    }

    return {
      shot,
      scale,
      visual,
      audio,
      duration,
    };
  });
}

function copyHistoryTitle(input) {
  return `爆款文案 · ${input.title || "未命名短剧"} · ${platformLabel(input.platform)}`;
}

function storyboardHistoryTitle() {
  return "剧本转分镜";
}

module.exports = {
  copyHistoryTitle,
  parseCopyOutput,
  parseStoryboardJson,
  platformLabel,
  platformPromptName,
  storyboardHistoryTitle,
};
