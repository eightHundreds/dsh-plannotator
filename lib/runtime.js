/**
 * Resolve the official Plannotator CLI (or a local checkout) and its env.
 * @module dsh-plannotator/lib/runtime
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ORIGIN = 'dsh'

/**
 * @typedef {object} PlannotatorCommand
 * @property {string} command
 * @property {string[]} args
 * @property {'cli' | 'source'} source
 */

/**
 * @param {{ session?: { header?: { cwd?: string } } } | undefined} agent
 * @returns {string}
 */
export function sessionCwd(agent) {
  const cwd = agent?.session?.header?.cwd
  return typeof cwd === 'string' && cwd.trim() ? cwd : process.cwd()
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [pluginDir]
 * @returns {PlannotatorCommand}
 */
export function resolvePlannotatorCommand(env = process.env, pluginDir = currentPluginDir()) {
  const sourceEntry = resolveSourceEntry(env, pluginDir)
  if (sourceEntry) {
    return {
      command: resolveBunExecutable(env),
      args: [sourceEntry],
      source: 'source',
    }
  }

  const bin = resolvePlannotatorBin(env)
  return { command: bin, args: [], source: 'cli' }
}

/**
 * Stock Plannotator CLI (0.19+) already has this internal plan-review
 * bridge. It reads `{ plan }` on stdin and prints `{ approved, feedback? }`.
 * We do not invent Claude hook JSON, and we do not require a fork of
 * Plannotator.
 * @returns {string[]}
 */
export function buildPlanArgs() {
  return ['opencode-plan']
}

/**
 * @param {string} plan
 * @returns {string}
 */
export function buildPlanInput(plan) {
  return JSON.stringify({ plan })
}

/**
 * @param {string} cwd
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Record<string, string>}
 */
export function buildPlannotatorEnv(cwd, env = process.env) {
  /** @type {Record<string, string>} */
  const next = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') next[key] = value
  }
  next.PLANNOTATOR_ORIGIN = ORIGIN
  next.PLANNOTATOR_CWD = cwd
  return next
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [pluginDir]
 * @returns {string | null}
 */
export function resolveSourceEntry(env = process.env, pluginDir = currentPluginDir()) {
  const explicit = env.PLANNOTATOR_DSH_SOURCE_ENTRY?.trim()
  if (explicit) {
    const resolved = resolve(explicit)
    return existsSync(resolved) ? resolved : null
  }

  if (env.PLANNOTATOR_DSH_USE_SOURCE !== '1') return null

  const roots = [
    env.PLANNOTATOR_DSH_SOURCE_ROOT?.trim(),
    process.cwd(),
    pluginDir,
  ].filter((value) => Boolean(value))

  for (const start of roots) {
    const entry = findSourceEntry(start)
    if (entry) return entry
  }

  return null
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {string}
 */
function resolvePlannotatorBin(env) {
  const explicit = env.PLANNOTATOR_BIN?.trim()
  if (explicit) return explicit

  const home = env.HOME?.trim() || env.USERPROFILE?.trim() || homedir()
  if (process.platform === 'win32') {
    const localAppData = env.LOCALAPPDATA?.trim()
    if (localAppData) {
      const candidate = join(localAppData, 'plannotator', 'plannotator.exe')
      if (existsSync(candidate)) return candidate
    }
    const userBin = join(home, '.local', 'bin', 'plannotator.exe')
    if (existsSync(userBin)) return userBin
    return 'plannotator'
  }

  const userBin = join(home, '.local', 'bin', 'plannotator')
  if (existsSync(userBin)) return userBin
  return 'plannotator'
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {string}
 */
function resolveBunExecutable(env) {
  const explicit = env.PLANNOTATOR_BUN?.trim() || env.BUN?.trim()
  if (explicit) return explicit
  return 'bun'
}

/**
 * @param {string} startDir
 * @returns {string | null}
 */
function findSourceEntry(startDir) {
  const root = findRepoRoot(startDir)
  if (!root) return null
  const sourceEntry = join(root, 'apps', 'hook', 'server', 'index.ts')
  return existsSync(sourceEntry) ? sourceEntry : null
}

/**
 * @param {string} startDir
 * @returns {string | null}
 */
function findRepoRoot(startDir) {
  let dir = resolve(startDir)
  while (true) {
    const packageJsonPath = join(dir, 'package.json')
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
        if (pkg.name === 'plannotator') return dir
      } catch {
        // Ignore malformed package.json while walking upward.
      }
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * @returns {string}
 */
function currentPluginDir() {
  const here = dirname(fileURLToPath(import.meta.url))
  return isAbsolute(here) ? here : resolve(here)
}
