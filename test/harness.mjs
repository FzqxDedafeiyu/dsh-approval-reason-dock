/**
 * Sandbox harness for dsh-approval-reason-dock.
 *
 * Runs without DSH: it validates the published package shape, loads the real
 * browser bundle factory with React, drives the slot registration against a
 * fake Cordis context, exercises the allow/reject note flow through the
 * exported internals, and drives the panel itself with react-test-renderer
 * (input view -> confirm view -> answer). Nothing here touches a running
 * Harness instance.
 *
 * Run: node test/harness.mjs
 */
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TestRenderer from "react-test-renderer";
import { fileURLToPath, pathToFileURL } from "node:url";

const act = TestRenderer.act;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let failures = 0;
let checks = 0;

function check(name, condition, detail) {
  checks += 1;
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail === undefined ? "" : ` — ${detail}`}`);
  }
}

function equal(name, actual, expected) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), `actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}

function includes(name, haystack, needle) {
  check(name, String(haystack).includes(needle), `actual=${JSON.stringify(String(haystack))} needle=${JSON.stringify(needle)}`);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const readJson = (relative) => JSON.parse(read(relative));

/* ------------------------------------------------------------- manifest */

console.log("manifest");
const pkg = readJson("package.json");
check("name is dsh-approval-reason-dock", pkg.name === "dsh-approval-reason-dock", pkg.name);
check("version is an exact SemVer", /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version), pkg.version);
check("type is module", pkg.type === "module", pkg.type);
check("license is MIT", pkg.license === "MIT", pkg.license);
check("engines.dsh declared", typeof pkg.engines?.dsh === "string" && pkg.engines.dsh.length > 0, JSON.stringify(pkg.engines));
check("dsh.manifestVersion is 1", pkg.dsh?.manifestVersion === 1, JSON.stringify(pkg.dsh?.manifestVersion));
check("dsh.bundle.patch declared", pkg.dsh?.bundle?.patch === "./cordis.patch.yml", JSON.stringify(pkg.dsh?.bundle));
check("dsh.client.platform is web", pkg.dsh?.client?.platform === "web", JSON.stringify(pkg.dsh?.client));
check("dsh.client is eager", pkg.dsh?.client?.immediately === true, JSON.stringify(pkg.dsh?.client?.immediately));
check("dsh.client.inject is a package list", Array.isArray(pkg.dsh?.client?.inject) && pkg.dsh.client.inject.every((name) => typeof name === "string" && name.includes("/")), JSON.stringify(pkg.dsh?.client?.inject));

equal("exports shape", Object.keys(pkg.exports ?? {}).sort(), [".", "./client", "./icon", "./locale/*.json", "./package.json"].sort());
check("exports ./client points at client.js", pkg.exports?.["./client"] === "./client.js");
check("exports ./icon points at icon.svg", pkg.exports?.["./icon"] === "./icon.svg");
check("repository points at the GitHub repo", /github\.com\/FzqxDedafeiyu\/dsh-approval-reason-dock/.test(pkg.repository?.url ?? ""), pkg.repository?.url);
check("files covers every shipped runtime file", ["index.js", "client.js", "cordis.patch.yml", "locale/*.json", "icon.svg", "LICENSE"].every((entry) => pkg.files?.includes(entry)), JSON.stringify(pkg.files));
check("devDependencies pin React for the harness", typeof pkg.devDependencies?.react === "string", JSON.stringify(pkg.devDependencies));
check("devDependencies pin react-test-renderer for the harness", typeof pkg.devDependencies?.["react-test-renderer"] === "string", JSON.stringify(pkg.devDependencies));
check("test script runs this harness", pkg.scripts?.test === "node test/harness.mjs", pkg.scripts?.test);

/* --------------------------------------------------------- package files */

console.log("package files");
for (const file of ["index.js", "client.js", "cordis.patch.yml", "icon.svg", "README.md", "README.zh.md", "CHANGELOG.md", "LICENSE"]) {
  check(`${file} exists`, fs.existsSync(path.join(root, file)));
}
const patch = read("cordis.patch.yml");
includes("patch inserts the row id", patch, "id: approval-reason-dock");
includes("patch inserts the package name", patch, `name: ${pkg.name}`);

const icon = fs.readFileSync(path.join(root, "icon.svg"));
check("icon is under the 256 KiB display limit", icon.byteLength < 256 * 1024, String(icon.byteLength));
check("icon is a valid-looking SVG", icon.toString("utf8").trimStart().startsWith("<svg"), icon.toString("utf8").slice(0, 20));

for (const locale of ["en", "zh"]) {
  const dict = readJson(`locale/${locale}.json`);
  check(`locale/${locale}.json has meta.title`, typeof dict.meta?.title === "string" && dict.meta.title.length > 0);
  check(`locale/${locale}.json has meta.description`, typeof dict.meta?.description === "string" && dict.meta.description.length > 0);
}

const hostHalf = await import(pathToFileURL(path.join(root, "index.js")).href);
check("host half exports apply", typeof hostHalf.apply === "function");

/* -------------------------------------------------------------- bundle */

console.log("bundle");
let registered;
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      if (registered !== undefined) throw new Error("bundle registered twice");
      registered = definition;
    },
  },
};

const clientSource = read("client.js");
check("bundle starts with the module loader call", clientSource.trimStart().startsWith("window.__ModuleLoader__.load("));
await import(pathToFileURL(path.join(root, "client.js")).href);
check("bundle registered through window.__ModuleLoader__", registered !== undefined);
equal("bundle id equals the package name", registered?.id, pkg.name);

const requireShim = (name) => {
  if (name === "react") return React;
  throw new Error(`unexpected require("${name}")`);
};
const bundle = registered.factory(requireShim);
check("bundle exports apply", typeof bundle.apply === "function");
equal("bundle inject", bundle.inject, ["slots", "locale", "remote", "remote.session", "uiSession"]);

const internals = bundle.__internals;
check("internals exported for the harness", internals !== undefined && typeof internals.deliverReason === "function");
check("internals expose answerApproval", typeof internals.answerApproval === "function");
check("internals expose allowApproval", typeof internals.allowApproval === "function");
check("internals keep rejectApproval", typeof internals.rejectApproval === "function");
equal("locale dictionaries keep the same key set", Object.keys(internals.zh).sort(), Object.keys(internals.en).sort());
check("both dictionaries fill every key", Object.values(internals.zh).every((value) => typeof value === "string" && value.length > 0) && Object.values(internals.en).every((value) => typeof value === "string" && value.length > 0));

