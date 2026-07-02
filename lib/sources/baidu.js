"use strict";

const { createSource, guiguiyaCandidate, uapisCandidate } = require("./common");

module.exports = createSource({
  id: "baidu",
  name: "百度",
  candidates: [
    uapisCandidate("baidu"),
    guiguiyaCandidate("baidu"),
  ],
});
