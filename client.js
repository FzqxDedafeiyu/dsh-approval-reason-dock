window.__ModuleLoader__.load({
	id: "dsh-approval-reason-dock",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		const React = require("react");
		const h = React.createElement;

		const NS = "approval-reason-dock";
		const MAX_REASON_CHARS = 500;

		/* ------------------------------------------------------------ copy */

		const zh = {
			title: "审批待处理",
			hint: "留一句拒绝理由（可选，会立即进入当前对话）",
			placeholder: "例如：网络不稳，先别把截图发出去；等我确认后再做。",
			send: "拒绝并说明",
			plain: "只拒绝",
			close: "关闭",
			collapse: "折叠",
			expand: "展开",
			pendingBadge: "待审核",
			sending: "正在把理由送进当前对话…",
			deliveredSteer: "已拒绝，理由已进入当前对话。",
			deliveredQueue: "已拒绝，理由已排队，下一轮会看到。",
			deliveryFailed: "已拒绝，但理由发送失败：{error}",
			settled: "审批已被其他方式处理。",
			handled: "已拒绝（未附理由）。",
			handledTitle: "审批已处理",
			tool: "工具：{tool}",
			session: "会话：{title}",
			reasonPrefix: "（审批拒绝理由）",
			ariaInput: "审批拒绝理由（可选）",
			ariaPanel: "审批拒绝理由浮层",
		};

		const en = {
			title: "Approval pending",
			hint: "Add a rejection reason (optional; it enters the running turn immediately)",
			placeholder: "e.g. The network is unreliable, do not send the screenshot yet; wait for my confirmation.",
			send: "Reject with reason",
			plain: "Reject",
			close: "Close",
			collapse: "Collapse",
			expand: "Expand",
			pendingBadge: "Pending review",
			sending: "Sending the reason into the running turn…",
			deliveredSteer: "Rejected; the reason entered the running turn.",
			deliveredQueue: "Rejected; the reason is queued for the next turn.",
			deliveryFailed: "Rejected, but sending the reason failed: {error}",
			settled: "The approval was already handled elsewhere.",
			handled: "Rejected (no reason).",
			handledTitle: "Approval handled",
			tool: "Tool: {tool}",
			session: "Session: {title}",
			reasonPrefix: "(approval rejection reason) ",
			ariaInput: "Approval rejection reason (optional)",
			ariaPanel: "Approval rejection reason panel",
		};

		/* --------------------------------------------------------- helpers */

		/** Collapse whitespace, trim, and cap a user-typed reason. */
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

		/**
		 * Send one rejection reason into the running session.
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

		/**
		 * Answer one approval as rejected, optionally carrying a reason first.
		 * This is the whole interaction flow, kept outside React so tests can
		 * drive it without a browser.
		 * @returns {Promise<{answered: boolean, delivery?: {mode: string, error?: string}}>}
		 */
		async function rejectApproval(target, remote, prefix, reason) {
			let delivery;
			if (reason !== "") delivery = await deliverReason(remote, target.sessionId, prefix, reason);
			let answered = false;
			try {
				await target.pending.answer("rejected");
				answered = true;
			} catch {
				answered = false;
			}
			return delivery === undefined ? { answered } : { answered, delivery };
		}

		/* ------------------------------------------------------------ theme */

		const surface = {
			position: "fixed",
			right: 24,
			top: 112,
			width: 344,
			maxWidth: "calc(100vw - 48px)",
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
			position: "fixed",
			right: 24,
			top: 112,
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

		/* -------------------------------------------------------- component */

		/**
		 * Frame-wide panel: while one answerable approval exists, offer an
		 * optional rejection reason and two rejection buttons.
		 * @param props - slot props: session status hook, locale seat, remote service.
		 * @returns the panel, a result notice, or null.
		 */
		function ApprovalReasonDock(props) {
			const useSessionStatus = props.useSessionStatus;
			const useSessions = props.useSessions;
			const t = props.t;
			const remote = props.remote;
			const uiSession = props.uiSession;
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
			const [draft, setDraft] = React.useState("");
			const [busy, setBusy] = React.useState(false);
			const [notice, setNotice] = React.useState(null);
			const [collapsed, setCollapsed] = React.useState(false);

			React.useEffect(() => {
				// Switching sessions resets transient notices and the stale answer
				// target, but keeps the typed draft: returning to the same pending
				// approval should restore the panel with its text intact.
				lastTarget.current = undefined;
				setNotice(null);
			}, [currentSessionId]);

			React.useEffect(() => {
				if (approval === undefined) return;
				lastTarget.current = approval;
				if (seenKey.current === approval.key) return;
				seenKey.current = approval.key;
				setDraft(recallDraft(approval.key));
				setNotice(null);
				setCollapsed(false);
			}, [approval]);

			const dismiss = React.useCallback(() => setNotice(null), []);

			const submit = React.useCallback(
				async (withReason) => {
					if (busy) return;
					const target = approval === undefined ? lastTarget.current : approval;
					if (target === undefined) return;
					setBusy(true);
					const reason = withReason ? normalizeReason(draft) : "";
					const outcome = await rejectApproval(target, remote, t("reasonPrefix"), reason);
					setBusy(false);
					lastTarget.current = undefined;
					rememberDraft(target.key, "");
					setDraft("");
					// Success (with or without a reason) closes the panel immediately;
					// only a failed reason delivery keeps a dismissible error notice.
					if (outcome.answered !== true) {
						setNotice(null);
						return;
					}
					if (outcome.delivery !== undefined && outcome.delivery.mode === "failed") {
						setNotice({ kind: "error", text: t("deliveryFailed", { error: outcome.delivery.error }) });
						return;
					}
					setCollapsed(false);
					setNotice(null);
				},
				[approval, busy, draft, remote, t],
			);

			if (approval === undefined) {
				if (notice === null) return null;
				return h(
					"div",
					{ style: surface, role: "status", "aria-label": t("ariaPanel") },
					noticeRow(t, notice, dismiss),
				);
			}

			const toolName = typeof approval.pending.toolName === "string" ? approval.pending.toolName : "";
			if (collapsed) {
				return h(
					"button",
					{
						type: "button",
						style: pillStyle,
						title: t("expand"),
						"aria-label": t("expand"),
						onClick: () => setCollapsed(false),
					},
					h("span", { style: { ...dotStyle, flex: "none" } }),
					h("span", null, t("pendingBadge")),
					toolName !== "" ? h("span", { style: pillToolStyle }, toolName) : null,
				);
			}

			return h(
				"div",
				{ style: surface, role: "dialog", "aria-label": t("ariaPanel") },
				h(
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
				),
				sessionTitle === undefined ? null : h("div", { style: sessionStyle }, t("session", { title: sessionTitle })),
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
						if (event.key === "Enter" && event.shiftKey !== true) {
							event.preventDefault();
							void submit(true);
						}
					},
				}),
				h(
					"div",
					{ style: actionsRow },
					h("button", { type: "button", style: primaryButton, disabled: busy, onClick: () => void submit(true) }, t("send")),
					h("button", { type: "button", style: ghostButton, disabled: busy, onClick: () => void submit(false) }, t("plain")),
				),
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

		/* ----------------------------------------------------------- plugin */

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
			rejectApproval,
			sessionTitleOf,
			recallDraft,
			rememberDraft,
			zh,
			en,
			ApprovalReasonDock,
		};
		return module.exports;
	},
});