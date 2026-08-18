/**
 * Unit tests for CLI decision parsing.
 * @module dsh-plannotator/tests/decision
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DENY_MESSAGE,
  DISMISS_MESSAGE,
  denyMessage,
  parsePlanDecision,
  throwDecision,
} from '../lib/decision.js'

test('parsePlanDecision reads an approved decision', () => {
  assert.deepEqual(parsePlanDecision('{"decision":"approved"}\n'), { kind: 'approved' })
})

test('parsePlanDecision treats approved feedback as notes', () => {
  assert.deepEqual(parsePlanDecision('{"decision":"approved","feedback":"Watch retries"}\n'), {
    kind: 'approved',
    notes: 'Watch retries',
  })
})

test('parsePlanDecision reads a denied decision', () => {
  assert.deepEqual(parsePlanDecision('{"decision":"denied","feedback":"Split the migration"}\n'), {
    kind: 'denied',
    feedback: 'Split the migration',
  })
})

test('parsePlanDecision maps annotate-style annotated to denied', () => {
  assert.deepEqual(parsePlanDecision('{"decision":"annotated","feedback":"Need a rollback"}'), {
    kind: 'denied',
    feedback: 'Need a rollback',
  })
})

test('parsePlanDecision reads dismissed', () => {
  assert.deepEqual(parsePlanDecision('{"decision":"dismissed"}'), { kind: 'dismissed' })
})

test('parsePlanDecision uses the last JSON object on stdout', () => {
  assert.deepEqual(parsePlanDecision('starting\n{"decision":"denied"}\n{"decision":"approved"}\n'), {
    kind: 'approved',
  })
})

test('parsePlanDecision accepts approved:true without a decision field', () => {
  assert.deepEqual(parsePlanDecision('{"approved":true}'), { kind: 'approved' })
})

test('parsePlanDecision accepts the stock opencode-plan { approved, feedback } record', () => {
  assert.deepEqual(parsePlanDecision('{"approved":false,"feedback":"Split it"}'), {
    kind: 'denied',
    feedback: 'Split it',
  })
})

test('parsePlanDecision rejects unrecognized JSON', () => {
  assert.throws(() => parsePlanDecision('{"ok":true}'), /unrecognized decision/)
})

test('parsePlanDecision rejects empty stdout', () => {
  assert.throws(() => parsePlanDecision(''), /did not return a JSON decision/)
})

test('throwDecision uses the official dismiss copy', () => {
  assert.throws(() => throwDecision({ kind: 'dismissed' }), (error) => error.message === DISMISS_MESSAGE)
})

test('throwDecision uses the official deny copy without feedback', () => {
  assert.throws(() => throwDecision({ kind: 'denied' }), (error) => error.message === DENY_MESSAGE)
})

test('throwDecision includes reviewer feedback on deny', () => {
  assert.throws(
    () => throwDecision({ kind: 'denied', feedback: 'Name the risk' }),
    (error) => error.message === denyMessage('Name the risk'),
  )
})
