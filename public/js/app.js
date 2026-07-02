(function () {
  "use strict";

  var ui = window.DramaForgeUi;
  var api = window.DramaForgeApi;
  var appRoot = document.getElementById("app");

  var PROVIDER_PRESETS = [
    { label: "DeepSeek", value: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
    { label: "Kimi", value: "Kimi", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
    { label: "通义千问", value: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
    { label: "自定义", value: "自定义", baseUrl: "", model: "" },
  ];

  var HOT_SOURCES = [
    { id: "douyin", label: "抖音" },
    { id: "kuaishou", label: "快手" },
    { id: "weibo", label: "微博" },
    { id: "duanju", label: "短剧榜" },
    { id: "xiaohongshu", label: "小红书" },
    { id: "bilibili", label: "B站" },
    { id: "baidu", label: "百度" },
    { id: "toutiao", label: "头条" },
    { id: "zhihu", label: "知乎" },
  ];

  var DEFAULT_CONFIG = {
    ai: {
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "",
    },
    demoMode: false,
    sources: {
      douyin: true,
      kuaishou: true,
      weibo: true,
      duanju: true,
      xiaohongshu: true,
      bilibili: true,
      baidu: false,
      toutiao: false,
      zhihu: false,
    },
    refreshMinutes: 30,
  };

  var ROUTES = [
    { hash: "#/hot", id: "hot", label: "今日热点", icon: "trend", stage: "阶段 2 交付", title: "今日<span class=\"grad\">热点</span>", meta: getTodayMeta() },
    { group: "内容生产" },
    { hash: "#/storyboard", id: "storyboard", label: "剧本转分镜", icon: "storyboard", stage: "阶段 3 交付", title: "剧本转<span class=\"grad\">分镜</span>", meta: "脚本拆镜与 CSV 导出" },
    { group: "投放增长" },
    { hash: "#/copy", id: "copy", label: "爆款文案工厂", icon: "copy", stage: "阶段 3 交付", title: "爆款<span class=\"grad\">文案工厂</span>", meta: "标题、钩子、简介、标签" },
    { group: "团队效率" },
    { hash: "#/files", id: "files", label: "素材批量整理", icon: "folder", stage: "阶段 4 交付", title: "素材<span class=\"grad\">批量整理</span>", meta: "纯本地扫描、预览与撤销" },
    { hash: "#/report", id: "report", label: "AI 周报", icon: "report", stage: "阶段 4 交付", title: "AI <span class=\"grad\">周报</span>", meta: "口水账整理成可交付周报" },
    { group: "沉淀" },
    { hash: "#/prompts", id: "prompts", label: "提示词库", icon: "prompts", stage: "阶段 5 交付", title: "提示词<span class=\"grad\">库</span>", meta: "模板沉淀与本地覆盖" },
    { hash: "#/history", id: "history", label: "历史记录", icon: "history", stage: "阶段 5 交付", title: "历史<span class=\"grad\">记录</span>", meta: "生成结果与整理日志" },
    { hash: "#/settings", id: "settings", label: "API 设置", icon: "settings", stage: "阶段 1 交付", title: "API <span class=\"grad\">设置</span>", meta: "模型连接、演示模式、热点来源" },
  ];

  var state = {
    config: null,
    testStatus: null,
  };

  function getTodayMeta() {
    var formatter = new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
    });
    return formatter.format(new Date()) + " · 后续阶段接入热榜";
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeLocalConfig(base, patch) {
    var output = clone(base || DEFAULT_CONFIG);
    Object.keys(patch || {}).forEach(function (key) {
      if (patch[key] && typeof patch[key] === "object" && !Array.isArray(patch[key])) {
        output[key] = mergeLocalConfig(output[key], patch[key]);
      } else if (patch[key] !== undefined) {
        output[key] = patch[key];
      }
    });
    return output;
  }

  function pageRoutes() {
    return ROUTES.filter(function (item) {
      return item.hash;
    });
  }

  function routeByHash(hash) {
    var normalized = hash || "#/hot";
    return pageRoutes().find(function (route) {
      return route.hash === normalized;
    }) || pageRoutes()[0];
  }

  function readConnectionState() {
    try {
      return JSON.parse(window.localStorage.getItem("drama-forge:connection") || "null");
    } catch (error) {
      return null;
    }
  }

  function writeConnectionState(value) {
    try {
      if (value) {
        window.localStorage.setItem("drama-forge:connection", JSON.stringify(value));
      } else {
        window.localStorage.removeItem("drama-forge:connection");
      }
    } catch (error) {
      return;
    }
  }

  function isMaskedKey(value) {
    return String(value || "").indexOf("••••") >= 0 || String(value || "").indexOf("****") >= 0;
  }

  function hasAnyKey(config) {
    return Boolean(config && config.ai && config.ai.apiKey);
  }

  function renderNavItem(route) {
    return [
      '<a class="nav-item" href="',
      route.hash,
      '" data-route="',
      route.hash,
      '">',
      ui.icon(route.icon),
      '<span>',
      ui.escapeHtml(route.label),
      "</span></a>",
    ].join("");
  }

  function renderSidebarMain() {
    return ROUTES.slice(0, -1).map(function (item) {
      if (item.group) {
        return '<div class="nav-group">' + ui.escapeHtml(item.group) + "</div>";
      }
      return renderNavItem(item);
    }).join("");
  }

  function renderShell() {
    appRoot.innerHTML = [
      '<div class="blobs" aria-hidden="true"><div class="blob blob-1"></div><div class="blob blob-2"></div><div class="blob blob-3"></div></div>',
      '<div class="demo-banner" data-demo-banner>演示模式</div>',
      '<div class="app-shell">',
      '<aside class="sidebar">',
      '<div class="logo"><span class="logo-mark">',
      ui.icon("flame"),
      '</span><span><span class="logo-name">短剧工坊</span><span class="logo-sub">drama-forge</span></span></div>',
      renderSidebarMain(),
      '<div class="sidebar-foot">',
      renderNavItem(ROUTES[ROUTES.length - 1]),
      '<div class="connection-pill" data-connection-pill><span class="connection-dot"></span><span data-connection-text>未配置</span></div>',
      "</div>",
      "</aside>",
      '<main class="main" id="main" tabindex="-1"><div id="page-root"></div></main>',
      "</div>",
      '<div class="toast-region" data-toast-region></div>',
    ].join("");
  }

  function updateConnectionStatus() {
    var config = state.config || DEFAULT_CONFIG;
    var banner = document.querySelector("[data-demo-banner]");
    var pill = document.querySelector("[data-connection-pill]");
    var text = document.querySelector("[data-connection-text]");
    var connection = readConnectionState();

    if (banner) {
      banner.classList.toggle("visible", Boolean(config.demoMode));
    }

    if (!pill || !text) {
      return;
    }

    pill.className = "connection-pill";
    if (config.demoMode) {
      pill.classList.add("warning");
      text.textContent = "演示模式";
      return;
    }

    if (connection && connection.ok && hasAnyKey(config)) {
      pill.classList.add("success");
      text.textContent = (connection.provider || config.ai.provider || "模型") + " 已连接";
      return;
    }

    text.textContent = "未配置";
  }

  function renderPlaceholder(route) {
    return [
      '<section class="page-view">',
      '<div class="page-head">',
      '<h1 class="page-title">',
      route.title,
      "</h1>",
      '<span class="page-meta">',
      ui.escapeHtml(route.meta),
      "</span>",
      "</div>",
      '<div class="card placeholder-card">',
      '<h2 class="placeholder-title">',
      ui.escapeHtml(route.label),
      "</h2>",
      '<p class="placeholder-text">',
      ui.escapeHtml(route.stage),
      " · 此页先保留页面入口与视觉骨架，具体功能将在对应阶段实现。",
      "</p>",
      "</div>",
      "</section>",
    ].join("");
  }

  function currentProviderValue(config) {
    var provider = config.ai.provider || "DeepSeek";
    return PROVIDER_PRESETS.some(function (preset) {
      return preset.value === provider;
    }) ? provider : "自定义";
  }

  function renderOptions(options, currentValue) {
    return options.map(function (option) {
      return [
        '<option value="',
        ui.escapeHtml(option.value),
        '"',
        String(option.value) === String(currentValue) ? " selected" : "",
        ">",
        ui.escapeHtml(option.label),
        "</option>",
      ].join("");
    }).join("");
  }

  function renderRefreshOptions(currentValue) {
    return [15, 30, 60].map(function (value) {
      return [
        '<option value="',
        value,
        '"',
        Number(currentValue) === value ? " selected" : "",
        ">",
        value,
        " 分钟</option>",
      ].join("");
    }).join("");
  }

  function renderToggle(active, attrs) {
    return [
      '<button type="button" class="toggle',
      active ? " active" : "",
      '" aria-pressed="',
      active ? "true" : "false",
      '" ',
      attrs,
      "></button>",
    ].join("");
  }

  function renderStatusBox() {
    if (!state.testStatus) {
      return '<div class="status-box" data-test-status></div>';
    }

    return [
      '<div class="status-box visible ',
      state.testStatus.type,
      '" data-test-status>',
      state.testStatus.type === "success" ? ui.icon("check") : ui.icon("x"),
      '<span>',
      ui.escapeHtml(state.testStatus.message),
      "</span></div>",
    ].join("");
  }

  function renderSettingsPage(route) {
    if (!state.config) {
      return [
        '<section class="page-view">',
        '<div class="page-head"><h1 class="page-title">',
        route.title,
        '</h1><span class="page-meta">正在读取本机配置</span></div>',
        '<div class="card card-pad"><div class="skeleton" style="height:160px"></div></div>',
        "</section>",
      ].join("");
    }

    var config = mergeLocalConfig(DEFAULT_CONFIG, state.config);
    var provider = currentProviderValue(config);
    var demoActive = Boolean(config.demoMode);

    return [
      '<section class="page-view">',
      '<div class="page-head"><h1 class="page-title">',
      route.title,
      '</h1><span class="page-meta">',
      ui.escapeHtml(route.meta),
      "</span></div>",
      '<div class="settings-grid">',
      '<form class="card settings-card" data-settings-form>',
      '<div class="settings-card-head"><div><h2 class="settings-card-title">模型连接</h2><p class="settings-card-desc">选择 OpenAI 兼容服务商，测试后保存到本机配置。</p></div></div>',
      '<div class="form-grid">',
      '<div class="field"><label for="ai-provider">服务商预设</label><select class="input" id="ai-provider" name="provider" data-provider-select>',
      renderOptions(PROVIDER_PRESETS, provider),
      "</select></div>",
      '<div class="field"><label for="ai-model">模型名</label><input class="input" id="ai-model" name="model" value="',
      ui.escapeHtml(config.ai.model),
      '" autocomplete="off"></div>',
      '<div class="field full"><label for="ai-base-url">接口地址</label><input class="input" id="ai-base-url" name="baseUrl" value="',
      ui.escapeHtml(config.ai.baseUrl),
      '" autocomplete="off"></div>',
      '<div class="field full"><label for="ai-api-key">API Key</label><div class="password-wrap"><input class="input" id="ai-api-key" name="apiKey" type="password" value="',
      ui.escapeHtml(config.ai.apiKey || ""),
      '" autocomplete="off"><button type="button" class="password-toggle" data-action="toggle-password" title="显示或隐藏 API Key">',
      ui.icon("eye"),
      '</button></div><p class="field-help">Key 仅保存在本机 data 目录，不会上传，也不会进入代码仓库。</p></div>',
      '<div class="full">',
      renderStatusBox(),
      "</div>",
      '<div class="btn-row full"><button type="button" class="btn-secondary" data-action="test-ai">',
      ui.icon("check"),
      "测试连接</button><button type=\"submit\" class=\"btn-primary\">",
      ui.icon("spark"),
      "保存</button></div>",
      "</div>",
      "</form>",
      '<section class="card settings-card">',
      '<div class="settings-card-head"><div><h2 class="settings-card-title">演示模式</h2><p class="settings-card-desc">断网或未配 key 时，用内置示例数据完整走通所有功能。</p></div>',
      renderToggle(demoActive, 'data-action="toggle-demo" data-demo-toggle'),
      "</div>",
      '<p class="field-help">开启后全局顶部显示琥珀色横幅，侧边栏连接状态同步为演示模式。</p>',
      "</section>",
      '<section class="card settings-card">',
      '<div class="settings-card-head"><div><h2 class="settings-card-title">今日热点来源</h2><p class="settings-card-desc">控制首页来源胶囊和后续热榜自动刷新间隔。</p></div>',
      '<div class="field" style="min-width:150px"><label for="refresh-minutes">自动刷新</label><select class="input" id="refresh-minutes" data-refresh-select>',
      renderRefreshOptions(config.refreshMinutes),
      "</select></div></div>",
      '<div class="source-grid">',
      HOT_SOURCES.map(function (source) {
        var active = Boolean(config.sources && config.sources[source.id]);
        return [
          '<div class="switch-row"><div><div class="switch-title">',
          ui.escapeHtml(source.label),
          '</div><div class="switch-desc">',
          source.id,
          '</div></div>',
          renderToggle(active, 'data-action="toggle-source" data-source="' + source.id + '"'),
          "</div>",
        ].join("");
      }).join(""),
      "</div>",
      "</section>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderRoute() {
    var route = routeByHash(window.location.hash);
    var pageRoot = document.getElementById("page-root");
    if (!pageRoot) {
      return;
    }

    if (window.location.hash !== route.hash) {
      window.location.hash = route.hash;
      return;
    }

    document.querySelectorAll("[data-route]").forEach(function (navItem) {
      navItem.classList.toggle("active", navItem.getAttribute("data-route") === route.hash);
    });

    pageRoot.innerHTML = route.id === "settings" ? renderSettingsPage(route) : renderPlaceholder(route);
    updateConnectionStatus();
  }

  function collectSettingsForm() {
    var form = document.querySelector("[data-settings-form]");
    var config = mergeLocalConfig(DEFAULT_CONFIG, state.config || {});
    if (!form) {
      return config;
    }

    var data = new FormData(form);
    config.ai = {
      provider: String(data.get("provider") || "DeepSeek"),
      baseUrl: String(data.get("baseUrl") || "").trim(),
      model: String(data.get("model") || "").trim(),
      apiKey: String(data.get("apiKey") || ""),
    };
    return config;
  }

  async function saveState(silent) {
    state.config = await api.saveConfig(state.config);
    updateConnectionStatus();
    renderRoute();
    if (!silent) {
      ui.showToast("设置已保存", "success");
    }
  }

  async function loadConfig() {
    try {
      state.config = await api.getConfig();
    } catch (error) {
      state.config = clone(DEFAULT_CONFIG);
      ui.showToast(error.message || "配置读取失败", "error");
    }
    updateConnectionStatus();
    renderRoute();
  }

  function setProviderPreset(value) {
    var preset = PROVIDER_PRESETS.find(function (item) {
      return item.value === value;
    });
    if (!preset || preset.value === "自定义") {
      return;
    }

    var baseUrl = document.getElementById("ai-base-url");
    var model = document.getElementById("ai-model");
    if (baseUrl) {
      baseUrl.value = preset.baseUrl;
    }
    if (model) {
      model.value = preset.model;
    }
  }

  async function handleTestConnection(button) {
    var status = document.querySelector("[data-test-status]");
    var config = collectSettingsForm();
    state.testStatus = { type: "success", message: "正在测试连接..." };
    renderRoute();

    var nextButton = document.querySelector('[data-action="test-ai"]');
    if (nextButton) {
      nextButton.disabled = true;
    }

    try {
      var result = await api.testConnection(config);
      writeConnectionState({
        ok: true,
        provider: config.ai.provider,
        latencyMs: result.latencyMs,
        testedAt: Date.now(),
      });
      state.testStatus = { type: "success", message: "已连接 · 延迟 " + result.latencyMs + " ms" };
      ui.showToast("模型连接测试成功", "success");
    } catch (error) {
      writeConnectionState(null);
      state.testStatus = { type: "error", message: error.message || "连接测试失败" };
      if (status) {
        status.textContent = state.testStatus.message;
      }
      ui.showToast(state.testStatus.message, "error", 6000);
    } finally {
      if (button) {
        button.disabled = false;
      }
      updateConnectionStatus();
      renderRoute();
    }
  }

  function bindEvents() {
    document.addEventListener("submit", async function (event) {
      if (!event.target.matches("[data-settings-form]")) {
        return;
      }

      event.preventDefault();
      state.config = collectSettingsForm();
      try {
        await saveState(false);
      } catch (error) {
        ui.showToast(error.message || "保存失败", "error", 6000);
      }
    });

    document.addEventListener("change", async function (event) {
      if (event.target.matches("[data-provider-select]")) {
        setProviderPreset(event.target.value);
        return;
      }

      if (event.target.matches("[data-refresh-select]") && state.config) {
        state.config.refreshMinutes = Number(event.target.value);
        try {
          await saveState(true);
          ui.showToast("刷新间隔已保存", "success");
        } catch (error) {
          ui.showToast(error.message || "保存失败", "error", 6000);
        }
      }
    });

    document.addEventListener("click", async function (event) {
      var actionTarget = event.target.closest("[data-action]");
      if (!actionTarget) {
        return;
      }

      var action = actionTarget.getAttribute("data-action");

      if (action === "toggle-password") {
        var input = document.getElementById("ai-api-key");
        if (!input) {
          return;
        }
        input.type = input.type === "password" ? "text" : "password";
        actionTarget.innerHTML = input.type === "password" ? ui.icon("eye") : ui.icon("eyeOff");
        return;
      }

      if (action === "test-ai") {
        await handleTestConnection(actionTarget);
        return;
      }

      if (action === "toggle-demo" && state.config) {
        state.config.demoMode = !state.config.demoMode;
        try {
          await saveState(true);
          ui.showToast(state.config.demoMode ? "演示模式已开启" : "演示模式已关闭", "success");
        } catch (error) {
          ui.showToast(error.message || "保存失败", "error", 6000);
        }
        return;
      }

      if (action === "toggle-source" && state.config) {
        var source = actionTarget.getAttribute("data-source");
        state.config.sources[source] = !state.config.sources[source];
        try {
          await saveState(true);
          ui.showToast("热点来源已保存", "success");
        } catch (error) {
          ui.showToast(error.message || "保存失败", "error", 6000);
        }
      }
    });
  }

  function boot() {
    if (!appRoot || !ui || !api) {
      return;
    }

    renderShell();
    bindEvents();
    window.addEventListener("hashchange", renderRoute);
    if (!window.location.hash) {
      window.location.hash = "#/hot";
    } else {
      renderRoute();
    }
    loadConfig();
  }

  window.DramaForgeRoutes = pageRoutes();
  boot();
})();
