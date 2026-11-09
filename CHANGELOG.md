# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Client activation fixes: `dsh.client.inject` now lists only real client
  packages (no host API packages), and `exports.inject` declares the client
  services the bundle actually touches, including the dotted `remote.session`
  and `uiSession` paths. Missing declarations made the panel throw inside the
  slot inject callback and never render.
- Only the visible session's status/title are subscribed, so updates in other
  sessions no longer re-render the frame-wide panel.

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