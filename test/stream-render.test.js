"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "js", "app.js"), "utf8");

function functionBody(name) {
  const start = appJs.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const next = appJs.indexOf("\n  function ", start + 1);
  return appJs.slice(start, next === -1 ? appJs.length : next);
}

test("streaming token callbacks do not re-render the whole route", () => {
  for (const name of ["handleGenerateIdeas", "handleGenerateCopy", "handleGenerateReport"]) {
    const body = functionBody(name);
    const tokenCallback = body.match(/onToken:\s*function\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\},/);
    assert.ok(tokenCallback, `missing onToken callback in ${name}`);
    assert.doesNotMatch(tokenCallback[1], /renderRoute\s*\(/, `${name} should update only the streaming region`);
  }
});
