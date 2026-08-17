import { describe, expect, it } from "vitest";
import {
  DENY_MESSAGE,
  DISMISS_MESSAGE,
  denyMessage,
  parsePlanDecision,
  throwDecision,
} from "./decision.js";

describe("parsePlanDecision", () => {
  it("reads an approved decision", () => {
    expect(parsePlanDecision('{"decision":"approved"}\n')).toEqual({ kind: "approved" });
  });

  it("treats approved feedback as notes", () => {
    expect(parsePlanDecision('{"decision":"approved","feedback":"Watch retries"}\n')).toEqual({
      kind: "approved",
      notes: "Watch retries",
    });
  });

  it("reads a denied decision", () => {
    expect(parsePlanDecision('{"decision":"denied","feedback":"Split the migration"}\n')).toEqual({
      kind: "denied",
      feedback: "Split the migration",
    });
  });

  it("maps annotate-style annotated to denied", () => {
    expect(parsePlanDecision('{"decision":"annotated","feedback":"Need a rollback"}')).toEqual({
      kind: "denied",
      feedback: "Need a rollback",
    });
  });

  it("reads dismissed", () => {
    expect(parsePlanDecision('{"decision":"dismissed"}')).toEqual({ kind: "dismissed" });
  });

  it("uses the last JSON object on stdout", () => {
    expect(parsePlanDecision("starting\n{\"decision\":\"denied\"}\n{\"decision\":\"approved\"}\n")).toEqual({
      kind: "approved",
    });
  });

  it("accepts approved:true without a decision field", () => {
    expect(parsePlanDecision('{"approved":true}')).toEqual({ kind: "approved" });
  });

  it("accepts the stock opencode-plan { approved, feedback } record", () => {
    expect(parsePlanDecision('{"approved":false,"feedback":"Split it"}')).toEqual({
      kind: "denied",
      feedback: "Split it",
    });
  });

  it("rejects unrecognized JSON", () => {
    expect(() => parsePlanDecision('{"ok":true}')).toThrow(/unrecognized decision/);
  });

  it("rejects empty stdout", () => {
    expect(() => parsePlanDecision("")).toThrow(/did not return a JSON decision/);
  });
});

describe("throwDecision", () => {
  it("uses the official dismiss copy", () => {
    expect(() => throwDecision({ kind: "dismissed" })).toThrow(DISMISS_MESSAGE);
  });

  it("uses the official deny copy without feedback", () => {
    expect(() => throwDecision({ kind: "denied" })).toThrow(DENY_MESSAGE);
  });

  it("includes reviewer feedback on deny", () => {
    expect(() => throwDecision({ kind: "denied", feedback: "Name the risk" })).toThrow(
      denyMessage("Name the risk"),
    );
  });
});
