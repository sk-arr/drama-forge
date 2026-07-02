(function () {
  "use strict";

  var ui = window.DramaForgeUi;
  var api = window.DramaForgeApi;
  var exporter = window.DramaForgeExport;
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

  var COPY_GENRES = ["女频逆袭", "男频战神", "豪门复仇", "甜宠", "悬疑反转", "家庭伦理", "其他自定义"];

  var COPY_PLATFORMS = [
    { id: "douyin", label: "抖音" },
    { id: "kuaishou", label: "快手" },
    { id: "weixin", label: "微信小程序" },
  ];

  var COPY_GROUPS = [
    { key: "titles", marker: "===TITLES===", label: "标题" },
    { key: "hooks", marker: "===HOOKS===", label: "开场钩子" },
    { key: "intros", marker: "===INTROS===", label: "简介" },
    { key: "tags", marker: "===TAGS===", label: "话题标签" },
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
    copy: {
      title: "",
      genre: "女频逆袭",
      customGenre: "",
      sellingPoint: "",
      platform: "douyin",
      loading: false,
      controller: null,
      rawText: "",
      result: { titles: [], hooks: [], intros: [], tags: [] },
      expanded: { titles: false, hooks: false, intros: false, tags: false },
      selected: {},
    },
    storyboard: {
      script: "",
      ratio: "竖屏 9:16",
      loading: false,
      list: [],
      error: "",
    },
    files: {
      dir: "",
      rule: "date",
      template: "{日期}_{类型}_{序号}",
      previewLoading: false,
      executing: false,
      undoing: false,
      preview: null,
      result: null,
      error: "",
      picker: {
        open: false,
        path: "",
        loading: false,
        data: null,
        error: "",
      },
    },
    report: {
      text: "",
      type: "week",
      loading: false,
      controller: null,
      content: "",
      dateRange: "",
      error: "",
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

  function emptyCopyResult() {
    return { titles: [], hooks: [], intros: [], tags: [] };
  }

  function normalizeCopyResult(result) {
    var normalized = emptyCopyResult();
    COPY_GROUPS.forEach(function (group) {
      normalized[group.key] = Array.isArray(result && result[group.key])
        ? result[group.key].map(function (item) { return String(item || "").trim(); }).filter(Boolean)
        : [];
    });
    return normalized;
  }

  function copyPlatformLabel(platformId) {
    var platform = COPY_PLATFORMS.find(function (item) {
      return item.id === platformId;
    });
    return platform ? platform.label : COPY_PLATFORMS[0].label;
  }

  function copyGenreValue() {
    if (state.copy.genre === "其他自定义") {
      return String(state.copy.customGenre || "").trim() || "其他自定义";
    }
    return state.copy.genre || "女频逆袭";
  }

  function normalizeCopyLine(line) {
    return String(line || "")
      .replace(/^\s*(?:[-*]|\d+[\.\、\)]|[（(]\d+[）)])\s*/, "")
      .trim();
  }

  function parseCopyStream(text) {
    var result = emptyCopyResult();
    var currentKey = "";

    String(text || "").split(/\r?\n/).forEach(function (line) {
      var trimmed = line.trim();
      var matched = COPY_GROUPS.find(function (group) {
        return trimmed.indexOf(group.marker) >= 0;
      });
      if (matched) {
        currentKey = matched.key;
        return;
      }

      if (!currentKey || !trimmed) {
        return;
      }

      var value = normalizeCopyLine(trimmed);
      if (!value) {
        return;
      }

      if (currentKey === "tags") {
        value.split(/[\s,，、]+/).map(function (tag) {
          return tag.trim();
        }).filter(Boolean).forEach(function (tag) {
          result.tags.push(tag);
        });
        return;
      }

      result[currentKey].push(value);
    });

    return result;
  }

  function applyCopyResult(result) {
    var normalized = normalizeCopyResult(result);
    var liveIds = {};

    COPY_GROUPS.forEach(function (group) {
      normalized[group.key].forEach(function (text, index) {
        var id = group.key + "-" + index;
        liveIds[id] = true;
        if (state.copy.selected[id] === undefined) {
          state.copy.selected[id] = true;
        }
      });
    });

    Object.keys(state.copy.selected).forEach(function (id) {
      if (!liveIds[id]) {
        delete state.copy.selected[id];
      }
    });

    state.copy.result = normalized;
  }

  function hydrateCopyFromSeed() {
    var raw = "";
    try {
      raw = window.sessionStorage.getItem("drama-forge:copy-seed") || "";
      if (raw) {
        window.sessionStorage.removeItem("drama-forge:copy-seed");
      }
    } catch (error) {
      raw = "";
    }

    if (!raw) {
      return;
    }

    try {
      var seed = JSON.parse(raw);
      state.copy.title = seed.title || state.copy.title;
      state.copy.sellingPoint = seed.sellingPoint || state.copy.sellingPoint;
      if (COPY_GENRES.indexOf(seed.genre) >= 0) {
        state.copy.genre = seed.genre;
        state.copy.customGenre = "";
      } else if (seed.genre) {
        state.copy.genre = "其他自定义";
        state.copy.customGenre = seed.genre;
      }
      ui.showToast("已带入首页选题参数", "success");
    } catch (error) {
      return;
    }
  }

  function collectCopyForm() {
    var form = document.querySelector("[data-copy-form]");
    if (!form) {
      return;
    }
    var data = new FormData(form);
    state.copy.title = String(data.get("title") || "").trim();
    state.copy.genre = String(data.get("genre") || "女频逆袭");
    state.copy.customGenre = String(data.get("customGenre") || "").trim();
    state.copy.sellingPoint = String(data.get("sellingPoint") || "").trim();
  }

  function collectStoryboardForm() {
    var form = document.querySelector("[data-storyboard-form]");
    if (!form) {
      return;
    }
    var data = new FormData(form);
    state.storyboard.script = String(data.get("script") || "").trim();
    state.storyboard.ratio = String(data.get("ratio") || "竖屏 9:16");
  }

  function flattenCopyRows(onlySelected) {
    var rows = [];
    COPY_GROUPS.forEach(function (group) {
      (state.copy.result[group.key] || []).forEach(function (text, index) {
        var id = group.key + "-" + index;
        if (!onlySelected || state.copy.selected[id]) {
          rows.push({
            id: id,
            group: group.key,
            groupLabel: group.label,
            text: text,
          });
        }
      });
    });
    return rows;
  }

  function selectedCopyRows() {
    return flattenCopyRows(true);
  }

  function copyRowById(rowId) {
    return flattenCopyRows(false).find(function (row) {
      return row.id === rowId;
    });
  }

  function hasCopyOutput() {
    return flattenCopyRows(false).length > 0;
  }

  function modelReady() {
    var config = mergeLocalConfig(DEFAULT_CONFIG, state.config || {});
    if (!config.demoMode && !hasAnyKey(config)) {
      ui.showToast("先到设置页配置 API Key", "error", 6000);
      return false;
    }
    return true;
  }

  function collectFilesForm() {
    var dirInput = document.querySelector("[data-files-dir]");
    var templateInput = document.querySelector("[data-files-template]");
    if (dirInput) {
      state.files.dir = String(dirInput.value || "").trim();
    }
    if (templateInput) {
      state.files.template = String(templateInput.value || "").trim();
    }
  }

  function resetFilePreview() {
    state.files.preview = null;
    state.files.result = null;
    state.files.error = "";
  }

  function fileRelativeName(baseDir, filePath) {
    var base = String(baseDir || "").replace(/\\/g, "/").replace(/\/+$/, "");
    var full = String(filePath || "").replace(/\\/g, "/");
    if (base && full.indexOf(base + "/") === 0) {
      return full.slice(base.length + 1);
    }
    return full;
  }

  function fileTypeInitial(type) {
    var text = String(type || "其他");
    return text.slice(0, 1);
  }

  function reportTypeLabel(type) {
    return type === "day" ? "日报" : "周报";
  }

  function reportFilenamePrefix(type) {
    return type === "day" ? "日报" : "周报";
  }

  function chineseDate(date) {
    return (date.getMonth() + 1) + "月" + date.getDate() + "日";
  }

  function reportDateRange(type) {
    var now = new Date();
    if (type === "day") {
      return chineseDate(now);
    }
    var start = new Date(now);
    var day = start.getDay();
    var offset = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - offset);
    return chineseDate(start) + "—" + chineseDate(now);
  }

  function collectReportForm() {
    var form = document.querySelector("[data-report-form]");
    if (!form) {
      return;
    }
    var data = new FormData(form);
    state.report.text = String(data.get("text") || "").trim();
    state.report.type = String(data.get("type") || "week") === "day" ? "day" : "week";
  }

  function reportSectionTitle(line) {
    return [
      "本周完成",
      "今日完成",
      "数据亮点",
      "下周计划",
      "明日计划",
      "风险与需要支持",
      "风险",
    ].indexOf(String(line || "").trim()) >= 0;
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

  function renderFilesRulePills() {
    var rules = [
      { id: "date", label: "按拍摄日期" },
      { id: "type", label: "按类型" },
    ];
    return [
      '<div class="platform-pills">',
      rules.map(function (rule) {
        return [
          '<button type="button" class="pill',
          state.files.rule === rule.id ? " active" : "",
          '" data-action="select-file-rule" data-rule="',
          rule.id,
          '">',
          ui.escapeHtml(rule.label),
          "</button>",
        ].join("");
      }).join(""),
      "</div>",
    ].join("");
  }

  function renderFilesTopCard() {
    return [
      '<form class="card files-path-card" data-files-form>',
      '<div class="files-card-head"><div><h2>素材批量整理</h2><p>只扫描所选目录第一层文件，子目录不会被移动。</p></div><span class="files-local-badge">纯本地运行</span></div>',
      '<div class="files-path-row">',
      '<input class="input" name="dir" value="',
      ui.escapeHtml(state.files.dir),
      '" placeholder="选择或粘贴要整理的文件夹路径" autocomplete="off" data-files-dir>',
      '<button type="button" class="btn-secondary" data-action="open-folder-picker">选择…</button>',
      "</div>",
      '<p class="field-help">安全规则: 绝不删除文件，只在该目录内移动和重命名。</p>',
      "</form>",
    ].join("");
  }

  function renderFilesRuleCard() {
    return [
      '<section class="card files-rule-card">',
      '<div class="files-card-head"><div><h2>整理规则</h2><p>模板留空 = 不重命名，只归类。</p></div></div>',
      '<div class="field"><span class="field-label">分类方式</span>',
      renderFilesRulePills(),
      "</div>",
      '<div class="field"><label for="files-template">重命名模板</label><input class="input" id="files-template" name="template" value="',
      ui.escapeHtml(state.files.template),
      '" placeholder="{日期}_{类型}_{序号}" autocomplete="off" data-files-template></div>',
      '<div class="btn-row"><button type="button" class="btn-secondary" data-action="preview-files"',
      state.files.previewLoading ? " disabled" : "",
      ">",
      state.files.previewLoading ? "预览中..." : "预览",
      '</button><button type="button" class="btn-primary" data-action="execute-files"',
      state.files.preview && state.files.preview.plan && state.files.preview.plan.length && !state.files.executing ? "" : " disabled",
      ">",
      state.files.executing ? "执行中..." : "执行整理",
      "</button></div>",
      '<p class="field-help">预览成功前不可执行；改动路径、规则或模板后需要重新预览。</p>',
      "</section>",
    ].join("");
  }

  function renderFilePreviewRows() {
    var preview = state.files.preview;
    if (state.files.previewLoading) {
      return Array.from({ length: 6 }).map(function () {
        return '<div class="file-preview-row"><span class="file-type-badge"><div class="skeleton" style="width:16px;height:16px"></div></span><div class="skeleton" style="height:18px;flex:1"></div><div class="skeleton" style="height:18px;width:160px"></div></div>';
      }).join("");
    }
    if (!preview || !preview.plan || !preview.plan.length) {
      return '<div class="storyboard-empty"><h2>还没有预览</h2><p>选择文件夹和规则后点击预览。</p></div>';
    }

    var rows = preview.plan.slice(0, 50).map(function (item) {
      return [
        '<div class="file-preview-row">',
        '<span class="file-type-badge">',
        ui.escapeHtml(fileTypeInitial(item.type)),
        '</span><span class="file-name">',
        ui.escapeHtml(item.fromName || fileRelativeName(state.files.dir, item.from)),
        '</span><span class="file-arrow">→</span><span class="file-target">',
        ui.escapeHtml(item.toRelative || fileRelativeName(state.files.dir, item.to)),
        "</span></div>",
      ].join("");
    }).join("");

    var rest = preview.plan.length > 50
      ? '<div class="file-preview-more">等 ' + (preview.plan.length - 50) + " 条</div>"
      : "";
    return rows + rest;
  }

  function renderFilesPreviewCard() {
    var preview = state.files.preview;
    var total = preview ? preview.total : 0;
    var dirCount = preview && preview.dirs ? preview.dirs.length : 0;
    return [
      '<section class="card file-preview-card">',
      '<div class="files-card-head"><div><h2>整理预览</h2><p>扫描到 ',
      total,
      " 个文件 → ",
      dirCount,
      " 个目录</p></div></div>",
      state.files.error ? '<div class="status-box visible error">' + ui.icon("x") + "<span>" + ui.escapeHtml(state.files.error) + "</span></div>" : "",
      '<div class="file-preview-list">',
      renderFilePreviewRows(),
      "</div>",
      "</section>",
    ].join("");
  }

  function renderFileFailureList(failed) {
    if (!failed || !failed.length) {
      return "";
    }
    return [
      '<details class="file-failure-list" open><summary>失败 ',
      failed.length,
      " 条</summary>",
      failed.map(function (item) {
        return [
          '<div class="file-failure-row"><span>',
          ui.escapeHtml(fileRelativeName(state.files.dir, item.from)),
          '</span><span>',
          ui.escapeHtml(item.reason || "失败"),
          "</span></div>",
        ].join("");
      }).join(""),
      "</details>",
    ].join("");
  }

  function renderFilesResultCard() {
    var result = state.files.result;
    if (!result) {
      return "";
    }

    return [
      '<section class="card file-result-card">',
      '<div class="files-card-head"><div><h2>执行结果</h2><p>成功移动 ',
      result.moved || 0,
      " 个文件，失败 ",
      result.failed ? result.failed.length : 0,
      " 条</p></div>",
      '<button type="button" class="btn-secondary" data-action="undo-files"',
      result.historyId && !state.files.undoing ? "" : " disabled",
      ">",
      state.files.undoing ? "撤销中..." : "撤销本次",
      "</button></div>",
      renderFileFailureList(result.failed),
      "</section>",
    ].join("");
  }

  function renderFolderPicker() {
    if (!state.files.picker.open) {
      return "";
    }
    var picker = state.files.picker;
    var dirs = picker.data && Array.isArray(picker.data.dirs) ? picker.data.dirs : [];
    var currentPath = picker.data && picker.data.path !== undefined ? picker.data.path : picker.path;
    var parent = picker.data && picker.data.parent ? picker.data.parent : "";

    return [
      '<div class="folder-picker-backdrop">',
      '<section class="folder-picker" role="dialog" aria-modal="true">',
      '<div class="folder-picker-head"><div><h2>选择文件夹</h2><p>',
      currentPath ? ui.escapeHtml(currentPath) : "选择一个磁盘开始",
      '</p></div><button type="button" class="btn-icon" data-action="close-folder-picker" title="关闭">',
      ui.icon("x"),
      "</button></div>",
      '<div class="folder-picker-actions">',
      parent ? '<button type="button" class="btn-secondary" data-action="browse-folder" data-path="' + ui.escapeHtml(parent) + '">上一级</button>' : "",
      currentPath ? '<button type="button" class="btn-primary" data-action="choose-current-folder">选择此文件夹</button>' : "",
      "</div>",
      picker.loading ? '<div class="card-pad"><div class="skeleton" style="height:180px"></div></div>' : "",
      picker.error ? '<div class="status-box visible error">' + ui.icon("x") + "<span>" + ui.escapeHtml(picker.error) + "</span></div>" : "",
      '<div class="folder-list">',
      dirs.length ? dirs.map(function (dir) {
        return [
          '<button type="button" class="folder-row" data-action="browse-folder" data-path="',
          ui.escapeHtml(dir.path),
          '">',
          ui.icon("folder"),
          '<span>',
          ui.escapeHtml(dir.name),
          "</span></button>",
        ].join("");
      }).join("") : '<div class="storyboard-empty"><p>没有可进入的子文件夹。</p></div>',
      "</div>",
      "</section></div>",
    ].join("");
  }

  function renderFilesPage(route) {
    return [
      '<section class="page-view">',
      '<div class="page-head"><h1 class="page-title">',
      route.title,
      '</h1><span class="page-meta">',
      ui.escapeHtml(route.meta),
      "</span></div>",
      '<div class="files-layout">',
      '<div class="files-left">',
      renderFilesTopCard(),
      renderFilesRuleCard(),
      renderFilesResultCard(),
      "</div>",
      renderFilesPreviewCard(),
      "</div>",
      renderFolderPicker(),
      "</section>",
    ].join("");
  }

  function renderReportBody() {
    var content = state.report.content;
    if (!content && state.report.loading) {
      return [
        '<div class="report-body">',
        '<div class="skeleton" style="height:18px;width:42%"></div>',
        '<div class="skeleton" style="height:18px;width:82%"></div>',
        '<div class="skeleton" style="height:18px;width:74%"></div>',
        '<div class="skeleton" style="height:18px;width:52%"></div>',
        "</div>",
      ].join("");
    }

    if (!content) {
      return [
        '<div class="report-empty">',
        ui.icon("report"),
        "<h2>还没有周报</h2><p>把零散记录粘到左侧，生成后这里会变成四段式预览。</p>",
        "</div>",
      ].join("");
    }

    return [
      '<div class="report-body">',
      content.split(/\r?\n/).map(function (line) {
        var trimmed = line.trim();
        if (!trimmed) {
          return '<div class="report-spacer"></div>';
        }
        if (reportSectionTitle(trimmed)) {
          return '<h3 class="report-section-title">' + ui.escapeHtml(trimmed) + "</h3>";
        }
        if (trimmed.indexOf("- ") === 0) {
          return '<p class="report-bullet">' + ui.escapeHtml(trimmed.slice(2)) + "</p>";
        }
        return '<p>' + ui.escapeHtml(trimmed) + "</p>";
      }).join(""),
      "</div>",
    ].join("");
  }

  function renderReportPage(route) {
    var typeLabel = reportTypeLabel(state.report.type);
    var dateRange = state.report.dateRange || reportDateRange(state.report.type);
    var disabled = state.report.loading ? " disabled" : "";

    return [
      '<section class="page-view">',
      '<div class="page-head"><h1 class="page-title">',
      route.title,
      '</h1><span class="page-meta">',
      ui.escapeHtml(route.meta),
      "</span></div>",
      '<div class="report-layout">',
      '<form class="card report-input-card" data-report-form>',
      '<div class="files-card-head"><div><h2>这周干了啥,随便记</h2><p>复制聊天记录、待办、数据口径都可以，AI 会整理成汇报稿。</p></div></div>',
      '<div class="field"><label for="report-type">类型</label><select class="input" id="report-type" name="type" data-report-type>',
      '<option value="week"',
      state.report.type === "week" ? " selected" : "",
      ">周报</option>",
      '<option value="day"',
      state.report.type === "day" ? " selected" : "",
      ">日报</option>",
      "</select></div>",
      '<div class="field"><label for="report-text">原始记录</label><textarea class="input report-textarea" id="report-text" name="text" placeholder="例：这周剪了 12 条素材，3 条跑出 23% 完播；周三和投放复盘，发现前 3 秒冲突还不够；下周要补女频逆袭钩子。">',
      ui.escapeHtml(state.report.text),
      "</textarea></div>",
      '<div class="btn-row"><button type="button" class="btn-primary" data-action="generate-report"',
      disabled,
      ">",
      ui.icon("spark"),
      state.report.loading ? "生成中..." : "生成",
      "</button></div>",
      "</form>",
      '<section class="card report-preview-card">',
      '<div class="report-toolbar"><div><h2>',
      ui.escapeHtml(typeLabel),
      '</h2><p>',
      ui.escapeHtml(dateRange),
      '</p></div><div class="btn-row"><button type="button" class="btn-secondary" data-action="copy-report"',
      state.report.content ? "" : " disabled",
      '>复制</button><button type="button" class="btn-secondary" data-action="export-report"',
      state.report.content ? "" : " disabled",
      ">导出 .md</button></div></div>",
      '<p class="field-help">导出文件名示例: 周报_YYYYMMDD.md</p>',
      renderReportBody(),
      state.report.error ? '<div class="status-box visible error">' + ui.icon("x") + "<span>" + ui.escapeHtml(state.report.error) + "</span></div>" : "",
      "</section>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderCopyGenreOptions() {
    return COPY_GENRES.map(function (genre) {
      return [
        '<option value="',
        ui.escapeHtml(genre),
        '"',
        state.copy.genre === genre ? " selected" : "",
        ">",
        ui.escapeHtml(genre),
        "</option>",
      ].join("");
    }).join("");
  }

  function renderPlatformPills() {
    return [
      '<div class="platform-pills">',
      COPY_PLATFORMS.map(function (platform) {
        return [
          '<button type="button" class="pill',
          state.copy.platform === platform.id ? " active" : "",
          '" data-action="select-copy-platform" data-platform="',
          platform.id,
          '">',
          ui.escapeHtml(platform.label),
          "</button>",
        ].join("");
      }).join(""),
      "</div>",
    ].join("");
  }

  function renderCopyForm() {
    var disabled = state.copy.loading ? " disabled" : "";
    var showCustomGenre = state.copy.genre === "其他自定义";

    return [
      '<form class="card copy-form-card" data-copy-form>',
      '<div class="copy-form-head"><div><h2>爆款文案工厂</h2><p>按平台语感生成标题、钩子、简介和话题标签。</p></div></div>',
      '<div class="form-grid">',
      '<div class="field"><label for="copy-title">剧名</label><input class="input" id="copy-title" name="title" value="',
      ui.escapeHtml(state.copy.title),
      '" placeholder="如：离婚当天我成了集团继承人" autocomplete="off"></div>',
      '<div class="field"><label for="copy-genre">题材类型</label><select class="input" id="copy-genre" name="genre" data-copy-genre>',
      renderCopyGenreOptions(),
      "</select></div>",
      showCustomGenre ? [
        '<div class="field full"><label for="copy-custom-genre">自定义题材</label><input class="input" id="copy-custom-genre" name="customGenre" value="',
        ui.escapeHtml(state.copy.customGenre),
        '" placeholder="输入你的细分题材" autocomplete="off"></div>',
      ].join("") : "",
      '<div class="field full"><label for="copy-selling-point">剧情卖点</label><textarea class="input" id="copy-selling-point" name="sellingPoint" placeholder="写清主角身份、冲突、爽点、反转或第一集关键情节">',
      ui.escapeHtml(state.copy.sellingPoint),
      "</textarea></div>",
      '<div class="field full"><span class="field-label">投放平台</span>',
      renderPlatformPills(),
      '<p class="field-help">当前平台: ',
      ui.escapeHtml(copyPlatformLabel(state.copy.platform)),
      "</p></div>",
      '<div class="btn-row full"><button type="button" class="btn-primary" data-action="generate-copy"',
      disabled,
      ">",
      ui.icon("spark"),
      state.copy.loading ? "生成中..." : "生成文案",
      '</button><button type="button" class="btn-secondary" data-action="stop-copy"',
      state.copy.loading ? "" : " disabled",
      ">停止</button></div>",
      "</div>",
      "</form>",
    ].join("");
  }

  function renderCopyRow(group, text, index) {
    var id = group.key + "-" + index;
    var checked = state.copy.selected[id] !== false ? " checked" : "";
    var bodyClass = group.key === "tags" ? "copy-tag" : "copy-row-text";

    return [
      '<div class="copy-row" data-copy-row="',
      ui.escapeHtml(id),
      '"><label class="copy-check"><input type="checkbox" data-action="toggle-copy-select" data-copy-id="',
      ui.escapeHtml(id),
      '"',
      checked,
      "></label><span class=\"",
      bodyClass,
      "\">",
      ui.escapeHtml(text),
      '</span><button type="button" class="btn-icon" title="复制这一条" data-action="copy-one" data-copy-id="',
      ui.escapeHtml(id),
      '">',
      ui.icon("copy"),
      "</button></div>",
    ].join("");
  }

  function renderCopyGroup(group) {
    var items = state.copy.result[group.key] || [];
    var expanded = Boolean(state.copy.expanded[group.key]);
    var limit = group.key === "tags" ? items.length : 3;
    var visibleItems = expanded ? items : items.slice(0, limit);
    var hiddenCount = Math.max(0, items.length - visibleItems.length);

    return [
      '<section class="copy-group-card">',
      '<div class="copy-group-head"><h3>',
      ui.escapeHtml(group.label),
      '</h3><span>',
      items.length,
      " 条</span></div>",
      items.length ? visibleItems.map(function (text, index) {
        return renderCopyRow(group, text, index);
      }).join("") : (
        state.copy.loading
          ? '<div class="copy-row"><div class="skeleton" style="height:18px;flex:1"></div></div>'
          : '<div class="copy-empty-line">等待生成</div>'
      ),
      hiddenCount ? [
        '<button type="button" class="copy-more" data-action="toggle-copy-expanded" data-copy-group="',
        group.key,
        '">展开其余 ',
        hiddenCount,
        " 条</button>",
      ].join("") : "",
      expanded && items.length > limit ? [
        '<button type="button" class="copy-more" data-action="toggle-copy-expanded" data-copy-group="',
        group.key,
        '">收起</button>',
      ].join("") : "",
      "</section>",
    ].join("");
  }

  function renderCopyResults() {
    var selectedCount = selectedCopyRows().length;
    var totalCount = flattenCopyRows(false).length;

    return [
      '<section class="copy-results">',
      '<div class="copy-results-head"><div><h2>生成结果</h2><p>流式分组渲染，勾选后可复制或导出。</p></div><span>',
      totalCount,
      " 条</span></div>",
      '<div class="copy-results-grid">',
      COPY_GROUPS.map(renderCopyGroup).join(""),
      "</div>",
      state.copy.loading && !hasCopyOutput() ? [
        '<div class="card card-pad copy-stream-loading">',
        '<div class="skeleton" style="height:18px;width:78%"></div>',
        '<div class="skeleton" style="height:18px;width:64%"></div>',
        '<div class="skeleton" style="height:18px;width:70%"></div>',
        "</div>",
      ].join("") : "",
      state.copy.rawText && !hasCopyOutput() ? '<pre class="ideas-stream">' + ui.escapeHtml(state.copy.rawText) + "</pre>" : "",
      '<div class="copy-action-bar">',
      '<button type="button" class="btn-secondary" data-action="copy-selected"',
      selectedCount ? "" : " disabled",
      ">复制选中 ",
      selectedCount,
      ' 条</button><button type="button" class="btn-secondary" data-action="export-copy"',
      totalCount ? "" : " disabled",
      ">导出 CSV</button></div>",
      "</section>",
    ].join("");
  }

  function renderCopyPage(route) {
    hydrateCopyFromSeed();
    return [
      '<section class="page-view">',
      '<div class="page-head"><h1 class="page-title">',
      route.title,
      '</h1><span class="page-meta">',
      ui.escapeHtml(route.meta),
      "</span></div>",
      '<div class="copy-layout">',
      renderCopyForm(),
      renderCopyResults(),
      "</div>",
      "</section>",
    ].join("");
  }

  function renderStoryboardRows() {
    if (state.storyboard.loading) {
      return Array.from({ length: 5 }).map(function () {
        return [
          "<tr>",
          '<td><div class="skeleton" style="height:18px;width:42px"></div></td>',
          '<td><div class="skeleton" style="height:18px;width:48px"></div></td>',
          '<td><div class="skeleton" style="height:18px;width:210px"></div></td>',
          '<td><div class="skeleton" style="height:18px;width:160px"></div></td>',
          '<td><div class="skeleton" style="height:18px;width:38px"></div></td>',
          "</tr>",
        ].join("");
      }).join("");
    }

    return state.storyboard.list.map(function (row) {
      return [
        "<tr>",
        "<td>",
        ui.escapeHtml(row.shot),
        "</td><td>",
        ui.escapeHtml(row.scale),
        "</td><td>",
        ui.escapeHtml(row.visual),
        "</td><td>",
        ui.escapeHtml(row.audio || ""),
        "</td><td>",
        ui.escapeHtml(row.duration),
        "s</td></tr>",
      ].join("");
    }).join("");
  }

  function renderStoryboardPage(route) {
    var hasRows = state.storyboard.list.length > 0;
    return [
      '<section class="page-view">',
      '<div class="page-head"><h1 class="page-title">',
      route.title,
      '</h1><span class="page-meta">',
      ui.escapeHtml(route.meta),
      "</span></div>",
      '<div class="storyboard-layout">',
      '<form class="card storyboard-form-card" data-storyboard-form>',
      '<div class="copy-form-head"><div><h2>剧本转分镜</h2><p>粘贴剧本后生成可拍摄、可导出的镜头表。</p></div></div>',
      '<div class="field"><label for="storyboard-script">剧本文本</label><textarea class="input storyboard-script" id="storyboard-script" name="script" placeholder="粘贴包含人物、动作、台词的短剧剧本">',
      ui.escapeHtml(state.storyboard.script),
      "</textarea></div>",
      '<div class="field"><label for="storyboard-ratio">画幅</label><select class="input" id="storyboard-ratio" name="ratio" data-storyboard-ratio>',
      '<option value="竖屏 9:16"',
      state.storyboard.ratio === "竖屏 9:16" ? " selected" : "",
      ">竖屏 9:16</option>",
      '<option value="横屏 16:9"',
      state.storyboard.ratio === "横屏 16:9" ? " selected" : "",
      ">横屏 16:9</option>",
      "</select></div>",
      '<div class="btn-row"><button type="button" class="btn-primary" data-action="generate-storyboard"',
      state.storyboard.loading ? " disabled" : "",
      ">",
      ui.icon("storyboard"),
      state.storyboard.loading ? "生成中..." : "生成分镜",
      "</button></div>",
      "</form>",
      '<section class="card storyboard-table-card">',
      '<div class="storyboard-table-head"><div><h2>分镜表</h2><p>',
      hasRows ? "共 " + state.storyboard.list.length + " 个镜头" : "生成后在这里整理为表格",
      '</p></div><button type="button" class="btn-secondary" data-action="export-storyboard"',
      hasRows ? "" : " disabled",
      ">导出 CSV</button></div>",
      (hasRows || state.storyboard.loading) ? [
        '<div class="storyboard-table-wrap"><table class="storyboard-table"><thead><tr>',
        "<th>镜号</th><th>景别</th><th>画面描述</th><th>台词/音效</th><th>时长</th>",
        "</tr></thead><tbody>",
        renderStoryboardRows(),
        "</tbody></table></div>",
      ].join("") : [
        '<div class="storyboard-empty">',
        ui.icon("storyboard"),
        "<h2>还没有分镜</h2><p>输入剧本后点击生成分镜。</p>",
        "</div>",
      ].join(""),
      state.storyboard.error ? '<div class="status-box visible error">' + ui.icon("x") + "<span>" + ui.escapeHtml(state.storyboard.error) + "</span></div>" : "",
      "</section>",
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

    if (route.id === "settings") {
      pageRoot.innerHTML = renderSettingsPage(route);
    } else if (route.id === "hot") {
      pageRoot.innerHTML = renderHotPage(route);
    } else if (route.id === "copy") {
      pageRoot.innerHTML = renderCopyPage(route);
    } else if (route.id === "storyboard") {
      pageRoot.innerHTML = renderStoryboardPage(route);
    } else if (route.id === "files") {
      pageRoot.innerHTML = renderFilesPage(route);
    } else if (route.id === "report") {
      pageRoot.innerHTML = renderReportPage(route);
    } else {
      pageRoot.innerHTML = renderPlaceholder(route);
    }
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

  async function handleGenerateCopy() {
    collectCopyForm();
    if (!modelReady()) {
      return;
    }
    if (!state.copy.title || !state.copy.sellingPoint) {
      ui.showToast("先填写剧名和剧情卖点", "error", 6000);
      return;
    }

    var controller = new AbortController();
    state.copy.loading = true;
    state.copy.controller = controller;
    state.copy.rawText = "";
    state.copy.result = emptyCopyResult();
    state.copy.selected = {};
    state.copy.expanded = { titles: false, hooks: false, intros: false, tags: false };
    renderRoute();

    try {
      await api.generateCopy({
        title: state.copy.title,
        genre: copyGenreValue(),
        selling: state.copy.sellingPoint,
        platform: state.copy.platform,
      }, {
        onToken: function (token) {
          state.copy.rawText += token;
          applyCopyResult(parseCopyStream(state.copy.rawText));
          renderRoute();
        },
        onFinal: function (result) {
          applyCopyResult(result || parseCopyStream(state.copy.rawText));
          renderRoute();
        },
      }, controller.signal);
      ui.showToast("文案生成完成", "success");
    } catch (error) {
      if (error && error.name === "AbortError") {
        ui.showToast("已停止生成", "success");
      } else {
        ui.showToast((error && error.message) || "文案生成失败", "error", 6000);
      }
    } finally {
      state.copy.loading = false;
      state.copy.controller = null;
      renderRoute();
    }
  }

  function handleStopCopy() {
    if (state.copy.controller) {
      state.copy.controller.abort();
    }
  }

  async function handleCopyOne(rowId) {
    var row = copyRowById(rowId);
    if (!row) {
      ui.showToast("没有可复制的内容", "error", 4000);
      return;
    }
    await exporter.copyText(row.text);
    ui.showToast("已复制 1 条", "success");
  }

  async function handleCopySelected() {
    var rows = selectedCopyRows();
    if (!rows.length) {
      ui.showToast("先勾选要复制的内容", "error", 4000);
      return;
    }
    await exporter.copyText(rows.map(function (row) {
      return row.groupLabel + "：" + row.text;
    }).join("\n"));
    ui.showToast("已复制选中内容", "success");
  }

  function handleExportCopy() {
    var rows = flattenCopyRows(false);
    if (!rows.length) {
      ui.showToast("没有可导出的文案", "error", 4000);
      return;
    }
    var csv = exporter.buildCsv(["组别", "内容"], rows.map(function (row) {
      return [row.groupLabel, row.text];
    }));
    exporter.downloadText("drama-forge-copy-" + exporter.dateStamp(new Date()) + ".csv", csv, "text/csv;charset=utf-8");
    ui.showToast("CSV 已导出", "success");
  }

  async function handleGenerateStoryboard() {
    collectStoryboardForm();
    if (!modelReady()) {
      return;
    }
    if (!state.storyboard.script) {
      ui.showToast("先粘贴剧本文本", "error", 6000);
      return;
    }

    state.storyboard.loading = true;
    state.storyboard.error = "";
    renderRoute();

    try {
      var result = await api.generateStoryboard({
        script: state.storyboard.script,
        ratio: state.storyboard.ratio,
      });
      state.storyboard.list = Array.isArray(result.list) ? result.list : [];
      ui.showToast("分镜生成完成", "success");
    } catch (error) {
      state.storyboard.error = error.message || "分镜生成失败";
      ui.showToast(state.storyboard.error, "error", 6000);
    } finally {
      state.storyboard.loading = false;
      renderRoute();
    }
  }

  function handleExportStoryboard() {
    if (!state.storyboard.list.length) {
      ui.showToast("没有可导出的分镜", "error", 4000);
      return;
    }
    var csv = exporter.buildCsv(["镜号", "景别", "画面描述", "台词/音效", "时长"], state.storyboard.list.map(function (row) {
      return [row.shot, row.scale, row.visual, row.audio || "", row.duration];
    }));
    exporter.downloadText("drama-forge-storyboard-" + exporter.dateStamp(new Date()) + ".csv", csv, "text/csv;charset=utf-8");
    ui.showToast("CSV 已导出", "success");
  }

  async function browseFolder(pathValue) {
    state.files.picker.loading = true;
    state.files.picker.error = "";
    state.files.picker.path = pathValue || "";
    renderRoute();

    try {
      state.files.picker.data = await api.browseFiles(pathValue || "");
    } catch (error) {
      state.files.picker.error = error.message || "读取文件夹失败";
    } finally {
      state.files.picker.loading = false;
      renderRoute();
    }
  }

  async function openFolderPicker() {
    state.files.picker.open = true;
    state.files.picker.data = null;
    state.files.picker.error = "";
    await browseFolder(state.files.dir || "");
  }

  async function handlePreviewFiles() {
    collectFilesForm();
    if (!state.files.dir) {
      ui.showToast("先选择要整理的文件夹", "error", 6000);
      return;
    }

    state.files.previewLoading = true;
    state.files.error = "";
    state.files.preview = null;
    state.files.result = null;
    renderRoute();

    try {
      state.files.preview = await api.scanFiles({
        dir: state.files.dir,
        rule: state.files.rule,
        template: state.files.template,
      });
      ui.showToast("预览已生成", "success");
    } catch (error) {
      state.files.error = error.message || "扫描失败";
      ui.showToast(state.files.error, "error", 6000);
    } finally {
      state.files.previewLoading = false;
      renderRoute();
    }
  }

  async function handleExecuteFiles() {
    collectFilesForm();
    if (!state.files.preview || !state.files.preview.plan || !state.files.preview.plan.length) {
      ui.showToast("预览成功前不可执行", "error", 6000);
      return;
    }

    state.files.executing = true;
    renderRoute();

    try {
      state.files.result = await api.executeFiles({
        dir: state.files.dir,
        plan: state.files.preview.plan,
      });
      ui.showToast("整理完成: 成功 " + state.files.result.moved + " 个，失败 " + state.files.result.failed.length + " 条", state.files.result.failed.length ? "error" : "success", state.files.result.failed.length ? 6000 : 3200);
    } catch (error) {
      state.files.error = error.message || "执行整理失败";
      ui.showToast(state.files.error, "error", 6000);
    } finally {
      state.files.executing = false;
      renderRoute();
    }
  }

  async function handleUndoFiles() {
    if (!state.files.result || !state.files.result.historyId) {
      ui.showToast("没有可撤销的整理记录", "error", 4000);
      return;
    }

    state.files.undoing = true;
    renderRoute();

    try {
      var result = await api.undoFiles({ historyId: state.files.result.historyId });
      state.files.result.historyId = "";
      ui.showToast("已撤销: 还原 " + result.restored + " 个，失败 " + result.failed.length + " 条", result.failed.length ? "error" : "success", result.failed.length ? 6000 : 3200);
    } catch (error) {
      ui.showToast(error.message || "撤销失败", "error", 6000);
    } finally {
      state.files.undoing = false;
      renderRoute();
    }
  }

  async function handleGenerateReport() {
    collectReportForm();
    if (!modelReady()) {
      return;
    }
    if (!state.report.text) {
      ui.showToast("先粘贴工作记录", "error", 6000);
      return;
    }

    var controller = new AbortController();
    state.report.loading = true;
    state.report.controller = controller;
    state.report.content = "";
    state.report.error = "";
    state.report.dateRange = reportDateRange(state.report.type);
    renderRoute();

    try {
      await api.generateReport({
        text: state.report.text,
        type: state.report.type,
      }, {
        onToken: function (token) {
          state.report.content += token;
          renderRoute();
        },
        onDone: function (content, event) {
          state.report.content = content || state.report.content;
          state.report.dateRange = event && event.dateRange ? event.dateRange : state.report.dateRange;
          renderRoute();
        },
      }, controller.signal);
      ui.showToast("报告生成完成", "success");
    } catch (error) {
      state.report.error = error.message || "报告生成失败";
      ui.showToast(state.report.error, "error", 6000);
    } finally {
      state.report.loading = false;
      state.report.controller = null;
      renderRoute();
    }
  }

  async function handleCopyReport() {
    if (!state.report.content) {
      ui.showToast("没有可复制的报告", "error", 4000);
      return;
    }
    await exporter.copyText(state.report.content);
    ui.showToast("报告已复制", "success");
  }

  function handleExportReport() {
    if (!state.report.content) {
      ui.showToast("没有可导出的报告", "error", 4000);
      return;
    }
    var filename = reportFilenamePrefix(state.report.type) + "_" + exporter.dateStamp(new Date()) + ".md";
    exporter.downloadText(filename, state.report.content, "text/markdown;charset=utf-8");
    ui.showToast("Markdown 已导出", "success");
  }

  function bindEvents() {
    document.addEventListener("submit", async function (event) {
      if (event.target.matches("[data-settings-form]")) {
        event.preventDefault();
        state.config = collectSettingsForm();
        try {
          await saveState(false);
        } catch (error) {
          ui.showToast(error.message || "保存失败", "error", 6000);
        }
        return;
      }

      if (event.target.matches("[data-copy-form]")) {
        event.preventDefault();
        await handleGenerateCopy();
        return;
      }

      if (event.target.matches("[data-storyboard-form]")) {
        event.preventDefault();
        await handleGenerateStoryboard();
        return;
      }

      if (event.target.matches("[data-files-form]")) {
        event.preventDefault();
        await handlePreviewFiles();
        return;
      }

      if (event.target.matches("[data-report-form]")) {
        event.preventDefault();
        await handleGenerateReport();
      }
    });

    document.addEventListener("input", function (event) {
      if (event.target.closest("[data-copy-form]")) {
        collectCopyForm();
        return;
      }
      if (event.target.closest("[data-storyboard-form]")) {
        collectStoryboardForm();
        return;
      }
      if (event.target.matches("[data-files-dir], [data-files-template]")) {
        collectFilesForm();
        if (state.files.preview || state.files.result) {
          resetFilePreview();
          renderRoute();
        }
        return;
      }
      if (event.target.closest("[data-report-form]")) {
        collectReportForm();
      }
    });

    document.addEventListener("change", async function (event) {
      if (event.target.matches("[data-provider-select]")) {
        setProviderPreset(event.target.value);
        return;
      }

      if (event.target.matches("[data-copy-genre]")) {
        collectCopyForm();
        renderRoute();
        return;
      }

      if (event.target.matches("[data-storyboard-ratio]")) {
        collectStoryboardForm();
        return;
      }

      if (event.target.matches("[data-report-type]")) {
        collectReportForm();
        state.report.content = "";
        state.report.dateRange = reportDateRange(state.report.type);
        state.report.error = "";
        renderRoute();
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

      if (action === "select-copy-platform") {
        collectCopyForm();
        state.copy.platform = actionTarget.getAttribute("data-platform") || "douyin";
        renderRoute();
        return;
      }

      if (action === "generate-copy") {
        await handleGenerateCopy();
        return;
      }

      if (action === "stop-copy") {
        handleStopCopy();
        return;
      }

      if (action === "toggle-copy-expanded") {
        var copyGroup = actionTarget.getAttribute("data-copy-group");
        state.copy.expanded[copyGroup] = !state.copy.expanded[copyGroup];
        renderRoute();
        return;
      }

      if (action === "toggle-copy-select") {
        state.copy.selected[actionTarget.getAttribute("data-copy-id")] = Boolean(actionTarget.checked);
        renderRoute();
        return;
      }

      if (action === "copy-one") {
        try {
          await handleCopyOne(actionTarget.getAttribute("data-copy-id"));
        } catch (error) {
          ui.showToast(error.message || "复制失败", "error", 4000);
        }
        return;
      }

      if (action === "copy-selected") {
        try {
          await handleCopySelected();
        } catch (error) {
          ui.showToast(error.message || "复制失败", "error", 4000);
        }
        return;
      }

      if (action === "export-copy") {
        handleExportCopy();
        return;
      }

      if (action === "generate-storyboard") {
        await handleGenerateStoryboard();
        return;
      }

      if (action === "export-storyboard") {
        handleExportStoryboard();
        return;
      }

      if (action === "select-file-rule") {
        collectFilesForm();
        state.files.rule = actionTarget.getAttribute("data-rule") || "date";
        resetFilePreview();
        renderRoute();
        return;
      }

      if (action === "open-folder-picker") {
        collectFilesForm();
        await openFolderPicker();
        return;
      }

      if (action === "close-folder-picker") {
        state.files.picker.open = false;
        renderRoute();
        return;
      }

      if (action === "browse-folder") {
        await browseFolder(actionTarget.getAttribute("data-path") || "");
        return;
      }

      if (action === "choose-current-folder") {
        state.files.dir = state.files.picker.data && state.files.picker.data.path ? state.files.picker.data.path : state.files.picker.path;
        state.files.picker.open = false;
        resetFilePreview();
        renderRoute();
        return;
      }

      if (action === "preview-files") {
        await handlePreviewFiles();
        return;
      }

      if (action === "execute-files") {
        await handleExecuteFiles();
        return;
      }

      if (action === "undo-files") {
        await handleUndoFiles();
        return;
      }

      if (action === "generate-report") {
        await handleGenerateReport();
        return;
      }

      if (action === "copy-report") {
        try {
          await handleCopyReport();
        } catch (error) {
          ui.showToast(error.message || "复制失败", "error", 4000);
        }
        return;
      }

      if (action === "export-report") {
        handleExportReport();
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
