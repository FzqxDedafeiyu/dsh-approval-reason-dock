# 交付与维护手册（dsh-approval-reason-dock）

> 版本：0.2.0 · 归档日期：2026-11-12 · 维护者：主人 / DSH 智能体
> 这份文档记录**做了什么、放在哪、怎么改、怎么发、出问题怎么查**，供以后维护直接查阅。

## 一、项目概览

| 项 | 内容 |
|---|---|
| 名称 | `dsh-approval-reason-dock` |
| 定位 | DeepSeek Harness Web 客户端的**新增层**插件：审批卡出现时提供可选的「说明」——拒绝时是理由、允许时是附言；说明先作为 steering 用户消息进入当前对话，再把审批答成 `rejected` / `allowed-once`；允许前还有一次面板内二次确认 |
| 边界 | **不替换**内置审批卡、**不改**审批协议/审计事件、不动 `app.asar`；插件只负责送说明、**不改变授权范围**；渲染失败时静默隐藏，内置卡照常工作（fail-soft） |
| 技术栈 | 纯 JavaScript（无构建链）· `shell.overlay` 槽 · React · `--dsw-*` 主题 token · zh/en locale |
| 兼容 | `engines.dsh: >=0.2.2-rc.1 <0.3.0`；**版本匹配**：DSH `0.2.1-rc.2` ↔ 插件 `0.1.0`（已验证稳定），DSH `0.2.2-rc.1` ↔ 插件 `0.1.1` / `0.1.2`（已验证），DSH `0.2.2` 线 ↔ 插件 `0.2.0`（允许并说明 + 允许二次确认） |

### 为什么要做

Harness 审批结果只有封闭枚举（`allowed-once / rejected / cancelled / unavailable`），拒绝时没有理由通道；模型只能收到「the user rejected tool X」。允许时同样没地方带交代（「只改 docs/ 下的文件」「先 --dry-run 试一遍」），而放行本身会立即执行、更需要一次确认。本插件在 UI 层补一个说明输入：用 `remote.session.prompt` 把说明以 `mode: "steer"` 送进当前轮（不可用时降级 `queue`），说明送达后才回答审批（`rejected` / `allowed-once`）；允许前先进入面板内二次确认（风险说明 + 部分同意提示），说明投递失败则阻塞本次决定。

## 二、产物与链接

| 产物 | 位置 |
|---|---|
| GitHub 仓库 | https://github.com/FzqxDedafeiyu/dsh-approval-reason-dock （公开，MIT） |
| npm 包 | https://www.npmjs.com/package/dsh-approval-reason-dock （`0.2.0`，dist-tag `latest`） |
| GitHub Release | https://github.com/FzqxDedafeiyu/dsh-approval-reason-dock/releases/tag/v0.2.0 |
| 仓库工作副本 | `<repo working copy>` |
| 本机已安装插件 | `$DSH_HOME/plugins/<plugin-dir>`（profile 通过 bundle 机制引用） |
| 本机旧版备份 | `<plugin-dir>.bak-<timestamp>`（旧 DOM 实现） |
| 分析与原型产物 | `<analysis dir>`（app.asar 解析脚本、原型、截图等） |
| 预览图 | 仓库 `docs/preview.png`（英文，默认/npm 用）+ `docs/preview-zh.png`（中文），源文件 `preview.html` / `preview-zh.html`；0.2.0 起两张图同时展示「非空草稿态按钮」与「允许二次确认视图」 |

## 三、仓库结构

