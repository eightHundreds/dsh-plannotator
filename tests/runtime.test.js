/**
 * Unit tests for CLI resolution and env shaping.
 * @module dsh-plannotator/tests/runtime
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildPlanArgs,
  buildPlanInput,
  buildPlannotatorEnv,
  resolvePlannotatorCommand,
  resolveSourceEntry,
  sessionCwd,
} from '../lib/runtime.js'

test('sessionCwd prefers the session header cwd', () => {
  assert.equal(sessionCwd({ session: { header: { cwd: '/tmp/project' } } }), '/tmp/project')
})

test('sessionCwd falls back to process.cwd', () => {
  assert.equal(sessionCwd(undefined), process.cwd())
  assert.equal(sessionCwd({ session: { header: {} } }), process.cwd())
})

test('buildPlanArgs uses the stock opencode-plan bridge, not Claude hook JSON', () => {
  assert.deepEqual(buildPlanArgs(), ['opencode-plan'])
})

test('buildPlanInput wraps the markdown plan in the existing CLI JSON envelope', () => {
  assert.deepEqual(JSON.parse(buildPlanInput('# Title\n\nBody')), {
    plan: '# Title\n\nBody',
  })
})

test('buildPlannotatorEnv pins origin and cwd', () => {
  const env = buildPlannotatorEnv('/tmp/ws', { PATH: '/bin', PLANNOTATOR_ORIGIN: 'claude-code' })
  assert.equal(env.PLANNOTATOR_ORIGIN, 'dsh')
  assert.equal(env.PLANNOTATOR_CWD, '/tmp/ws')
  assert.equal(env.PATH, '/bin')
})

test('resolveSourceEntry returns null unless source mode is requested', () => {
  assert.equal(resolveSourceEntry({ PLANNOTATOR_DSH_USE_SOURCE: '0' }), null)
})

test('resolveSourceEntry honors an explicit source entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'plannotator-dsh-entry-'))
  const entry = join(dir, 'index.ts')
  writeFileSync(entry, '')
  assert.equal(resolveSourceEntry({ PLANNOTATOR_DSH_SOURCE_ENTRY: entry }), entry)
})

test('resolveSourceEntry walks up from SOURCE_ROOT to the plannotator checkout', () => {
  const root = mkdtempSync(join(tmpdir(), 'plannotator-dsh-root-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'plannotator' }))
  const hookDir = join(root, 'apps', 'hook', 'server')
  mkdirSync(hookDir, { recursive: true })
  const entry = join(hookDir, 'index.ts')
  writeFileSync(entry, '')

  assert.equal(resolveSourceEntry({
    PLANNOTATOR_DSH_USE_SOURCE: '1',
    PLANNOTATOR_DSH_SOURCE_ROOT: join(root, 'apps', 'hook'),
  }), entry)
})

test('resolvePlannotatorCommand uses PLANNOTATOR_BIN when not in source mode', () => {
  const resolved = resolvePlannotatorCommand({ PLANNOTATOR_BIN: '/opt/plannotator' })
  assert.deepEqual(resolved, { command: '/opt/plannotator', args: [], source: 'cli' })
})

test('resolvePlannotatorCommand runs the checkout through bun in source mode', () => {
  const dir = mkdtempSync(join(tmpdir(), 'plannotator-dsh-bun-'))
  const entry = join(dir, 'index.ts')
  writeFileSync(entry, '')
  const resolved = resolvePlannotatorCommand({
    PLANNOTATOR_DSH_SOURCE_ENTRY: entry,
    PLANNOTATOR_BUN: '/usr/local/bin/bun',
  })
  assert.deepEqual(resolved, {
    command: '/usr/local/bin/bun',
    args: [entry],
    source: 'source',
  })
})
