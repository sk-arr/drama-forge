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

  async function streamSse(url, payload, handlers, signal) {
    var response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload || {}),
      signal: signal,
    });

    if (!response.ok) {
      var errorPayload = {};
      try {
        errorPayload = await response.json();
      } catch (error) {
        errorPayload = {};
      }
      throw new Error(errorPayload.error || "请求失败，请稍后重试");
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
        callbacks.onDone(event.content || "", event);
      }
      if (event.type === "final" && callbacks.onFinal) {
        callbacks.onFinal(event.result || null);
      }
      if (event.type === "error") {
        throw new Error(event.error || "生成失败");
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

  function generateIdeas(payload, handlers, signal) {
    return streamSse("/api/ai/ideas", payload, handlers, signal);
  }

  function generateCopy(payload, handlers, signal) {
    return streamSse("/api/ai/copy", payload, handlers, signal);
  }

  function generateReport(payload, handlers, signal) {
    return streamSse("/api/ai/report", payload, handlers, signal);
  }

  function generateStoryboard(payload) {
    return requestJson("/api/ai/storyboard", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  }

  function browseFiles(dirPath) {
    var params = new URLSearchParams();
    if (dirPath) {
      params.set("path", dirPath);
    }
    return requestJson("/api/files/browse" + (params.toString() ? "?" + params.toString() : ""));
  }

  function scanFiles(payload) {
    return requestJson("/api/files/scan", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  }

  function executeFiles(payload) {
    return requestJson("/api/files/execute", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  }

  function undoFiles(payload) {
    return requestJson("/api/files/undo", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  }

  window.DramaForgeApi = {
    browseFiles: browseFiles,
    executeFiles: executeFiles,
    generateCopy: generateCopy,
    generateIdeas: generateIdeas,
    generateReport: generateReport,
    generateStoryboard: generateStoryboard,
    getConfig: getConfig,
    getHot: getHot,
    saveConfig: saveConfig,
    scanFiles: scanFiles,
    streamSse: streamSse,
    testConnection: testConnection,
    undoFiles: undoFiles,
  };
})();
