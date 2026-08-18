/**
 * Smoke-check the shipped runtime skill and bundle manifest.
 * @module dsh-plannotator/tests/skill
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { apply } from '../index.js'

test('ships a model-facing skill manual', () => {
  const skill = readFileSync(new URL('../skills/plannotator/SKILL.md', import.meta.url), 'utf8')
  assert.match(skill, /# plannotator/)
  assert.match(skill, /exit_plan_mode/)
  assert.match(skill, /plannotator-review/)
})

test('package.json is a no-build dsh bundle', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.main, 'index.js')
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.ok(pkg.files.includes('index.js'))
  assert.ok(pkg.files.includes('lib'))
  assert.ok(pkg.files.includes('skills'))
  assert.equal(pkg.scripts.test, 'node --test')
  assert.equal(pkg.scripts.build, undefined)
})

test('apply registers the runtime skill when skills is present', () => {
  const registered = []
  const ctx = {
    get(name) {
      if (name !== 'skills') return undefined
      return {
        register(skill) {
          registered.push(skill)
          return () => {}
        },
      }
    },
    on() {
      return () => {}
    },
  }
  apply(ctx)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].name, 'plannotator')
  assert.equal(registered[0].source, 'runtime')
  assert.equal(registered[0].provider, 'dsh-plannotator')
  assert.match(registered[0].content, /官方 Plannotator/)
})
