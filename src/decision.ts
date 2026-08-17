import type { PlanDecision } from "./types.js";

export const DISMISS_MESSAGE =
  "The user dismissed the plan review to speak instead; stay in plan mode, stop here, and wait for their message.";

export const DENY_MESSAGE =
  "The user chose to keep planning; revise the plan and present it again.";

export function denyMessage(feedback?: string): string {
  const trimmed = feedback?.trim();
  return trimmed
    ? `The user chose to keep planning; their feedback: ${trimmed}`
    : DENY_MESSAGE;
}

export function throwDecision(decision: Exclude<PlanDecision, { kind: "approved" }>): never {
  if (decision.kind === "dismissed") {
    throw new Error(DISMISS_MESSAGE);
  }
  throw new Error(denyMessage(decision.feedback));
}

/**
 * Read the last JSON object from CLI stdout. Wrapper noise may precede it.
 */
export function parsePlanDecision(stdout: string): PlanDecision {
  const parsed = parseLastJson(stdout);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Plannotator CLI did not return a JSON decision.");
  }

  const record = parsed as Record<string, unknown>;
  const decision = record.decision;
  const feedback = readOptionalString(record.feedback);

  if (decision === "approved" || record.approved === true) {
    return feedback ? { kind: "approved", notes: feedback } : { kind: "approved" };
  }
  if (decision === "dismissed" || record.exit === true) {
    return { kind: "dismissed" };
  }
  if (decision === "denied" || decision === "annotated" || record.approved === false) {
    return { kind: "denied", feedback };
  }

  throw new Error("Plannotator CLI returned an unrecognized decision.");
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseLastJson(stdout: string): unknown {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line?.startsWith("{")) continue;
    try {
      return JSON.parse(line);
    } catch {
      // Keep scanning earlier JSON lines.
    }
  }

  const trimmed = stdout.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  return undefined;
}
