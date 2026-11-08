# 交付与维护手册（dsh-approval-reason-dock）

> 版本：0.1.0 · 归档日期：2026-11-09 · 维护者：主人 / DSH 智能体
> 这份文档记录**做了什么、放在哪、怎么改、怎么发、出问题怎么查**，供以后维护直接查阅。

## 一、项目概览

| 项 | 内容 |
|---|---|
| 名称 | `dsh-approval-reason-dock` |
| 定位 | DeepSeek Harness Web 客户端的**新增层**插件：审批卡出现时提供可选的「拒绝理由」，理由先作为 steering 用户消息进入当前对话，再提交 `rejected` |
| 边界 | **不替换**内置审批卡、**不改**审批协议/审计事件、不动 `app.asar`；渲染失败时静默隐藏，内置卡照常工作（fail-soft） |
| 技术栈 | 纯 JavaScript（无构建链）· `shell.overlay` 槽 · React · `--dsw-*` 主题 token · zh/en locale |
| 兼容 | `engines.dsh: >=0.2.1-rc.2 <0.3.0`（开发/验证于 DSH 0.2.1-rc.2） |

### 为什么要做

Harness 审批结果只有封闭枚举（`allowed-once / rejected / cancelled / unavailable`），拒绝时没有理由通道；模型只能收到「the user rejected tool X」。本插件在 UI 层补一个理由输入，用 `remote.session.prompt` 把理由以 `mode: "steer"` 送进当前轮（不可用时降级 `queue`），再回答 `rejected`。

## 二、产物与链接

| 产物 | 位置 |
|---|---|
| GitHub 仓库 | https://github.com/FzqxDedafeiyu/dsh-approval-reason-dock （公开，MIT） |
| npm 包 | https://www.npmjs.com/package/dsh-approval-reason-dock （`0.1.0`，dist-tag `latest`） |
| GitHub Release | https://github.com/FzqxDedafeiyu/dsh-approval-reason-dock/releases/tag/v0.1.0 |
| 仓库工作副本 | `D:\日常\projects\dsh-approval-reason-dock` |
| 本机已安装插件 | `D:\DSH\plugins\dsh-approval-reason-dock`（profile 通过 bundle 机制引用） |
| 本机旧版备份 | `D:\DSH\plugins\dsh-approval-reason-dock.bak-20261108-224113`（旧 DOM 实现） |
| 分析与原型产物 | `D:\日常\approval-analysis`（app.asar 解析脚本、原型、截图等） |
| 预览图 | 仓库 `docs/preview.png` |

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
docs/preview.html/.png  # README 预览图的源文件与渲染结果
test/harness.mjs        # 沙箱测试（manifest/打包/逻辑/SSR 渲染/槽注册）
.github/workflows/ci.yml       # Node 20/22/24 跑 npm ci + npm test + npm pack --dry-run
.github/workflows/release.yml  # tag 触发；有 NPM_TOKEN 时 npm publish，否则跳过并说明
```

## 四、技术实现要点

### 客户端（client.js）

| 点 | 说明 |
|---|---|
| 注册 | `ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name:"shell.overlay", id:"approval-reason-dock", order:20, locale:NS, inject:()=>({remote:ctx.remote}) }, ApprovalReasonDock))` |
| 状态 | 通过槽标准 props 的 `useSessionStatus((s)=>s)` 读取会话状态 Map，`firstApproval()` 找第一个 `kind==="approval" && answerable!==false` 的交互 |
| 作答 | `pending.answer("rejected")`（内置卡同一对象） |
| 理由投递 | `remote.session.prompt({requestId, sessionId, content:[{type:"text", text: prefix+reason}], mode:"steer", clientTimeZone})`；失败自动重试 `mode:"queue"` |
| 文案 | `ctx.locale.register("approval-reason-dock", { zh, en })` + 槽 `locale: NS` 提供的 `t` 席位 |
| 样式 | 全部 inline style + `var(--dsw-* , fallback)` 主题 token；不写 `document.body`、不依赖 primitives |
| 生命周期 | 全部注册在 `ctx.effect` 内并返回清理；React 组件内状态随卸载清理 |
| 测试钩子 | `exports.__internals` 暴露纯逻辑（normalizeReason / errorText / deliverReason / firstApproval / rejectApproval）供 harness 使用 |

### 依赖的 DSH 内部接口（升级风险点）

- `shell.overlay` 槽（由 `@deepseek-ai/dsh-client-ui-layout` 提供）
- `uiSession` 的 `sessionStatus`（`useSessionStatus` 槽 props）
- `PendingApproval.answer()`（审批交互对象的公开方法）
- `remote.session.prompt`（客户端 Remote 方法；**必须 inject `remote.session`**，只 inject `remote` 会调用失败——这是 0.1.0 修复过的 bug）
- `ctx.locale.register` / 槽 `locale` 席位

**升级冒烟**：DSH 升级后触发一次真实审批，确认浮层出现、理由能送达、内置卡仍可正常允许/拒绝；若内部接口变更，面板应静默不出现而不是报错。

## 五、本地开发与测试

```powershell
# 工作副本
cd D:\日常\projects\dsh-approval-reason-dock

