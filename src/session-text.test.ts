import { describe, expect, it } from "vitest";
import { lastAssistantText } from "./session-text.js";

describe("lastAssistantText", () => {
  it("returns the latest assistant prose from the session log", () => {
    expect(lastAssistantText([
      { type: "user/message" },
      {
        type: "assistant/message",
        data: { message: { content: [{ type: "text", text: "first" }] } },
      },
      {
        type: "assistant/message",
        data: { message: { content: [{ type: "text", text: "second" }] } },
      },
      { type: "turn/end" },
    ])).toBe("second");
  });

  it("skips empty or non-text assistant events", () => {
    expect(lastAssistantText([
      { type: "assistant/message", data: { message: { content: [] } } },
    ])).toBeNull();
    expect(lastAssistantText([])).toBeNull();
    expect(lastAssistantText(undefined)).toBeNull();
  });
});
