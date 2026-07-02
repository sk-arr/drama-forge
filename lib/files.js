"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHistoryStore } = require("./history");

const ROOT_DRIVES = ["C:", "D:", "E:", "F:", "G:", "H:"];
const TYPE_LABELS = {
  video: "视频",
  image: "图片",
  audio: "音频",
  other: "其他",
};
const VIDEO_EXTS = new Set([".mp4", ".mov", ".avi", ".mkv", ".flv"]);
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const AUDIO_EXTS = new Set([".mp3", ".m4a", ".wav", ".flac"]);

function pad2(value) {
  return String(value).padStart(2, "0");
}

function pad3(value) {
  return String(value).padStart(3, "0");
}

function formatDate(date) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join("");
}

function formatMonthDay(date) {
  return pad2(date.getMonth() + 1) + pad2(date.getDate());
}

function classifyExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (VIDEO_EXTS.has(ext)) {
    return TYPE_LABELS.video;
  }
  if (IMAGE_EXTS.has(ext)) {
    return TYPE_LABELS.image;
  }
  if (AUDIO_EXTS.has(ext)) {
    return TYPE_LABELS.audio;
  }
  return TYPE_LABELS.other;
}

function assertDirectory(dir) {
  const resolved = path.resolve(String(dir || ""));
  if (!dir || !fs.existsSync(resolved)) {
    throw new Error("文件夹不存在");
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error("路径不是文件夹");
  }
  return resolved;
}

