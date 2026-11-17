window.__ModuleLoader__.load({
	id: "dsh-approval-reason-dock",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		const React = require("react");
		const h = React.createElement;

		const NS = "approval-reason-dock";
		const MAX_REASON_CHARS = 500;
		// 0.3.0: shown by the update checker; the harness keeps it in sync with
		// package.json.
		const PLUGIN_VERSION = "0.3.0";
		// Settings are persisted per browser. 0.2.0 shipped two allow-side
		// switches; 0.3.0 adds allow-side delivered notices (on, 3 s) plus an
		// approval log and update checks (both off).
		const SETTINGS_KEY = "dsh-approval-reason-dock:settings";
		const DEFAULT_SETTINGS = {
			allowNote: true,
			confirmAllow: true,
			allowNotice: true,
			allowNoticeMs: 3000,
			approvalLog: false,
			updateCheck: false,
		};
		// Delivered-notice queue: at most two in memory, closing together.
		const NOTICE_MAX = 2;
		const NOTICE_WARN_ICON = "⚠️";
		// Approval log: local-only ring buffer in localStorage (schema v1).
		const LOG_KEY = "dsh-approval-reason-dock:log:v1";
		const LOG_SCHEMA_VERSION = 1;
		const LOG_MAX_TOTAL = 200;
		const LOG_MAX_PER_SESSION = 100;
		const LOG_MAX_TEXT = 500;
		const LOG_DISPLAY_LIMIT = 50;
		// Update check: registry metadata only; never installs anything.
		const UPDATE_REGISTRY_URL = "https://registry.npmjs.org/dsh-approval-reason-dock/latest";
		const UPDATE_COMMAND = "dsh plugin --profile web add dsh-approval-reason-dock@latest";
		const UPDATE_AUTO_INTERVAL_MS = 3600000;

		/* ------------------------------------------------------------ copy */

		const zh = {
			title: "审批待处理",
			hint: "留一句说明（可选）；点允许后先送达当前对话，再提交审批。",
			placeholder: "例如：只改 docs/ 下的文件；先 --dry-run 试一遍。",
			allowPlain: "允许一次",
			allowWithNote: "允许并说明",
			rejectPlain: "拒绝",
			rejectWithNote: "拒绝并说明",
			allowPrefix: "（审批同意说明）",
			reasonPrefix: "（审批拒绝理由）",
			confirmTitle: "确认允许这次执行？",
			confirmBody: "允许后会立即执行该工具调用。本插件只负责把补充说明送给模型，不会改变本次授权范围。",
			partialAgreementHint: "部分同意或附条件放行，请点「拒绝并说明」。",
			confirmNote: "将附上说明：{text}",
			confirmAllow: "确认允许",
			cancel: "取消",
			sending: "正在把说明送进当前对话…",
			deliveryFailed: "审批未提交：说明发送失败：{error}（可重试或清空后重试）",
			close: "关闭",
			collapse: "折叠",
			expand: "展开",
			pendingBadge: "待审核",
			deliveredSteer: "已送达；当前步骤结束后插入对话，下一步模型可见。",
			deliveredQueue: "已排队（steer 降级）：下一轮模型可见。",
			settled: "审批已被其他方式处理。",
			handled: "已拒绝（未附说明）。",
			handledTitle: "审批已处理",
			tool: "工具：{tool}",
			session: "会话：{title}",
			ariaInput: "审批说明（可选）",
			ariaPanel: "审批说明浮层",
			ariaConfirmPanel: "允许二次确认",
			// 0.2.0 settings section
			settingsNav: "审批说明浮层",
			settingsTitle: "审批说明浮层",
			settingsIntro: "控制允许带话、允许二次确认、送达提醒、审批日志与更新检查。拒绝带理由始终可用，不受这些开关影响。",
			allowNoteLabel: "允许时带话",
			allowNoteDesc: "允许审批时可以附一句说明，作为 steering 用户消息送进当前对话。",
			allowNoteRiskOn: "开启时：说明会写入会话日志并进入模型上下文；说明送不到时本次不回答审批（可重试）。",
			allowNoteRiskOff: "关闭时：允许不能附带条件，模型只看到原生放行；需要条件时请改用「拒绝并说明」。",
			confirmAllowLabel: "允许二次确认",
			confirmAllowDesc: "点允许后先在面板内二次确认，再执行工具调用。",
			confirmAllowRiskOn: "开启时：每次允许多一步操作，高频审批会略慢。",
			confirmAllowRiskOff: "关闭时：点允许会立即执行工具调用，误触/手滑没有第二道保护。",
			settingsDefaultNote: "0.2.0 两项与送达提醒默认开启；审批日志与更新检查默认关闭。设置保存在本机浏览器。",
			allowNoteDisabledHint: "「允许时带话」已在设置中关闭：本次允许不会附说明。",
			settingsToggleAria: "{name} 开关",
			// 0.3.0 delivered notices (allow side)
			allowNoticeLabel: "允许说明送达提醒",
			allowNoticeDesc: "允许并说明送达后，在浮层短暂显示「已送达」提示；只影响提示，不影响投递。",
			allowNoticeRiskOn: "开启时：送达后显示提示，按下方时长自动关闭；提示只放内存，刷新后消失。",
			allowNoticeRiskOff: "关闭时：审批处理完浮层立即消失，恢复 0.2.0 行为。",
			allowNoticeMsLabel: "提示显示时长（秒）",
			allowNoticeMsDesc: "1–10 秒的整数；越界自动夹取；以最后一条送达为准重新计时。",
			// 0.3.0 approval log (local only, default off)
			approvalLogLabel: "审批日志",
			approvalLogDesc: "记录本插件可见的审批（时间/会话/工具/说明/结果），保存在本机浏览器，可查看与导出。",
			approvalLogRiskOn: "开启时：审批信息（含说明文本，可能含路径/命令细节）写入本机 localStorage，不上传；导出文件由你保管。",
			approvalLogRiskOff: "关闭时：不记录任何审批日志（默认）。",
			logSectionTitle: "审批日志",
			logEmpty: "暂无记录",
			logCount: "共 {count} 条记录",
			logFilterAll: "全部",
			logFilterAllowed: "已允许",
			logFilterRejected: "已拒绝",
			logFilterUnknown: "未知",
			logExport: "导出 JSON",
			logClear: "清空本机日志",
			logHint: "最多保留 200 条（每会话 100 条），超出丢弃最旧；导出只包含本机记录。",
			logViaPanel: "插件面板",
			logViaUnknown: "内置卡/外部",
			logOutcomeAllowed: "已允许",
			logOutcomeRejected: "已拒绝",
			logOutcomeUnknown: "结果未知",
			logOutcomePending: "待定",
			logNotePrefix: "说明：{text}",
			logReasonPrefix: "原因：{text}",
			logSession: "会话：{title}",
			logExportFailed: "导出失败：当前环境不支持文件下载。",
			// 0.3.0 update check (registry metadata only)
			updateCheckLabel: "检查新版本",
			updateCheckDesc: "手动检查 npm 上的新版本并提示更新命令；不会自动安装。",
			updateCheckRiskOn: "开启时：打开设置页会向 npm registry 查询本包最新版本号（只发送包名）。",
			updateCheckRiskOff: "关闭时：完全不联网检查（默认）。",
			updateCheckButton: "立即检查",
			updateChecking: "正在检查…",
			updateUpToDate: "已是最新版本（{version}）。",
			updateAvailable: "有新版本 {latest}（当前 {current}）。更新命令：{command}",
			updateFailed: "检查失败：{error}",
			updateDisabledHint: "「检查新版本」已关闭：不会联网检查。",
		};

		const en = {
			title: "Approval pending",
			hint: "Add a note (optional); it is delivered to the running turn before the approval is answered.",
			placeholder: "e.g. Only change files under docs/; run --dry-run first.",
			allowPlain: "Allow once",
			allowWithNote: "Allow with note",
			rejectPlain: "Reject",
			rejectWithNote: "Reject with note",
			allowPrefix: "(approval allow note) ",
			reasonPrefix: "(approval rejection reason) ",
			confirmTitle: "Allow this run?",
			confirmBody: "Allowing runs this tool call immediately. The plugin only delivers your note to the model; it does not change the authorization scope.",
			partialAgreementHint: "For partial or conditional approval, use \"Reject with note\".",
			confirmNote: "Note to send: {text}",
			confirmAllow: "Confirm allow",
			cancel: "Cancel",
			sending: "Sending the note into the running turn…",
			deliveryFailed: "Approval not submitted: sending the note failed: {error} (retry or clear the note)",
			close: "Close",
			collapse: "Collapse",
			expand: "Expand",
			pendingBadge: "Pending review",
			deliveredSteer: "Delivered; it is inserted after the current step and is visible to the model next step.",
			deliveredQueue: "Queued (steer downgraded); visible to the model next round.",
			settled: "The approval was already handled elsewhere.",
			handled: "Rejected (no note).",
			handledTitle: "Approval handled",
			tool: "Tool: {tool}",
			session: "Session: {title}",
			ariaInput: "Approval note (optional)",
			ariaPanel: "Approval note panel",
			ariaConfirmPanel: "Allow confirmation",
			// 0.2.0 settings section
			settingsNav: "Approval Note Dock",
			settingsTitle: "Approval Note Dock",
			settingsIntro: "Controls allow-with-note, allow confirmation, delivered notices, the approval log and update checks. Reject with a note always works and is not affected by these switches.",
			allowNoteLabel: "Allow with note",
			allowNoteDesc: "Attach a note when allowing; it enters the running turn as a steering user message.",
			allowNoteRiskOn: "On: the note becomes a normal user message in the session log and model context; if it cannot be delivered, the approval is not answered (retryable).",
			allowNoteRiskOff: "Off: allows carry no conditions — the model only sees a native allow; use \"Reject with note\" instead.",
			confirmAllowLabel: "Allow confirmation",
			confirmAllowDesc: "Clicking allow opens an in-panel confirmation before the tool call runs.",
			confirmAllowRiskOn: "On: one extra step per allow; frequent approvals feel slower.",
			confirmAllowRiskOff: "Off: clicking allow runs the tool call immediately; no second line of defense against misclicks.",
			settingsDefaultNote: "The two 0.2.0 switches and delivered notices default to on; the approval log and update checks default to off. Stored in this browser.",
			allowNoteDisabledHint: "\"Allow with note\" is off in settings: this allow carries no note.",
			settingsToggleAria: "{name} toggle",
			// 0.3.0 delivered notices (allow side)
			allowNoticeLabel: "Delivered-notice feedback",
			allowNoticeDesc: "After an allow-with-note is delivered, briefly show a delivered notice; this affects the notice only, not delivery.",
			allowNoticeRiskOn: "On: shows a delivered notice that auto-closes after the duration below; notices are in memory only and disappear on reload.",
			allowNoticeRiskOff: "Off: the overlay disappears as soon as the approval is handled (0.2.0 behavior).",
			allowNoticeMsLabel: "Notice duration (seconds)",
			allowNoticeMsDesc: "Integer 1–10 seconds; out-of-range values are clamped; the timer restarts with the last delivered notice.",
			// 0.3.0 approval log (local only, default off)
			approvalLogLabel: "Approval log",
			approvalLogDesc: "Records approvals visible to this plugin (time/session/tool/note/outcome) in this browser; view and export as you like.",
			approvalLogRiskOn: "On: approval details (including note text that may contain paths or command details) are stored in this browser's localStorage and never uploaded; exported files are yours to keep.",
			approvalLogRiskOff: "Off: records nothing (default).",
			logSectionTitle: "Approval log",
			logEmpty: "No records yet",
			logCount: "{count} records",
			logFilterAll: "All",
			logFilterAllowed: "Allowed",
			logFilterRejected: "Rejected",
			logFilterUnknown: "Unknown",
			logExport: "Export JSON",
			logClear: "Clear local log",
			logHint: "Keeps up to 200 records (100 per session), dropping the oldest; exports contain local records only.",
			logViaPanel: "Plugin panel",
			logViaUnknown: "Built-in card / external",
			logOutcomeAllowed: "Allowed",
			logOutcomeRejected: "Rejected",
			logOutcomeUnknown: "Unknown outcome",
			logOutcomePending: "Pending",
			logNotePrefix: "Note: {text}",
			logReasonPrefix: "Reason: {text}",
			logSession: "Session: {title}",
			logExportFailed: "Export failed: file download is unavailable in this environment.",
			// 0.3.0 update check (registry metadata only)
			updateCheckLabel: "Check for updates",
			updateCheckDesc: "Checks npm for a newer version and shows the update command; never installs automatically.",
			updateCheckRiskOn: "On: opening this settings section queries the npm registry for this package's latest version (package name only).",
			updateCheckRiskOff: "Off: no network check at all (default).",
			updateCheckButton: "Check now",
			updateChecking: "Checking…",
			updateUpToDate: "Up to date ({version}).",
			updateAvailable: "New version {latest} available (current {current}). Update command: {command}",
			updateFailed: "Check failed: {error}",
			updateDisabledHint: "\"Check for updates\" is off: no network check.",
		};

		/* --------------------------------------------------------- helpers */

		/** Collapse whitespace, trim, and cap a user-typed note. */
		function normalizeReason(value) {
			if (typeof value !== "string") return "";
			return value.replace(/\s+/g, " ").trim().slice(0, MAX_REASON_CHARS);
		}

		/** Human-readable one-liner for a Remote failure result. */
		function errorText(result) {
			const error = result === undefined || result === null ? undefined : result.error;
			if (error === undefined || error === null) return "unknown error";
			const code = typeof error.code === "string" ? error.code : "";
			const message = typeof error.message === "string" ? error.message : "";
			if (code !== "" && message !== "") return code + ": " + message;
			if (code !== "") return code;
			if (message !== "") return message;
			return "unknown error";
		}

		function requestId() {
			try {
				return globalThis.crypto.randomUUID();
			} catch {
				return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
			}
		}

		function timeZone() {
			try {
				return Intl.DateTimeFormat().resolvedOptions().timeZone;
			} catch {
				return undefined;
			}
		}

		/** Clamp a stored notice duration to whole seconds in [1, 10], in ms. */
		function normalizeNoticeMs(value) {
			if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SETTINGS.allowNoticeMs;
			const seconds = Math.min(10, Math.max(1, Math.round(value / 1000)));
			return seconds * 1000;
		}

		/** Append one delivered notice, keeping only the newest NOTICE_MAX. */
		function pushNotice(queue, notice) {
			const list = Array.isArray(queue) ? queue : [];
			return list.concat([notice]).slice(-NOTICE_MAX);
		}

		/** Locale key for a delivered-notice mode. */
		function noticeTextKey(mode) {
			return mode === "queue" ? "deliveredQueue" : "deliveredSteer";
		}

		/** Collapse whitespace, trim and cap free text for local storage. */
		function truncateText(value, max) {
			if (typeof value !== "string") return undefined;
			const text = value.replace(/\s+/g, " ").trim();
			if (text === "") return undefined;
			return text.slice(0, Math.max(0, max));
		}

		/** Parse "X.Y.Z" or "X.Y.Z-pre" into comparable parts. */
		function parseSemver(value) {
			if (typeof value !== "string") return undefined;
			const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
			if (match === null) return undefined;
			return {
				major: Number(match[1]),
				minor: Number(match[2]),
				patch: Number(match[3]),
				pre: match[4] === undefined ? "" : match[4],
			};
		}

		/** SemVer prerelease precedence: absent pre is higher, numeric < alpha. */
		function comparePrerelease(a, b) {
			if (a === b) return 0;
			if (a === "") return 1;
			if (b === "") return -1;
			const left = a.split(".");
			const right = b.split(".");
			const length = Math.max(left.length, right.length);
			for (let index = 0; index < length; index += 1) {
				if (index >= left.length) return -1;
				if (index >= right.length) return 1;
				const x = left[index];
				const y = right[index];
				const xNumeric = /^\d+$/.test(x);
				const yNumeric = /^\d+$/.test(y);
				if (xNumeric && yNumeric) {
					const nx = Number(x);
					const ny = Number(y);
					if (nx !== ny) return nx < ny ? -1 : 1;
				} else if (xNumeric) {
					return -1;
				} else if (yNumeric) {
					return 1;
				} else if (x !== y) {
					return x < y ? -1 : 1;
				}
			}
			return 0;
		}

		/** -1 / 0 / 1 for two SemVers, or undefined when either is invalid. */
		function compareSemver(a, b) {
			const left = parseSemver(a);
			const right = parseSemver(b);
			if (left === undefined || right === undefined) return undefined;
			for (const key of ["major", "minor", "patch"]) {
				if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
			}
			return comparePrerelease(left.pre, right.pre);
		}

		/** True when `candidate` is strictly newer than `current`. */
		function semverGt(candidate, current) {
			return compareSemver(candidate, current) === 1;
		}

		/** Local "YYYY-MM-DD HH:MM" for log rows. */
		function formatLogTime(ms) {
			const date = new Date(ms);
			if (Number.isNaN(date.getTime())) return "";
			const pad = (value) => String(value).padStart(2, "0");
			return (
				String(date.getFullYear()) +
				"-" +
				pad(date.getMonth() + 1) +
				"-" +
				pad(date.getDate()) +
				" " +
				pad(date.getHours()) +
				":" +
				pad(date.getMinutes())
			);
		}

		/** Filter log entries by outcome; "all" keeps everything. */
		function filterLogEntries(entries, outcome) {
			const list = Array.isArray(entries) ? entries : [];
			if (outcome === undefined || outcome === null || outcome === "all") return list;
			return list.filter((entry) => entry !== null && typeof entry === "object" && entry.outcome === outcome);
		}

		/** Serialize the local log for an explicit download. */
		function formatLogExport(entries, now) {
			return JSON.stringify(
				{
					schema: LOG_SCHEMA_VERSION,
					exportedAt: typeof now === "number" ? now : Date.now(),
					entries: Array.isArray(entries) ? entries : [],
				},
				null,
				2,
			);
		}

		/**
		 * Check npm for a newer version. Registry metadata only: no install, no
		 * file writes. Failures are returned (callers decide whether to show).
		 * @returns {Promise<{status: "available"|"latest"|"failed", current?: string, latest?: string, command?: string, error?: string}>}
		 */
		async function checkForUpdate(currentVersion, options) {
			const source = options === null || typeof options !== "object" ? {} : options;
			let fetchImpl;
			if (typeof source.fetchImpl === "function") fetchImpl = source.fetchImpl;
			else if (typeof globalThis.fetch === "function") fetchImpl = globalThis.fetch.bind(globalThis);
			if (fetchImpl === undefined) return { status: "failed", error: "fetch unavailable" };
			const url = typeof source.url === "string" ? source.url : UPDATE_REGISTRY_URL;
			try {
				const init = { cache: "no-store" };
				if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") init.signal = AbortSignal.timeout(5000);
				const response = await fetchImpl(url, init);
				if (response === undefined || response === null || response.ok !== true) {
					const status = response === undefined || response === null ? "unknown" : response.status;
					return { status: "failed", error: "http " + status };
				}
				const body = await response.json();
				const latest = body === undefined || body === null ? undefined : body.version;
				if (typeof latest !== "string") return { status: "failed", error: "no version in registry response" };
				if (semverGt(latest, currentVersion) === true) {
					return { status: "available", current: currentVersion, latest, command: UPDATE_COMMAND };
				}
				return { status: "latest", current: currentVersion, latest };
			} catch (error) {
				return { status: "failed", error: error instanceof Error ? error.message : String(error) };
			}
		}

		/**
		 * Send one note (allow or reject flavour) into the running session.
		 * Steer first so the model reads it in the next step of the current turn;
		 * fall back to a queued message when the turn no longer accepts steering.
		 * @returns {Promise<{mode: "steer" | "queue" | "failed", error?: string}>}
		 */
		async function deliverReason(remote, sessionId, prefix, reason) {
			if (remote === undefined || remote.session === undefined || typeof remote.session.prompt !== "function") {
				return { mode: "failed", error: "remote.session.prompt unavailable" };
			}
			const base = {
				requestId: requestId(),
				sessionId,
				content: [{ type: "text", text: prefix + reason }],
			};
			const zone = timeZone();
			if (zone !== undefined) base.clientTimeZone = zone;
			const failures = [];
			for (const mode of ["steer", "queue"]) {
				try {
					const result = await remote.session.prompt({ ...base, mode });
					if (result !== undefined && result.ok === true) return { mode };
					failures.push(mode + " → " + errorText(result));
				} catch (error) {
					failures.push(mode + " → " + (error instanceof Error ? error.message : String(error)));
				}
			}
			return { mode: "failed", error: failures.join("; ") };
		}

		/**
		 * First answerable approval for the session currently shown in the main
		 * view. Approvals from other sessions stay quiet until the user switches
		 * to them.
		 * @param snapshot - uiSession.sessionStatus snapshot (sessionId -> status)
		 * @param currentSessionId - session displayed in the main view, or undefined
		 * @returns {{sessionId: string, pending: object, key: string} | undefined}
		 */
		function firstApproval(snapshot, currentSessionId) {
			if (currentSessionId === undefined || currentSessionId === null) return undefined;
			if (snapshot === undefined || snapshot === null || typeof snapshot.get !== "function") return undefined;
			const status = snapshot.get(currentSessionId);
			const pending = status === undefined || status === null ? undefined : status.pendingInteraction;
			if (pending === undefined || pending === null) return undefined;
			if (pending.kind !== "approval" || pending.answerable === false) return undefined;
			return { sessionId: currentSessionId, pending, key: pending.key === undefined ? currentSessionId : pending.key };
		}

		/**
		 * Subscribe to the main-view session binding exposed by `uiSession`.
		 * `ctx.uiSession.current` is a binding source: `getSnapshot()` returns the
		 * binding whose `key` is the displayed session id. That binding is kept by
		 * the host (publishMain / watchMainRetention are byte-identical on 0.2.1
		 * and 0.2.2), so it follows session switches.
		 * @param source - uiSession.current binding source, or undefined
		 * @returns {string | undefined} displayed session id
		 */
		function useCurrentSessionId(source) {
			const subscribe = React.useCallback(
				(listener) =>
					source === undefined || source === null || typeof source.subscribe !== "function" ? () => {} : source.subscribe(listener),
				[source],
			);
			const read = React.useCallback(() => {
				if (source === undefined || source === null || typeof source.getSnapshot !== "function") return undefined;
				const binding = source.getSnapshot();
				if (binding === undefined || binding === null) return undefined;
				return binding.key;
			}, [source]);
			return React.useSyncExternalStore(subscribe, read, read);
		}

		/**
		 * Answerable approval for one session status, or undefined.
		 * Prefer the narrow selector form: callers subscribe to
		 * `status.get(currentSessionId)` so unrelated sessions do not re-render
		 * the panel.
		 * @param status - uiSession.sessionStatus entry for one session
		 * @param sessionId - that session's id
		 * @returns {{sessionId: string, pending: object, key: string} | undefined}
		 */
		function approvalFromStatus(status, sessionId) {
			if (sessionId === undefined || sessionId === null) return undefined;
			const pending = status === undefined || status === null ? undefined : status.pendingInteraction;
			if (pending === undefined || pending === null) return undefined;
			if (pending.kind !== "approval" || pending.answerable === false) return undefined;
			return { sessionId, pending, key: pending.key === undefined ? sessionId : pending.key };
		}

		/** Session title from a sessions snapshot, when available. */
		function sessionTitleOf(snapshot, sessionId) {
			const byId = snapshot === undefined || snapshot === null ? undefined : snapshot.byId;
			const info = byId === undefined || byId === null ? undefined : byId[sessionId];
			const title = info === undefined || info === null ? undefined : info.title;
			return typeof title === "string" && title !== "" ? title : undefined;
		}

		/**
		 * Drafts keyed by approval key: two sessions can both have a pending
		 * approval, so switching back and forth must not wipe the other one's
		 * text. Cleared when the approval is answered.
		 * @type {Map<string, string>}
		 */
		const draftsByKey = new Map();

		function recallDraft(key) {
			if (key === undefined) return "";
			return draftsByKey.get(key) ?? "";
		}

		function rememberDraft(key, text) {
			if (key === undefined) return;
			if (text === "") draftsByKey.delete(key);
			else draftsByKey.set(key, text);
		}

		/* ------------------------------------------------------ settings store */

		let cachedSettings = readStoredSettings();
		/** @type {Set<() => void>} */
		const settingsListeners = new Set();

		/**
		 * Read persisted settings. Missing storage, malformed JSON, non-object
		 * values and non-boolean fields all fall back to defaults per field;
		 * unknown extra fields are ignored.
		 */
		function readStoredSettings() {
			const defaults = { ...DEFAULT_SETTINGS };
			let raw;
			try {
				if (typeof globalThis.localStorage === "undefined" || globalThis.localStorage === null) return defaults;
				raw = globalThis.localStorage.getItem(SETTINGS_KEY);
			} catch {
				return defaults;
			}
			if (typeof raw !== "string" || raw === "") return defaults;
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return defaults;
			}
			if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;
			return {
				allowNote: typeof parsed.allowNote === "boolean" ? parsed.allowNote : defaults.allowNote,
				confirmAllow: typeof parsed.confirmAllow === "boolean" ? parsed.confirmAllow : defaults.confirmAllow,
				allowNotice: typeof parsed.allowNotice === "boolean" ? parsed.allowNotice : defaults.allowNotice,
				allowNoticeMs: normalizeNoticeMs(parsed.allowNoticeMs),
				approvalLog: typeof parsed.approvalLog === "boolean" ? parsed.approvalLog : defaults.approvalLog,
				updateCheck: typeof parsed.updateCheck === "boolean" ? parsed.updateCheck : defaults.updateCheck,
			};
		}

		function notifySettings() {
			for (const listener of Array.from(settingsListeners)) {
				try {
					listener();
				} catch {
					// A broken subscriber must not break the store or other subscribers.
				}
			}
		}

		/** Current settings object (stable reference between updates). */
		function getSettings() {
			return cachedSettings;
		}

		/** Patch one or more settings, persist, and notify subscribers. */
		function updateSettings(patch) {
			const source = patch !== null && typeof patch === "object" ? patch : {};
			const next = {
				allowNote: typeof source.allowNote === "boolean" ? source.allowNote : cachedSettings.allowNote,
				confirmAllow: typeof source.confirmAllow === "boolean" ? source.confirmAllow : cachedSettings.confirmAllow,
				allowNotice: typeof source.allowNotice === "boolean" ? source.allowNotice : cachedSettings.allowNotice,
				allowNoticeMs:
					typeof source.allowNoticeMs === "number" ? normalizeNoticeMs(source.allowNoticeMs) : cachedSettings.allowNoticeMs,
				approvalLog: typeof source.approvalLog === "boolean" ? source.approvalLog : cachedSettings.approvalLog,
				updateCheck: typeof source.updateCheck === "boolean" ? source.updateCheck : cachedSettings.updateCheck,
			};
			cachedSettings = next;
			try {
				if (typeof globalThis.localStorage !== "undefined" && globalThis.localStorage !== null) {
					globalThis.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
				}
			} catch {
				// Persistence only: a blocked localStorage keeps the in-memory value.
			}
			notifySettings();
			return next;
		}

		/** Subscribe to settings changes; returns an unsubscribe function. */
		function subscribe(listener) {
			if (typeof listener !== "function") return () => {};
			settingsListeners.add(listener);
			return () => {
				settingsListeners.delete(listener);
			};
		}

		/** Re-read persisted settings, notifying subscribers when they changed. */
		function syncSettingsFromStorage() {
			const next = readStoredSettings();
			const unchanged =
				next.allowNote === cachedSettings.allowNote &&
				next.confirmAllow === cachedSettings.confirmAllow &&
				next.allowNotice === cachedSettings.allowNotice &&
				next.allowNoticeMs === cachedSettings.allowNoticeMs &&
				next.approvalLog === cachedSettings.approvalLog &&
				next.updateCheck === cachedSettings.updateCheck;
			if (unchanged) return cachedSettings;
			cachedSettings = next;
			notifySettings();
			return cachedSettings;
		}

		/** storage-event handler: ignore other keys, re-read our own (null = cleared). */
		function handleStorageEvent(event) {
			if (event !== undefined && event !== null && event.key !== undefined && event.key !== null && event.key !== SETTINGS_KEY) {
				return cachedSettings;
			}
			return syncSettingsFromStorage();
		}

		// One process-wide listener keeps other windows/tabs in sync. Node and
		// plain test environments have no addEventListener, hence the guard.
		try {
			if (typeof globalThis.addEventListener === "function") globalThis.addEventListener("storage", handleStorageEvent);
		} catch {
			// Cross-window sync is best effort only.
		}

		/* ------------------------------------------------------- approval log store */

		let cachedLog = readStoredLog();
		/** @type {Set<() => void>} */
		const logListeners = new Set();

		/** Keep only the fields schema v1 knows; drop garbage entries. */
		function normalizeLogEntry(value) {
			if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
			if (typeof value.id !== "string" || value.id === "") return undefined;
			if (typeof value.sessionId !== "string" || value.sessionId === "") return undefined;
			return {
				v: LOG_SCHEMA_VERSION,
				id: value.id,
				sessionId: value.sessionId,
				sessionTitle: truncateText(value.sessionTitle, 200),
				toolName: typeof value.toolName === "string" ? value.toolName : "",
				reason: truncateText(value.reason, LOG_MAX_TEXT),
				note: truncateText(value.note, LOG_MAX_TEXT),
				noteMode: value.noteMode === "steer" || value.noteMode === "queue" ? value.noteMode : undefined,
				askedAt: typeof value.askedAt === "number" && Number.isFinite(value.askedAt) ? value.askedAt : Date.now(),
				decidedAt: typeof value.decidedAt === "number" && Number.isFinite(value.decidedAt) ? value.decidedAt : undefined,
				latencyMs: typeof value.latencyMs === "number" && Number.isFinite(value.latencyMs) ? value.latencyMs : undefined,
				outcome: value.outcome === "allowed-once" || value.outcome === "rejected" ? value.outcome : "unknown",
				via: value.via === "panel" ? "panel" : "unknown",
				source: "client-overlay",
				fidelity: "partial",
			};
		}

		/** Keep the newest LOG_MAX_TOTAL / LOG_MAX_PER_SESSION entries. */
		function trimLog(entries) {
			const list = Array.isArray(entries) ? entries : [];
			const kept = [];
			const perSession = new Map();
			for (let index = list.length - 1; index >= 0; index -= 1) {
				const entry = list[index];
				if (entry === null || typeof entry !== "object") continue;
				const count = perSession.get(entry.sessionId) ?? 0;
				if (count >= LOG_MAX_PER_SESSION) continue;
				perSession.set(entry.sessionId, count + 1);
				kept.push(entry);
			}
			kept.reverse();
			return kept.length > LOG_MAX_TOTAL ? kept.slice(kept.length - LOG_MAX_TOTAL) : kept;
		}

		/** Read the persisted log; malformed storage degrades to an empty log. */
		function readStoredLog() {
			let raw;
			try {
				if (typeof globalThis.localStorage === "undefined" || globalThis.localStorage === null) return [];
				raw = globalThis.localStorage.getItem(LOG_KEY);
			} catch {
				return [];
			}
			if (typeof raw !== "string" || raw === "") return [];
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return [];
			}
			const entries = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed.entries : undefined;
			if (!Array.isArray(entries)) return [];
			const normalized = [];
			for (const value of entries) {
				const entry = normalizeLogEntry(value);
				if (entry !== undefined) normalized.push(entry);
			}
			return trimLog(normalized);
		}

		function persistLog(entries) {
			try {
				if (typeof globalThis.localStorage === "undefined" || globalThis.localStorage === null) return;
				globalThis.localStorage.setItem(LOG_KEY, JSON.stringify({ schema: LOG_SCHEMA_VERSION, entries }));
			} catch {
				// Persistence only: the in-memory log stays usable.
			}
		}

		function notifyLog() {
			for (const listener of Array.from(logListeners)) {
				try {
					listener();
				} catch {
					// A broken subscriber must not break the store.
				}
			}
		}

		/** Current log entries (stable reference between writes). */
		function getLogEntries() {
			return cachedLog;
		}

		/** Subscribe to log writes; returns an unsubscribe function. */
		function subscribeLog(listener) {
			if (typeof listener !== "function") return () => {};
			logListeners.add(listener);
			return () => {
				logListeners.delete(listener);
			};
		}

		/** Merge one entry by id, apply the caps, persist and notify. */
		function putLogEntry(entry) {
			cachedLog = trimLog(cachedLog.filter((existing) => existing.id !== entry.id).concat([entry]));
			persistLog(cachedLog);
			notifyLog();
			return entry;
		}

		/** True when a disappeared approval should be logged as an external decision. */
		function shouldRecordLostApproval(lostKey, answeringKey) {
			if (typeof lostKey !== "string" || lostKey === "") return false;
			if (typeof answeringKey !== "string" || answeringKey === "") return true;
			return lostKey !== answeringKey;
		}

		/** Record a newly seen approval (only when the log switch is on). */
		function recordLogAsked(input) {
			if (cachedSettings.approvalLog !== true) return undefined;
			if (input === null || typeof input !== "object") return undefined;
			if (typeof input.id !== "string" || input.id === "" || typeof input.sessionId !== "string" || input.sessionId === "") return undefined;
			const existing = cachedLog.find((entry) => entry.id === input.id);
			if (existing !== undefined) return existing;
			return putLogEntry({
				v: LOG_SCHEMA_VERSION,
				id: input.id,
				sessionId: input.sessionId,
				sessionTitle: truncateText(input.sessionTitle, 200),
				toolName: typeof input.toolName === "string" ? input.toolName : "",
				reason: truncateText(input.reason, LOG_MAX_TEXT),
				askedAt: typeof input.askedAt === "number" ? input.askedAt : Date.now(),
				outcome: "unknown",
				via: "unknown",
				source: "client-overlay",
				fidelity: "partial",
			});
		}

		/** Fill the decided fields; a decided entry is never downgraded. */
		function recordLogDecided(id, patch) {
			if (cachedSettings.approvalLog !== true) return undefined;
			const index = cachedLog.findIndex((entry) => entry.id === id);
			if (index < 0) return undefined;
			const current = cachedLog[index];
			const source = patch === null || typeof patch !== "object" ? {} : patch;
			const isUpgrade = typeof current.decidedAt === "number" && current.via === "unknown" && source.via === "panel";
			if (typeof current.decidedAt === "number" && !isUpgrade) return current;
			const decidedAt =
				typeof source.decidedAt === "number" ? source.decidedAt : typeof current.decidedAt === "number" ? current.decidedAt : Date.now();
			const updated = {
				...current,
				outcome: source.outcome === "allowed-once" || source.outcome === "rejected" ? source.outcome : "unknown",
				via: source.via === "panel" ? "panel" : "unknown",
				decidedAt,
				latencyMs: Math.max(0, decidedAt - current.askedAt),
				note: truncateText(source.note, LOG_MAX_TEXT) ?? current.note,
				noteMode: source.noteMode === "steer" || source.noteMode === "queue" ? source.noteMode : current.noteMode,
			};
			const next = cachedLog.slice();
			next[index] = updated;
			cachedLog = next;
			persistLog(cachedLog);
			notifyLog();
			return updated;
		}

		/** Fill in a session title learned after the approval was recorded. */
		function recordLogSessionTitle(id, title) {
			if (cachedSettings.approvalLog !== true) return undefined;
			const text = truncateText(title, 200);
			if (text === undefined) return undefined;
			const index = cachedLog.findIndex((entry) => entry.id === id);
			if (index < 0) return undefined;
			const current = cachedLog[index];
			if (current.sessionTitle === text) return current;
			const next = cachedLog.slice();
			next[index] = { ...current, sessionTitle: text };
			cachedLog = next;
			persistLog(cachedLog);
			notifyLog();
			return next[index];
		}

		/** Clear the local log (localStorage only; never external). */
		function clearLog() {
			cachedLog = [];
			persistLog(cachedLog);
			notifyLog();
			return cachedLog;
		}

		/** storage-event handler for the log key. */
		function handleLogStorageEvent(event) {
			if (event !== undefined && event !== null && event.key !== undefined && event.key !== null && event.key !== LOG_KEY) {
				return cachedLog;
			}
			cachedLog = readStoredLog();
			notifyLog();
			return cachedLog;
		}

		try {
			if (typeof globalThis.addEventListener === "function") globalThis.addEventListener("storage", handleLogStorageEvent);
		} catch {
			// Cross-window sync is best effort only.
		}

		/* -------------------------------------------------------- update checker */

		let updateCache = { at: 0, result: undefined };

		/** Last registry result while it is younger than the auto-check interval. */
		function getCachedUpdate(now) {
			const at = typeof now === "number" ? now : Date.now();
			if (updateCache.result === undefined) return undefined;
			if (at - updateCache.at > UPDATE_AUTO_INTERVAL_MS) return undefined;
			return updateCache.result;
		}

		/** Run one registry check and remember the result in memory. */
		async function runUpdateCheck(options) {
			const result = await checkForUpdate(PLUGIN_VERSION, options);
			updateCache = { at: Date.now(), result };
			return result;
		}

		/**
		 * Deliver the optional note, then answer one approval with `outcome`.
		 * Prompt-before-answer is a hard ordering requirement: the model should
		 * read the note in this turn before the tool call is let through. A failed
		 * delivery blocks the answer on purpose (no note, no authorization) so the
		 * user can retry from the still-open panel.
		 * @returns {Promise<{answered: boolean, delivery?: {mode: string, error?: string}}>}
		 */
		async function answerApproval(target, remote, prefix, reason, outcome) {
			let delivery;
			if (reason !== "") {
				delivery = await deliverReason(remote, target.sessionId, prefix, reason);
				if (delivery.mode === "failed") return { answered: false, delivery };
			}
			let answered = false;
			try {
				await target.pending.answer(outcome);
				answered = true;
			} catch {
				answered = false;
			}
			return delivery === undefined ? { answered } : { answered, delivery };
		}

		/** Answer one approval as rejected, optionally carrying a reason first. */
		async function rejectApproval(target, remote, prefix, reason) {
			return answerApproval(target, remote, prefix, reason, "rejected");
		}

		/** Answer one approval as allowed once, optionally carrying a note first. */
		async function allowApproval(target, remote, prefix, reason) {
			return answerApproval(target, remote, prefix, reason, "allowed-once");
		}

		/* ------------------------------------------------------------ theme */

		// 0.3.0: one fixed column hosts the approval card and the delivered-notice
		// stack, so a new card can appear without dropping earlier notices.
		const noticeLayer = {
			position: "fixed",
			right: 24,
			top: 112,
			width: 344,
			maxWidth: "calc(100vw - 48px)",
			display: "flex",
			flexDirection: "column",
			alignItems: "stretch",
			gap: 8,
			pointerEvents: "none",
			zIndex: 30,
		};

		const surface = {
			width: "100%",
			boxSizing: "border-box",
			pointerEvents: "auto",
			padding: "12px 14px",
			borderRadius: "var(--dsw-radius-xl, 14px)",
			border: "1px solid var(--dsw-alias-border-l2, #3a3a3a)",
			background: "var(--dsw-alias-bg-layer-2, #1e1e1e)",
			color: "var(--dsw-alias-label-primary, #e8e8e8)",
			boxShadow: "var(--dsw-shadow-lv2, 0 8px 28px rgba(0, 0, 0, 0.35))",
			fontFamily: "var(--dsw-font-base-16-font-family, system-ui, sans-serif)",
			fontSize: "var(--dsw-font-base-16-font-size, 13px)",
			lineHeight: "var(--dsw-font-base-16-line-height, 1.5)",
		};

		const headRow = { display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13, minWidth: 0 };
		const dotStyle = { width: 8, height: 8, borderRadius: "50%", flex: "none", background: "var(--dsw-alias-state-warn-primary, #e0a45e)" };
		const titleStyle = { flex: "none", color: "var(--dsw-alias-label-primary, #e8e8e8)", fontWeight: 600 };
		const toolStyle = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--dsw-alias-label-tertiary, #9a9a9a)", fontWeight: 400 };
		const hintStyle = { marginBottom: 8, color: "var(--dsw-alias-label-secondary, #b9b9b9)", fontSize: 12 };
		const sessionStyle = {
			marginBottom: 6,
			color: "var(--dsw-alias-label-tertiary, #9a9a9a)",
			fontSize: 12,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		};
		const inputStyle = {
			width: "100%",
			minHeight: 64,
			resize: "vertical",
			boxSizing: "border-box",
			padding: "8px 10px",
			borderRadius: "var(--dsw-radius-md, 9px)",
			border: "1px solid var(--dsw-alias-border-l2, #3a3a3a)",
			background: "var(--dsw-specific-input-major, #10141a)",
			color: "var(--dsw-alias-label-primary, #e8e8e8)",
			font: "inherit",
			outline: "none",
		};
		const actionsRow = { display: "flex", alignItems: "center", gap: 8, marginTop: 9 };
		const buttonBase = {
			borderRadius: "var(--dsw-radius-md, 9px)",
			padding: "6px 12px",
			font: "inherit",
			cursor: "pointer",
			border: "1px solid transparent",
		};
		const primaryButton = {
			...buttonBase,
			background: "var(--dsw-alias-button-primary-fill, #f0f0f0)",
			color: "var(--dsw-alias-label-primary-foreground, #141414)",
			fontWeight: 600,
		};
		const ghostButton = {
			...buttonBase,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary, #b9b9b9)",
			border: "1px solid var(--dsw-alias-border-l2, #3a3a3a)",
		};
		// Confirming an allow is the risky step: warn/danger fill, deep label.
		const confirmButton = {
			...buttonBase,
			background: "var(--dsw-alias-state-warn-primary, #e0a45e)",
			color: "var(--dsw-alias-label-primary-foreground, #141414)",
			fontWeight: 600,
		};
		const noticeTone = {
			ok: { color: "var(--dsw-alias-state-success-primary, #4ec9a0)" },
			warn: { color: "var(--dsw-alias-state-warn-label, #e0a45e)" },
			error: { color: "var(--dsw-alias-state-error-primary, #e08a84)" },
		};
		const collapseButton = {
			flex: "none",
			marginLeft: "auto",
			padding: "0 4px",
			border: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary, #8a8a8a)",
			font: "inherit",
			lineHeight: 1,
			cursor: "pointer",
		};
		const pillStyle = {
			alignSelf: "flex-end",
			pointerEvents: "auto",
			display: "flex",
			alignItems: "center",
			gap: 6,
			padding: "6px 12px",
			boxSizing: "border-box",
			borderRadius: "999px",
			border: "1px solid var(--dsw-alias-border-l2, #3a3a3a)",
			background: "var(--dsw-alias-bg-layer-2, #1e1e1e)",
			color: "var(--dsw-alias-label-secondary, #b9b9b9)",
			opacity: 0.82,
			boxShadow: "var(--dsw-shadow-lv1, 0 2px 8px rgba(0, 0, 0, 0.25))",
			font: "inherit",
			fontSize: "var(--dsw-font-base-16-font-size, 13px)",
			cursor: "pointer",
		};
		const pillToolStyle = {
			maxWidth: 160,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			color: "var(--dsw-alias-label-tertiary, #8a8a8a)",
			fontSize: 12,
		};
		const confirmTitleStyle = { marginBottom: 6, fontWeight: 600, color: "var(--dsw-alias-label-primary, #e8e8e8)" };
		const confirmBodyStyle = { marginBottom: 8, color: "var(--dsw-alias-label-secondary, #b9b9b9)", fontSize: 12 };
		const warnHintStyle = { marginBottom: 8, color: "var(--dsw-alias-state-warn-label, #e0a45e)", fontSize: 12 };
		const confirmNoteStyle = {
			marginBottom: 8,
			padding: "6px 8px",
			borderRadius: "var(--dsw-radius-md, 9px)",
			background: "var(--dsw-specific-input-major, #10141a)",
			color: "var(--dsw-alias-label-secondary, #b9b9b9)",
			fontSize: 12,
			whiteSpace: "pre-wrap",
			overflowWrap: "anywhere",
		};
		const settingsSectionStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 4,
			width: "100%",
			maxWidth: "100%",
			boxSizing: "border-box",
			color: "var(--dsw-alias-label-primary, #e8e8e8)",
			fontFamily: "var(--dsw-font-base-16-font-family, system-ui, sans-serif)",
			fontSize: "var(--dsw-font-base-16-font-size, 13px)",
			lineHeight: "var(--dsw-font-base-16-line-height, 1.5)",
		};
		const settingsTitleStyle = { fontWeight: 600, fontSize: 14, color: "var(--dsw-alias-label-primary, #e8e8e8)" };
		const settingsIntroStyle = { color: "var(--dsw-alias-label-secondary, #b9b9b9)", fontSize: 12 };
		const settingsRowStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 4,
			padding: "10px 0 2px",
			borderTop: "1px solid var(--dsw-alias-border-l2, #3a3a3a)",
		};
		const settingsHeadStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
		const settingsLabelStyle = { fontWeight: 600, cursor: "pointer", color: "var(--dsw-alias-label-primary, #e8e8e8)" };
		const settingsCheckboxStyle = {
			width: 16,
			height: 16,
			flex: "none",
			accentColor: "var(--dsw-alias-state-warn-primary, #e0a45e)",
			cursor: "pointer",
		};
		const settingsDescStyle = { color: "var(--dsw-alias-label-secondary, #b9b9b9)", fontSize: 12 };
		const settingsRiskStyle = { display: "flex", flexDirection: "column", gap: 2 };
		const settingsRiskOnStyle = { color: "var(--dsw-alias-label-tertiary, #9a9a9a)", fontSize: 12 };
		const settingsRiskOffStyle = { color: "var(--dsw-alias-state-warn-label, #e0a45e)", fontSize: 12 };
		const settingsDefaultStyle = { paddingTop: 8, color: "var(--dsw-alias-label-tertiary, #9a9a9a)", fontSize: 12 };
		// 0.3.0 delivered notices.
		const deliveredNoticeStyle = {
			pointerEvents: "auto",
			boxSizing: "border-box",
			padding: "9px 12px",
			borderRadius: "var(--dsw-radius-lg, 12px)",
			border: "1px solid var(--dsw-alias-border-l2, #3a3a3a)",
			background: "var(--dsw-alias-bg-layer-2, #1e1e1e)",
			fontFamily: "var(--dsw-font-base-16-font-family, system-ui, sans-serif)",
			fontSize: 12,
			lineHeight: "var(--dsw-font-base-16-line-height, 1.5)",
			overflowWrap: "anywhere",
			boxShadow: "var(--dsw-shadow-lv1, 0 2px 8px rgba(0, 0, 0, 0.25))",
		};
		const deliveredSteerStyle = { color: "var(--dsw-alias-state-success-primary, #4ec9a0)" };
		const deliveredQueueStyle = { color: "var(--dsw-alias-state-warn-label, #e0a45e)" };
		// 0.3.0 settings: duration input, action buttons and the log viewer.
		const settingsInlineRowStyle = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 2 };
		const settingsNumberStyle = {
			width: 72,
			padding: "4px 8px",
			boxSizing: "border-box",
			borderRadius: "var(--dsw-radius-md, 9px)",
			border: "1px solid var(--dsw-alias-border-l2, #3a3a3a)",
			background: "var(--dsw-specific-input-major, #10141a)",
			color: "var(--dsw-alias-label-primary, #e8e8e8)",
			font: "inherit",
		};
		const settingsButtonStyle = {
			borderRadius: "var(--dsw-radius-md, 9px)",
			padding: "5px 10px",
			font: "inherit",
			fontSize: 12,
			cursor: "pointer",
			border: "1px solid var(--dsw-alias-border-l2, #3a3a3a)",
			background: "transparent",
			color: "var(--dsw-alias-label-secondary, #b9b9b9)",
		};
		const settingsButtonActiveStyle = {
			...settingsButtonStyle,
			background: "var(--dsw-alias-state-warn-primary, #e0a45e)",
			borderColor: "transparent",
			color: "var(--dsw-alias-label-primary-foreground, #141414)",
			fontWeight: 600,
		};
		const logListStyle = { display: "flex", flexDirection: "column", gap: 6, marginTop: 6, maxHeight: 300, overflowY: "auto" };
		const logEntryStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 2,
			padding: "7px 9px",
			borderRadius: "var(--dsw-radius-md, 9px)",
			background: "var(--dsw-alias-bg-layer-1, #161616)",
			border: "1px solid var(--dsw-alias-border-l2, #3a3a3a)",
		};
		const logHeadStyle = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--dsw-alias-label-primary, #e8e8e8)" };
		const logMetaStyle = { color: "var(--dsw-alias-label-tertiary, #9a9a9a)", fontSize: 11 };
		const logSubStyle = { color: "var(--dsw-alias-label-secondary, #b9b9b9)", fontSize: 12, overflowWrap: "anywhere" };
		const logActionsStyle = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6 };
		const logFilterRowStyle = { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 };
		const settingsStatusStyle = { color: "var(--dsw-alias-label-secondary, #b9b9b9)", fontSize: 12, overflowWrap: "anywhere", paddingTop: 2 };

		/* -------------------------------------------------------- component */

		/** Subscribe a component to the settings store. */
		function useSettings() {
			return React.useSyncExternalStore(subscribe, getSettings, getSettings);
		}

		/**
		 * Frame-wide panel: while one answerable approval exists, offer an
		 * optional note plus allow/reject actions. "Allow" first opens an inline
		 * confirmation view (the tool runs immediately after an allow) whose Esc
		 * cancels and whose Enter does nothing.
		 * @param props - slot props: session status hook, locale seat, remote service.
		 * @returns the panel, a result notice, or null.
		 */
		function ApprovalReasonDock(props) {
			const useSessionStatus = props.useSessionStatus;
			const useSessions = props.useSessions;
			const t = props.t;
			const remote = props.remote;
			const uiSession = props.uiSession;
			// Settings live in a module store shared with the settings section.
			const settings = useSettings();
			const allowNote = settings.allowNote === true;
			const confirmAllow = settings.confirmAllow === true;
			// uiSession is the service; `.current` is the binding source for the
			// session shown in the main view.
			const currentSessionSource = uiSession === undefined || uiSession === null ? undefined : uiSession.current;
			const currentSessionId = useCurrentSessionId(currentSessionSource);
			// Narrow subscriptions: only the visible session's status/title can
			// change what this panel renders. With many concurrent approvals this
			// keeps re-renders tied to the visible session instead of every update.
			const status = useSessionStatus((value) =>
				value === undefined || value === null || currentSessionId === undefined ? undefined : value.get(currentSessionId),
			);
			const approval = React.useMemo(() => approvalFromStatus(status, currentSessionId), [status, currentSessionId]);
			const useSessionsMaybe = typeof useSessions === "function" ? useSessions : () => undefined;
			const sessionTitle = useSessionsMaybe((value) => (approval === undefined ? undefined : sessionTitleOf(value, approval.sessionId)));
			const seenKey = React.useRef(undefined);
			const lastTarget = React.useRef(undefined);
			// Synchronous duplicate-submit guard: `busy` only becomes true after a
			// re-render, so two clicks in the same tick could both pass a state check.
			const submittingRef = React.useRef(false);
			const [draft, setDraft] = React.useState("");
			const [busy, setBusy] = React.useState(false);
			const [notice, setNotice] = React.useState(null);
			const [collapsed, setCollapsed] = React.useState(false);
			const [view, setView] = React.useState("input");
			// 0.3.0: delivered notices live in their own in-memory queue, so a new
			// approval card, a session switch or a re-render never drops them.
			const [delivered, setDelivered] = React.useState([]);
			const deliveredTimer = React.useRef(undefined);
			const lostKey = React.useRef(undefined);
			// Key the plugin is currently answering. The host may push the approval
			// status change synchronously inside `await answer()`, which would let
			// the "approval disappeared" effect write a bogus `unknown` outcome
			// before the success path records the real one — so the effect skips the
			// key we are answering (and the store also refuses to downgrade a panel
			// decision that arrives second).
			const answeringKey = React.useRef(undefined);
			// Approval keys (`approval:3`) restart at 1 on every DSH boot, so they are
			// not unique across runs inside one session log. The persisted log key
			// therefore gets a per-mount instance suffix: same mount reuses it for
			// asked→decided, a remount (new run) starts a fresh entry.
			const logIds = React.useRef(new Map());

			/** Stable log id for one approval instance in this mount. */
			const logIdOf = React.useCallback((approval) => {
				const key = approval !== null && typeof approval === "object" && typeof approval.key === "string" ? approval.key : "";
				if (key === "") return undefined;
				const existing = logIds.current.get(key);
				if (existing !== undefined) return existing;
				const created = key + "#" + requestId();
				logIds.current.set(key, created);
				return created;
			}, []);

			const clearDeliveredTimer = React.useCallback(() => {
				if (deliveredTimer.current === undefined) return;
				if (typeof globalThis.clearTimeout === "function") globalThis.clearTimeout(deliveredTimer.current);
				deliveredTimer.current = undefined;
			}, []);

			const armDeliveredTimer = React.useCallback(
				(duration) => {
					clearDeliveredTimer();
					if (typeof globalThis.setTimeout !== "function") return;
					deliveredTimer.current = globalThis.setTimeout(() => {
						deliveredTimer.current = undefined;
						setDelivered([]);
					}, duration);
				},
				[clearDeliveredTimer],
			);

			const pushDelivered = React.useCallback(
				(mode) => {
					if (settings.allowNotice !== true) return;
					setDelivered((previous) => pushNotice(previous, { id: requestId(), mode }));
					armDeliveredTimer(settings.allowNoticeMs);
				},
				[armDeliveredTimer, settings.allowNotice, settings.allowNoticeMs],
			);

			React.useEffect(
				() => () => {
					// Unmount only drops the timer; the queue is memory-only anyway.
					clearDeliveredTimer();
				},
				[clearDeliveredTimer],
			);

			React.useEffect(() => {
				if (settings.allowNotice !== true) {
					clearDeliveredTimer();
					setDelivered((previous) => (previous.length === 0 ? previous : []));
					return;
				}
				if (deliveredTimer.current !== undefined) armDeliveredTimer(settings.allowNoticeMs);
			}, [settings.allowNotice, settings.allowNoticeMs, clearDeliveredTimer, armDeliveredTimer]);

			React.useEffect(() => {
				// Switching sessions resets the transient notice and the stale
				// answer target, and returns to the input view; the typed draft is
				// kept per approval key so switching back restores it.
				lastTarget.current = undefined;
				setNotice(null);
				setView("input");
			}, [currentSessionId]);

			React.useEffect(() => {
				if (approval === undefined) return;
				lastTarget.current = approval;
				const logId = logIdOf(approval);
				lostKey.current = { key: approval.key, sessionId: approval.sessionId, logId };
				if (seenKey.current === approval.key) return;
				seenKey.current = approval.key;
				setDraft(recallDraft(approval.key));
				setNotice(null);
				setView("input");
				setCollapsed(false);
				const pending = approval.pending;
				const reason =
					typeof pending.reason === "string" && pending.reason !== ""
						? pending.reason
						: typeof pending.displayReason === "string" && pending.displayReason !== ""
							? pending.displayReason
							: undefined;
				recordLogAsked({
					id: logId,
					sessionId: approval.sessionId,
					toolName: typeof pending.toolName === "string" ? pending.toolName : "",
					reason,
					sessionTitle,
				});
			}, [approval, logIdOf, sessionTitle]);

			React.useEffect(() => {
				// The panel answered nothing yet the approval disappeared while its
				// session stayed current: the built-in card handled it. Record the
				// honest "unknown" outcome once; an entry the plugin already decided
				// is never overwritten, and the approval the plugin is currently
				// answering is never misread as "handled elsewhere".
				if (approval !== undefined || lostKey.current === undefined) return;
				const lost = lostKey.current;
				lostKey.current = undefined;
				if (lost.sessionId !== currentSessionId) return;
				if (shouldRecordLostApproval(lost.key, answeringKey.current) !== true) return;
				recordLogDecided(lost.logId, { outcome: "unknown", via: "unknown", decidedAt: Date.now() });
			}, [approval, currentSessionId]);

			React.useEffect(() => {
				if (approval === undefined || sessionTitle === undefined) return;
				recordLogSessionTitle(logIdOf(approval), sessionTitle);
			}, [approval, logIdOf, sessionTitle]);

			React.useEffect(() => {
				// Defensive: switching "allow confirmation" off while the confirm
				// view happens to be open must never leave a stale confirmation.
				if (view === "confirm-allow" && confirmAllow !== true) setView("input");
			}, [view, confirmAllow]);

			const dismiss = React.useCallback(() => setNotice(null), []);

			const cancelConfirm = React.useCallback(() => setView("input"), []);

			const submit = React.useCallback(
				async (outcome, withNote) => {
					if (busy || submittingRef.current) return;
					const target = approval === undefined ? lastTarget.current : approval;
					if (target === undefined) return;
					submittingRef.current = true;
					answeringKey.current = target.key;
					setBusy(true);
					try {
						const reason = withNote ? normalizeReason(draft) : "";
						const prefix = outcome === "allowed-once" ? t("allowPrefix") : t("reasonPrefix");
						let result;
						try {
							result = await answerApproval(target, remote, prefix, reason, outcome);
						} catch {
							result = { answered: false };
						}
						if (result.answered !== true) {
							// Delivery failed: the approval is still pending and the note is
							// kept, so the user can retry from the input view. An approval
							// handled elsewhere has nothing left to retry: clear the draft.
							if (result.delivery !== undefined && result.delivery.mode === "failed") {
								setView("input");
								setNotice({ kind: "error", text: t("deliveryFailed", { error: result.delivery.error }) });
								return;
							}
							lastTarget.current = undefined;
							rememberDraft(target.key, "");
							setDraft("");
							setNotice(null);
							setView("input");
							return;
						}
						// Answered: clear the draft and drop the panel with the approval.
						lastTarget.current = undefined;
						rememberDraft(target.key, "");
						setDraft("");
						setNotice(null);
						setView("input");
						setCollapsed(false);
						const deliveryMode =
							result.delivery !== undefined && result.delivery.mode !== "failed" ? result.delivery.mode : undefined;
						// Allow side only: a delivered allow-with-note queues one notice.
						if (outcome === "allowed-once" && deliveryMode !== undefined) pushDelivered(deliveryMode);
						recordLogDecided(logIdOf(target), {
							outcome,
							via: "panel",
							note: reason,
							noteMode: deliveryMode,
							decidedAt: Date.now(),
						});
					} finally {
						// Clear only after the log write: the lost-approval effect runs
						// during the await and must see the key as "being answered".
						submittingRef.current = false;
						answeringKey.current = undefined;
						setBusy(false);
					}
				},
				[approval, busy, draft, logIdOf, pushDelivered, remote, t],
			);

			// Confirmation view keyboard rules: Esc cancels (never allows), Enter
			// is swallowed so it cannot trigger the allow button.
			React.useEffect(() => {
				if (view !== "confirm-allow") return undefined;
				if (typeof globalThis.addEventListener !== "function") return undefined;
				const onKeyDown = (event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						cancelConfirm();
					} else if (event.key === "Enter") {
						event.preventDefault();
					}
				};
				globalThis.addEventListener("keydown", onKeyDown);
				return () => {
					if (typeof globalThis.removeEventListener === "function") globalThis.removeEventListener("keydown", onKeyDown);
				};
			}, [view, cancelConfirm]);

			// 0.3.0 render model: one fixed column stacks the approval card, the
			// panel-local result notice and the delivered-notice queue. Nothing here
			// clears the queue — only the timer / settings / unmount do.
			const blocks = [];
			if (approval === undefined) {
				if (notice !== null) {
					blocks.push(
						h(
							"div",
							{ key: "panel-notice", style: surface, role: "status", "aria-label": t("ariaPanel") },
							noticeRow(t, notice, dismiss),
						),
					);
				}
			} else {
				const toolName = typeof approval.pending.toolName === "string" ? approval.pending.toolName : "";
				if (collapsed) {
					blocks.push(
						h(
							"button",
							{
								key: "pill",
								type: "button",
								style: pillStyle,
								title: t("expand"),
								"aria-label": t("expand"),
								onClick: () => setCollapsed(false),
							},
							h("span", { style: { ...dotStyle, flex: "none" } }),
							h("span", null, t("pendingBadge")),
							toolName !== "" ? h("span", { style: pillToolStyle }, toolName) : null,
						),
					);
				} else {
					const header = h(
						"div",
						{ style: headRow },
						h("span", { style: dotStyle, "aria-hidden": true }),
						h("span", { style: titleStyle }, t("title")),
						toolName !== "" ? h("span", { style: toolStyle, title: toolName }, t("tool", { tool: toolName })) : null,
						h(
							"button",
							{
								type: "button",
								style: collapseButton,
								title: t("collapse"),
								"aria-label": t("collapse"),
								onClick: () => setCollapsed(true),
							},
							"–",
						),
					);
					const sessionRow =
						sessionTitle === undefined ? null : h("div", { style: sessionStyle }, t("session", { title: sessionTitle }));

					if (view === "confirm-allow") {
						blocks.push(
							h(
								"div",
								{ key: "confirm", style: surface, role: "dialog", "aria-label": t("ariaConfirmPanel") },
								header,
								sessionRow,
								h("div", { style: confirmTitleStyle }, t("confirmTitle")),
								h("div", { style: confirmBodyStyle }, t("confirmBody")),
								busy ? h("div", { style: hintStyle }, t("sending")) : null,
								h("div", { style: warnHintStyle }, t("partialAgreementHint")),
								draft !== "" && allowNote
									? h("div", { style: confirmNoteStyle }, t("confirmNote", { text: normalizeReason(draft) }))
									: null,
								allowNote === false ? h("div", { style: warnHintStyle }, t("allowNoteDisabledHint")) : null,
								h(
									"div",
									{ style: actionsRow },
									h(
										"button",
										{
											type: "button",
											style: confirmButton,
											disabled: busy,
											onClick: () => void submit("allowed-once", allowNote && draft !== ""),
										},
										t("confirmAllow"),
									),
									h("button", { type: "button", style: ghostButton, disabled: busy, onClick: cancelConfirm }, t("cancel")),
								),
							),
						);
					} else {
						blocks.push(
							h(
								"div",
								{ key: "panel", style: surface, role: "dialog", "aria-label": t("ariaPanel") },
								header,
								sessionRow,
								// A failed note delivery keeps the approval open, so its error has
								// to be visible inside the panel next to the draft it must retry.
								notice === null ? null : noticeRow(t, notice, dismiss),
								h("div", { style: hintStyle }, busy ? t("sending") : t("hint")),
								h("textarea", {
									style: inputStyle,
									value: draft,
									disabled: busy,
									placeholder: t("placeholder"),
									"aria-label": t("ariaInput"),
									onChange: (event) => {
										const next = event.target.value;
										setDraft(next);
										rememberDraft(approval.key, next);
									},
									onKeyDown: (event) => {
										// Enter without Shift keeps the safe direction: reject with note.
										if (event.key === "Enter" && event.shiftKey !== true) {
											event.preventDefault();
											void submit("rejected", true);
										}
									},
								}),
								h(
									"div",
									{ style: actionsRow },
									h(
										"button",
										{
											type: "button",
											style: primaryButton,
											disabled: busy,
											onClick: () => {
												if (busy) return;
												if (confirmAllow !== true) {
													// Confirmation switched off: allow immediately (still
													// carrying the note only when allow-with-note is on).
													void submit("allowed-once", allowNote && draft !== "");
													return;
												}
												setView("confirm-allow");
											},
										},
										allowNote && draft !== "" ? t("allowWithNote") : t("allowPlain"),
									),
									h(
										"button",
										{
											type: "button",
											style: ghostButton,
											disabled: busy,
											onClick: () => void submit("rejected", draft !== ""),
										},
										draft !== "" ? t("rejectWithNote") : t("rejectPlain"),
									),
								),
							),
						);
					}
				}
			}
			for (const item of delivered) blocks.push(deliveredNoticeBlock(t, item));
			if (blocks.length === 0) return null;
			return h("div", { style: noticeLayer, "data-approval-dock": "layer" }, blocks);
		}

		/** One delivered notice: steer is ok tone, queue downgrade is a warning. */
		function deliveredNoticeBlock(t, notice) {
			const mode = notice !== null && typeof notice === "object" && notice.mode === "queue" ? "queue" : "steer";
			const warn = mode === "queue";
			const text = (warn ? NOTICE_WARN_ICON + " " : "") + t(noticeTextKey(mode));
			return h(
				"div",
				{
					key: notice !== null && typeof notice === "object" && notice.id !== undefined ? String(notice.id) : text,
					style: deliveredNoticeStyle,
					role: "status",
					"data-notice-mode": mode,
				},
				h("div", { style: warn ? deliveredQueueStyle : deliveredSteerStyle }, text),
			);
		}

		/** One result notice with its dismiss control. */
		function noticeRow(t, notice, dismiss) {
			return h(
				"div",
				null,
				h(
					"div",
					{ style: { ...hintStyle, marginBottom: 0, color: (noticeTone[notice.kind] ?? noticeTone.warn).color, whiteSpace: "pre-wrap", overflowWrap: "anywhere" } },
					notice.text,
				),
				h(
					"div",
					{ style: { ...actionsRow, marginTop: 9 } },
					h("button", { type: "button", style: ghostButton, onClick: dismiss }, t("close")),
				),
			);
		}

		/* -------------------------------------------------- settings section */

		/**
		 * Settings page section: two independent switches, each with its on/off
		 * risk copy. Values come from the module store, so the overlay and any
		 * other window stay in sync.
		 * @param props - slot props: locale seat.
		 */
		/** Subscribe a component to the approval-log store. */
		function useLogEntries() {
			return React.useSyncExternalStore(subscribeLog, getLogEntries, getLogEntries);
		}

		/**
		 * Settings page section: 0.2.0's two allow switches, 0.3.0's delivered
		 * notices (+ duration), the local approval log and the update check.
		 * Values come from module stores, so the overlay and other windows stay
		 * in sync.
		 * @param props - slot props: locale seat.
		 */
		function SettingsSection(props) {
			const t = props.t;
			const settings = useSettings();
			const logEntries = useLogEntries();
			const [logFilter, setLogFilter] = React.useState("all");
			const [exportFailed, setExportFailed] = React.useState(false);
			const [updateState, setUpdateState] = React.useState({ kind: "idle" });
			const checkingRef = React.useRef(false);

			/** Manual checks always hit the registry; auto checks reuse an hour. */
			const runCheck = React.useCallback(async (manual) => {
				if (checkingRef.current) return;
				if (manual !== true) {
					const cached = getCachedUpdate();
					if (cached !== undefined) {
						setUpdateState({ kind: "done", result: cached, manual: false });
						return;
					}
				}
				checkingRef.current = true;
				setUpdateState({ kind: "checking" });
				let result;
				try {
					result = await runUpdateCheck();
				} catch (error) {
					result = { status: "failed", error: error instanceof Error ? error.message : String(error) };
				}
				checkingRef.current = false;
				setUpdateState({ kind: "done", result, manual: manual === true });
			}, []);

			React.useEffect(() => {
				if (settings.updateCheck !== true) return;
				void runCheck(false);
			}, [settings.updateCheck, runCheck]);

			const onExport = React.useCallback(() => {
				const text = formatLogExport(getLogEntries());
				let ok = false;
				try {
					if (
						typeof Blob === "function" &&
						typeof URL !== "undefined" &&
						typeof URL.createObjectURL === "function" &&
						typeof document !== "undefined" &&
						typeof document.createElement === "function"
					) {
						const blob = new Blob([text], { type: "application/json" });
						const url = URL.createObjectURL(blob);
						const anchor = document.createElement("a");
						anchor.href = url;
						anchor.download = "dsh-approval-log-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
						if (typeof anchor.click === "function") anchor.click();
						if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
						ok = true;
					}
				} catch {
					ok = false;
				}
				setExportFailed(!ok);
			}, []);

			const filtered = filterLogEntries(logEntries, logFilter);
			const shown = filtered.slice(Math.max(0, filtered.length - LOG_DISPLAY_LIMIT)).reverse();
			const filterButtons = [
				["all", t("logFilterAll")],
				["allowed-once", t("logFilterAllowed")],
				["rejected", t("logFilterRejected")],
				["unknown", t("logFilterUnknown")],
			];

			const noticeDuration = h(
				"div",
				{ style: { ...settingsRowStyle, borderTop: "none", paddingTop: 0 } },
				h(
					"div",
					{ style: settingsInlineRowStyle },
					h("label", { htmlFor: "dsh-approval-reason-dock-allow-notice-ms", style: settingsLabelStyle }, t("allowNoticeMsLabel")),
					h("input", {
						id: "dsh-approval-reason-dock-allow-notice-ms",
						type: "number",
						min: 1,
						max: 10,
						step: 1,
						value: String(Math.round(settings.allowNoticeMs / 1000)),
						disabled: settings.allowNotice !== true,
						style: { ...settingsNumberStyle, opacity: settings.allowNotice === true ? 1 : 0.5 },
						"aria-label": t("allowNoticeMsLabel"),
						onChange: (event) => {
							const raw = event.target.value;
							if (raw === "") return;
							const seconds = Number(raw);
							if (!Number.isFinite(seconds)) return;
							updateSettings({ allowNoticeMs: Math.round(seconds) * 1000 });
						},
					}),
				),
				h("div", { style: settingsDescStyle }, t("allowNoticeMsDesc")),
			);

			const logPanel =
				settings.approvalLog === true
					? h(
							"div",
							{ style: { ...settingsRowStyle, borderTop: "none", paddingTop: 0 } },
							h("div", { style: settingsInlineRowStyle }, h("span", { style: settingsLabelStyle }, t("logCount", { count: filtered.length }))),
							h(
								"div",
								{ style: logFilterRowStyle },
								filterButtons.map(([value, label]) =>
									h(
										"button",
										{
											key: value,
											type: "button",
											style: logFilter === value ? settingsButtonActiveStyle : settingsButtonStyle,
											"aria-pressed": logFilter === value,
											onClick: () => setLogFilter(value),
										},
										label,
									),
								),
							),
							shown.length === 0
								? h("div", { style: settingsStatusStyle }, t("logEmpty"))
								: h("div", { style: logListStyle }, shown.map((entry) => logEntryRow(t, entry))),
							exportFailed ? h("div", { style: settingsRiskOffStyle }, t("logExportFailed")) : null,
							h(
								"div",
								{ style: logActionsStyle },
								h("button", { type: "button", style: settingsButtonStyle, onClick: onExport }, t("logExport")),
								h("button", { type: "button", style: settingsButtonStyle, onClick: () => clearLog() }, t("logClear")),
							),
							h("div", { style: settingsDescStyle }, t("logHint")),
						)
					: null;

			const updatePanel =
				settings.updateCheck === true
					? h(
							"div",
							{ style: { ...settingsRowStyle, borderTop: "none", paddingTop: 0 } },
							h(
								"div",
								{ style: settingsInlineRowStyle },
								h(
									"button",
									{
										type: "button",
										style: settingsButtonStyle,
										disabled: updateState.kind === "checking",
										onClick: () => void runCheck(true),
									},
									updateState.kind === "checking" ? t("updateChecking") : t("updateCheckButton"),
								),
								h("span", { style: settingsStatusStyle }, updateState.kind === "done" ? updateStatusText(t, updateState) : ""),
							),
						)
					: h(
							"div",
							{ style: { ...settingsRowStyle, borderTop: "none", paddingTop: 0 } },
							h("div", { style: settingsStatusStyle }, t("updateDisabledHint")),
						);

			return h(
				"section",
				{ style: settingsSectionStyle, "aria-label": t("settingsTitle") },
				h("div", { style: settingsTitleStyle }, t("settingsTitle")),
				h("div", { style: settingsIntroStyle }, t("settingsIntro")),
				settingsToggleRow(t, {
					id: "dsh-approval-reason-dock-allow-note",
					label: t("allowNoteLabel"),
					desc: t("allowNoteDesc"),
					riskOn: t("allowNoteRiskOn"),
					riskOff: t("allowNoteRiskOff"),
					checked: settings.allowNote === true,
					onChange: (checked) => updateSettings({ allowNote: checked }),
				}),
				settingsToggleRow(t, {
					id: "dsh-approval-reason-dock-confirm-allow",
					label: t("confirmAllowLabel"),
					desc: t("confirmAllowDesc"),
					riskOn: t("confirmAllowRiskOn"),
					riskOff: t("confirmAllowRiskOff"),
					checked: settings.confirmAllow === true,
					onChange: (checked) => updateSettings({ confirmAllow: checked }),
				}),
				settingsToggleRow(t, {
					id: "dsh-approval-reason-dock-allow-notice",
					label: t("allowNoticeLabel"),
					desc: t("allowNoticeDesc"),
					riskOn: t("allowNoticeRiskOn"),
					riskOff: t("allowNoticeRiskOff"),
					checked: settings.allowNotice === true,
					onChange: (checked) => updateSettings({ allowNotice: checked }),
				}),
				noticeDuration,
				settingsToggleRow(t, {
					id: "dsh-approval-reason-dock-approval-log",
					label: t("approvalLogLabel"),
					desc: t("approvalLogDesc"),
					riskOn: t("approvalLogRiskOn"),
					riskOff: t("approvalLogRiskOff"),
					checked: settings.approvalLog === true,
					onChange: (checked) => updateSettings({ approvalLog: checked }),
				}),
				logPanel,
				settingsToggleRow(t, {
					id: "dsh-approval-reason-dock-update-check",
					label: t("updateCheckLabel"),
					desc: t("updateCheckDesc"),
					riskOn: t("updateCheckRiskOn"),
					riskOff: t("updateCheckRiskOff"),
					checked: settings.updateCheck === true,
					onChange: (checked) => updateSettings({ updateCheck: checked }),
				}),
				updatePanel,
				h("div", { style: settingsDefaultStyle }, t("settingsDefaultNote")),
			);
		}

		/** Status line for the update check; auto-check failures stay silent. */
		function updateStatusText(t, state) {
			const result = state !== null && typeof state === "object" ? state.result : undefined;
			if (result === undefined || result === null) return "";
			if (result.status === "available") {
				return t("updateAvailable", { latest: result.latest, current: result.current, command: result.command });
			}
			if (result.status === "latest") {
				return t("updateUpToDate", { version: result.latest ?? result.current ?? PLUGIN_VERSION });
			}
			if (state.manual === true) return t("updateFailed", { error: result.error === undefined ? "unknown error" : String(result.error) });
			return "";
		}

		/** One approval-log row: time, tool, outcome, via and optional details. */
		function logEntryRow(t, entry) {
			const outcomeText =
				entry.outcome === "allowed-once"
					? t("logOutcomeAllowed")
					: entry.outcome === "rejected"
						? t("logOutcomeRejected")
						: typeof entry.decidedAt === "number"
							? t("logOutcomeUnknown")
							: t("logOutcomePending");
			const viaText = entry.via === "panel" ? t("logViaPanel") : t("logViaUnknown");
			return h(
				"div",
				{ key: entry.id, style: logEntryStyle },
				h(
					"div",
					{ style: logHeadStyle },
					h("span", { style: logMetaStyle }, formatLogTime(entry.askedAt)),
					h("span", null, entry.toolName === "" ? "?" : entry.toolName),
					h("span", { style: logMetaStyle }, outcomeText),
					h("span", { style: logMetaStyle }, viaText),
				),
				entry.sessionTitle !== undefined ? h("div", { style: logSubStyle }, t("logSession", { title: entry.sessionTitle })) : null,
				entry.reason !== undefined ? h("div", { style: logSubStyle }, t("logReasonPrefix", { text: entry.reason })) : null,
				entry.note !== undefined ? h("div", { style: logSubStyle }, t("logNotePrefix", { text: entry.note })) : null,
			);
		}

		/** One labelled checkbox plus its description and both risk lines. */
		function settingsToggleRow(t, options) {
			return h(
				"div",
				{ style: settingsRowStyle },
				h(
					"div",
					{ style: settingsHeadStyle },
					h("label", { htmlFor: options.id, style: settingsLabelStyle }, options.label),
					h("input", {
						id: options.id,
						type: "checkbox",
						checked: options.checked,
						style: settingsCheckboxStyle,
						"aria-label": t("settingsToggleAria", { name: options.label }),
						onChange: (event) => options.onChange(event.target.checked === true),
					}),
				),
				h("div", { style: settingsDescStyle }, options.desc),
				h(
					"div",
					{ style: settingsRiskStyle },
					h("div", { style: settingsRiskOnStyle }, options.riskOn),
					h("div", { style: settingsRiskOffStyle }, options.riskOff),
				),
			);
		}

		/* ----------------------------------------------------------- plugin */

		/**
		 * Localized settings nav label; a missing locale seat falls back to the
		 * raw key name so registration never throws.
		 */
		function settingsNavLabel(ctx) {
			try {
				if (ctx !== undefined && ctx !== null && ctx.locale !== undefined && ctx.locale !== null && typeof ctx.locale.bind === "function") {
					const t = ctx.locale.bind(NS);
					if (typeof t === "function") {
						const text = t("settingsNav");
						if (typeof text === "string" && text !== "") return text;
					}
				}
			} catch {
				// Fall through to the key name.
			}
			return "settingsNav";
		}

		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "approval-reason-dock: dictionaries");
			ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register(
					{
						name: "shell.overlay",
						id: "approval-reason-dock",
						order: 20,
						locale: NS,
						inject: () => ({ remote: ctx.remote, uiSession: ctx.uiSession }),
					},
					ApprovalReasonDock,
				),
			);
			ctx.slots.inject("settings.section", () =>
				ctx.slots.register(
					{
						name: "settings.section",
						id: NS,
						order: 60,
						label: () => settingsNavLabel(ctx),
						locale: NS,
						inject: () => ({}),
					},
					SettingsSection,
				),
			);
		}

		exports.apply = apply;
		// Client SERVICE names, not package names. Cordis matches dotted paths:
		// "remote" grants ctx.remote, "remote.session" grants ctx.remote.session
		// (prompt lives there), and "uiSession" grants ctx.uiSession.
		exports.inject = ["slots", "locale", "remote", "remote.session", "uiSession"];
		/* Test-only surface: the sandbox harness drives these without a browser. */
		exports.__internals = {
			normalizeReason,
			errorText,
			deliverReason,
			firstApproval,
			approvalFromStatus,
			answerApproval,
			allowApproval,
			rejectApproval,
			sessionTitleOf,
			recallDraft,
			rememberDraft,
			// 0.2.0 settings store + settings section
			SETTINGS_KEY,
			DEFAULT_SETTINGS,
			getSettings,
			updateSettings,
			subscribe,
			readStoredSettings,
			syncSettingsFromStorage,
			handleStorageEvent,
			SettingsSection,
			settingsNavLabel,
			// 0.3.0 delivered notices
			normalizeNoticeMs,
			NOTICE_MAX,
			NOTICE_WARN_ICON,
			pushNotice,
			noticeTextKey,
			// 0.3.0 approval log
			LOG_KEY,
			LOG_SCHEMA_VERSION,
			LOG_MAX_TOTAL,
			LOG_MAX_PER_SESSION,
			LOG_MAX_TEXT,
			readStoredLog,
			getLogEntries,
			subscribeLog,
			recordLogAsked,
			recordLogDecided,
			recordLogSessionTitle,
			shouldRecordLostApproval,
			clearLog,
			handleLogStorageEvent,
			filterLogEntries,
			formatLogExport,
			formatLogTime,
			// 0.3.0 update checker
			PLUGIN_VERSION,
			UPDATE_REGISTRY_URL,
			UPDATE_COMMAND,
			UPDATE_AUTO_INTERVAL_MS,
			parseSemver,
			compareSemver,
			semverGt,
			checkForUpdate,
			runUpdateCheck,
			getCachedUpdate,
			// shared internals
			truncateText,
			zh,
			en,
			ApprovalReasonDock,
			deliveredNoticeBlock,
		};
		return module.exports;
	},
});
