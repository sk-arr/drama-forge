"use strict";

const fs = require("node:fs");
const path = require("node:path");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function outputCount(output) {
  if (Array.isArray(output)) {
    return output.length;
  }

  if (output && typeof output === "object") {
    if (Array.isArray(output.items)) {
      return output.items.length;
    }
    return Object.values(output).reduce((total, value) => {
      return total + (Array.isArray(value) ? value.length : 0);
    }, 0);
  }

  return output ? 1 : 0;
}

function readRecord(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

function createHistoryStore(options) {
  const dataDir = options && options.dataDir
    ? options.dataDir
    : path.join(__dirname, "..", "data");
  const historyDir = path.join(dataDir, "history");

  function historyFiles() {
    ensureDir(historyDir);
    return fs.readdirSync(historyDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => path.join(historyDir, name))
      .sort();
  }

  function prune() {
    const files = historyFiles();
    const overflow = files.length - 200;
    if (overflow <= 0) {
      return;
    }

    files.slice(0, overflow).forEach((file) => {
      fs.rmSync(file, { force: true });
    });
  }

  function save(type, title, input, output) {
    ensureDir(historyDir);
    const now = new Date();
    const id = `${now.toISOString().replace(/[-:.TZ]/g, "")}-${process.hrtime.bigint().toString(36)}`;
    const record = {
      id,
      type,
      title,
      createdAt: now.toISOString(),
      input: input || {},
      output: output === undefined ? null : output,
    };
    fs.writeFileSync(path.join(historyDir, `${id}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
    prune();
    return record;
  }

  function get(id) {
    if (!id || /[\\/]/.test(String(id))) {
      return null;
    }
    return readRecord(path.join(historyDir, `${id}.json`));
  }

  function update(id, patch) {
    const current = get(id);
    if (!current) {
      return null;
    }

    const next = Object.assign({}, current, patch || {});
    fs.writeFileSync(path.join(historyDir, `${id}.json`), `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  }

  function remove(id) {
    if (!get(id)) {
      return false;
    }
    fs.rmSync(path.join(historyDir, `${id}.json`), { force: true });
    return true;
  }

  function list(type) {
    return historyFiles()
      .map(readRecord)
      .filter(Boolean)
      .filter((record) => !type || record.type === type)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((record) => ({
        id: record.id,
        type: record.type,
        title: record.title,
        createdAt: record.createdAt,
        count: outputCount(record.output),
      }));
  }

  return {
    get,
    historyDir,
    list,
    remove,
    save,
    update,
  };
}

module.exports = {
  createHistoryStore,
  outputCount,
};