const expectedKeys = [
  "title",
  "hint",
  "placeholder",
  "allowPlain",
  "allowWithNote",
  "rejectPlain",
  "rejectWithNote",
  "allowPrefix",
  "reasonPrefix",
  "confirmTitle",
  "confirmBody",
  "partialAgreementHint",
  "confirmNote",
  "confirmAllow",
  "cancel",
  "sending",
  "deliveryFailed",
  "close",
  "collapse",
  "expand",
  "pendingBadge",
  "deliveredSteer",
  "deliveredQueue",
  "settled",
  "handled",
  "handledTitle",
  "tool",
  "session",
  "ariaInput",
  "ariaPanel",
  "ariaConfirmPanel",
  // 0.2.0 settings section
  "settingsNav",
  "settingsTitle",
  "settingsIntro",
  "allowNoteLabel",
  "allowNoteDesc",
  "allowNoteRiskOn",
  "allowNoteRiskOff",
  "confirmAllowLabel",
  "confirmAllowDesc",
  "confirmAllowRiskOn",
  "confirmAllowRiskOff",
  "settingsDefaultNote",
  "allowNoteDisabledHint",
  "settingsToggleAria",
];
equal("zh dictionary uses the 0.2.0 key set", Object.keys(internals.zh).sort(), [...expectedKeys].sort());
equal("en dictionary uses the 0.2.0 key set", Object.keys(internals.en).sort(), [...expectedKeys].sort());
check("old send/plain keys are gone", internals.zh.send === undefined && internals.zh.plain === undefined && internals.en.send === undefined && internals.en.plain === undefined);
check("en allow/reason prefixes keep the trailing space", internals.en.allowPrefix.endsWith(" ") && internals.en.reasonPrefix.endsWith(" "));
check("allowPrefix marks the allow note", internals.zh.allowPrefix === "（审批同意说明）");
check("confirm copy preserves the authorization scope", internals.zh.confirmBody.includes("不会改变本次授权范围"));
check("partialAgreementHint points at reject with note", internals.zh.partialAgreementHint.includes("拒绝并说明"));
check(
  "settings dictionaries carry both risk directions",
  ["allowNoteRiskOn", "allowNoteRiskOff", "confirmAllowRiskOn", "confirmAllowRiskOff"].every(
    (key) => typeof internals.zh[key] === "string" && typeof internals.en[key] === "string",
  ),
);
check("settings intro says reject is unaffected", internals.zh.settingsIntro.includes("拒绝带理由始终可用") && internals.en.settingsIntro.includes("Reject with a note always works"));
check("note-disabled hint names the switch", internals.zh.allowNoteDisabledHint.includes("允许时带话") && internals.en.allowNoteDisabledHint.includes("Allow with note"));
check("toggle aria template carries the name placeholder", internals.zh.settingsToggleAria.includes("{name}") && internals.en.settingsToggleAria.includes("{name}"));
check("settings defaults keep both features on", internals.DEFAULT_SETTINGS.allowNote === true && internals.DEFAULT_SETTINGS.confirmAllow === true);
check("settings key is namespaced", internals.SETTINGS_KEY === "dsh-approval-reason-dock:settings");

/* -------------------------------------------------------------- helpers */

console.log("helpers");
equal("normalizeReason trims and collapses", internals.normalizeReason("  网络不稳，   先别发  "), "网络不稳， 先别发");
equal("normalizeReason caps at 500 characters", internals.normalizeReason("a".repeat(600)).length, 500);
equal("normalizeReason tolerates non-strings", internals.normalizeReason(undefined), "");
equal("errorText combines code and message", internals.errorText({ ok: false, error: { code: "session/denied", message: "no such session" } }), "session/denied: no such session");
equal("errorText tolerates a missing error", internals.errorText({ ok: false }), "unknown error");

const approval = { kind: "approval", key: "approval:1", toolName: "pwsh", answerable: true, answer: async () => {} };
const approvalB = { kind: "approval", key: "approval:3", toolName: "edit", answerable: true, answer: async () => {} };
const question = { kind: "question", key: "question:1", answerable: true };
const settled = { kind: "approval", key: "approval:2", answerable: false, answer: async () => {} };
check("firstApproval requires a current session", internals.firstApproval(new Map([["s", { pendingInteraction: approval }]]), undefined) === undefined);
check("firstApproval ignores questions", internals.firstApproval(new Map([["s", { pendingInteraction: question }]]), "s") === undefined);
check("firstApproval ignores unanswerable approvals", internals.firstApproval(new Map([["s", { pendingInteraction: settled }]]), "s") === undefined);
equal("firstApproval returns the current session approval", internals.firstApproval(new Map([["s", { pendingInteraction: approval }]]), "s")?.sessionId, "s");
check("firstApproval hides other sessions' approvals", internals.firstApproval(new Map([["s", { pendingInteraction: approval }]]), "other") === undefined);
const twoSessions = new Map([
  ["a", { pendingInteraction: approval }],
  ["b", { pendingInteraction: approvalB }],
]);
equal("firstApproval follows session a", internals.firstApproval(twoSessions, "a")?.pending.toolName, "pwsh");
equal("firstApproval follows session b", internals.firstApproval(twoSessions, "b")?.pending.toolName, "edit");
check("firstApproval hides sessions without approvals", internals.firstApproval(twoSessions, "c") === undefined);

/* ------------------------------------------------------- delivery flow */

console.log("delivery flow");
function fakeRemote(responses) {
  const calls = [];
  return {
    calls,
    session: {
      async prompt(request) {
        calls.push(request);
        const respond = responses[Math.min(calls.length - 1, responses.length - 1)];
        return typeof respond === "function" ? respond(request, calls.length) : respond;
      },
    },
  };
}

const accepted = fakeRemote([{ ok: true, value: { accepted: true } }]);
const steered = await internals.deliverReason(accepted, "session-1", "（审批拒绝理由）", "网络不稳");
equal("steer succeeds on the first attempt", steered.mode, "steer");
equal("one prompt call", accepted.calls.length, 1);
equal("prompt mode is steer", accepted.calls[0].mode, "steer");
equal("prompt session", accepted.calls[0].sessionId, "session-1");
equal("content is one text part", accepted.calls[0].content, [{ type: "text", text: "（审批拒绝理由）网络不稳" }]);
check("prompt carries a requestId", typeof accepted.calls[0].requestId === "string" && accepted.calls[0].requestId.length > 0);

const queued = fakeRemote([
  { ok: false, error: { code: "session/steer-unavailable", message: "turn ended" } },
  { ok: true, value: { accepted: true } },
]);
const queuedResult = await internals.deliverReason(queued, "session-1", "（审批拒绝理由）", "停一下");
equal("steer failure falls back to queue", queuedResult.mode, "queue");
equal("two prompt calls", queued.calls.length, 2);
equal("second attempt queues", queued.calls[1].mode, "queue");

const failed = fakeRemote([{ ok: false, error: { code: "session/denied", message: "no such session" } }]);
const failedResult = await internals.deliverReason(failed, "session-1", "（审批拒绝理由）", "试试");
equal("both attempts failing reports failed", failedResult.mode, "failed");
includes("failure keeps the error code", failedResult.error, "session/denied");

