#!/usr/bin/env node
/**
 * Cursor hooks for code review typecheck:
 * - beforeSubmitPrompt: when the prompt looks like a review, run pnpm typecheck
 *   and inject the result as additional_context (when the host supports it).
 * - preToolUse (Task): when launching bugbot or security-review, append typecheck
 *   output to the subagent prompt via updated_input.
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const REVIEW_PROMPT_RE =
  /\b(code\s*review|agent[- ]?review|bugbot|\/review|find issues|review (the |these |my |our )?(changes|commits?|diff|pr|pull request|branch))\b/i;

const REVIEW_SUBAGENTS = new Set(["bugbot", "security-review"]);

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

function projectRoot(payload) {
  const roots = payload.workspace_roots;
  if (Array.isArray(roots) && roots.length > 0) return roots[0];
  return process.cwd();
}

function runTypecheck(root) {
  const result = spawnSync("pnpm", ["typecheck"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 4 * 1024 * 1024,
    env: process.env,
  });
  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  const combined = [stdout, stderr].filter(Boolean).join("\n");
  const ok = result.status === 0;
  const body = combined || (ok ? "(no output)" : `typecheck exited ${result.status}`);
  return {
    ok,
    status: result.status == null ? 1 : result.status,
    text: body.slice(0, 12000),
  };
}

function typecheckBlock(result) {
  const status = result.ok ? "PASS" : "FAIL";
  return [
    "Earthbeat typecheck result (pnpm typecheck):",
    `Status: ${status} (exit ${result.status})`,
    "",
    result.text,
    "",
    "Treat every TypeScript error above as a Critical review finding with file:line.",
  ].join("\n");
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
  process.exit(0);
}

function handleBeforeSubmitPrompt(payload) {
  const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
  if (!REVIEW_PROMPT_RE.test(prompt)) {
    return emit({ continue: true });
  }

  const result = runTypecheck(projectRoot(payload));
  const context = typecheckBlock(result);
  return emit({
    continue: true,
    // Supported when the host accepts session-style injection on submit.
    additional_context: context,
    // Fallback: surface in the agent turn when additional_context is ignored.
    agent_message: context,
  });
}

function handlePreToolUse(payload) {
  const input = payload.tool_input;
  if (!input || typeof input !== "object") {
    return emit({ permission: "allow" });
  }

  const subagent =
    (typeof input.subagent_type === "string" && input.subagent_type) ||
    (typeof input.subagentType === "string" && input.subagentType) ||
    "";
  if (!REVIEW_SUBAGENTS.has(subagent)) {
    return emit({ permission: "allow" });
  }

  const result = runTypecheck(projectRoot(payload));
  const block = typecheckBlock(result);
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  const updated = {
    ...input,
    prompt: prompt
      ? `${prompt}\n\n---\n${block}`
      : block,
  };

  return emit({
    permission: "allow",
    updated_input: updated,
    agent_message: result.ok
      ? "Injected pnpm typecheck PASS into the review subagent prompt."
      : "Injected pnpm typecheck FAIL into the review subagent prompt.",
  });
}

async function main() {
  const raw = (await readStdin()).replace(/^\uFEFF+/, "");
  if (!raw.trim()) return emit({ continue: true });

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return emit({ continue: true });
  }

  const hook = payload.hook_event_name || payload.event || "";
  const tool = payload.tool_name || "";

  if (hook === "beforeSubmitPrompt" || (!hook && typeof payload.prompt === "string")) {
    return handleBeforeSubmitPrompt(payload);
  }

  if (
    hook === "preToolUse" ||
    tool === "Task" ||
    (payload.tool_input && typeof payload.tool_input === "object")
  ) {
    if (tool && tool !== "Task" && hook === "preToolUse") {
      return emit({ permission: "allow" });
    }
    return handlePreToolUse(payload);
  }

  return emit({ continue: true });
}

main().catch(() => emit({ continue: true }));
