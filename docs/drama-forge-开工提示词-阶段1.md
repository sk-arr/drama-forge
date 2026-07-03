# drama-forge 开工提示词 · 阶段 1(骨架 + 视觉系统 + 设置页)

把本文件与《drama-forge-设计文档.md》一起发给 Codex。本阶段只做下面列出的任务,设计文档是唯一权威依据,冲突时以设计文档为准。

---

## 给 Codex 的指令

你是本项目的建造工程师。项目:drama-forge(短剧工坊),一个零依赖 Node.js 的本地 Web 应用。完整规格见随附《设计文档》,本阶段只实现「骨架、视觉系统、API 设置页」。

### 硬约束(违反即返工)

1. 代码全部放在 `D:\drama-forge`,**严禁在该目录之外(尤其桌面)创建任何文件**。
2. **零 npm 依赖**:不执行 npm install,不创建 node_modules;只用 Node ≥18 内置模块。package.json 只写 name/version/scripts(start=node server.js)。
3. server 只监听 `127.0.0.1:3900`。
4. API Key 等运行时数据只写入 `data/`;初始化 git 仓库,`.gitignore` 含 `data/`、`*.log`;首个 commit 前确认无任何真实 key。
5. 完成后输出文字报告即可,不要生成截图。

### 执行循环

按任务顺序逐个:实现 → 自检(`node --check` 全部 js 文件 + 启动冒烟)→ git commit(信息格式 `feat(p1): 任务名`)→ 下一个。卡住时停下列出 2~3 个方案等确认,不要硬试。不要做本阶段任务之外的功能(后续页面只放占位)。

### 任务清单

**T1 项目骨架。**建目录:`server.js`、`lib/`(config.js 空实现先行)、`public/`(index.html、css/app.css、js/app.js、js/api.js、js/ui.js、fonts/)、`prompts/`(空)、`start.bat`(启动 server 并 `start http://127.0.0.1:3900`)、`.gitignore`、`package.json`、`README.md`(暂时只放名字一行,阶段 6 再写)。git init + 首个 commit。

**T2 静态服务器 + API 骨架。**server.js:静态文件服务(默认 index.html,正确 MIME:html/css/js/svg/woff2/json/ico),`/api/` 前缀路由分发器(JSON body 解析、统一错误返回 `{error:"人话"}`),预留路由:`GET/POST /api/config`、`POST /api/ai/test`。自检:启动后首页 200、未知 API 返回 404 JSON。

**T3 视觉系统。**app.css 顶部集中 CSS 变量,严格采用设计文档 §3.1 的全部 token(颜色、渐变、三档阴影、圆角、字体栈、动效时长)。实现:背景光斑层(2~3 个 blur 大圆 + 9~12s 漂浮动画 + prefers-reduced-motion 降级)、公共组件类(.card、.btn-primary、.btn-secondary、.pill、.toggle、.input、.toast、.skeleton)。**质感验收基准:与用户桌面的《drama-forge-首页预览.html》同级**——该文件的 CSS 可直接参考移植。

**T4 应用外壳 + hash 路由。**侧边栏按设计文档 §3.2:logo(渐变方块火苗 SVG + 短剧工坊/drama-forge)、导航 8 项按分组(今日热点;内容生产:剧本转分镜;投放增长:爆款文案工厂;团队效率:素材批量整理、AI 周报;沉淀:提示词库、历史记录;底部:API 设置 + 连接状态胶囊)。js/app.js 实现 hash 路由(`#/hot` 默认、`#/storyboard`、`#/copy`、`#/files`、`#/report`、`#/prompts`、`#/history`、`#/settings`),切换淡入 150ms;除设置页外全部渲染统一占位卡(页名 + 「阶段 x 交付」灰字)。图标一律内联线性 SVG,禁 emoji。

**T5 配置读写。**lib/config.js:读写 `data/config.json`(目录不存在自动建),结构 `{ ai:{provider,baseUrl,model,apiKey}, demoMode:false, sources:{douyin:true,kuaishou:true,weibo:true,duanju:true,xiaohongshu:true,bilibili:true,baidu:false,toutiao:false,zhihu:false}, refreshMinutes:30 }`,提供默认值合并。`GET /api/config` 返回配置但 **apiKey 只返回掩码**(前 4 后 4);`POST /api/config` 保存(前端没改 key 时传掩码则保留原值)。

**T6 API 设置页(本阶段唯一完整页面)。**按设计文档 §4.8 实现三张卡:模型连接(预设下拉 DeepSeek/Kimi/通义/自定义,选择即自动填 baseUrl+model;key 密码框带眼睛;「测试连接」调 `POST /api/ai/test`;「保存」)、演示模式开关(开启后全局顶部琥珀细横幅 + 侧边栏胶囊变「演示模式」)、热点来源九开关 + 刷新间隔下拉。`/api/ai/test` 实现:用当前配置发一次最小 chat 请求(max_tokens=1,超时 15s),成功返回延迟 ms,失败按类型返回人话(401=key 无效 / 402 或 insufficient=余额不足 / 超时 / 网络不通)。连接状态胶囊三态:绿=已连接(最近一次测试成功)、灰=未配置、琥珀=演示模式。

**T7 冒烟与收尾。**全 js `node --check`;启动;手测清单:8 个导航可切换且高亮正确、设置页保存后重启不丢、掩码回传不覆盖真 key、测试连接对错误 key 报人话、演示模式横幅出现/消失。整理 commit 历史,输出完成报告(做了什么/怎么验的/遗留问题)。

### 阶段验收(用户执行)

用户 `node server.js`(或双击 start.bat)后检查:视觉与桌面预览 html 同级、导航齐全、设置页三卡可用、真实 DeepSeek key 测试连接成功、重启配置保留。通过后进入阶段 2(今日热点)。
