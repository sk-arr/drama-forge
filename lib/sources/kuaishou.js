"use strict";

const { createSource, uapisCandidate } = require("./common");

module.exports = createSource({
  id: "kuaishou",
  name: "快手",
  candidates: [
    uapisCandidate("kuaishou"),
  ],
});