```
package.json            # 官方 bundle 清单：dsh.bundle.patch / dsh.client / engines / exports / files
cordis.patch.yml        # 插入 Loader 行：id=approval-reason-dock, name=dsh-approval-reason-dock
index.js                # 宿主半：export function apply() {}（空实现，只为能被 Loader 挂载）
client.js               # 浏览器半：window.__ModuleLoader__.load({id, factory}) 单文件 bundle
locale/en.json          # 插件页展示元数据 meta.title / meta.description（英文）
locale/zh.json          # 同上（中文）
icon.svg                # 原创图标（<256 KiB，包内路径）
README.md / README.zh.md# 双语说明（含 badges、预览、安装、兼容性）
CHANGELOG.md            # Keep a Changelog 格式
LICENSE                 # MIT
docs/preview.html/.png        # 英文 README 预览图（默认，npm 页用）
docs/preview-zh.html/.png     # 中文 README 预览图
test/harness.mjs        # 沙箱测试（manifest/打包/逻辑/SSR 渲染/槽注册）
.github/workflows/ci.yml       # Node 20/22/24 跑 npm ci + npm test + npm pack --dry-run
.github/workflows/release.yml  # tag 触发；有 NPM_TOKEN 时 npm publish，否则跳过并说明
```

## 四、技术实现要点

### 客户端（client.js）

| 点 | 说明 |
|---|---|
| 注册 | `ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name:"shell.overlay", id:"approval-reason-dock", order:20, locale:NS, inject:()=>({ remote: ctx.remote, uiSession: ctx.uiSession }) }, ApprovalReasonDock))` |
| 当前会话 | `ctx.uiSession.current` 是 binding source：`getSnapshot().key` 即主视图正在显示的会话 id。0.2.1 与 0.2.2 的 `publishMain`/`watchMainRetention` 逐字节一致，切换会话可靠更新（已真机验证） |
| 状态 | 窄订阅：`useSessionStatus((map) => map.get(currentSessionId))`，再用 `approvalFromStatus()` 取 `kind==="approval" && answerable!==false` 的交互；其他会话的状态变化不会重渲染面板 |
| 会话名 | `useSessions((s) => sessionTitleOf(s, approval.sessionId))`，显式标题避免多会话认错 |
| 作答 | `answerApproval(target, remote, prefix, reason, outcome)`：`reason !== ""` 时先 `await deliverReason(...)`，失败直接返回 `{answered:false, delivery}`、**不 answer**（阻塞策略）；成功才 `await target.pending.answer(outcome)`（与内置卡同一对象）。`rejectApproval` = outcome `rejected` 包装（旧 harness 断言继续可用），`allowApproval` = outcome `allowed-once` 包装；**顺序硬要求：prompt 先于 answer** |
| 投递通道 | 拒绝与允许共用 `deliverReason`：`remote.session.prompt({requestId, sessionId, content:[{type:"text", text: prefix+reason}], mode:"steer", clientTimeZone})`；当前轮不再接受 steering 时自动降级 `mode:"queue"`；两种都失败才视为 `failed`（阻塞） |
| 说明前缀 | `deliverReason(remote, sessionId, prefix, reason)` 已 parameterize：允许用 `allowPrefix`（zh `（审批同意说明）` / en `(approval allow note) `），拒绝用 `reasonPrefix`（zh `（审批拒绝理由）` / en `(approval rejection reason) `，英文尾随空格保留）；`MAX_REASON_CHARS = 500`，`normalizeReason` 空白折叠 + trim + 截断 |
| 视图状态机 | 0.2.0 起 `view: "input" \| "confirm-allow"` + `submittingRef`（同步防重）：点允许只 `setView("confirm-allow")`（**不发 prompt、不 answer、不清草稿**）；确认视图含 `confirmTitle` / `confirmBody` / `partialAgreementHint`（warn 色）/ 非空草稿时 `confirmNote` 预览 / `confirmAllow`（warn 底深字）+ `cancel`（ghost）；取消回 input 且保留草稿，重复点击只提交一次 |
| 按钮文案 | 随草稿切换：空输入 `allowPlain` / `rejectPlain`（原生、不发消息）；非空 `allowWithNote` / `rejectWithNote`；旧键 `send` / `plain` 已删除 |
| 失败阻塞 | 说明投递 `mode === "failed"` → 不 answer、回 input 视图、保留草稿、`notice = deliveryFailed(error)`；审批已被别处处理（answered false 且无 failed delivery）→ `notice=null` 并清草稿 |
| 键盘 | input 视图：textarea `Enter`（无 Shift）= 拒绝并说明（安全方向）；confirm 视图：`globalThis.addEventListener` 捕获 `Escape` = 取消（preventDefault），`Enter` = preventDefault 且不动作；view 变化时清理监听，存在性守卫 |
| 草稿 | `draftsByKey: Map<approvalKey, text>`：多会话/多审批切换保留各自文本；作答成功后清草稿 + `rememberDraft("")` 并收起浮层 |
| 文案 | `ctx.locale.register("approval-reason-dock", { zh, en })` + 槽 `locale: NS` 提供的 `t` 席位 |
| 样式 | 全部 inline style + `var(--dsw-* , fallback)` 主题 token；`position:fixed; right:24px; top:112px; width:344px`（右上角，避开内置审批卡与标题按钮）；不写 `document.body`、不依赖 primitives |
| 生命周期 | 全部注册在 `ctx.effect` 内并返回清理；React 组件内状态随卸载清理 |
| 测试钩子 | `exports.__internals` 暴露纯逻辑（normalizeReason / errorText / deliverReason / firstApproval / approvalFromStatus / rejectApproval / answerApproval / allowApproval / sessionTitleOf / recallDraft / rememberDraft）供 harness 使用 |

