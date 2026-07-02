(function () {
  "use strict";

  var ui = window.DramaForgeUi;
  var appRoot = document.getElementById("app");

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

  function getTodayMeta() {
    var formatter = new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
    });
    return formatter.format(new Date()) + " · 后续阶段接入热榜";
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

  function renderSettingsPlaceholder(route) {
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
      '<h2 class="placeholder-title">设置页即将接入</h2>',
      '<p class="placeholder-text">阶段 1 的 T6 会完成模型连接、演示模式和热点来源开关；当前先完成路由入口。</p>',
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

    pageRoot.innerHTML = route.id === "settings" ? renderSettingsPlaceholder(route) : renderPlaceholder(route);
  }

  function boot() {
    if (!appRoot || !ui) {
      return;
    }

    renderShell();
    window.addEventListener("hashchange", renderRoute);
    if (!window.location.hash) {
      window.location.hash = "#/hot";
      return;
    }
    renderRoute();
  }

  window.DramaForgeRoutes = pageRoutes();
  boot();
})();
