/**
 * Latest rendered assistant prose from the live session log.
 * @module dsh-plannotator/lib/session-text
 */

/**
 * @typedef {object} SessionTextEvent
 * @property {string} [type]
 * @property {{ message?: { content?: unknown } }} [data]
 */

/**
 * Walks `agent.session.events` only — no on-disk transcript parse.
 * @param {readonly SessionTextEvent[] | undefined} events
 * @returns {string | null}
 */
export function lastAssistantText(events) {
  if (!events) return null

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'assistant/message') continue
    const text = textFromContent(event.data?.message?.content)
    if (text) return text
  }

  return null
}

/**
 * @param {unknown} content
 * @returns {string | null}
 */
export function textFromContent(content) {
  if (!Array.isArray(content)) return null

  const parts = content.flatMap((block) => {
    if (!block || typeof block !== 'object') return []
    const record = /** @type {{ type?: unknown, text?: unknown }} */ (block)
    if (record.type !== 'text' || typeof record.text !== 'string') return []
    const text = record.text.trim()
    return text ? [text] : []
  })

  return parts.length > 0 ? parts.join('\n\n') : null
}
