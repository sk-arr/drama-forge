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
    hot: {
      source: "",
      loading: false,
      data: null,
      error: "",
      ideasLoading: false,
      ideasText: "",
      ideasCards: [],
    },
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

  function enabledHotSources(config) {
    var merged = mergeLocalConfig(DEFAULT_CONFIG, config || {});
    var enabled = HOT_SOURCES.filter(function (source) {
      return Boolean(merged.sources && merged.sources[source.id]);
    });
    return enabled.length ? enabled : HOT_SOURCES.slice(0, 1);
  }

  function hotSourceById(sourceId) {
    return HOT_SOURCES.find(function (source) {
      return source.id === sourceId;
    }) || HOT_SOURCES[0];
  }

  function readLastHotSource() {
    try {
      return window.localStorage.getItem("drama-forge:hot-source") || "";
    } catch (error) {
      return "";
    }
  }

  function writeLastHotSource(sourceId) {
    try {
      window.localStorage.setItem("drama-forge:hot-source", sourceId);
    } catch (error) {
      return;
    }
  }

  function ensureHotSource() {
    var enabled = enabledHotSources(state.config);
    var selected = state.hot.source || readLastHotSource();
    if (!enabled.some(function (source) { return source.id === selected; })) {
      selected = enabled[0].id;
    }
    state.hot.source = selected;
    writeLastHotSource(selected);
    return selected;
  }

  function minutesAgoText(isoText) {
    if (!isoText) {
      return "尚未更新";
    }
    var diffMs = Date.now() - Date.parse(isoText);
    if (!Number.isFinite(diffMs) || diffMs < 0) {
      return "刚刚更新";
    }
    var minutes = Math.max(1, Math.round(diffMs / 60000));
    if (minutes < 60) {
      return minutes + " 分钟前更新";
    }
    return Math.round(minutes / 60) + " 小时前更新";
  }

  function staleCacheText(isoText) {
    if (!isoText) {
      return "使用旧缓存";
    }
    var diffMs = Date.now() - Date.parse(isoText);
    var hours = Math.max(1, Math.round(diffMs / 3600000));
    return "使用 " + hours + " 小时前缓存";
  }

  function searchUrlFor(sourceId, title) {
    var keyword = encodeURIComponent(title || "");
    var templates = {
      douyin: "https://www.douyin.com/search/" + keyword,
      kuaishou: "https://www.kuaishou.com/search/video?searchKey=" + keyword,
      weibo: "https://s.weibo.com/weibo?q=" + keyword,
      bilibili: "https://search.bilibili.com/all?keyword=" + keyword,
      xiaohongshu: "https://www.xiaohongshu.com/search_result?keyword=" + keyword,
      baidu: "https://www.baidu.com/s?wd=" + keyword,
      toutiao: "https://so.toutiao.com/search?keyword=" + keyword,
      zhihu: "https://www.zhihu.com/search?type=content&q=" + keyword,
      duanju: "https://www.douyin.com/search/" + keyword,
    };
    return templates[sourceId] || templates.baidu;
  }

  function itemUrl(sourceId, item) {
    return item && item.url ? item.url : searchUrlFor(sourceId, item && item.title);
  }

  function parseIdeaCards(text) {
    return String(text || "").split(/\n(?=\d+\.\s*题目[:：])/).map(function (block) {
      var title = (block.match(/题目[:：]\s*(.+)/) || [])[1] || "";
      var logic = (block.match(/一句话逻辑[:：]\s*(.+)/) || [])[1] || "";
      var genre = (block.match(/适配题材[:：]\s*(.+)/) || [])[1] || "其他自定义";
      if (!title.trim()) {
        return null;
      }
      return {
        title: title.trim(),
        logic: logic.trim(),
        genre: genre.trim(),
      };
    }).filter(Boolean).slice(0, 3);
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
    var seedHtml = "";
    if (route.id === "copy") {
      try {
        var seed = JSON.parse(window.sessionStorage.getItem("drama-forge:copy-seed") || "null");
        if (seed) {
          seedHtml = [
            '<div class="seed-preview">',
            '<div class="seed-title">已收到首页选题参数</div>',
            '<div class="seed-row">剧名建议: ',
            ui.escapeHtml(seed.title || ""),
            '</div><div class="seed-row">题材: ',
            ui.escapeHtml(seed.genre || ""),
            '</div><div class="seed-row">卖点: ',
            ui.escapeHtml(seed.sellingPoint || ""),
            "</div></div>",
          ].join("");
        }
      } catch (error) {
        seedHtml = "";
      }
    }

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
      seedHtml,
      "</div>",
      "</section>",
    ].join("");
  }

  function renderHotSkeleton() {
    return [
      '<div class="hot-top-grid">',
      '<div class="card card-pad"><div class="skeleton" style="height:110px"></div></div>',
      '<div class="card card-pad"><div class="skeleton" style="height:110px"></div></div>',
      '<div class="card card-pad"><div class="skeleton" style="height:110px"></div></div>',
      "</div>",
      '<div class="hot-list-card card">',
      Array.from({ length: 7 }).map(function () {
        return '<div class="hot-list-row"><div class="skeleton" style="width:22px;height:18px"></div><div class="skeleton" style="height:18px;flex:1"></div><div class="skeleton" style="width:58px;height:18px"></div></div>';
      }).join(""),
      "</div>",
    ].join("");
  }

  function renderSourceToolbar(selectedSource) {
    var enabled = enabledHotSources(state.config);
    return [
      '<div class="hot-toolbar">',
      '<div class="hot-pills">',
      enabled.map(function (source) {
        return [
          '<button type="button" class="pill',
          source.id === selectedSource ? " active" : "",
          '" data-action="select-hot-source" data-source="',
          source.id,
          '">',
          ui.escapeHtml(source.label),
          "</button>",
        ].join("");
      }).join(""),
      "</div>",
      '<button type="button" class="btn-secondary hot-refresh" data-action="refresh-hot">',
      ui.icon("trend"),
      "刷新</button>",
      "</div>",
    ].join("");
  }

  function renderTopCards(list, sourceId) {
    var topLabels = ["TOP 1", "TOP 2", "TOP 3"];
    return [
      '<div class="hot-top-grid">',
      list.slice(0, 3).map(function (item, index) {
        var coverClass = "c" + ((index % 3) + 1);
        var style = item.cover ? ' style="background-image:url(' + ui.escapeHtml(item.cover) + ')"' : "";
        return [
          '<a class="hot-card" href="',
          ui.escapeHtml(itemUrl(sourceId, item)),
          '" target="_blank" rel="noreferrer">',
          '<div class="hot-cover ',
          coverClass,
          item.cover ? " has-image" : "",
          '"',
          style,
          '><span class="rank-badge">',
          ui.escapeHtml(topLabels[index]),
          '</span><span class="play">',
          ui.icon("chevron"),
          "</span></div>",
          '<div class="hot-title">',
          ui.escapeHtml(item.title),
          '</div><div class="hot-meta">',
          ui.escapeHtml(item.heat || "热度上升"),
          " · 点击看视频</div></a>",
        ].join("");
      }).join(""),
      "</div>",
    ].join("");
  }

  function renderListRows(list, sourceId) {
    return [
      '<div class="hot-list-card card">',
      list.slice(3, 10).map(function (item) {
        return [
          '<a class="hot-list-row" href="',
          ui.escapeHtml(itemUrl(sourceId, item)),
          '" target="_blank" rel="noreferrer">',
          '<span class="row-rank">',
          ui.escapeHtml(item.rank),
          '</span><span class="row-title">',
          ui.escapeHtml(item.title),
          '</span><span class="row-heat">',
          ui.escapeHtml(item.heat || ""),
          '</span><span class="row-arrow">',
          ui.icon("chevron"),
          "</span></a>",
        ].join("");
      }).join(""),
      "</div>",
    ].join("");
  }

  function renderIdeasArea() {
    var cards = state.hot.ideasCards;
    var text = state.hot.ideasText;
    var disabled = state.hot.ideasLoading ? " disabled" : "";

    return [
      '<div class="ai-card">',
      '<div class="ai-inner">',
      '<div class="ai-orb">',
      ui.icon("spark"),
      '</div><div class="ai-copy"><div class="ai-title">AI 选题灵感</div>',
      '<div class="ai-desc">基于当前榜单提炼趋势,生成可带入文案工厂的短剧选题。</div></div>',
      '<button type="button" class="btn-primary" data-action="generate-ideas"',
      disabled,
      ">",
      ui.icon("spark"),
      state.hot.ideasLoading ? "生成中..." : "生成 3 个选题",
      "</button></div>",
      text ? '<pre class="ideas-stream">' + ui.escapeHtml(text) + "</pre>" : "",
      cards.length ? [
        '<div class="idea-grid">',
        cards.map(function (card) {
          return [
            '<div class="idea-card">',
            '<h3>',
            ui.escapeHtml(card.title),
            '</h3><p>',
            ui.escapeHtml(card.logic),
            '</p><div class="idea-foot"><span>',
            ui.escapeHtml(card.genre),
            '</span><button type="button" class="btn-secondary" data-action="go-copy" data-title="',
            ui.escapeHtml(card.title),
            '" data-genre="',
            ui.escapeHtml(card.genre),
            '" data-logic="',
            ui.escapeHtml(card.logic),
            '">去生成文案</button></div></div>',
          ].join("");
        }).join(""),
        "</div>",
      ].join("") : "",
      "</div>",
    ].join("");
  }

  function renderHotPage(route) {
    var selectedSource = ensureHotSource();
    var data = state.hot.data;
    var list = data && Array.isArray(data.list) ? data.list : [];
    var meta = data && data.fetchedAt ? minutesAgoText(data.fetchedAt) : getTodayMeta();
    var stale = data && data.stale;
    var note = data && data.note ? data.note : "";

    return [
      '<section class="page-view">',
      '<div class="page-head"><h1 class="page-title">',
      route.title,
      '</h1><span class="page-meta">',
      ui.escapeHtml(meta),
      "</span></div>",
      renderSourceToolbar(selectedSource),
      stale ? '<div class="cache-note">' + ui.escapeHtml(staleCacheText(data.fetchedAt)) + "</div>" : "",
      note ? '<div class="cache-note">' + ui.escapeHtml(note) + "</div>" : "",
      state.hot.loading ? renderHotSkeleton() : "",
      !state.hot.loading && list.length ? renderTopCards(list, selectedSource) + renderListRows(list, selectedSource) : "",
      !state.hot.loading && !list.length ? [
        '<div class="card empty-card">',
        '<div class="empty-icon">',
        ui.icon("trend"),
        '</div><h2>该来源暂不可用</h2><p>',
        ui.escapeHtml((data && data.error) || state.hot.error || "热点源暂不可用"),
        '</p><button type="button" class="btn-secondary" data-action="refresh-hot">重试</button></div>',
      ].join("") : "",
      renderIdeasArea(),
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

    pageRoot.innerHTML = route.id === "settings"
      ? renderSettingsPage(route)
      : (route.id === "hot" ? renderHotPage(route) : renderPlaceholder(route));
    updateConnectionStatus();
  }

  function loadHotIfNeeded() {
    if (window.location.hash !== "#/hot" || !state.config) {
      return;
    }
    var sourceId = ensureHotSource();
    if (!state.hot.loading && (!state.hot.data || !state.hot.data.source || state.hot.data.source.id !== sourceId)) {
      loadHot(false);
    }
  }

  async function loadHot(force) {
    var sourceId = ensureHotSource();
    state.hot.loading = true;
    state.hot.error = "";
    if (force) {
      state.hot.data = null;
    }
    renderRoute();

    try {
      state.hot.data = await api.getHot(sourceId, { force: Boolean(force) });
      state.hot.error = state.hot.data.error || "";
    } catch (error) {
      state.hot.data = {
        source: { id: sourceId, name: hotSourceById(sourceId).label },
        list: [],
        stale: false,
        error: error.message || "热点源暂不可用",
      };
      state.hot.error = state.hot.data.error;
    } finally {
      state.hot.loading = false;
      renderRoute();
    }
  }

  function handleRouteChange() {
    renderRoute();
    loadHotIfNeeded();
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
    loadHotIfNeeded();
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

  async function handleGenerateIdeas(button) {
    var config = mergeLocalConfig(DEFAULT_CONFIG, state.config || {});
    if (!config.demoMode && !hasAnyKey(config)) {
      ui.showToast("先到设置页配置 API Key", "error", 6000);
      return;
    }

    var data = state.hot.data;
    var list = data && Array.isArray(data.list) ? data.list.slice(0, 10) : [];
    if (!list.length) {
      ui.showToast("当前榜单为空，先刷新一个可用来源", "error", 6000);
      return;
    }

    state.hot.ideasLoading = true;
    state.hot.ideasText = "";
    state.hot.ideasCards = [];
    renderRoute();

    try {
      await api.generateIdeas({
        source: state.hot.source,
        sourceName: hotSourceById(state.hot.source).label,
        list: list,
      }, {
        onToken: function (token) {
          state.hot.ideasText += token;
          renderRoute();
        },
        onDone: function () {
          state.hot.ideasCards = parseIdeaCards(state.hot.ideasText);
          renderRoute();
        },
      });
      state.hot.ideasCards = parseIdeaCards(state.hot.ideasText);
      ui.showToast("选题生成完成", "success");
    } catch (error) {
      ui.showToast(error.message || "选题生成失败", "error", 6000);
    } finally {
      state.hot.ideasLoading = false;
      if (button) {
        button.disabled = false;
      }
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

      if (action === "select-hot-source") {
        state.hot.source = actionTarget.getAttribute("data-source") || "douyin";
        writeLastHotSource(state.hot.source);
        state.hot.data = null;
        state.hot.ideasText = "";
        state.hot.ideasCards = [];
        await loadHot(false);
        return;
      }

      if (action === "refresh-hot") {
        await loadHot(true);
        return;
      }

      if (action === "generate-ideas") {
        await handleGenerateIdeas(actionTarget);
        return;
      }

      if (action === "go-copy") {
        window.sessionStorage.setItem("drama-forge:copy-seed", JSON.stringify({
          title: actionTarget.getAttribute("data-title") || "",
          genre: actionTarget.getAttribute("data-genre") || "其他自定义",
          sellingPoint: actionTarget.getAttribute("data-logic") || "",
        }));
        window.location.hash = "#/copy";
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
    window.addEventListener("hashchange", handleRouteChange);
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
