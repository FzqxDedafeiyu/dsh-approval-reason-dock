// Read-only probe build for dsh-approval-reason-dock.
//
// Deployed temporarily as the installed plugin's client.js to answer one
// question: which session does the frame-wide shell.overlay actually see as
// "current"? It renders a tiny badge (top-left) with:
//   - uiSession.current binding -> current session id
//   - sessions snapshot -> sessions whose retainedBy.mainView > 0
//   - uiSession.sessionStatus -> sessions with a pending approval
//
// It polls every 500ms on purpose: the probe itself must not depend on
// subscription semantics while we are measuring them. No approval actions,
// no new slots, no protocol changes.

window.__ModuleLoader__.load({
	id: "dsh-approval-reason-dock",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		const React = require("react");
		const h = React.createElement;
		const POLL_MS = 500;

		const short = (id) => (typeof id === "string" ? id.slice(0, 8) : String(id));

		function readCurrentId(uiSession) {
			try {
				const source = uiSession === undefined || uiSession === null ? undefined : uiSession.current;
				if (source === undefined || source === null || typeof source.getSnapshot !== "function") return undefined;
				const binding = source.getSnapshot();
				if (binding === undefined || binding === null) return undefined;
				return binding.key;
			} catch {
				return undefined;
			}
		}

		function readRetained(sessionsSnapshot) {
			const out = [];
			const byId = sessionsSnapshot === undefined || sessionsSnapshot === null ? undefined : sessionsSnapshot.byId;
			if (byId === undefined || byId === null) return out;
			for (const [id, info] of Object.entries(byId)) {
				const count = info === undefined || info === null || info.retainedBy === undefined ? undefined : info.retainedBy.mainView;
				if ((count ?? 0) > 0) out.push(short(id) + ((count ?? 0) > 1 ? " x" + count : ""));
			}
			return out;
		}

		function readApprovals(statusSnapshot) {
			const out = [];
			if (statusSnapshot === undefined || statusSnapshot === null || typeof statusSnapshot.forEach !== "function") return out;
			statusSnapshot.forEach((status, id) => {
				const pending = status === undefined || status === null ? undefined : status.pendingInteraction;
				if (pending === undefined || pending === null) return;
				const kind = pending.kind === "approval" ? "approval" : String(pending.kind);
				const tool = typeof pending.toolName === "string" && pending.toolName !== "" ? pending.toolName : "?";
				const answerable = pending.answerable === false ? " (settled)" : "";
				out.push(short(id) + " → " + kind + ":" + tool + answerable);
			});
			return out;
		}

		function line(label, value) {
			return h(
				"div",
				null,
				h("span", { style: { color: "#8a8a8a" } }, label + ": "),
				h("span", { style: { color: "#e8e8e8" } }, value),
			);
		}

		function ApprovalProbe(props) {
			const uiSession = props.uiSession;
			// A missing standard prop must not throw: fall back to a no-op reader
			// so the probe can still render its diagnostics instead of breaking
			// the whole overlay slot.
			const useSessionsMaybe = typeof props.useSessions === "function" ? props.useSessions : () => undefined;
			const useSessionStatusMaybe = typeof props.useSessionStatus === "function" ? props.useSessionStatus : () => undefined;

			const sessionsSnapshot = useSessionsMaybe((value) => value);
			const statusSnapshot = useSessionStatusMaybe((value) => value);
			const [tick, setTick] = React.useState(0);

			React.useEffect(() => {
				const timer = setInterval(() => setTick((n) => n + 1), POLL_MS);
				return () => clearInterval(timer);
			}, []);

			// tick forces a fresh read on every poll; the values below are all
			// snapshots, so this is a pure read of the three signals.
			const currentId = React.useMemo(() => readCurrentId(uiSession), [uiSession, tick]);
			const retained = React.useMemo(() => readRetained(sessionsSnapshot), [sessionsSnapshot, tick]);
			const approvals = React.useMemo(() => readApprovals(statusSnapshot), [statusSnapshot, tick]);

			let rows;
			try {
				rows = [
					h("div", { style: { color: "#e0a45e", fontWeight: 600 } }, "approval-probe"),
					line("current", currentId === undefined ? "(undefined)" : short(currentId) + " …"),
					line("raw", currentId === undefined ? "-" : currentId),
					line("retained", retained.length === 0 ? "(none)" : retained.join(", ")),
					line("approvals", approvals.length === 0 ? "(none)" : approvals.join(" | ")),
					line(
						"hooks",
						(typeof props.useSessions === "function" ? "sessions ok" : "sessions MISSING") +
							" / " +
							(typeof props.useSessionStatus === "function" ? "status ok" : "status MISSING"),
					),
				];
			} catch (error) {
				rows = [h("div", { style: { color: "#e08a84" } }, "probe error: " + (error instanceof Error ? error.message : String(error)))];
			}

			return h(
				"div",
				{
					style: {
						position: "fixed",
						right: 24,
						bottom: 160,
						zIndex: 9999,
						pointerEvents: "none",
						padding: "6px 9px",
						borderRadius: 8,
						border: "1px solid #3a3a3a",
						background: "rgba(20, 24, 30, 0.88)",
						color: "#e8e8e8",
						fontFamily: "Consolas, ui-monospace, monospace",
						fontSize: 11,
						lineHeight: 1.45,
						maxWidth: 460,
					},
					"aria-label": "approval probe",
				},
				rows,
			);
		}

		function apply(ctx) {
			const slots = ctx === undefined || ctx === null ? undefined : ctx.slots;
			if (slots === undefined || slots === null || typeof slots.inject !== "function" || typeof slots.register !== "function") {
				console.warn("[approval-probe] slots service unavailable; probe inactive");
				return;
			}
			slots.inject("shell.overlay", () =>
				slots.register(
					{
						name: "shell.overlay",
						id: "approval-probe",
						order: 10,
						inject: () => ({ uiSession: ctx.uiSession }),
					},
					ApprovalProbe,
				),
			);
			console.log("[approval-probe] registered in shell.overlay");
		}

		exports.apply = apply;
		// Service names the client half actually touches. Reading ctx.uiSession
		// without declaring "uiSession" throws inside the slot inject callback
		// ("cannot get property `uiSession` without inject"). "remote.session"
		// is a nested member of remote, not a service name.
		exports.inject = ["slots", "uiSession"];
		return module.exports;
	},
});
