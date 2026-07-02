"use strict";

const { createSource, guiguiyaCandidate, uapisCandidate } = require("./common");

module.exports = createSource({
  id: "weibo",
  name: "微博",
  candidates: [
    uapisCandidate("weibo"),
    guiguiyaCandidate("weibo"),
  ],
});
