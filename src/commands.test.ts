import { describe, expect, it, vi } from "vitest";
import { describeAnnotateDecision, registerPlannotatorCommands, splitArgs } from "./commands.js";

describe("splitArgs", () => {
  it("splits the free-form command tail", () => {
    expect(splitArgs("  https://example.com/pull/1  ")).toEqual(["https://example.com/pull/1"]);
    expect(splitArgs("")).toEqual([]);
  });
});

describe("describeAnnotateDecision", () => {
  it("keeps approve-with-notes as guidance", () => {
    expect(describeAnnotateDecision({ kind: "approved", notes: "Keep the lock ordered" })).toEqual({
      ui: "Approved with notes.",
      inject: "# Approved with Notes\n\nKeep the lock ordered",
    });
  });

  it("sends annotation feedback to the agent", () => {
    expect(describeAnnotateDecision({ kind: "denied", feedback: "Rename the helper" })).toEqual({
      ui: "Feedback sent to the agent.",
      inject: "Rename the helper",
    });
  });
});

describe("registerPlannotatorCommands", () => {
  it("registers review, annotate, and last", () => {
    const names: string[] = [];
    registerPlannotatorCommands({
      register(definition) {
        names.push(definition.name);
      },
    });
    expect(names).toEqual([
      "plannotator-review",
      "plannotator-annotate",
      "plannotator-last",
    ]);
  });

  it("refuses annotate without a target", async () => {
    const handlers = new Map<string, (inv: { agent: { inject: () => void; session?: { events?: [] } }; rawInput: string; signal: AbortSignal }) => Promise<{ kind: string; text: string }>>();
    registerPlannotatorCommands({
      register(definition) {
        handlers.set(definition.name, definition.handler);
      },
    });
    const result = await handlers.get("plannotator-annotate")!({
      agent: { inject: vi.fn() },
      rawInput: "",
      signal: new AbortController().signal,
    });
    expect(result).toEqual({ kind: "error", text: "Name a file, folder, or URL to annotate." });
  });

  it("refuses last when the session has no assistant reply", async () => {
    const handlers = new Map<string, (inv: { agent: { inject: () => void; session?: { events?: [] } }; rawInput: string; signal: AbortSignal }) => Promise<{ kind: string; text: string }>>();
    registerPlannotatorCommands({
      register(definition) {
        handlers.set(definition.name, definition.handler);
      },
    });
    const result = await handlers.get("plannotator-last")!({
      agent: { inject: vi.fn(), session: { events: [] } },
      rawInput: "",
      signal: new AbortController().signal,
    });
    expect(result).toEqual({ kind: "error", text: "No assistant reply in this session yet." });
  });
});
