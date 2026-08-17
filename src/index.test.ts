import { describe, expect, it, vi } from "vitest";
import {
  apply,
  EXIT_PLAN_MODE,
  isPlanModeActive,
  leavePlanMode,
  readPlanArgument,
  resolvePlanMode,
  settlePlanDecision,
  shouldInterceptExitPlanMode,
} from "./index.js";
import { DENY_MESSAGE, DISMISS_MESSAGE } from "./decision.js";
import type { PlanAgent, PlanModeService } from "./types.js";

function planMode(active: boolean): PlanModeService {
  return {
    get: () => ({ active }),
    set: vi.fn(() => "queued"),
  };
}

const validPlan = "# Ship retries\n\nUse a bounded queue.";

describe("shouldInterceptExitPlanMode", () => {
  it("ignores every other tool", () => {
    expect(shouldInterceptExitPlanMode({
      name: "ask_user_question",
      arguments: { plan: validPlan },
      agent: { inject() {} },
    }, planMode(true))).toBe(false);
  });

  it("intercepts from session events when planMode is not on this context", () => {
    const agent = {
      inject() {},
      session: { events: [{ type: "plan/mode", data: { active: true } }] },
    };
    expect(shouldInterceptExitPlanMode({
      name: EXIT_PLAN_MODE,
      arguments: { plan: validPlan },
      agent,
    })).toBe(true);
    expect(isPlanModeActive(agent)).toBe(true);
  });

  it("leaves official validation to exit_plan_mode when inactive or malformed", () => {
    const agent = { inject() {} };
    expect(shouldInterceptExitPlanMode({
      name: EXIT_PLAN_MODE,
      arguments: { plan: validPlan },
      agent,
    }, planMode(false))).toBe(false);

    expect(shouldInterceptExitPlanMode({
      name: EXIT_PLAN_MODE,
      arguments: { plan: validPlan },
    }, planMode(true))).toBe(false);

    expect(shouldInterceptExitPlanMode({
      name: EXIT_PLAN_MODE,
      arguments: { plan: "no heading" },
      agent,
    }, planMode(true))).toBe(false);
  });

  it("intercepts an in-mode plan that starts with a heading", () => {
    expect(shouldInterceptExitPlanMode({
      name: EXIT_PLAN_MODE,
      arguments: { plan: validPlan },
      agent: { inject() {} },
    }, planMode(true))).toBe(true);
  });
});

describe("apply", () => {
  it("delegates non-exit tools to next()", async () => {
    let handler:
      | ((exec: { name: string; arguments: unknown; agent?: { inject(): void }; signal: AbortSignal }, next: () => Promise<unknown>) => Promise<unknown>)
      | undefined;
    const ctx = {
      get: () => undefined,
      on(_name: string, listener: typeof handler) {
        handler = listener;
        return () => {};
      },
    };

    apply(ctx as never);
    const next = vi.fn(async () => ({ delegated: true }));
    await expect(handler?.(
      { name: "bash", arguments: {}, agent: { inject() {} }, signal: new AbortController().signal },
      next,
    )).resolves.toEqual({ delegated: true });
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("readPlanArgument", () => {
  it("reads a string plan and ignores anything else", () => {
    expect(readPlanArgument({ plan: validPlan })).toBe(validPlan);
    expect(readPlanArgument({ plan: 12 })).toBe("");
    expect(readPlanArgument(null)).toBe("");
  });
});

describe("settlePlanDecision", () => {
  it("leaves plan mode and returns the official success value", async () => {
    const set = vi.fn(() => "queued" as const);
    const agent: PlanAgent = { inject: vi.fn() };
    await expect(settlePlanDecision({ get: () => ({ active: true }), set }, agent, {
      kind: "approved",
    })).resolves.toEqual({ isError: false, value: { approved: true } });
    expect(set).toHaveBeenCalledWith(agent, false);
    expect(agent.inject).not.toHaveBeenCalled();
  });

  it("injects approve-with-notes after leaving plan mode", async () => {
    const set = vi.fn(() => "queued" as const);
    const agent: PlanAgent = { inject: vi.fn() };
    await settlePlanDecision({ get: () => ({ active: true }), set }, agent, {
      kind: "approved",
      notes: "Keep the lock ordered",
    });
    expect(set).toHaveBeenCalledWith(agent, false);
    expect(agent.inject).toHaveBeenCalledTimes(1);
    const injected = vi.mocked(agent.inject).mock.calls[0]?.[0] as {
      content?: Array<{ text?: string }>;
    };
    expect(injected.content?.[0]?.text).toContain("Keep the lock ordered");
  });

  it("throws official copy on deny and dismiss and does not leave plan mode", async () => {
    const set = vi.fn(() => "queued" as const);
    const agent: PlanAgent = { inject: vi.fn() };
    const service = { get: () => ({ active: true }), set };

    await expect(settlePlanDecision(service, agent, { kind: "denied" })).rejects.toThrow(DENY_MESSAGE);
    await expect(settlePlanDecision(service, agent, { kind: "dismissed" })).rejects.toThrow(DISMISS_MESSAGE);
    expect(set).not.toHaveBeenCalled();
  });

  it("appends plan/mode when the isolated service is not visible", async () => {
    const append = vi.fn();
    const agent: PlanAgent = {
      inject: vi.fn(),
      session: { append },
    };
    await settlePlanDecision(undefined, agent, { kind: "approved" });
    expect(append).toHaveBeenCalledWith("plan/mode", { active: false });
  });
});

describe("resolvePlanMode", () => {
  it("prefers the agent context, then ctx.get", () => {
    const isolated = planMode(true);
    const host = planMode(false);
    expect(resolvePlanMode(
      { get: () => host } as never,
      { inject() {}, ctx: { get: () => isolated } },
    )).toBe(isolated);
    expect(resolvePlanMode({ get: (name: string) => name === "planMode" ? host : undefined } as never)).toBe(host);
    expect(resolvePlanMode({ get: () => undefined } as never)).toBeUndefined();
  });
});

describe("leavePlanMode", () => {
  it("prefers the public planMode.set API", () => {
    const set = vi.fn(() => "queued" as const);
    const agent: PlanAgent = { inject() {} };
    leavePlanMode(agent, { get: () => ({ active: true }), set });
    expect(set).toHaveBeenCalledWith(agent, false);
  });
});
