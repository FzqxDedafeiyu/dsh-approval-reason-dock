# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Documented the plugin's core positioning: **non-invasive by design**. README
  (EN/ZH) gained a dedicated section, `package.json` description and the GitHub
  About text were updated — client-only bundle (no host half, routes or
  `tools/*` hooks), the built-in approval card / approval protocol / audit
  events / sandbox policy stay untouched, fail-soft when the panel cannot
  render, and subagent approvals are left entirely to DSH (auto-rejected there).
  Version unchanged; documentation-only.

## [0.1.2] - 2026-11-10

### Changed

- Documentation / market-sync release, no runtime code changes: the tagged
  release now carries the dsh-plugin.org listing badge, the explicit
  `dsh-approval-reason-dock@0.1.0` fallback install for DSH 0.2.1, the split
  English/Chinese preview images and `screenshots.json`, so the tag matches
  `main` again after the 0.1.1 publish.
- Repo hygiene: the local probe build and the rollback script moved out of the
  release branch; `.gitattributes` marks such local-only tooling `export-ignore`
  for local archives. (GitHub source archives ignore that attribute; keeping the
  files off the release branch is the actual fix.)
- `engines.dsh` is unchanged (`>=0.2.2-rc.1 <0.3.0`); DSH 0.2.1 users stay on
  plugin `0.1.0`.

## [0.1.1] - 2026-11-09

### Fixed

- The panel now follows the session shown in the main view: it subscribes to
  `uiSession.current` and only offers that session's approval. Switching
  sessions hides the panel instead of showing another session's approval;
  approvals in other sessions stay quiet until you switch to them.
- Reason drafts are kept per approval: with several sessions or approvals
  pending at once, switching between them no longer wipes the text of the
  other one.
- The panel moved to the top-right corner and got slightly narrower so it no
  longer covers the built-in approval card or the header buttons in a narrow
  window.
- The panel header now shows the session title, so the owner of a pending
  approval is identifiable even if the visible-session filter fails.
- The panel can be collapsed to a semi-transparent “Pending review” pill; it
  starts expanded for every new approval.
- Rejection closes the panel immediately on success. A failed reason delivery
  still keeps a dismissible error notice.
- Client activation, two independent failures fixed:
  - `dsh.client.inject` now lists only real client packages (no host API
    packages). The old list mixed transport/API layers into the client
    activation graph; on DSH 0.2.2 that left UI entries waiting and the loader
    treated it as fatal (`N entries did not activate`, boot dialog). This was
    the 2026-11-09 web-boot crash.
  - `exports.inject` now declares the dotted client services the bundle reads
    (`remote.session`, `uiSession`). A missing declaration throws inside the
    slot inject callback (`cannot get property ... without inject`), the slot
    entry dies, and the panel silently never renders. This was the separate
    "plugin installed but nothing appears" failure found with the probe build.
- Kept `dsh.client.immediately: true`: verified on DSH 0.2.2, and the
  prerequisites are now explicit in `dsh.client.inject` while `apply()` guards
  for a missing slots service, so activation order cannot strand the UI.
- Only the visible session's status/title are subscribed, so updates in other
  sessions no longer re-render the frame-wide panel.
- Compatibility is now explicit: `engines.dsh` is `>=0.2.2-rc.1 <0.3.0` for
  0.1.1 (verified there); DSH `0.2.1-rc.2` users should stay on `0.1.0`, which
  was verified on that line.

## [0.1.0] - 2026-11-08

### Added

- A `shell.overlay` panel that appears while the active session has a pending
  approval, letting the user type an optional rejection reason.
- `Reject with reason` sends `（审批拒绝理由）<text>` as a steering user message
  into the running turn (falling back to a queued message when the turn no
  longer accepts steering), then answers the approval as `rejected`.
- Localized copy for English and Chinese, following the host locale.
- Display metadata (`locale/*.json`) and an original `icon.svg` for the DSH
  plugin inventory.

### Compatibility

- Built and tested against DSH `0.2.1-rc.2` (`engines.dsh: >=0.2.1-rc.2 <0.3.0`).
- The panel relies on the `shell.overlay` slot, `uiSession.sessionStatus`
  interactions, and `remote.session.prompt`; a DSH upgrade may require an
  update to this plugin.