### 依赖的 DSH 内部接口（升级风险点）

- `shell.overlay` 槽（由 `@deepseek-ai/dsh-client-ui-layout` 提供，`kind:"list"` / `scope:"root"`）
- `uiSession` 的 `sessionStatus`（`useSessionStatus` 槽 props）与 `uiSession.current`（binding source）
- `PendingApproval.answer()`（审批交互对象的公开方法）
- `remote.session.prompt`（客户端 Remote 方法）
- `ctx.locale.register` / 槽 `locale` 席位

**客户端 inject 两条硬规则**（0.1.1 踩坑后确认）：

1. `package.json` 的 `dsh.client.inject` 是**客户端包名**（激活顺序），只放 `@deepseek-ai/dsh-client-*`；不要放 `dsh-api-*`（宿主 API 包）。
2. 客户端模块的 `exports.inject` 是**服务名/点号路径**：访问 `ctx.remote.session` 必须同时声明 `"remote"` 和 `"remote.session"`；访问 `ctx.uiSession` 必须声明 `"uiSession"`。缺声明会在槽 inject 回调里抛 `cannot get property ... without inject`，面板静默不出现。

**两条独立故障链（别混为一谈）**：

- **A. boot fatal**：`dsh.client.inject` 混入 `dsh-api-*` 宿主 API 包 → 客户端激活图异常 → DSH 0.2.2 web boot 被判 fatal（`N entries did not activate`，窗口「无法使用」）。2026-11-09 早间的多次崩溃即此。
- **B. 面板不渲染**：`exports.inject` 缺服务名/点号路径（`uiSession`、`remote.session`）→ 槽 inject 回调抛错 → 只有该 slot entry 死亡，窗口正常但浮层永不出现。2026-11-09 22:47 的 probe 调试即此。

**`immediately: true` 为什么保留**：已在 DSH 0.2.2 真机验证；前置客户端包已显式列在 `dsh.client.inject`，且 `apply()` 对 `slots` 缺失做了守卫，激活顺序不会把 UI 卡死。

**`engines.dsh` 下限为什么是 0.2.2**：0.1.1 依赖客户端 `uiSession` 服务注入，该服务在 0.2.1 的 client runner 中**未验证存在**；因此 0.2.1 用户应显式安装 `dsh-approval-reason-dock@0.1.0`。

**升级冒烟**：DSH 升级后触发一次真实审批，确认浮层出现、说明能送达（允许/拒绝都测）、允许二次确认可取消、内置卡仍可正常允许/拒绝；若内部接口变更，面板应静默不出现而不是报错。

## 五、本地开发与测试

```powershell
# 工作副本
cd <repo working copy>

# 安装测试依赖（react / react-dom / react-test-renderer 仅测试用）
npm install

# 跑沙箱测试（不接触运行中的 DSH）
npm test                 # = node test/harness.mjs，当前 213/213

# 校验发布文件清单
npm run pack:check       # = npm pack --dry-run
```

