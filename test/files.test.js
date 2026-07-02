"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createFileOrganizer } = require("../lib/files");
const { createHistoryStore } = require("../lib/history");

function makeTmpDir(name) {
  const dir = path.join(__dirname, "..", "tmp-test", `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(filePath, content, mtime) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content || "x");
  if (mtime) {
    fs.utimesSync(filePath, mtime, mtime);
  }
}

test("scan previews only first-level files and does not move anything", () => {
  const dir = makeTmpDir("scan");
  const organizer = createFileOrganizer();
  const mtime = new Date("2026-07-02T08:00:00+08:00");

  try {
    writeFile(path.join(dir, "a.mp4"), "video", mtime);
    writeFile(path.join(dir, "b.jpg"), "image", mtime);
    writeFile(path.join(dir, "nested", "c.mp3"), "audio", mtime);

    const result = organizer.scan({ dir, rule: "type", template: "{日期}_{类型}_{序号}" });

    assert.equal(result.total, 2);
    assert.deepEqual(result.dirs.sort(), ["图片", "视频"]);
    assert.equal(fs.existsSync(path.join(dir, "a.mp4")), true);
    assert.equal(fs.existsSync(path.join(dir, "b.jpg")), true);
    assert.equal(fs.existsSync(path.join(dir, "nested", "c.mp3")), true);
    assert.match(path.relative(dir, result.plan[0].to), /视频|图片/);
    assert.match(path.basename(result.plan[0].to), /^20260702_(视频|图片)_001\./);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("scan rejects path traversal in rename template", () => {
  const dir = makeTmpDir("traversal");
  const organizer = createFileOrganizer();

  try {
    writeFile(path.join(dir, "a.mp4"));
    assert.throws(() => {
      organizer.scan({ dir, rule: "type", template: "..\\{日期}_{序号}" });
    }, /重命名模板不能包含路径/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("execute blocks plans that leave the selected directory", () => {
  const dir = makeTmpDir("execute-block");
  const organizer = createFileOrganizer();

  try {
    writeFile(path.join(dir, "a.mp4"));
    const result = organizer.execute({
      dir,
      plan: [{ from: path.join(dir, "a.mp4"), to: path.join(dir, "..", "escape.mp4") }],
    });

    assert.equal(result.moved, 0);
    assert.equal(result.failed.length, 1);
    assert.match(result.failed[0].reason, /必须在所选目录内/);
    assert.equal(fs.existsSync(path.join(dir, "a.mp4")), true);
    assert.equal(fs.existsSync(path.join(dir, "..", "escape.mp4")), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("execute resolves name conflicts, records history, and undo restores files", () => {
  const dir = makeTmpDir("execute-undo");
  const dataDir = path.join(dir, ".data");
  const historyStore = createHistoryStore({ dataDir });
  const organizer = createFileOrganizer({ historyStore });
  const mtime = new Date("2026-07-02T08:00:00+08:00");

  try {
    writeFile(path.join(dir, "a.mp4"), "one", mtime);
    writeFile(path.join(dir, "b.mp4"), "two", mtime);
    writeFile(path.join(dir, "视频", "20260702_视频_001.mp4"), "existing", mtime);

    const preview = organizer.scan({ dir, rule: "type", template: "{日期}_{类型}_{序号}" });
    const executed = organizer.execute({ dir, plan: preview.plan });

    assert.equal(executed.moved, 2);
    assert.equal(executed.failed.length, 0);
    assert.ok(executed.historyId);
    assert.equal(fs.existsSync(path.join(dir, "a.mp4")), false);
    assert.equal(fs.existsSync(path.join(dir, "b.mp4")), false);
    assert.equal(fs.existsSync(path.join(dir, "视频", "20260702_视频_001_2.mp4")), true);
    assert.equal(fs.existsSync(path.join(dir, "视频", "20260702_视频_002.mp4")), true);

    const undone = organizer.undo({ historyId: executed.historyId });

    assert.equal(undone.restored, 2);
    assert.equal(undone.failed.length, 0);
    assert.equal(fs.readFileSync(path.join(dir, "a.mp4"), "utf8"), "one");
    assert.equal(fs.readFileSync(path.join(dir, "b.mp4"), "utf8"), "two");
    assert.equal(fs.existsSync(path.join(dir, "视频", "20260702_视频_001.mp4")), true);
    assert.equal(historyStore.get(executed.historyId).output.undone, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
