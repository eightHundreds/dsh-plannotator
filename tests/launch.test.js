/**
 * Integration-style tests for the CLI child process.
 * @module dsh-plannotator/tests/launch
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openPlannotator, runPlannotator } from '../lib/launch.js'

function writeFixture(source, executable = false) {
  const dir = mkdtempSync(join(tmpdir(), 'plannotator-dsh-cli-'))
  const path = join(dir, executable ? 'plannotator' : 'cli.mjs')
  writeFileSync(path, source)
  if (executable) chmodSync(path, 0o755)
  return path
}

test('runPlannotator captures stdout from a child and forwards stdin', async () => {
  const cli = writeFixture(`
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => {
      process.stdout.write(JSON.stringify({ heard: data.trim() }) + "\\n");
    });
  `)

  const result = await runPlannotator({
    command: process.execPath,
    args: [cli],
    cwd: process.cwd(),
    env: { ...process.env },
    stdin: '# Plan\n',
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /"heard":"# Plan"/)
})

test('runPlannotator kills the child when the call is aborted', async () => {
  const cli = writeFixture(`
    setInterval(() => {}, 1000);
  `)
  const controller = new AbortController()
  const pending = runPlannotator({
    command: process.execPath,
    args: [cli],
    cwd: process.cwd(),
    env: { ...process.env },
    stdin: '# Plan\n',
    signal: controller.signal,
  })

  controller.abort(new Error('turn cancelled'))
  await assert.rejects(pending, /turn cancelled/)
})

test('openPlannotator parses a structured plan decision from the child', async () => {
  const cli = writeFixture(`#!/usr/bin/env node
process.stdout.write(JSON.stringify({ decision: "denied", feedback: "Split it" }) + "\\n");
`, true)

  const decision = await openPlannotator('# Title\n\nBody', {
    env: {
      ...process.env,
      PLANNOTATOR_BIN: cli,
      PLANNOTATOR_DSH_USE_SOURCE: '0',
    },
  })

  assert.deepEqual(decision, { kind: 'denied', feedback: 'Split it' })
})

test('openPlannotator sends the opencode-plan JSON envelope on stdin', async () => {
  const cli = writeFixture(`#!/usr/bin/env node
let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { data += chunk; });
process.stdin.on("end", () => {
  const parsed = JSON.parse(data);
  process.stdout.write(JSON.stringify({ approved: !parsed.plan.includes("deny"), feedback: parsed.plan }) + "\\n");
});
`, true)

  const decision = await openPlannotator('# Title\n\nPlease deny', {
    env: {
      ...process.env,
      PLANNOTATOR_BIN: cli,
      PLANNOTATOR_DSH_USE_SOURCE: '0',
    },
  })

  assert.deepEqual(decision, {
    kind: 'denied',
    feedback: '# Title\n\nPlease deny',
  })
})

test('openPlannotator surfaces a CLI failure when stdout is not a decision', async () => {
  const cli = writeFixture(`#!/usr/bin/env node
process.stderr.write("boom\\n");
process.exit(1);
`, true)

  await assert.rejects(openPlannotator('# Title\n', {
    env: {
      ...process.env,
      PLANNOTATOR_BIN: cli,
      PLANNOTATOR_DSH_USE_SOURCE: '0',
    },
  }), /Plannotator CLI failed: boom/)
})