const throwing = {
  session: {
    async prompt() {
      throw new Error("socket closed");
    },
  },
};
const thrown = await internals.deliverReason(throwing, "session-1", "(reason) ", "x");
equal("throwing prompts also report failed", thrown.mode, "failed");
includes("throwing prompts keep the message", thrown.error, "socket closed");

/* -------------------------------------------------------- rejectApproval */

console.log("rejectApproval");
{
  const answered = [];
  const target = {
    sessionId: "session-1",
    pending: { answer: async (outcome) => answered.push(outcome) },
  };
  const remote = fakeRemote([{ ok: true, value: { accepted: true } }]);
  const result = await internals.rejectApproval(target, remote, "（审批拒绝理由）", "网络不稳");
  equal("approval answered rejected", answered, ["rejected"]);
  equal("delivery reported", result.delivery.mode, "steer");
  check("answered flag is true", result.answered === true);
}

{
  const target = {
    sessionId: "session-1",
    pending: {
      answer: async () => {
        throw new Error("already settled");
      },
    },
  };
  const result = await internals.rejectApproval(target, fakeRemote([{ ok: true }]), "（审批拒绝理由）", "x");
  check("already-settled approval does not throw", result.answered === false);
}

/* ------------------------------------------------- answerApproval / allow */

console.log("answerApproval / allowApproval");
function eventTarget(sessionId = "session-1") {
  const events = [];
  const target = {
    sessionId,
    pending: {
      kind: "approval",
      key: `approval:${sessionId}`,
      toolName: "pwsh",
      answerable: true,
      answer: async (outcome) => {
        events.push({ kind: "answer", outcome });
      },
    },
  };
  return { target, events };
}

function eventRemote(respond, events) {
  const calls = [];
  return {
    calls,
    session: {
      async prompt(request) {
        calls.push(request);
        events.push({ kind: "prompt", mode: request.mode, text: request.content[0].text });
        return typeof respond === "function" ? respond(request, calls.length) : respond;
      },
    },
  };
}

const answerKinds = (events) => events.map((event) => event.kind);
const answerOutcomes = (events) => events.filter((event) => event.kind === "answer").map((event) => event.outcome);

{
  const { target, events } = eventTarget("allow-plain");
  const remote = eventRemote({ ok: true }, events);
  const result = await internals.allowApproval(target, remote, "（审批同意说明）", "");
  equal("allow without note answers allowed-once", answerOutcomes(events), ["allowed-once"]);
  equal("allow without note sends no prompt", remote.calls.length, 0);
  check("allow without note reports answered true", result.answered === true);
  check("allow without note has no delivery", result.delivery === undefined);
}

{
  const { target, events } = eventTarget("allow-note");
  const remote = eventRemote({ ok: true }, events);
  const result = await internals.allowApproval(target, remote, "（审批同意说明）", "只改 docs/");
  equal("allow with note prompts before answering", answerKinds(events), ["prompt", "answer"]);
  equal("allow note text uses the allow prefix", events[0].text, "（审批同意说明）只改 docs/");
  equal("allow note lands as steer", events[0].mode, "steer");
  equal("allow note answers allowed-once", events[1].outcome, "allowed-once");
  equal("allow note reports steer delivery", result.delivery.mode, "steer");
}

{
  const { target, events } = eventTarget("allow-queue");
  const remote = eventRemote((request, index) => (index === 1 ? { ok: false, error: { code: "session/steer-unavailable", message: "turn ended" } } : { ok: true }), events);
  const result = await internals.allowApproval(target, remote, "（审批同意说明）", "先 dry-run");
  equal("allow note falls back to queue", result.delivery.mode, "queue");
  equal("allow note tried steer then queue", remote.calls.map((call) => call.mode), ["steer", "queue"]);
  equal("allow still answers after the queue fallback", answerOutcomes(events), ["allowed-once"]);
}

{
  const { target, events } = eventTarget("allow-fail");
  const remote = eventRemote(() => ({ ok: false, error: { code: "session/denied", message: "no such session" } }), events);
  const result = await internals.allowApproval(target, remote, "（审批同意说明）", "说明");
  equal("failed allow note answers nothing", answerOutcomes(events), []);
  check("failed allow note reports answered false", result.answered === false);
  equal("failed allow note reports a failed delivery", result.delivery.mode, "failed");
  includes("failed allow note keeps the error code", result.delivery.error, "session/denied");
  equal("failed allow note tried steer then queue", remote.calls.map((call) => call.mode), ["steer", "queue"]);
}

{
  const { target, events } = eventTarget("allow-settled");
  target.pending.answer = async () => {
    throw new Error("already settled");
  };
  const result = await internals.answerApproval(target, eventRemote({ ok: true }, events), "（审批同意说明）", "", "allowed-once");
  check("already-settled allow does not throw", result.answered === false);
  check("already-settled allow has no delivery", result.delivery === undefined);
}

{
  const { target, events } = eventTarget("generic");
  const result = await internals.answerApproval(target, eventRemote({ ok: true }, events), "P", "note", "rejected");
  equal("answerApproval forwards the requested outcome", answerOutcomes(events), ["rejected"]);
  equal("answerApproval precedes the answer with the note", answerKinds(events), ["prompt", "answer"]);
  equal("answerApproval reports steer delivery", result.delivery.mode, "steer");
}

/* --------------------------------------------------------------- render */

console.log("render");
const zhText = (key, vars) => String(internals.zh[key] ?? key).replaceAll(/\{([^}]+)\}/g, (_, name) => String(vars?.[name] ?? `{${name}}`));
const enText = (key, vars) => String(internals.en[key] ?? key).replaceAll(/\{([^}]+)\}/g, (_, name) => String(vars?.[name] ?? `{${name}}`));

function renderWith(t, snapshot, currentSessionId, titles = undefined) {
  const uiSession = {
    current: {
      getSnapshot: () => ({ key: currentSessionId }),
      subscribe: () => () => {},
    },
  };
  const byId = {};
  for (const [id, title] of Object.entries(titles ?? {})) byId[id] = { id, title };
  const sessionsSnapshot = { byId };
  return renderToStaticMarkup(
    React.createElement(internals.ApprovalReasonDock, {
      useSessionStatus: (selector) => selector(snapshot),
      useSessions: (selector) => selector(sessionsSnapshot),
      t,
      remote: fakeRemote([{ ok: true }]),
      uiSession,
    }),
  );
}

