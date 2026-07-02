"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.join(__dirname, "..", "public", "css", "app.css"), "utf8");

test("defines the corporate trust design tokens", () => {
  [
    "--bg: #F8FAFC",
    "--surface: #FFFFFF",
    "--primary: #4F46E5",
    "--secondary: #7C3AED",
    "--text: #0F172A",
    "--muted: #64748B",
    "--border: #E2E8F0",
    "--success: #10B981",
    "--gradient-primary: linear-gradient(135deg,#4F46E5,#7C3AED)",
    "--shadow-card: 0 4px 20px -2px rgba(79,70,229,.10)",
    "--shadow-card-hover: 0 10px 25px -5px rgba(79,70,229,.15), 0 8px 10px -6px rgba(79,70,229,.10)",
    "--shadow-btn: 0 4px 14px 0 rgba(79,70,229,.30)",
    "--radius-card: 16px",
    "--transition-fast: all .2s ease-out",
  ].forEach((token) => {
    assert.ok(css.includes(token), `missing token: ${token}`);
  });
});

test("includes background blobs and reduced-motion fallback", () => {
  assert.match(css, /\.blobs\b/);
  assert.match(css, /\.blob-1\b/);
  assert.match(css, /\.blob-2\b/);
  assert.match(css, /\.blob-3\b/);
  assert.match(css, /@keyframes drift/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("includes the stage-one shared component classes", () => {
  [
    ".card",
    ".btn-primary",
    ".btn-secondary",
    ".pill",
    ".toggle",
    ".input",
    ".toast",
    ".skeleton",
  ].forEach((className) => {
    assert.ok(css.includes(className), `missing class: ${className}`);
  });
});

test("keeps tablet widths on the two-column app shell", () => {
  const tabletBlock = css.match(/@media \(max-width: 900px\) \{[\s\S]*?\n\}/);
  const phoneBlock = css.match(/@media \(max-width: 640px\) \{[\s\S]*?\n\}/);

  assert.ok(tabletBlock, "missing tablet media query");
  assert.ok(phoneBlock, "missing phone media query");
  assert.doesNotMatch(tabletBlock[0], /\.app-shell\s*\{\s*display:\s*block;/);
  assert.match(phoneBlock[0], /\.app-shell\s*\{\s*display:\s*block;/);
  assert.match(tabletBlock[0], /\.hot-top-grid\s*\{[\s\S]*grid-template-columns:\s*1fr;/);
});

test("main content fills the remaining app workspace", () => {
  const shellBlock = css.match(/\.app-shell\s*\{[\s\S]*?\n\}/);
  const mainBlock = css.match(/\.main\s*\{[\s\S]*?\n\}/);

  assert.ok(shellBlock, "missing app shell styles");
  assert.ok(mainBlock, "missing main content styles");
  assert.match(shellBlock[0], /display:\s*grid;/);
  assert.match(shellBlock[0], /grid-template-columns:\s*[^;]*minmax\(0,\s*1fr\)/);
  assert.match(mainBlock[0], /width:\s*100%;/);
  assert.match(mainBlock[0], /max-width:\s*none;/);
  assert.match(mainBlock[0], /min-width:\s*0;/);
  assert.doesNotMatch(mainBlock[0], /max-width:\s*1080px;/);
});
