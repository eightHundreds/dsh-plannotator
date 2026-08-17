import type { Context } from "@deepseek-ai/cordis";
import { throwDecision } from "./decision.js";
import { openPlannotatorForAgent } from "./launch.js";
import type { PlanAgent, PlanDecision, PlanModeService, ToolDispatchExecution } from "./types.js";

export const name = "plannotator";

/**
 * Host-plane `tools` only. On `dsh web`, `planMode` lives in the per-preset
 * `planning` isolate, so a hard `inject: ['planMode']` waits forever and the
 * profile never boots. Read it with `ctx.get('planMode')` (no inject needed).
 */
export const inject = ["tools"];

export const EXIT_PLAN_MODE = "exit_plan_mode";

const HEADING_RE = /^#\s+\S/;

export function apply(ctx: Context): void {
  ctx.on("tools/execute", async (exec, next) => {
    const planMode = resolvePlanMode(ctx, exec.agent);
    if (!shouldInterceptExitPlanMode(exec, planMode)) return next();

    const plan = readPlanArgument(exec.arguments);
    const agent = exec.agent;
    if (!agent) return next();

    const decision = await openPlannotatorForAgent(plan, agent, exec.signal);
    return settlePlanDecision(planMode, agent, decision);
  });
}

export function resolvePlanMode(ctx: Context, agent?: PlanAgent): PlanModeService | undefined {
  const fromAgent = asPlanModeService(agent?.ctx?.get?.("planMode"));
  if (fromAgent) return fromAgent;
  return asPlanModeService(ctx.get("planMode"));
}

function asPlanModeService(value: unknown): PlanModeService | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (!("get" in value) || !("set" in value)) return undefined;
  return value as PlanModeService;
}

export function shouldInterceptExitPlanMode(
  exec: Pick<ToolDispatchExecution, "name" | "arguments" | "agent">,
  planMode?: PlanModeService,
): boolean {
  if (exec.name !== EXIT_PLAN_MODE) return false;
  if (!exec.agent) return false;
  if (!isPlanModeActive(exec.agent, planMode)) return false;
  return HEADING_RE.test(readPlanArgument(exec.arguments).trim());
}

export function isPlanModeActive(agent: PlanAgent, planMode?: PlanModeService): boolean {
  if (planMode) return planMode.get(agent).active;
  let active = false;
  for (const event of agent.session?.events ?? []) {
    if (event.type === "plan/mode") active = event.data?.active === true;
  }
  return active;
}

export function readPlanArgument(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const plan = (args as { plan?: unknown }).plan;
  return typeof plan === "string" ? plan : "";
}

export interface ApprovedToolResult {
  isError: false;
  value: { approved: true };
}

export async function settlePlanDecision(
  planMode: PlanModeService | undefined,
  agent: PlanAgent,
  decision: PlanDecision,
): Promise<ApprovedToolResult> {
  if (decision.kind !== "approved") throwDecision(decision);

  leavePlanMode(agent, planMode);
  if (decision.notes) await injectApprovalNotes(agent, decision.notes);
  // tools/execute wrappers must return a ToolExecutionResult. A bare
  // `{ approved: true }` is read as `{ value: undefined }`, fails the
  // official output schema, and the model retries after we already left
  // plan mode — which surfaces as "exit_plan_mode is only available in plan mode".
  return { isError: false, value: { approved: true } };
}

export function leavePlanMode(agent: PlanAgent, planMode?: PlanModeService): void {
  if (planMode) {
    planMode.set(agent, false);
    return;
  }
  agent.session?.append?.("plan/mode", { active: false });
}

async function injectApprovalNotes(agent: PlanAgent, notes: string): Promise<void> {
  const text = `Implementation notes from the reviewer:\n\n${notes}`;
  const payload = {
    content: [{ type: "text" as const, text }],
    source: {
      kind: "plugin" as const,
      plugin: "plannotator",
      form: "notice",
      summary: "Plan approved with notes",
    },
  };

  try {
    const { createUserMessage } = await import("@deepseek-ai/dsh-llm");
    agent.inject(createUserMessage(payload));
    return;
  } catch {
    // Resolved from the dsh host when present; otherwise fall through.
  }
  try {
    agent.inject({
      id: crypto.randomUUID(),
      role: "user",
      ...payload,
    });
  } catch {
    // Notes are best-effort. Approval already left plan mode.
  }
}

export type { PlanDecision } from "./types.js";
export { DISMISS_MESSAGE, DENY_MESSAGE, denyMessage, parsePlanDecision } from "./decision.js";
export { openPlannotator } from "./launch.js";
