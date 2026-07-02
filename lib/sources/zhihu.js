"use strict";

const { createSource, uapisCandidate } = require("./common");

module.exports = createSource({
  id: "zhihu",
  name: "知乎",
  candidates: [
    uapisCandidate("zhihu"),
  ],
});
