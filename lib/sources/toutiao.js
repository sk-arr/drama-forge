"use strict";

const { createSource, guiguiyaCandidate, uapisCandidate } = require("./common");

module.exports = createSource({
  id: "toutiao",
  name: "头条",
  candidates: [
    uapisCandidate("toutiao"),
    guiguiyaCandidate("toutiao"),
  ],
});