- 0.2.0 起组件交互测试渲染用 `react-test-renderer@^18.3.1`（devDependency）；安装时如遇 `EPERM`，把 npm 缓存指到工作区临时目录：`cmd /c npm.cmd install --save-dev react-test-renderer@^18.3.1 --cache <workspace-temp>\npm-cache --no-audit --no-fund`。

- 本机 `git` 是 **MinGit 便携版**：`%LOCALAPPDATA%\Microsoft\WinGet\Packages\Git.MinGit\cmd\git.exe`（未永久加入已运行进程的 PATH，命令里可临时前置）。
- 本机 npm：`npm.cmd`（PowerShell 直接 `npm` 可能被执行策略拦 `npm.ps1`，用 `npm.cmd` 或 `cmd /c`）。
- **改 `client.js` 后必须重启 DSH**：宿主会缓存已发布的 bundle body，刷新页面不够。
- 测试环境里 pwsh 在 `workspace-write` 权限下会报 `ACL temp root must be outside the workspace`；发布/推送命令需用一次性 `danger-full-access` 审批执行。

## 六、发布流程

### 6.1 npm（当前 2FA 政策下的正确姿势：staged publishing）

npm 账号（`<npm-user>`）开了 2FA，**直接 `npm publish` 会被 403 拦**（需要 bypass-2FA token，该能力正在被废弃）。官方推荐流程：

```powershell
cd <repo working copy>
npm.cmd stage publish --access public        # 暂存，2FA 延后
npm.cmd stage list                            # 拿 stage id；等状态从 validating → staged
npm.cmd stage approve <stage-id>              # 触发网页 2FA（安全密钥）；或 --otp=<6位码>
```

- 本机 `.npmrc` 里应配置一个 **stage-only granular token**（`//registry.npmjs.org/:_authToken=...`，权限 `Read and write (stage only)`）。
- `stage approve` 若在非交互 shell 里报 `EOTP` 并打印 `https://www.npmjs.com/auth/cli/***`：需要保持 CLI 存活并在浏览器完成认证；本机曾用「伪造 TTY」（`--require fake-tty.cjs` 设 `process.stdin.isTTY=true`）让 npm 走 web-2FA 轮询，把真实 URL 交给主人在浏览器用安全密钥确认。
- 之后 `npm.cmd view dsh-approval-reason-dock version` 应返回当前发布版本（0.2.0），`dist-tags` 的 `latest` 指向新版本。

### 6.2 GitHub / Release

```powershell
$git = '%LOCALAPPDATA%\Microsoft\WinGet\Packages\Git.MinGit\cmd\git.exe'
& $git -C <repo working copy> status
& $git -C <repo working copy> add -A
& $git -C <repo working copy> commit -m "feat: ..."
& $git -C <repo working copy> push origin main
& $git -C <repo working copy> tag -f v0.2.0 <sha>
& $git -C <repo working copy> push -f origin refs/tags/v0.2.0
```

- Release 用 GitHub API 维护（`github_api` 工具）：`POST /releases`（草稿）→ 校验后 `PATCH /releases/{id}` `{draft:false}` 发布；改 tag 后若 Release 变回 draft，重新 PATCH 一次即可。
- 仓库直连 `git push` 曾因网络中断失败；可用 GitHub Contents/Git Data API 兜底提交。
- `release.yml` 在 tag push 时自动发布 npm（前提：仓库 secret 配了 `NPM_TOKEN`）。当前未配置，所以 tag 触发的 Release workflow 会跳过 npm 并打印说明。

### 6.3 发布后检查清单

- [ ] `npm view <包> version` = 新版本；`dist-tags.latest` 正确
- [ ] `npm stage list` 无残留
- [ ] GitHub Release 非草稿、tag 指向最新提交
- [ ] CI 绿
- [ ] 本机真机冒烟（审批浮层 → 说明送达 → 允许二次确认/取消 → 允许/拒绝仍正常 → 投递失败阻塞）
- [ ] 预览图两张为 0.2.0 新状态（输入态 + 确认视图）且已重新渲染
- [ ] CHANGELOG 已写

## 七、本机安装 / 升级 / 回退

