"use strict";

const { createSource, guiguiyaCandidate, uapisCandidate } = require("./common");

module.exports = createSource({
  id: "bilibili",
  name: "B站",
  candidates: [
    uapisCandidate("bilibili"),
    guiguiyaCandidate("bilihot"),
  ],
});