# 安装测试依赖（react / react-dom 仅测试用）
npm install

# 跑沙箱测试（不接触运行中的 DSH）
npm test                 # = node test/harness.mjs，当前 81/81

# 校验发布文件清单
npm run pack:check       # = npm pack --dry-run
```

- 本机 `git` 是 **MinGit 便携版**：`C:\Users\Administrator\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe`（未永久加入已运行进程的 PATH，命令里可临时前置）。
- 本机 npm：`D:\Tools\npm-global\npm.cmd`（PowerShell 直接 `npm` 可能被执行策略拦 `npm.ps1`，用 `npm.cmd` 或 `cmd /c`）。
- **改 `client.js` 后必须重启 DSH**：宿主会缓存已发布的 bundle body，刷新页面不够。
- 测试环境里 pwsh 在 `workspace-write` 权限下会报 `ACL temp root must be outside the workspace`；发布/推送命令需用一次性 `danger-full-access` 审批执行。

## 六、发布流程

### 6.1 npm（当前 2FA 政策下的正确姿势：staged publishing）

npm 账号（`b53010260`）开了 2FA，**直接 `npm publish` 会被 403 拦**（需要 bypass-2FA token，该能力正在被废弃）。官方推荐流程：

```powershell
cd D:\日常\projects\dsh-approval-reason-dock
npm.cmd stage publish --access public        # 暂存，2FA 延后
npm.cmd stage list                            # 拿 stage id；等状态从 validating → staged
npm.cmd stage approve <stage-id>              # 触发网页 2FA（安全密钥）；或 --otp=<6位码>
```

- 本机 `.npmrc` 里应配置一个 **stage-only granular token**（`//registry.npmjs.org/:_authToken=...`，权限 `Read and write (stage only)`）。
- `stage approve` 若在非交互 shell 里报 `EOTP` 并打印 `https://www.npmjs.com/auth/cli/***`：需要保持 CLI 存活并在浏览器完成认证；本机曾用「伪造 TTY」（`--require fake-tty.cjs` 设 `process.stdin.isTTY=true`）让 npm 走 web-2FA 轮询，把真实 URL 交给主人在浏览器用安全密钥确认。
- 之后 `npm.cmd view dsh-approval-reason-dock version` 应返回 `0.1.0`，`dist-tags` 的 `latest` 指向新版本。

### 6.2 GitHub / Release

```powershell
$git = 'C:\Users\Administrator\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe'
& $git -C D:\日常\projects\dsh-approval-reason-dock status
& $git -C D:\日常\projects\dsh-approval-reason-dock add -A
& $git -C D:\日常\projects\dsh-approval-reason-dock commit -m "feat: ..."
& $git -C D:\日常\projects\dsh-approval-reason-dock push origin main
& $git -C D:\日常\projects\dsh-approval-reason-dock tag -f v0.1.x <sha>
& $git -C D:\日常\projects\dsh-approval-reason-dock push -f origin refs/tags/v0.1.x
```

- Release 用 GitHub API 维护（`github_api` 工具）：`POST /releases`（草稿）→ 校验后 `PATCH /releases/{id}` `{draft:false}` 发布；改 tag 后若 Release 变回 draft，重新 PATCH 一次即可。
- 仓库直连 `git push` 曾因网络中断失败；可用 GitHub Contents/Git Data API 兜底提交。
- `release.yml` 在 tag push 时自动发布 npm（前提：仓库 secret 配了 `NPM_TOKEN`）。当前未配置，所以 tag 触发的 Release workflow 会跳过 npm 并打印说明。

### 6.3 发布后检查清单

- [ ] `npm view <包> version` = 新版本；`dist-tags.latest` 正确
- [ ] `npm stage list` 无残留
- [ ] GitHub Release 非草稿、tag 指向最新提交
- [ ] CI 绿
- [ ] 本机真机冒烟（审批浮层 → 理由送达 → 允许/拒绝仍正常）
- [ ] CHANGELOG 已写

