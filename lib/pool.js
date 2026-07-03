"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MAX_ITEMS = 100;

function createIdeaPool(options) {
  const dataDir = options && options.dataDir
    ? options.dataDir
    : path.join(__dirname, "..", "data");
  const filePath = path.join(dataDir, "idea-pool.json");

  function read() {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function write(list) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(list, null, 2)}\n`, "utf8");
  }

  function list() {
    return read();
  }

  function add(entry) {
    const title = String((entry && entry.title) || "").trim();
    if (!title) {
      throw new Error("选题标题不能为空");
    }

    const items = read();
    const existing = items.find((item) => item.title === title);
    if (existing) {
      return { item: existing, duplicated: true };
    }

    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      source: String((entry && entry.source) || "").trim(),
      heat: String((entry && entry.heat) || "").trim(),
      createdAt: new Date().toISOString(),
    };
    items.unshift(item);
    write(items.slice(0, MAX_ITEMS));
    return { item, duplicated: false };
  }

  function remove(id) {
    const items = read();
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) {
      return false;
    }
    write(next);
    return true;
  }

  return {
    add,
    filePath,
    list,
    remove,
  };
}

module.exports = {
  createIdeaPool,
  MAX_ITEMS,
};
