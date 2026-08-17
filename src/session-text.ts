export interface SessionTextEvent {
  type?: string;
  data?: {
    message?: {
      content?: unknown;
    };
  };
}

/**
 * Latest rendered assistant prose from the live session log.
 * Walks `agent.session.events` only — no on-disk transcript parse.
 */
export function lastAssistantText(events: readonly SessionTextEvent[] | undefined): string | null {
  if (!events) return null;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type !== "assistant/message") continue;
    const text = textFromContent(event.data?.message?.content);
    if (text) return text;
  }

  return null;
}

export function textFromContent(content: unknown): string | null {
  if (!Array.isArray(content)) return null;

  const parts = content.flatMap((block) => {
    if (!block || typeof block !== "object") return [];
    const record = block as { type?: unknown; text?: unknown };
    if (record.type !== "text" || typeof record.text !== "string") return [];
    const text = record.text.trim();
    return text ? [text] : [];
  });

  return parts.length > 0 ? parts.join("\n\n") : null;
}