## 七、本机安装 / 升级 / 回退

### 安装位置与引用关系

- 插件源码：`D:\DSH\plugins\dsh-approval-reason-dock`
- profile 依赖：`D:\DSH\profiles\desktop\package.json`
  - `dependencies` 里 `"dsh-approval-reason-dock": "link:C:/Users/Administrator/.dsh/plugins/dsh-approval-reason-dock"`
  - `dsh.profile.bundles` 末尾包含 `"dsh-approval-reason-dock"`
- node_modules：`D:\DSH\profiles\desktop\node_modules\dsh-approval-reason-dock` → 指向插件目录（symlink）
- Loader 行：由插件自带 `cordis.patch.yml` 插入；**不要**再在 `profiles/desktop/cordis.patch.yml` 里手工插同一行（会重复 id）

### 升级本机已装版本

1. 改完仓库文件、跑完 `npm test`；
2. 把运行时文件复制到 `D:\DSH\plugins\dsh-approval-reason-dock`（index.js / client.js / cordis.patch.yml / package.json / locale / icon）；
3. 重启 DSH；
4. 触发一次审批冒烟。

### 回退

- 删掉 `profiles/desktop/package.json` 里 `dsh.profile.bundles` 的 `dsh-approval-reason-dock`（以及依赖/symlink）→ 重启 DSH，即完全恢复内置审批卡；
- 或整体恢复旧版目录备份 `dsh-approval-reason-dock.bak-20261108-224113`；
- 配置改动前后可跑 `node D:\DSH\im\tools\dsh-guard.mjs snapshot/check`，出问题 `rollback --latest --go`。

## 八、排障手册

| 症状 | 可能原因 | 处理 |
|---|---|---|
| 审批时右下角没有浮层 | 插件未加载 / 槽注册失败 / DSH 未重启 / `shell.overlay` 变更 | 看 DSH 插件列表是否有该插件；重启 DSH；若 DSH 升级导致接口变更，面板应静默隐藏，需更新插件 |
| 浮层出现但点「拒绝并说明」后理由没送达 | `remote.session` 服务未注入 / `prompt` 参数错误 / turn 已结束 | 确认 `client.js` 的 `exports.inject` 含 `remote.session`；失败时会自动降级 queue；查看 `console.error("[approval-reason-dock] ...")` |
| npm publish 403「Two-factor authentication…required」 | 用了普通 token 直接发布 | 改走 `npm stage publish` + `stage approve`（见 §6.1） |
| `npm stage approve` 报 EOTP 且 URL 显示 `***` | 非交互 shell | 用 `--require fake-tty.cjs` 伪装 TTY 让 npm 走 web-2FA；或保持 CLI 存活，把 auth URL 给主人浏览器确认 |
| `npm stage publish` E401 token invalid | token 被删/过期 | 重新生成 stage-only token 并 `npm config set` |
| PowerShell 执行 `npm` 报 `npm.ps1 禁止运行脚本` | 执行策略 | 用 `npm.cmd` 或在 CMD 里跑 |
| `git push` 连不上 github.com | 本机网络/代理 | 重试；或走 GitHub API 提交 |
| pwsh 报 `ACL temp root must be outside the workspace` | 会话处于 `workspace-write` | 用一次性 `sandbox_permissions: danger-full-access` 执行命令，或让主人切完全访问 |
| 改了 client.js 但页面没变 | 宿主缓存 bundle | 重启 DSH（刷新页面不够） |

## 九、账号与密钥

- npm 账号：`b53010260`（发布者，`_npmUser` 记录为 `liangwjc@sina.com`）
- 本机 `.npmrc`（`C:\Users\Administrator\.npmrc`）保存 **stage-only granular token**；不要提交、不要外发
- 曾经在聊天里贴出过一个 `npm_P5vP…` token → 后续调用返回 401（已失效）；如仍有残留，去 npm → Access Tokens 撤销
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

## 十一、参考

- DSH 官方插件开发规范（内置 skill）：`cordis-plugin-development`（bundle 清单、展示元数据、客户端模块格式、`shell.overlay` 用法、UI 实践）
- DSH 包清单类型：`@deepseek-ai/dsh-package-manifest`
- 客户端模块系统：`@deepseek-ai/dsh-client-modules`
- 插件市场索引格式：`@deepseek-ai/dsh-plugin-market-index`（若要上架发现页，需 format 1 索引）