### 安装位置与引用关系

- 插件源码：`$DSH_HOME/plugins/<plugin-dir>`
- profile 依赖：`$DSH_HOME/profiles/<profile>\package.json`
  - `dependencies` 里 `"dsh-approval-reason-dock": "link:<DSH_HOME>/plugins/<plugin-dir>"`
  - `dsh.profile.bundles` 末尾包含 `"dsh-approval-reason-dock"`
- node_modules：`$DSH_HOME/profiles/<profile>\node_modules\dsh-approval-reason-dock` → 指向插件目录（symlink）
- Loader 行：由插件自带 `cordis.patch.yml` 插入；**不要**再在 `profiles/desktop/cordis.patch.yml` 里手工插同一行（会重复 id）

### 升级本机已装版本

1. 改完仓库文件、跑完 `npm test`；
2. 把运行时文件复制到 `$DSH_HOME/plugins/<plugin-dir>`（index.js / client.js / cordis.patch.yml / package.json / locale / icon）；
3. 重启 DSH；
4. 触发一次审批冒烟。

### 回退

- 删掉 `profiles/desktop/package.json` 里 `dsh.profile.bundles` 的 `dsh-approval-reason-dock`（以及依赖/symlink）→ 重启 DSH，即完全恢复内置审批卡；
- 或整体恢复旧版目录备份 `dsh-approval-reason-dock.bak-20261108-224113`；
- 配置改动前后可跑 `node $DSH_HOME/im/tools\dsh-guard.mjs snapshot/check`，出问题 `rollback --latest --go`。

## 八、排障手册

| 症状 | 可能原因 | 处理 |
|---|---|---|
| 审批时右上角没有浮层 | 插件未加载 / 槽注册失败 / DSH 未重启 / `shell.overlay` 变更 | 先开 DevTools Console（Ctrl+Shift+I）看红色报错；`plugin_manager list_plugins` 查宿主行是否 `fiberPhase:active`；再重启 DSH |
| Console: `cannot get property "X" without inject` / `slot entry crashed in 'shell.overlay'` | `exports.inject` 少了服务名或点号路径（如 `remote.session`、`uiSession`） | 补进 `exports.inject`；改了结构性代码后**完整重启 DSH** |
| 浮层看得见但点不动/输不进（僵死） | HMR 残留旧模块：新旧两个 overlay entry 并存，旧 entry 崩溃留下僵死 DOM | 完整重启 DSH（不要只刷新页面） |
| 多会话切换后草稿被清空 | 0.1.1 之前草稿是单一状态 | 0.1.1 起按审批 key 保存（`draftsByKey`），切会话不再互相清空 |
| 窄窗口浮层遮住右上角按钮 | 面板位置过高 | 0.1.1 起 `top:112px`、宽 344px；仍不适配可再调 `surface`/`pillStyle` |
| 浮层出现但点「拒绝并说明」后理由没送达 | `remote.session` 服务未注入 / `prompt` 参数错误 / turn 已结束 | 确认 `client.js` 的 `exports.inject` 含 `remote.session`；失败时会自动降级 queue；查看 `console.error("[approval-reason-dock] ...")` |
| 点「允许」后确认视图出不来 / 「确认允许」点了没反应（确认视图卡住） | HMR 残留旧模块（0.1.x 旧 bundle 与 0.2.0 混跑）或组件视图状态异常 | 完整重启 DSH（不要只刷新）；DevTools Console 看 `slot entry crashed`；确认本机插件已更新到 0.2.0（`client.js` 含 `confirm-allow` 视图状态机） |
| 点了「允许并说明 / 确认允许」后审批一直挂着，面板报「说明发送失败」 | 说明投递失败（steer 与 queue 都失败）→ 0.2.0 阻塞策略：**不回答审批**、保留面板与草稿 | 看错误提示码与 `console.error("[approval-reason-dock] ...")`；确认 `exports.inject` 含 `remote.session`；重试发送，或清空说明后点「允许一次」（空输入不投递消息、走原生放行） |
| npm publish 403「Two-factor authentication…required」 | 用了普通 token 直接发布 | 改走 `npm stage publish` + `stage approve`（见 §6.1） |
| `npm stage approve` 报 EOTP 且 URL 显示 `***` | 非交互 shell | 用 `--require fake-tty.cjs` 伪装 TTY 让 npm 走 web-2FA；或保持 CLI 存活，把 auth URL 给主人浏览器确认 |
| `npm stage publish` E401 token invalid | token 被删/过期 | 重新生成 stage-only token 并 `npm config set` |
| PowerShell 执行 `npm` 报 `npm.ps1 禁止运行脚本` | 执行策略 | 用 `npm.cmd` 或在 CMD 里跑 |
| `git push` 连不上 github.com | 本机网络/代理 | 重试；或走 GitHub API 提交 |
| pwsh 报 `ACL temp root must be outside the workspace` | 会话处于 `workspace-write` | 用一次性 `sandbox_permissions: danger-full-access` 执行命令，或让主人切完全访问 |
| 改了 client.js 但页面没变 | 宿主缓存 bundle | 重启 DSH（刷新页面不够） |

