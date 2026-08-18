/**
 * Unit tests for live-session assistant text extraction.
 * @module dsh-plannotator/tests/session-text
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lastAssistantText } from '../lib/session-text.js'

test('lastAssistantText returns the latest assistant prose from the session log', () => {
  assert.equal(lastAssistantText([
    { type: 'user/message' },
    {
      type: 'assistant/message',
      data: { message: { content: [{ type: 'text', text: 'first' }] } },
    },
    {
      type: 'assistant/message',
      data: { message: { content: [{ type: 'text', text: 'second' }] } },
    },
    { type: 'turn/end' },
  ]), 'second')
})

test('lastAssistantText skips empty or non-text assistant events', () => {
  assert.equal(lastAssistantText([
    { type: 'assistant/message', data: { message: { content: [] } } },
  ]), null)
  assert.equal(lastAssistantText([]), null)
  assert.equal(lastAssistantText(undefined), null)
})
