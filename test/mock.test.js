"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const demoMock = require("../lib/mock");
const { parseCopyOutput, parseIdeaCards, parseStoryboardJson } = require("../lib/generation");

test("hot mock returns 10 realistic items for each default source", () => {
  ["douyin", "kuaishou", "weibo", "duanju", "xiaohongshu", "bilibili"].forEach((sourceId) => {
    const payload = demoMock.hotMock(sourceId);
    assert.equal(payload.source.id, sourceId);
    assert.equal(payload.list.length, 10);
    assert.equal(payload.example, true);
    assert.ok(payload.note.includes("演示"));
    payload.list.forEach((item) => {
      assert.ok(item.title.length >= 4, `${sourceId} 词条过短: ${item.title}`);
    });
  });
});

test("hot mock falls back to generic list for sources without dedicated data", () => {
  const payload = demoMock.hotMock("baidu");
  assert.equal(payload.source.id, "baidu");
  assert.equal(payload.list.length, 10);
});

test("copy mock renders full four groups for every platform", () => {
  ["douyin", "kuaishou", "weixin"].forEach((platform) => {
    const parsed = parseCopyOutput(demoMock.copyText(platform));
    assert.equal(parsed.titles.length, 10, `${platform} 标题应为 10 条`);
    assert.equal(parsed.hooks.length, 10, `${platform} 钩子应为 10 条`);
    assert.equal(parsed.intros.length, 3, `${platform} 简介应为 3 条`);
    assert.ok(parsed.tags.length >= 8, `${platform} 标签应不少于 8 个`);
  });
});

test("storyboard mock is a valid 12-14 shot vertical sequence", () => {
  const list = demoMock.storyboardList();
  assert.ok(list.length >= 12 && list.length <= 14, `分镜应为 12~14 镜,实际 ${list.length}`);
  const validated = parseStoryboardJson(JSON.stringify(list));
  validated.forEach((row) => {
    assert.ok(row.duration >= 2 && row.duration <= 5, `单镜时长应 2~5s: 镜 ${row.shot}`);
  });
});

test("ideas mock parses into exactly three cards", () => {
  const cards = parseIdeaCards(demoMock.ideasText());
  assert.equal(cards.length, 3);
  cards.forEach((card) => {
    assert.ok(card.title);
    assert.ok(card.logic.length >= 10);
    assert.ok(card.genre);
  });
});

test("report mock keeps the four-section structure for week and day", () => {
  const week = demoMock.reportText("week");
  ["本周完成", "数据亮点", "下周计划", "风险与需要支持"].forEach((section) => {
    assert.ok(week.includes(section), `周报缺少段落: ${section}`);
  });

  const day = demoMock.reportText("day");
  ["今日完成", "数据亮点", "明日计划", "风险"].forEach((section) => {
    assert.ok(day.includes(section), `日报缺少段落: ${section}`);
  });
});
