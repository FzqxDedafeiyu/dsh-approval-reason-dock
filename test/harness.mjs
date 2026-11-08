/**
 * Sandbox harness for dsh-approval-reason-dock.
 *
 * Runs without DSH: it validates the published package shape, loads the real
 * browser bundle factory with React, drives the slot registration against a
 * fake Cordis context, and exercises the rejection flow through the exported
 * internals. Nothing here touches a running Harness instance.
 *
 * Run: node test/harness.mjs
 */
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fileURLToPath, pathToFileURL } from "node:url";

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
equal("bundle inject", bundle.inject, ["slots", "locale", "remote", "remote.session"]);

const internals = bundle.__internals;
check("internals exported for the harness", internals !== undefined && typeof internals.deliverReason === "function");
equal("locale dictionaries keep the same key set", Object.keys(internals.zh).sort(), Object.keys(internals.en).sort());
check("both dictionaries fill every key", Object.values(internals.zh).every((value) => typeof value === "string" && value.length > 0) && Object.values(internals.en).every((value) => typeof value === "string" && value.length > 0));

/* -------------------------------------------------------------- helpers */

console.log("helpers");
equal("normalizeReason trims and collapses", internals.normalizeReason("  网络不稳，   先别发  "), "网络不稳， 先别发");
equal("normalizeReason caps at 500 characters", internals.normalizeReason("a".repeat(600)).length, 500);
equal("normalizeReason tolerates non-strings", internals.normalizeReason(undefined), "");
equal("errorText combines code and message", internals.errorText({ ok: false, error: { code: "session/denied", message: "no such session" } }), "session/denied: no such session");
equal("errorText tolerates a missing error", internals.errorText({ ok: false }), "unknown error");

const approval = { kind: "approval", key: "approval:1", toolName: "pwsh", answerable: true, answer: async () => {} };
const question = { kind: "question", key: "question:1", answerable: true };
const settled = { kind: "approval", key: "approval:2", answerable: false, answer: async () => {} };
check("firstApproval ignores questions", internals.firstApproval(new Map([["s", { pendingInteraction: question }]])) === undefined);
check("firstApproval ignores unanswerable approvals", internals.firstApproval(new Map([["s", { pendingInteraction: settled }]])) === undefined);
equal("firstApproval returns the session and key", internals.firstApproval(new Map([["s", { pendingInteraction: approval }]]))?.sessionId, "s");

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

/* --------------------------------------------------------------- render */

console.log("render");
const zhText = (key, vars) => String(internals.zh[key] ?? key).replaceAll(/\{([^}]+)\}/g, (_, name) => String(vars?.[name] ?? `{${name}}`));
const enText = (key, vars) => String(internals.en[key] ?? key).replaceAll(/\{([^}]+)\}/g, (_, name) => String(vars?.[name] ?? `{${name}}`));

function renderWith(t, snapshot) {
  return renderToStaticMarkup(
    React.createElement(internals.ApprovalReasonDock, {
      useSessionStatus: (selector) => selector(snapshot),
      t,
      remote: fakeRemote([{ ok: true }]),
    }),
  );
}

const emptyMarkup = renderWith(zhText, new Map());
equal("no approval renders nothing", emptyMarkup, "");

const pendingMap = new Map([["session-1", { pendingInteraction: approval }]]);
const zhMarkup = renderWith(zhText, pendingMap);
includes("zh markup shows the title", zhMarkup, "审批待处理");
includes("zh markup shows the tool", zhMarkup, "工具：pwsh");
includes("zh markup shows both buttons", zhMarkup, "拒绝并说明");
includes("zh markup shows the plain reject", zhMarkup, "只拒绝");
includes("zh markup shows the hint", zhMarkup, "留一句拒绝理由");

const enMarkup = renderWith(enText, pendingMap);
includes("en markup shows the title", enMarkup, "Approval pending");
includes("en markup shows the primary action", enMarkup, "Reject with reason");

/* --------------------------------------------------------------- wiring */

console.log("wiring");
{
  const dictionaries = {};
  let slot;
  const disposers = [];
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
        install();
      },
      register(options, component) {
        slot = { options, component };
        return () => {};
      },
    },
    remote,
  };
  bundle.apply(ctx);
  equal("dictionaries registered under the plugin namespace", Object.keys(dictionaries), ["approval-reason-dock"]);
  equal("registered slot", slot?.options?.name, "shell.overlay");
  equal("registered slot id", slot?.options?.id, "approval-reason-dock");
  equal("slot locale namespace", slot?.options?.locale, "approval-reason-dock");
  equal("slot component", slot?.component, internals.ApprovalReasonDock);
  const injected = slot?.options?.inject?.();
  equal("slot inject exposes the remote service", injected?.remote, remote);
}

console.log("");
console.log(`${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exitCode = 1;