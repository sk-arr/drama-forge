(function () {
  "use strict";

  async function requestJson(url, options) {
    var response = await fetch(url, Object.assign({
      headers: {
        "content-type": "application/json",
      },
    }, options || {}));
    var payload = null;

    try {
      payload = await response.json();
    } catch (error) {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(payload.error || "请求失败，请稍后重试");
    }

    return payload;
  }

  function getConfig() {
    return requestJson("/api/config");
  }

  function saveConfig(config) {
    return requestJson("/api/config", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  function testConnection(config) {
    return requestJson("/api/ai/test", {
      method: "POST",
      body: JSON.stringify(config || {}),
    });
  }

  window.DramaForgeApi = {
    getConfig: getConfig,
    saveConfig: saveConfig,
    testConnection: testConnection,
  };
})();
