# dsh-approval-reason-dock

[![CI](https://github.com/FzqxDedafeiyu/dsh-approval-reason-dock/actions/workflows/ci.yml/badge.svg)](https://github.com/FzqxDedafeiyu/dsh-approval-reason-dock/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dsh-approval-reason-dock.svg)](https://www.npmjs.com/package/dsh-approval-reason-dock)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

给 [DeepSeek Harness](https://github.com/deepseek-ai) Web 端加一层**审批拒绝理由**：审批卡出现时可以填一句理由，插件会先把理由作为 steering 用户消息送进当前对话，再把审批答成「拒绝」。这样模型下一步就能读到理由，而不是只收到一句"用户拒绝了工具 X"、只能靠猜。

[English](README.md)

## 预览

![审批拒绝理由浮层叠加在内置审批卡上](https://raw.githubusercontent.com/FzqxDedafeiyu/dsh-approval-reason-dock/main/docs/preview.png)

## 为什么做这个

Harness 的审批卡只有「允许一次 / 拒绝」两个动作，拒绝结果是封闭的枚举值，协议里没有携带理由的字段。于是拒绝理由要么丢失，要么得等下一轮再说。当拒绝本身有上下文（"网络不稳"、"先别动那个文件"）时，它应该立刻进入对话。

这个插件在宿主 UI 之上加一个小浮层，**不替换**内置审批卡、**不修改**审批协议与审计事件；渲染失败时静默隐藏，内置卡照常工作（fail-soft）。

## 行为

- 当前会话存在可作答的审批时，右上角出现浮层（注册在 `shell.overlay` 槽）。
- 浮层跟随主视图当前会话：只提供该会话的审批；其他会话的审批保持安静，切过去才会出现。标题下方显示会话名。
- 浮层默认展开，可折叠成半透明的「待审核」小按钮以免挡住正文，点击小按钮重新展开；每个新审批默认展开。
- 理由草稿按审批分别保留：多个会话同时挂审批时，来回切换不会清掉另一个会话已输入的文字。
- 填理由并点「拒绝并说明」：
  1. 以 `remote.session.prompt`（`mode: "steer"`）把 `（审批拒绝理由）<文本>` 作为 steering 用户消息送进当前轮；
  2. 如果当前轮已不再接受 steering，则自动降级为 `mode: "queue"` 排队；
  3. 最后把审批答成 `rejected`。
- 拒绝成功后浮层立即收起；只有理由发送失败时保留错误码提示（可手动关闭）。
- 「只拒绝」= 不带理由，等价于内置卡的「拒绝」。

## 安装

要求 DSH `0.2.1-rc.2` 或同系列更高的 `0.2.x`（见 `engines.dsh`）。

推荐：在 DSH 的插件管理页用 npm 包名或 GitHub spec 安装 bundle：

```
dsh-approval-reason-dock
github:FzqxDedafeiyu/dsh-approval-reason-dock
```

手工管理 profile 的话：把 bundle 加入 `dsh.profile.bundles`，让它自带的 patch 插入行：

```yaml
- insert:
    - id: approval-reason-dock
      name: dsh-approval-reason-dock
```

包内包含 `cordis.patch.yml`、`index.js`（空宿主半）、`client.js`（浏览器半）、`locale/*.json`、`icon.svg`。

## 兼容性与风险

- 浏览器半依赖 DSH 客户端内部接口：`shell.overlay` 槽、`uiSession` 的会话状态交互、`remote.session.prompt`。这些不是稳定的公开契约，Harness 升级后可能需要更新插件。
- 内部接口缺失时浮层保持隐藏，审批仍可通过内置卡正常完成（fail-soft）。
- 插件不发起网络请求，除待处理审批的元数据外不读取会话内容。

## 隐私

你输入的理由会成为会话日志与模型上下文里的普通用户消息（限 500 字、纯文本、不渲染 HTML），不会发往任何其他位置。

## 卸载

从 `dsh.profile.bundles` 移除 `dsh-approval-reason-dock`（或在插件管理页卸载），重启 DSH 即可。

## 开发

```
node test/harness.mjs
```

harness 会校验清单/打包形态、加载真实的 `client.js` factory，并在假的 React/Cordis/槽环境里驱动完整拒绝流程（理由投递、steer→queue 降级、失败提示、审批已被处理）。`npm run pack:check` 校验实际发布文件清单。

仓库结构：

```
client.js           浏览器半（window.__ModuleLoader__ bundle）
index.js            宿主半（空 apply）
cordis.patch.yml    Loader 行
locale/{en,zh}.json 展示元数据
icon.svg            插件图标
test/harness.mjs    沙箱测试
.github/workflows/  CI
```

## 维护

发布流程、本机安装/回退、升级冒烟与排障见[交付与维护手册](docs/MAINTENANCE.md)。

## 许可证

MIT，见 [LICENSE](LICENSE)。