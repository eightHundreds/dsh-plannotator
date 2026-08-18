/**
 * Unit tests for slash-command helpers.
 * @module dsh-plannotator/tests/commands
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeAnnotateDecision, registerPlannotatorCommands, splitArgs } from '../lib/commands.js'

test('splitArgs splits the free-form command tail', () => {
  assert.deepEqual(splitArgs('  https://example.com/pull/1  '), ['https://example.com/pull/1'])
  assert.deepEqual(splitArgs(''), [])
})

test('describeAnnotateDecision keeps approve-with-notes as guidance', () => {
  assert.deepEqual(describeAnnotateDecision({ kind: 'approved', notes: 'Keep the lock ordered' }), {
    ui: 'Approved with notes.',
    inject: '# Approved with Notes\n\nKeep the lock ordered',
  })
})

test('describeAnnotateDecision sends annotation feedback to the agent', () => {
  assert.deepEqual(describeAnnotateDecision({ kind: 'denied', feedback: 'Rename the helper' }), {
    ui: 'Feedback sent to the agent.',
    inject: 'Rename the helper',
  })
})

test('registerPlannotatorCommands registers review, annotate, and last', () => {
  const names = []
  registerPlannotatorCommands({
    register(definition) {
      names.push(definition.name)
    },
  })
  assert.deepEqual(names, [
    'plannotator-review',
    'plannotator-annotate',
    'plannotator-last',
  ])
})

test('registerPlannotatorCommands refuses annotate without a target', async () => {
  const handlers = new Map()
  registerPlannotatorCommands({
    register(definition) {
      handlers.set(definition.name, definition.handler)
    },
  })
  const result = await handlers.get('plannotator-annotate')({
    agent: { inject() {} },
    rawInput: '',
    signal: new AbortController().signal,
  })
  assert.deepEqual(result, { kind: 'error', text: 'Name a file, folder, or URL to annotate.' })
})

test('registerPlannotatorCommands refuses last when the session has no assistant reply', async () => {
  const handlers = new Map()
  registerPlannotatorCommands({
    register(definition) {
      handlers.set(definition.name, definition.handler)
    },
  })
  const result = await handlers.get('plannotator-last')({
    agent: { inject() {}, session: { events: [] } },
    rawInput: '',
    signal: new AbortController().signal,
  })
  assert.deepEqual(result, { kind: 'error', text: 'No assistant reply in this session yet.' })
})