function isInside(root, target) {
  const rootResolved = path.resolve(root);
  const targetResolved = path.resolve(target);
  const relative = path.relative(rootResolved, targetResolved);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertInside(root, target, label) {
  if (!isInside(root, target)) {
    throw new Error((label || "路径") + "必须在所选目录内");
  }
}

function validateTemplate(template) {
  const value = String(template || "").trim();
  if (!value) {
    return "";
  }
  if (/[\\/]/.test(value) || value.includes("..")) {
    throw new Error("重命名模板不能包含路径或 ..");
  }
  if (/[<>:"|?*]/.test(value)) {
    throw new Error("重命名模板包含 Windows 文件名不允许的字符");
  }
  return value;
}

function renderFilename(template, item, sequence) {
  const ext = path.extname(item.name);
  const originalBase = path.basename(item.name, ext);
  if (!template) {
    return item.name;
  }

  const base = template
    .replace(/\{日期\}/g, item.fullDate)
    .replace(/\{类型\}/g, item.typeLabel)
    .replace(/\{序号\}/g, pad3(sequence))
    .trim();

  if (!base || /[\\/]/.test(base) || base.includes("..") || /[<>:"|?*]/.test(base)) {
    throw new Error(`重命名模板生成了非法文件名:${originalBase}`);
  }

  return base + ext;
}

function uniquePath(targetPath, taken) {
  const parsed = path.parse(targetPath);
  let candidate = targetPath;
  let suffix = 2;
  while (fs.existsSync(candidate) || (taken && taken.has(path.resolve(candidate).toLowerCase()))) {
    candidate = path.join(parsed.dir, `${parsed.name}_${suffix}${parsed.ext}`);
    suffix += 1;
  }
  if (taken) {
    taken.add(path.resolve(candidate).toLowerCase());
  }
  return candidate;
}

function relativeDisplay(root, filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function ensurePlan(plan) {
  if (!Array.isArray(plan) || !plan.length) {
    throw new Error("整理计划为空，请先预览");
  }
  return plan;
}

function createFileOrganizer(options) {
  const historyStore = options && options.historyStore
    ? options.historyStore
    : createHistoryStore(options && options.dataDir ? { dataDir: options.dataDir } : undefined);

  function browse(inputPath) {
    const rawPath = String(inputPath || "").trim();
    if (!rawPath) {
      const roots = ROOT_DRIVES.map((drive) => `${drive}\\`)
        .filter((drivePath) => fs.existsSync(drivePath))
        .map((drivePath) => ({
          name: drivePath,
          path: drivePath,
        }));
      return { path: "", parent: "", dirs: roots };
    }

    const dir = assertDirectory(rawPath);
    const parent = path.dirname(dir);
    const dirs = fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        path: path.join(dir, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

    return { path: dir, parent: parent === dir ? "" : parent, dirs };
  }

  function scan(input) {
    const dir = assertDirectory(input && input.dir);
    const rule = input && input.rule === "date" ? "date" : "type";
    const template = validateTemplate(input && input.template);
    const counters = new Map();
    const dirs = new Set();

    const files = fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const from = path.join(dir, entry.name);
        const stat = fs.statSync(from);
        const typeLabel = classifyExtension(entry.name);
        const fullDate = formatDate(stat.mtime);
        const targetFolder = rule === "date" ? formatMonthDay(stat.mtime) : typeLabel;
        return {
          from,
          fullDate,
          name: entry.name,
          targetFolder,
          typeLabel,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

    const plan = files.map((item) => {
      const targetDir = path.join(dir, item.targetFolder);
      const currentCount = (counters.get(item.targetFolder) || 0) + 1;
      counters.set(item.targetFolder, currentCount);
      dirs.add(item.targetFolder);
      const to = path.join(targetDir, renderFilename(template, item, currentCount));
      assertInside(dir, item.from, "from");
      assertInside(dir, to, "to");
      return {
        from: item.from,
        to,
        fromName: item.name,
        toRelative: relativeDisplay(dir, to),
        type: item.typeLabel,
      };
    });

    return {
      total: plan.length,
      dirs: Array.from(dirs).sort((a, b) => a.localeCompare(b, "zh-CN")),
      plan,
    };
  }

  function execute(input) {
    const dir = assertDirectory(input && input.dir);
    const plan = ensurePlan(input && input.plan);
    const movedItems = [];
    const failed = [];
    const taken = new Set();

    plan.forEach((item) => {
      try {
        const from = path.resolve(String(item.from || ""));
        const requestedTo = path.resolve(String(item.to || ""));
        assertInside(dir, from, "from");
        assertInside(dir, requestedTo, "to");
        if (!fs.existsSync(from)) {
          throw new Error("源文件不存在");
        }
        if (!fs.statSync(from).isFile()) {
          throw new Error("源路径不是文件");
        }

        fs.mkdirSync(path.dirname(requestedTo), { recursive: true });
        const finalTo = uniquePath(requestedTo, taken);
        assertInside(dir, finalTo, "to");
        fs.renameSync(from, finalTo);
        movedItems.push({
          from,
          requestedTo,
          to: finalTo,
          fromRelative: relativeDisplay(dir, from),
          toRelative: relativeDisplay(dir, finalTo),
        });
      } catch (error) {
        failed.push({
          from: item && item.from ? String(item.from) : "",
          to: item && item.to ? String(item.to) : "",
          reason: error.message || "移动失败",
        });
      }
    });

    const title = `素材整理 · ${movedItems.length} 个文件`;
    const record = historyStore.save("files", title, {
      dir,
      plan,
    }, {
      dir,
      moved: movedItems,
      failed,
      undone: false,
      undo: null,
    });

    return {
      moved: movedItems.length,
      failed,
      historyId: record.id,
      items: movedItems,
    };
  }

  function undo(input) {
    const historyId = input && input.historyId;
    const record = historyStore.get(historyId);
    if (!record || record.type !== "files") {
      throw new Error("整理日志不存在");
    }
    if (record.output && record.output.undone) {
      throw new Error("本次整理已撤销");
    }

    const dir = assertDirectory(record.output && record.output.dir);
    const moved = Array.isArray(record.output && record.output.moved) ? record.output.moved : [];
    const restoredItems = [];
    const failed = [];
    const taken = new Set();

    moved.slice().reverse().forEach((item) => {
      try {
        const from = path.resolve(item.to);
        const requestedTo = path.resolve(item.from);
        assertInside(dir, from, "from");
        assertInside(dir, requestedTo, "to");
        if (!fs.existsSync(from)) {
          throw new Error("待还原文件不存在");
        }
        fs.mkdirSync(path.dirname(requestedTo), { recursive: true });
        const finalTo = uniquePath(requestedTo, taken);
        assertInside(dir, finalTo, "to");
        fs.renameSync(from, finalTo);
        restoredItems.push({
          from,
          to: finalTo,
          fromRelative: relativeDisplay(dir, from),
          toRelative: relativeDisplay(dir, finalTo),
        });
      } catch (error) {
        failed.push({
          from: item && item.to ? String(item.to) : "",
          to: item && item.from ? String(item.from) : "",
          reason: error.message || "撤销失败",
        });
      }
    });

    historyStore.update(historyId, {
      output: Object.assign({}, record.output, {
        undone: failed.length === 0,
        undo: {
          restored: restoredItems,
          failed,
          undoneAt: new Date().toISOString(),
        },
      }),
    });

    return {
      restored: restoredItems.length,
      failed,
      historyId,
      items: restoredItems,
    };
  }

  return {
    browse,
    execute,
    scan,
    undo,
  };
}

module.exports = {
  classifyExtension,
  createFileOrganizer,
  formatDate,
  formatMonthDay,
  isInside,
};
