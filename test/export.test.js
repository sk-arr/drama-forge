"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { buildCsv, csvEscape, dateStamp } = require("../public/js/export");

test("csvEscape handles comma, quote, and line break", () => {
  assert.equal(csvEscape('她说,"反转"\n下一秒'), '"她说,""反转""\n下一秒"');
});

test("buildCsv emits UTF-8 BOM and escaped rows", () => {
  const csv = buildCsv(["组别", "内容"], [
    ["标题", "保洁阿姨,竟是总裁"],
    ["钩子", '她说"别叫我阿姨"'],
  ]);

  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.match(csv, /组别,内容/);
  assert.match(csv, /"保洁阿姨,竟是总裁"/);
  assert.match(csv, /"她说""别叫我阿姨"""/);
});

test("dateStamp returns compact YYYYMMDD", () => {
  assert.equal(dateStamp(new Date("2026-07-02T12:00:00+08:00")), "20260702");
});