equal("sessionTitleOf reads the title", internals.sessionTitleOf({ byId: { s: { title: "T" } } }, "s"), "T");
check("sessionTitleOf tolerates missing snapshots", internals.sessionTitleOf(undefined, "s") === undefined);
equal("approvalFromStatus returns the approval", internals.approvalFromStatus({ pendingInteraction: approval }, "s")?.key, "approval:1");
check("approvalFromStatus ignores questions", internals.approvalFromStatus({ pendingInteraction: question }, "s") === undefined);
check("approvalFromStatus without session id", internals.approvalFromStatus({ pendingInteraction: approval }, undefined) === undefined);
internals.rememberDraft("approval:a", "甲");
internals.rememberDraft("approval:b", "乙");
equal("drafts are kept per approval key (a)", internals.recallDraft("approval:a"), "甲");
equal("drafts are kept per approval key (b)", internals.recallDraft("approval:b"), "乙");
internals.rememberDraft("approval:a", "");
check("clearing one draft keeps the other", internals.recallDraft("approval:b") === "乙");
check("cleared draft is empty", internals.recallDraft("approval:a") === "");

const emptyMarkup = renderWith(zhText, new Map(), "session-1");
equal("no approval renders nothing", emptyMarkup, "");

const pendingMap = new Map([["session-1", { pendingInteraction: approval }]]);
const otherMap = new Map([
  ["session-1", { pendingInteraction: approval }],
  ["session-2", { pendingInteraction: approvalB }],
]);
equal("other sessions' approvals render nothing", renderWith(zhText, pendingMap, "session-2"), "");
equal("no current session renders nothing", renderWith(zhText, pendingMap, undefined), "");
const zoomMarkup = renderWith(zhText, otherMap, "session-2");
includes("follows the selected session (session-2 shows edit)", zoomMarkup, "工具：edit");
check("selected session hides the other session's approval", !zoomMarkup.includes("工具：pwsh"));
const zhMarkup = renderWith(zhText, pendingMap, "session-1");
includes("zh markup shows the title", zhMarkup, "审批待处理");
includes("zh markup shows the tool", zhMarkup, "工具：pwsh");
includes("zh markup shows the plain allow", zhMarkup, "允许一次");
includes("zh markup shows the plain reject", zhMarkup, "拒绝");
check("zh markup does not offer the note actions on an empty draft", !zhMarkup.includes("允许并说明") && !zhMarkup.includes("拒绝并说明"));
includes("zh markup shows the updated hint", zhMarkup, "留一句说明");
includes("zh markup offers a collapse control", zhMarkup, "折叠");

const titledMarkup = renderWith(zhText, pendingMap, "session-1", { "session-1": "改造审批中文与拒绝理由" });
includes("zh markup shows the session title", titledMarkup, "会话：改造审批中文与拒绝理由");

const enMarkup = renderWith(enText, pendingMap, "session-1");
includes("en markup shows the title", enMarkup, "Approval pending");
includes("en markup shows the plain allow", enMarkup, "Allow once");
includes("en markup shows the plain reject", enMarkup, ">Reject<");
includes("en markup shows the updated hint", enMarkup, "Add a note");
includes("en markup offers a collapse control", enMarkup, "Collapse");

/* ---------------------------------------------------------- interaction */

console.log("interaction");
function createDockProps(options = {}) {
  const { t = zhText, target, remote, currentSessionId = "session-1", titles = {}, statusMap = undefined } = options;
  const map = statusMap ?? new Map([[currentSessionId, { pendingInteraction: target.pending }]]);
  const byId = {};
  for (const [id, title] of Object.entries(titles)) byId[id] = { id, title };
  return {
    useSessionStatus: (selector) => selector(map),
    useSessions: (selector) => selector({ byId }),
    t,
    remote,
    uiSession: {
      current: {
        getSnapshot: () => ({ key: currentSessionId }),
        subscribe: () => () => {},
      },
    },
  };
}

function collectText(node, parts) {
  if (node === null || node === undefined) return;
  if (typeof node === "string") {
    parts.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, parts);
    return;
  }
  if (typeof node === "object" && Array.isArray(node.children)) collectText(node.children, parts);
}
const textOf = (renderer) => {
  const parts = [];
  collectText(renderer.toJSON(), parts);
  return parts.join("\n");
};
const buttonsOf = (renderer) => renderer.root.findAllByType("button");
const buttonText = (node) => node.children.filter((child) => typeof child === "string").join("");
const findButton = (renderer, label) => buttonsOf(renderer).find((node) => buttonText(node) === label);
const findTextarea = (renderer) => {
  const list = renderer.root.findAllByType("textarea");
  return list.length === 0 ? undefined : list[0];
};
const hasButton = (renderer, label) => findButton(renderer, label) !== undefined;

function mountDock(options = {}) {
  let renderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(internals.ApprovalReasonDock, createDockProps(options)));
  });
  return renderer;
}

function rerenderDock(renderer, options = {}) {
  act(() => {
    renderer.update(React.createElement(internals.ApprovalReasonDock, createDockProps(options)));
  });
}

function makeTarget(key, toolName = "pwsh", events) {
  return {
    sessionId: "session-1",
    pending: {
      kind: "approval",
      key,
      toolName,
      answerable: true,
      answer: async (outcome) => {
        events.push({ kind: "answer", outcome });
      },
    },
  };
}

async function clickAsync(node) {
  await act(async () => {
    node.props.onClick();
  });
}

function clickSync(node) {
  act(() => {
    node.props.onClick();
  });
}

function typeNote(renderer, value) {
  const area = findTextarea(renderer);
  act(() => {
    area.props.onChange({ target: { value } });
  });
}

