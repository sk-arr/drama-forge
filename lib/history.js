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

const TRASH_RETENTION_DAYS = 30;

function isSafeRecordId(id) {
  return typeof id === "string" && /^[a-z0-9_-]+$/i.test(id);
}

function recordPath(dir, id) {
  if (!isSafeRecordId(id)) {
    return null;
  }
  const root = path.resolve(dir);
  const file = path.resolve(root, `${id}.json`);
  if (path.dirname(file) !== root) {
    return null;
  }
  return file;
}

function createHistoryStore(options) {
  const dataDir = options && options.dataDir
    ? options.dataDir
    : path.join(__dirname, "..", "data");
  const historyDir = path.join(dataDir, "history");
  const trashDir = path.join(historyDir, "trash");

  function historyFiles() {
    ensureDir(historyDir);
    return fs.readdirSync(historyDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => path.join(historyDir, name))
      .sort();
  }

  function trashFiles() {
    ensureDir(trashDir);
    return fs.readdirSync(trashDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => path.join(trashDir, name))
      .sort();
  }

  function purgeExpiredTrash() {
    const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    trashFiles().forEach((file) => {
      const record = readRecord(file);
      const deletedAt = record && record.deletedAt ? Date.parse(record.deletedAt) : NaN;
      if (!Number.isFinite(deletedAt) || deletedAt < cutoff) {
        fs.rmSync(file, { force: true });
      }
    });
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
    const file = recordPath(historyDir, id);
    if (!file) {
      throw new Error("历史记录编号不合法");
    }
    const record = {
      id,
      type,
      title,
      createdAt: now.toISOString(),
      input: input || {},
      output: output === undefined ? null : output,
    };
    fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    prune();
    return record;
  }

  function get(id) {
    const file = recordPath(historyDir, id);
    if (!file) {
      return null;
    }
    return readRecord(file);
  }

  function update(id, patch) {
    const file = recordPath(historyDir, id);
    const current = file ? readRecord(file) : null;
    if (!current) {
      return null;
    }

    const next = Object.assign({}, current, patch || {});
    fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  }

  function remove(id) {
    const file = recordPath(historyDir, id);
    const current = file ? readRecord(file) : null;
    if (!current) {
      return false;
    }
    const trashFile = recordPath(trashDir, id);
    if (!trashFile) {
      return false;
    }
    ensureDir(trashDir);
    const trashed = Object.assign({}, current, { deletedAt: new Date().toISOString() });
    fs.writeFileSync(trashFile, `${JSON.stringify(trashed, null, 2)}\n`, "utf8");
    fs.rmSync(file, { force: true });
    purgeExpiredTrash();
    return true;
  }

  function getTrash(id) {
    const file = recordPath(trashDir, id);
    if (!file) {
      return null;
    }
    return readRecord(file);
  }

  function listTrash() {
    purgeExpiredTrash();
    return trashFiles()
      .map(readRecord)
      .filter(Boolean)
      .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)))
      .map((record) => ({
        id: record.id,
        type: record.type,
        title: record.title,
        createdAt: record.createdAt,
        deletedAt: record.deletedAt,
        count: outputCount(record.output),
      }));
  }

  function restore(id) {
    const trashFile = recordPath(trashDir, id);
    const historyFile = recordPath(historyDir, id);
    const record = trashFile ? readRecord(trashFile) : null;
    if (!record || !historyFile) {
      return false;
    }
    const revived = Object.assign({}, record);
    delete revived.deletedAt;
    ensureDir(historyDir);
    fs.writeFileSync(historyFile, `${JSON.stringify(revived, null, 2)}\n`, "utf8");
    fs.rmSync(trashFile, { force: true });
    prune();
    return true;
  }

  function emptyTrash() {
    const files = trashFiles();
    files.forEach((file) => {
      fs.rmSync(file, { force: true });
    });
    return files.length;
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
    emptyTrash,
    get,
    getTrash,
    historyDir,
    list,
    listTrash,
    remove,
    restore,
    save,
    trashDir,
    update,
  };
}

module.exports = {
  createHistoryStore,
  outputCount,
  TRASH_RETENTION_DAYS,
};
