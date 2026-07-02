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

  function getHot(sourceId, options) {
    var params = new URLSearchParams();
    params.set("source", sourceId || "douyin");
    if (options && options.force) {
      params.set("force", "1");
    }
    return requestJson("/api/hot?" + params.toString());
  }

  async function generateIdeas(payload, handlers) {
    var response = await fetch("/api/ai/ideas", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });

    if (!response.ok) {
      var errorPayload = {};
      try {
        errorPayload = await response.json();
      } catch (error) {
        errorPayload = {};
      }
      throw new Error(errorPayload.error || "选题生成失败");
    }

    if (!response.body || !response.body.getReader) {
      throw new Error("当前浏览器不支持流式读取");
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    var callbacks = handlers || {};

    function handleBlock(block) {
      var data = block.split(/\r?\n/)
        .filter(function (line) { return line.indexOf("data:") === 0; })
        .map(function (line) { return line.slice(5).trim(); })
        .join("\n");
      if (!data) {
        return;
      }
      var event = JSON.parse(data);
      if (event.type === "token" && callbacks.onToken) {
        callbacks.onToken(event.token || "");
      }
      if (event.type === "done" && callbacks.onDone) {
        callbacks.onDone(event.content || "");
      }
      if (event.type === "error") {
        throw new Error(event.error || "选题生成失败");
      }
    }

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      var index = buffer.indexOf("\n\n");
      while (index >= 0) {
        var block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        handleBlock(block);
        index = buffer.indexOf("\n\n");
      }
    }
  }

  window.DramaForgeApi = {
    generateIdeas: generateIdeas,
    getConfig: getConfig,
    getHot: getHot,
    saveConfig: saveConfig,
    testConnection: testConnection,
  };
})();
