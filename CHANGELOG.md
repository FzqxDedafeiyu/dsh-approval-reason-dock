# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-11-09

### Fixed

- The panel now follows the session shown in the main view. It only offers that
  session's approval, and switching sessions hides or moves the panel instead of
  showing another session's approval; approvals in other sessions stay quiet
  until you switch to them.

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