"use strict";

const { createSource, uapisCandidate } = require("./common");

module.exports = createSource({
  id: "douyin",
  name: "抖音",
  candidates: [
    uapisCandidate("douyin"),
  ],
});
