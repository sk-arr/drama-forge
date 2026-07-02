"use strict";

const { createSource, uapisCandidate } = require("./common");

module.exports = createSource({
  id: "xiaohongshu",
  name: "小红书",
  candidates: [
    uapisCandidate("xiaohongshu"),
  ],
});