## 九、账号与密钥

- npm 账号：`<npm-user>`（发布者）
- 本机用户级 `.npmrc` 保存 **stage-only granular token**；不要提交、不要外发
- 曾有一个发布 token 在聊天中出现过（已失效）；如仍有残留，去 npm → Access Tokens 检查
- GitHub：`gh` CLI 已登录 `FzqxDedafeiyu`（token scopes：repo/workflow/gist）；仓库 secret `NPM_TOKEN` **尚未配置**
- 建议后续：给仓库配 `NPM_TOKEN`（stage 或 publish 权限）以启用 Actions 自动发版；长期可迁 npm Trusted Publishing

## 十、变更记录

| 日期 | 版本/事件 | 说明 |
|---|---|---|
| 2026-11-08 | 原型 | 手写 DOM 浮层（dock）验证流程，harness 39/39 |
| 2026-11-08 | 0.0.1 本地 | 安装到 profile（手工 patch 行），真机验证通过 |
| 2026-11-08 | 迁移 | 改为官方 bundle 机制（dsh.profile.bundles），修复 `remote.session` 注入 bug |
| 2026-11-08 | 仓库化 | 重写为 `shell.overlay` + React + 主题 token + zh/en locale；harness 81/81 |
| 2026-11-09 | 0.1.0 | GitHub 仓库 + CI + Release；npm 发布（staged publish + 网页 2FA approve） |
| 2026-11-09 | 0.1.1 | 会话跟随（`uiSession.current`）、会话名、右上角位置、折叠/立即收起、按审批保存草稿、客户端激活修复（inject 服务名）、窄订阅；harness 104/104，DSH 0.2.2 真机多会话验证通过 |
| 2026-11-10 | 0.1.2 | docs/市场素材同步版（无运行时代码变更）：tag 与 main 对齐、收录徽章、0.2.1 显式回退安装命令、中英文预览图与 screenshots.json 进入 tag；probe/scripts 移出发布分支 |
| 2026-11-12 | 0.2.0 | 允许并说明（outcome `allowed-once`，前缀 `（审批同意说明）`，prompt 先于 answer）、允许前二次确认视图（风险说明 / 部分同意提示 / 取消 / Esc / Enter 不直接放行 / 防重复）、按钮文案随草稿切换、说明投递失败阻塞本次决定、说明上限 500；harness 213/213，DSH 0.2.2 真机验证由 Lead 执行；README / CHANGELOG / locale / MAINTENANCE / ALLOW-WITH-NOTE / 预览图同步 |

## 十一、参考

- DSH 官方插件开发规范（内置 skill）：`cordis-plugin-development`（bundle 清单、展示元数据、客户端模块格式、`shell.overlay` 用法、UI 实践）
- DSH 包清单类型：`@deepseek-ai/dsh-package-manifest`
- 客户端模块系统：`@deepseek-ai/dsh-client-modules`
- 插件市场索引格式：`@deepseek-ai/dsh-plugin-market-index`（若要上架发现页，需 format 1 索引）

