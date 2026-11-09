# dsh-approval-reason-dock

[![CI](https://github.com/FzqxDedafeiyu/dsh-approval-reason-dock/actions/workflows/ci.yml/badge.svg)](https://github.com/FzqxDedafeiyu/dsh-approval-reason-dock/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dsh-approval-reason-dock.svg)](https://www.npmjs.com/package/dsh-approval-reason-dock)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An additive web-client plugin for [DeepSeek Harness](https://github.com/deepseek-ai) that lets you type an optional **rejection reason** on approval prompts. The reason is delivered into the running turn as a steering user message *before* the approval is answered as rejected, so the model reads it in its next step instead of guessing why the action was denied.

[中文说明](README.zh.md)

## Preview

![Approval reason panel over the built-in approval card](https://raw.githubusercontent.com/FzqxDedafeiyu/dsh-approval-reason-dock/main/docs/preview.png)

## Why

Harness approval prompts offer `Allow once` / `Reject` only. The rejection result is a closed outcome value with no reason channel, so a rejection reaches the model as a bare "the user rejected tool X". When a denial carries context ("the network is unreliable", "do not touch that file yet"), it belongs in the conversation immediately — not in a follow-up turn.

This plugin adds a small frame-wide panel on top of the host UI. It does **not** replace the built-in approval card, does **not** change the approval protocol or audit events, and fails soft: if the panel cannot render, the built-in card keeps working exactly as before.

## Behavior

- While the active session has an answerable approval, a panel appears in the top-right corner (`shell.overlay` slot).
- The panel follows the session shown in the main view: only that session's approval is offered, and approvals in other sessions stay quiet until you switch to them. The panel header shows the session title.
- The panel starts expanded and can be collapsed into a semi-transparent “Pending review” pill so it does not cover the conversation; clicking the pill expands it again. Each new approval starts expanded.
- Reason drafts are kept per approval, so switching between several sessions with pending approvals does not wipe the text typed for the other one.
- Type a reason and press **Reject with reason**:
  1. ``(approval rejection reason) <text>`` is sent into the running session as a steering user message (`remote.session.prompt` with `mode: "steer"`);
  2. if the turn no longer accepts steering, it is queued (`mode: "queue"`) instead;
  3. the approval is then answered as `rejected`.
- Rejection closes the panel immediately. Only a failed reason delivery keeps a dismissible error notice with the error code.
- **Reject** answers without a reason, same as the built-in button.

## Install

Requires DSH `0.2.2-rc.1` or a later `0.2.x` release (see `engines.dsh`).

Version match:

| DSH | Plugin | Status |
| --- | --- | --- |
| `0.2.1-rc.2` | `0.1.0` | verified stable; `0.1.1` is not tested on this line |
| `0.2.2-rc.1` | `0.1.1`+ | verified (all 0.1.1 real-machine tests ran here) |

Preferred: install the bundle from the DSH UI (Plugin Manager → install bundle) using the npm package name or the GitHub spec:

```
dsh-approval-reason-dock
github:FzqxDedafeiyu/dsh-approval-reason-dock
```

Manual profile patch (if you manage the profile yourself): add the bundle to `dsh.profile.bundles` and let its patch insert the row:

```yaml
- insert:
    - id: approval-reason-dock
      name: dsh-approval-reason-dock
```

The bundle ships `cordis.patch.yml`, `index.js` (empty Host half), `client.js` (browser half), `locale/*.json` and `icon.svg`.

## Compatibility and risks

- The browser half uses DSH client internals: the `shell.overlay` slot, `uiSession` session-status interactions, and `remote.session.prompt`. These APIs are not a stable public contract; a Harness upgrade may require a plugin update.
- If an internal API is missing, the panel stays hidden and approvals still work through the built-in card (fail-soft).
- The plugin sends no network requests and reads no session content beyond the pending approval metadata.

## Privacy

The reason you type becomes a normal user message in the session log and model context (capped at 500 characters, plain text, never rendered as HTML). Nothing is sent anywhere else.

## Uninstall

Remove the `dsh-approval-reason-dock` entry from `dsh.profile.bundles` (or use Plugin Manager → uninstall), then restart DSH.

## Development

```
node test/harness.mjs
```

The harness checks the manifest/packaging shape, loads the real `client.js` factory, and drives the approval flow (reason delivery, steer→queue fallback, failure notices, already-settled approvals) against a fake React/Cordis/slot environment. `npm run pack:check` verifies the published file list.

Repository layout:

```
client.js           browser half (window.__ModuleLoader__ bundle)
index.js            host half (no-op apply)
cordis.patch.yml    Loader row
locale/{en,zh}.json display metadata
icon.svg            plugin icon
test/harness.mjs    sandbox tests
.github/workflows/  CI
```

## Maintenance

Release, install/rollback, upgrade smoke tests and troubleshooting are documented in the
[maintenance handbook](docs/MAINTENANCE.md) (Chinese, written for this deployment).

## License

MIT. See [LICENSE](LICENSE).