// --- empty draft labels ---------------------------------------------------
{
  const events = [];
  const target = makeTarget("approval:ui-empty", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  check("empty draft renders the plain allow button", hasButton(renderer, "允许一次"));
  check("empty draft renders the plain reject button", hasButton(renderer, "拒绝"));
  check("empty draft hides allow-with-note", !hasButton(renderer, "允许并说明"));
  check("empty draft hides reject-with-note", !hasButton(renderer, "拒绝并说明"));
  check("empty draft renders the textarea", findTextarea(renderer) !== undefined);
}

// --- typing switches the labels ------------------------------------------
{
  const events = [];
  const target = makeTarget("approval:ui-typed", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  typeNote(renderer, "只改 docs/ 下的文件");
  check("typed draft switches to allow-with-note", hasButton(renderer, "允许并说明"));
  check("typed draft switches to reject-with-note", hasButton(renderer, "拒绝并说明"));
  check("typed draft hides the plain allow", !hasButton(renderer, "允许一次"));
  equal("typing sends no prompt", remote.calls.length, 0);
  equal("typing answers nothing", answerOutcomes(events), []);
}

// --- allow opens the confirm view only -----------------------------------
{
  const events = [];
  const target = makeTarget("approval:ui-confirm", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  typeNote(renderer, "只改 docs/ 下的文件");
  clickSync(findButton(renderer, "允许并说明"));
  const text = textOf(renderer);
  check("confirm view shows the title", text.includes("确认允许这次执行？"));
  check("confirm view shows the risk body", text.includes("允许后会立即执行该工具调用"));
  check("confirm view shows the partial-agreement hint", text.includes("部分同意或附条件放行"));
  check("confirm view previews the note", text.includes("将附上说明：只改 docs/ 下的文件"));
  check("confirm view shows the confirm button", hasButton(renderer, "确认允许"));
  check("confirm view shows the cancel button", hasButton(renderer, "取消"));
  check("confirm view hides the textarea", findTextarea(renderer) === undefined);
  equal("opening the confirm view sends no prompt", remote.calls.length, 0);
  equal("opening the confirm view answers nothing", answerOutcomes(events), []);
  equal("opening the confirm view keeps the draft", internals.recallDraft("approval:ui-confirm"), "只改 docs/ 下的文件");

  // --- cancel returns to the input view, draft kept, nothing answered ---
  clickSync(findButton(renderer, "取消"));
  check("cancel returns to the input view", findTextarea(renderer) !== undefined);
  equal("cancel keeps the draft", findTextarea(renderer).props.value, "只改 docs/ 下的文件");
  equal("cancel sends no prompt", remote.calls.length, 0);
  equal("cancel answers nothing", answerOutcomes(events), []);
  check("cancel closes the confirm view", !textOf(renderer).includes("确认允许这次执行？"));
}

// --- confirm allow with a note -------------------------------------------
{
  const events = [];
  const target = makeTarget("approval:ui-allow-note", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  typeNote(renderer, "只改 docs/ 下的文件");
  clickSync(findButton(renderer, "允许并说明"));
  await clickAsync(findButton(renderer, "确认允许"));
  equal("confirmed allow with note answers allowed-once", answerOutcomes(events), ["allowed-once"]);
  equal("confirmed allow with note sends one prompt", remote.calls.length, 1);
  equal("confirmed allow note uses the allow prefix", remote.calls[0].content[0].text, "（审批同意说明）只改 docs/ 下的文件");
  equal("confirmed allow note is steered", remote.calls[0].mode, "steer");
  equal("confirmed allow prompts before answering", answerKinds(events), ["prompt", "answer"]);
  equal("confirmed allow clears the draft map", internals.recallDraft("approval:ui-allow-note"), "");
  check("confirmed allow returns to the input view", findTextarea(renderer) !== undefined);
  equal("confirmed allow clears the textarea", findTextarea(renderer).props.value, "");
}

// --- confirm allow without a note ----------------------------------------
{
  const events = [];
  const target = makeTarget("approval:ui-allow-plain", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  clickSync(findButton(renderer, "允许一次"));
  check("plain allow also opens the confirm view", textOf(renderer).includes("确认允许这次执行？"));
  check("plain confirm view has no note preview", !textOf(renderer).includes("将附上说明"));
  await clickAsync(findButton(renderer, "确认允许"));
  equal("confirmed plain allow answers allowed-once", answerOutcomes(events), ["allowed-once"]);
  equal("confirmed plain allow sends no prompt", remote.calls.length, 0);
}

// --- duplicate confirm clicks submit once --------------------------------
{
  const events = [];
  const target = makeTarget("approval:ui-double", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  typeNote(renderer, "重复点击测试");
  clickSync(findButton(renderer, "允许并说明"));
  const confirm = findButton(renderer, "确认允许");
  await act(async () => {
    confirm.props.onClick();
    confirm.props.onClick();
  });
  equal("duplicate confirm clicks answer once", answerOutcomes(events), ["allowed-once"]);
  equal("duplicate confirm clicks prompt once", remote.calls.length, 1);
}

// --- failed delivery blocks the allow ------------------------------------
{
  const events = [];
  const target = makeTarget("approval:ui-fail", "pwsh", events);
  const remote = eventRemote(() => ({ ok: false, error: { code: "session/denied", message: "no such session" } }), events);
  const renderer = mountDock({ target, remote });
  typeNote(renderer, "只改 docs/");
  clickSync(findButton(renderer, "允许并说明"));
  await clickAsync(findButton(renderer, "确认允许"));
  equal("failed delivery answers nothing", answerOutcomes(events), []);
  const text = textOf(renderer);
  check("failed delivery shows the failure notice", text.includes("审批未提交：说明发送失败"));
  check("failed delivery keeps the error code visible", text.includes("session/denied"));
  check("failed delivery returns to the input view", findTextarea(renderer) !== undefined);
  equal("failed delivery keeps the draft", findTextarea(renderer).props.value, "只改 docs/");
  check("failed delivery keeps the approval panel", text.includes("审批待处理"));
  equal("failed delivery tried steer then queue", remote.calls.map((call) => call.mode), ["steer", "queue"]);
}

// --- reject never visits the confirm view --------------------------------
{
  const events = [];
  const target = makeTarget("approval:ui-reject-note", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  typeNote(renderer, "先别发截图");
  await clickAsync(findButton(renderer, "拒绝并说明"));
  check("reject does not open the confirm view", !textOf(renderer).includes("确认允许这次执行？"));
  equal("reject with note prompts before answering", answerKinds(events), ["prompt", "answer"]);
  equal("reject note uses the rejection prefix", events[0].text, "（审批拒绝理由）先别发截图");
  equal("reject answers rejected", answerOutcomes(events), ["rejected"]);
  equal("reject clears the draft map", internals.recallDraft("approval:ui-reject-note"), "");
  equal("reject clears the textarea", findTextarea(renderer).props.value, "");
}

{
  const events = [];
  const target = makeTarget("approval:ui-reject-plain", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  await clickAsync(findButton(renderer, "拒绝"));
  equal("plain reject answers rejected", answerOutcomes(events), ["rejected"]);
  equal("plain reject sends no prompt", remote.calls.length, 0);
  check("plain reject does not open the confirm view", !textOf(renderer).includes("确认允许这次执行？"));
}

// --- keyboard rules in the confirm view ----------------------------------
{
  const originalAdd = globalThis.addEventListener;
  const originalRemove = globalThis.removeEventListener;
  const added = [];
  const removed = [];
  globalThis.addEventListener = (type, handler) => {
    added.push({ type, handler });
  };
  globalThis.removeEventListener = (type, handler) => {
    removed.push({ type, handler });
  };
  try {
    const events = [];
    const target = makeTarget("approval:ui-keys", "pwsh", events);
    const remote = eventRemote({ ok: true }, events);
    const renderer = mountDock({ target, remote });
    typeNote(renderer, "键盘测试");
    clickSync(findButton(renderer, "允许并说明"));
    const keydownAdds = added.filter((entry) => entry.type === "keydown");
    equal("confirm view subscribes to keydown on globalThis", keydownAdds.length, 1);
    check("keydown subscription receives a handler", typeof keydownAdds[0]?.handler === "function");

    let prevented = 0;
    const event = (key) => ({ key, preventDefault: () => (prevented += 1) });

    act(() => {
      keydownAdds[0].handler(event("Enter"));
    });
    equal("Enter is preventDefaulted", prevented, 1);
    check("Enter keeps the confirm view open", textOf(renderer).includes("确认允许这次执行？"));
    equal("Enter answers nothing", answerOutcomes(events), []);

    act(() => {
      keydownAdds[0].handler(event("Escape"));
    });
    equal("Escape is preventDefaulted", prevented, 2);
    check("Escape returns to the input view", findTextarea(renderer) !== undefined);
    check("Escape closes the confirm view", !textOf(renderer).includes("确认允许这次执行？"));
    equal("Escape keeps the draft", findTextarea(renderer).props.value, "键盘测试");
    equal("Escape answers nothing", answerOutcomes(events), []);
    equal("Escape sends no prompt", remote.calls.length, 0);
    check(
      "keydown listener is removed when the view changes",
      removed.some((entry) => entry.type === "keydown" && entry.handler === keydownAdds[0].handler),
    );
  } finally {
    globalThis.addEventListener = originalAdd;
    globalThis.removeEventListener = originalRemove;
  }
}

// --- new approval / session switch resets the view -----------------------
{
  const eventsA = [];
  const eventsB = [];
  const targetA = makeTarget("approval:ui-switch-a", "pwsh", eventsA);
  const targetB = makeTarget("approval:ui-switch-b", "edit", eventsB);
  const remoteA = eventRemote({ ok: true }, eventsA);
  const remoteB = eventRemote({ ok: true }, eventsB);
  const renderer = mountDock({ target: targetA, remote: remoteA, currentSessionId: "session-1" });
  typeNote(renderer, "甲草稿");
  clickSync(findButton(renderer, "允许并说明"));
  check("dispatch: confirm view is open before switching", textOf(renderer).includes("确认允许这次执行？"));

  rerenderDock(renderer, { target: targetB, remote: remoteB, currentSessionId: "session-2" });
  check("session switch returns to the input view", findTextarea(renderer) !== undefined);
  equal("session switch loads the other approval's empty draft", findTextarea(renderer).props.value, "");
  includes("session switch shows the other session's tool", textOf(renderer), "工具：edit");

  rerenderDock(renderer, { target: targetA, remote: remoteA, currentSessionId: "session-1" });
  equal("switching back restores the draft by approval key", findTextarea(renderer).props.value, "甲草稿");
  check("switching back restores the input view", !textOf(renderer).includes("确认允许这次执行？"));
}

/* ------------------------------------------------------- settings store */

console.log("settings store");

function fakeStorage() {
  const map = new Map();
  return {
    map,
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

/** Change settings from a test without tripping act() warnings. */
function setSettings(patch) {
  act(() => {
    internals.updateSettings(patch);
  });
}

{
  const scriptedStorage = fakeStorage();
  const originalLocalStorage = globalThis.localStorage;
  let storageInstalled = false;
  try {
    equal("settings default to on/on", internals.getSettings(), { allowNote: true, confirmAllow: true });
    equal("reading settings without localStorage returns defaults", internals.readStoredSettings(), { allowNote: true, confirmAllow: true });

    globalThis.localStorage = scriptedStorage;
    storageInstalled = true;
    equal("missing stored settings fall back to defaults", internals.readStoredSettings(), { allowNote: true, confirmAllow: true });

    scriptedStorage.map.set(internals.SETTINGS_KEY, "{not json");
    equal("malformed JSON falls back to defaults", internals.readStoredSettings(), { allowNote: true, confirmAllow: true });

    scriptedStorage.map.set(internals.SETTINGS_KEY, "[]");
    equal("non-object JSON falls back to defaults", internals.readStoredSettings(), { allowNote: true, confirmAllow: true });

    scriptedStorage.map.set(internals.SETTINGS_KEY, '{"allowNote":"yes","confirmAllow":0}');
    equal("non-boolean fields fall back to defaults", internals.readStoredSettings(), { allowNote: true, confirmAllow: true });

    scriptedStorage.map.set(internals.SETTINGS_KEY, '{"allowNote":false,"extra":1}');
    equal("partial stored settings merge with defaults and ignore extras", internals.readStoredSettings(), { allowNote: false, confirmAllow: true });

    scriptedStorage.map.set(internals.SETTINGS_KEY, '{"allowNote":true,"confirmAllow":true}');
    equal("updateSettings patches one field", internals.updateSettings({ allowNote: false }), { allowNote: false, confirmAllow: true });
    equal("updateSettings keeps the new memory value", internals.getSettings(), { allowNote: false, confirmAllow: true });
    equal("updateSettings persists to localStorage", JSON.parse(scriptedStorage.map.get(internals.SETTINGS_KEY)), {
      allowNote: false,
      confirmAllow: true,
    });

    let notified = 0;
    const unsubscribe = internals.subscribe(() => {
      notified += 1;
    });
    internals.updateSettings({ confirmAllow: false });
    equal("subscribers are notified on update", notified, 1);
    unsubscribe();
    internals.updateSettings({ confirmAllow: true });
    equal("unsubscribed listeners stop being notified", notified, 1);

    scriptedStorage.map.set(internals.SETTINGS_KEY, '{"allowNote":false,"confirmAllow":false}');
    let synced = 0;
    const unsubscribeSync = internals.subscribe(() => {
      synced += 1;
    });
    const beforeOtherKey = internals.getSettings();
    const afterOtherKey = internals.handleStorageEvent({ key: "some-other-key" });
    check("storage events for other keys are ignored", afterOtherKey === beforeOtherKey && synced === 0);
    internals.handleStorageEvent({ key: internals.SETTINGS_KEY });
    equal("storage event syncs settings from localStorage", internals.getSettings(), { allowNote: false, confirmAllow: false });
    equal("storage event notifies subscribers once", synced, 1);
    internals.handleStorageEvent({ key: internals.SETTINGS_KEY });
    equal("unchanged storage data does not re-notify", synced, 1);
    unsubscribeSync();

    globalThis.localStorage = {
      getItem: () => null,
      setItem() {
        throw new Error("quota exceeded");
      },
      removeItem() {},
    };
    equal("persistence failure keeps the in-memory value", internals.updateSettings({ allowNote: true, confirmAllow: true }), {
      allowNote: true,
      confirmAllow: true,
    });
    equal("persistence failure still notifies memory readers", internals.getSettings(), { allowNote: true, confirmAllow: true });
  } finally {
    if (storageInstalled) {
      if (originalLocalStorage === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = originalLocalStorage;
    }
    internals.updateSettings({ allowNote: true, confirmAllow: true });
  }
}

/* -------------------------------------------------- settings section UI */

console.log("settings section");

{
  setSettings({ allowNote: true, confirmAllow: true });
  let zhSettings;
  act(() => {
    zhSettings = TestRenderer.create(React.createElement(internals.SettingsSection, { t: zhText }));
  });
  const zhSettingsText = textOf(zhSettings);
  includes("settings section shows the title", zhSettingsText, "审批说明浮层");
  includes("settings section shows the intro", zhSettingsText, "拒绝带理由始终可用");
  includes("settings section shows the allow-note label", zhSettingsText, "允许时带话");
  includes("settings section shows the allow-note description", zhSettingsText, "作为 steering 用户消息");
  includes("settings section shows the allow-note on-risk", zhSettingsText, "开启时：说明会写入会话日志");
  includes("settings section shows the allow-note off-risk", zhSettingsText, "关闭时：允许不能附带条件");
  includes("settings section shows the confirmation label", zhSettingsText, "允许二次确认");
  includes("settings section shows the confirmation description", zhSettingsText, "点允许后先在面板内二次确认");
  includes("settings section shows the confirmation on-risk", zhSettingsText, "开启时：每次允许多一步操作");
  includes("settings section shows the confirmation off-risk", zhSettingsText, "关闭时：点允许会立即执行工具调用");
  includes("settings section shows the default note", zhSettingsText, "两项默认开启");
  const zhBoxes = zhSettings.root.findAllByType("input");
  equal("settings section renders two checkboxes", zhBoxes.length, 2);
  check("settings checkboxes default to checked", zhBoxes.every((box) => box.props.checked === true));
  equal("allow-note checkbox aria label", zhBoxes[0]?.props["aria-label"], "允许时带话 开关");
  equal("confirmation checkbox aria label", zhBoxes[1]?.props["aria-label"], "允许二次确认 开关");

  let enSettings;
  act(() => {
    enSettings = TestRenderer.create(React.createElement(internals.SettingsSection, { t: enText }));
  });
  const enSettingsText = textOf(enSettings);
  includes("en settings section shows the title", enSettingsText, "Approval Note Dock");
  includes("en settings section shows the allow-note label", enSettingsText, "Allow with note");
  includes("en settings section shows the confirmation label", enSettingsText, "Allow confirmation");
  includes("en settings section shows risk copy", enSettingsText, "no second line of defense against misclicks");
  includes("en settings section shows the default note", enSettingsText, "Both default to on");
  equal("en confirmation checkbox aria label", enSettings.root.findAllByType("input")[1]?.props["aria-label"], "Allow confirmation toggle");
}

{
  const scriptedStorage = fakeStorage();
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = scriptedStorage;
  try {
    setSettings({ allowNote: true, confirmAllow: true });
    let settingsRenderer;
    act(() => {
      settingsRenderer = TestRenderer.create(React.createElement(internals.SettingsSection, { t: zhText }));
    });

    let boxes = settingsRenderer.root.findAllByType("input");
    act(() => {
      boxes[0].props.onChange({ target: { checked: false } });
    });
    equal("toggling allow-note updates the store", internals.getSettings().allowNote, false);
    equal("toggling allow-note persists", JSON.parse(scriptedStorage.map.get(internals.SETTINGS_KEY)).allowNote, false);
    check("allow-note checkbox re-renders unchecked", settingsRenderer.root.findAllByType("input")[0].props.checked === false);

    boxes = settingsRenderer.root.findAllByType("input");
    act(() => {
      boxes[1].props.onChange({ target: { checked: false } });
    });
    equal("toggling confirmation updates the store", internals.getSettings().confirmAllow, false);
    equal("toggling confirmation persists", JSON.parse(scriptedStorage.map.get(internals.SETTINGS_KEY)).confirmAllow, false);
    check("confirmation checkbox re-renders unchecked", settingsRenderer.root.findAllByType("input")[1].props.checked === false);

    act(() => {
      settingsRenderer.root.findAllByType("input")[0].props.onChange({ target: { checked: true } });
    });
    equal("toggling allow-note back updates the store", internals.getSettings().allowNote, true);
    check("allow-note checkbox re-renders checked", settingsRenderer.root.findAllByType("input")[0].props.checked === true);
  } finally {
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
    setSettings({ allowNote: true, confirmAllow: true });
  }
}

/* ---------------------------------------------------- overlay behaviour matrix */

console.log("behaviour matrix");

{
  // allowNote off: the note can no longer ride along on an allow, but the
  // reject-with-note label and flow are untouched.
  setSettings({ allowNote: false, confirmAllow: true });
  const events = [];
  const target = makeTarget("approval:m-allow-label", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  typeNote(renderer, "只改 docs/");
  check("allowNote off shows the plain allow label", hasButton(renderer, "允许一次"));
  check("allowNote off hides allow-with-note", !hasButton(renderer, "允许并说明"));
  check("allowNote off keeps the reject-with-note label", hasButton(renderer, "拒绝并说明"));
}

{
  // allowNote off + confirmation on: confirming answers without delivering a note.
  setSettings({ allowNote: false, confirmAllow: true });
  const events = [];
  const target = makeTarget("approval:m-allow-confirm", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  typeNote(renderer, "别动别的文件");
  clickSync(findButton(renderer, "允许一次"));
  const text = textOf(renderer);
  check("confirmation still opens when notes are off", text.includes("确认允许这次执行？"));
  check("confirmation shows the note-disabled hint", text.includes("已在设置中关闭"));
  check("confirmation hides the note preview when notes are off", !text.includes("将附上说明"));
  await clickAsync(findButton(renderer, "确认允许"));
  equal("confirmed allow without note answers allowed-once", answerOutcomes(events), ["allowed-once"]);
  equal("confirmed allow without note sends no prompt", remote.calls.length, 0);
}

{
  // confirmAllow off: one click allows immediately, no confirmation view.
  setSettings({ allowNote: true, confirmAllow: false });
  const events = [];
  const target = makeTarget("approval:m-no-confirm", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  check("confirmation off keeps the plain allow label on an empty draft", hasButton(renderer, "允许一次"));
  check("confirmation off keeps the plain reject label on an empty draft", hasButton(renderer, "拒绝"));
  clickSync(findButton(renderer, "允许一次"));
  check("confirmation off skips the confirm view", !textOf(renderer).includes("确认允许这次执行？"));
  check("confirmation off reports progress instead", textOf(renderer).includes("正在把说明送进当前对话"));
  await act(async () => {});
  equal("confirmation off answers allowed-once immediately", answerOutcomes(events), ["allowed-once"]);
  equal("confirmation off sends no prompt for an empty draft", remote.calls.length, 0);
}

{
  // confirmAllow off + allowNote on: still prompt-before-answer, just no confirm view.
  setSettings({ allowNote: true, confirmAllow: false });
  const events = [];
  const target = makeTarget("approval:m-no-confirm-note", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  typeNote(renderer, "只改 docs/ 下的文件");
  check("confirmation off keeps the allow-with-note label", hasButton(renderer, "允许并说明"));
  await clickAsync(findButton(renderer, "允许并说明"));
  equal("direct allow with note answers allowed-once", answerOutcomes(events), ["allowed-once"]);
  equal("direct allow with note prompts before answering", answerKinds(events), ["prompt", "answer"]);
  equal("direct allow note uses the allow prefix", remote.calls[0].content[0].text, "（审批同意说明）只改 docs/ 下的文件");
  equal("direct allow note is steered", remote.calls[0].mode, "steer");
}

{
  // Both switches off: an allow carries neither a note nor a confirmation.
  setSettings({ allowNote: false, confirmAllow: false });
  const events = [];
  const target = makeTarget("approval:m-both-off", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  typeNote(renderer, "这句话不会送出去");
  check("both switches off show the plain allow label", hasButton(renderer, "允许一次"));
  await clickAsync(findButton(renderer, "允许一次"));
  equal("both switches off answer allowed-once", answerOutcomes(events), ["allowed-once"]);
  equal("both switches off send no prompt", remote.calls.length, 0);
}

{
  // Reject path is independent of both switches.
  setSettings({ allowNote: false, confirmAllow: false });
  const events = [];
  const target = makeTarget("approval:m-reject", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  typeNote(renderer, "先别发截图");
  check("reject-with-note label ignores the switches", hasButton(renderer, "拒绝并说明"));
  await clickAsync(findButton(renderer, "拒绝并说明"));
  equal("reject with note still prompts before answering", answerKinds(events), ["prompt", "answer"]);
  equal("reject note uses the rejection prefix", remote.calls[0].content[0].text, "（审批拒绝理由）先别发截图");
  equal("reject still answers rejected with switches off", answerOutcomes(events), ["rejected"]);
}

{
  // Live settings changes reach the mounted overlay and reset a stale confirm view.
  setSettings({ allowNote: true, confirmAllow: true });
  const events = [];
  const target = makeTarget("approval:m-live", "pwsh", events);
  const remote = eventRemote({ ok: true }, events);
  const renderer = mountDock({ target, remote });
  typeNote(renderer, "即时生效测试");
  check("dock starts with the allow-with-note label", hasButton(renderer, "允许并说明"));
  setSettings({ allowNote: false });
  check("disabling allow-note updates the open dock", hasButton(renderer, "允许一次"));
  setSettings({ allowNote: true });
  check("re-enabling allow-note restores the open dock", hasButton(renderer, "允许并说明"));

  clickSync(findButton(renderer, "允许并说明"));
  check("confirm view is open before the switch changes", textOf(renderer).includes("确认允许这次执行？"));
  setSettings({ confirmAllow: false });
  check("disabling confirmation exits the confirm view", findTextarea(renderer) !== undefined);
  check("disabling confirmation hides the confirm title", !textOf(renderer).includes("确认允许这次执行？"));
  equal("disabling confirmation answers nothing", answerOutcomes(events), []);
  setSettings({ allowNote: true, confirmAllow: true });
}

/* --------------------------------------------------------------- wiring */

console.log("wiring");
{
  const dictionaries = {};
  const registrations = [];
  const disposers = [];
  const injectedNames = [];
  const remote = fakeRemote([{ ok: true }]);
  const ctx = {
    effect(fn) {
      disposers.push(fn());
    },
    locale: {
      register(namespace, dict) {
        dictionaries[namespace] = dict;
        return () => {};
      },
      bind: () => zhText,
    },
    slots: {
      inject(name, install) {
        injectedNames.push(name);
        install();
      },
      register(options, component) {
        registrations.push({ options, component });
        return () => {};
      },
    },
    remote,
    uiSession: {
      current: {
        getSnapshot: () => ({ key: "session-1" }),
        subscribe: () => () => {},
      },
    },
  };
  bundle.apply(ctx);
  equal("dictionaries registered under the plugin namespace", Object.keys(dictionaries), ["approval-reason-dock"]);
  equal("slots injected by the plugin", injectedNames, ["shell.overlay", "settings.section"]);
  equal("two slot registrations", registrations.length, 2);
  const overlay = registrations.find((entry) => entry.options?.name === "shell.overlay");
  equal("registered overlay slot", overlay?.options?.name, "shell.overlay");
  equal("registered overlay id", overlay?.options?.id, "approval-reason-dock");
  equal("overlay locale namespace", overlay?.options?.locale, "approval-reason-dock");
  equal("overlay component", overlay?.component, internals.ApprovalReasonDock);
  const injected = overlay?.options?.inject?.();
  equal("overlay inject exposes the remote service", injected?.remote, remote);
  equal("overlay inject exposes the uiSession service", injected?.uiSession, ctx.uiSession);
  const settingsEntry = registrations.find((entry) => entry.options?.name === "settings.section");
  equal("registered settings section", settingsEntry?.options?.name, "settings.section");
  equal("registered settings section id", settingsEntry?.options?.id, "approval-reason-dock");
  equal("registered settings section order", settingsEntry?.options?.order, 60);
  equal("settings section locale namespace", settingsEntry?.options?.locale, "approval-reason-dock");
  equal("settings section component", settingsEntry?.component, internals.SettingsSection);
  equal("settings nav label is localized", settingsEntry?.options?.label?.(), "审批说明浮层");
  equal("settings section inject is empty", settingsEntry?.options?.inject?.(), {});
}

{
  // The nav label must never throw when the locale seat has no bind().
  const fallbackRegistrations = [];
  const fallbackCtx = {
    effect(fn) {
      fn();
    },
    locale: { register: () => () => {} },
    slots: {
      inject(name, install) {
        install();
      },
      register(options, component) {
        fallbackRegistrations.push({ options, component });
        return () => {};
      },
    },
  };
  bundle.apply(fallbackCtx);
  const settingsEntry = fallbackRegistrations.find((entry) => entry.options?.name === "settings.section");
  equal("settings nav label falls back to the key name", settingsEntry?.options?.label?.(), "settingsNav");

  const throwingRegistrations = [];
  const throwingCtx = {
    effect(fn) {
      fn();
    },
    locale: {
      register: () => () => {},
      bind() {
        throw new Error("no locale seat");
      },
    },
    slots: {
      inject(name, install) {
        install();
      },
      register(options, component) {
        throwingRegistrations.push({ options, component });
        return () => {};
      },
    },
  };
  bundle.apply(throwingCtx);
  const throwingEntry = throwingRegistrations.find((entry) => entry.options?.name === "settings.section");
  equal("settings nav label survives a broken locale seat", throwingEntry?.options?.label?.(), "settingsNav");
}

console.log("");
console.log(`${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exitCode = 1;
