/**
 * dsh-plannotator host plugin.
 *
 * Intercepts official plan-mode exit so the stock Plannotator app reviews
 * the plan, and registers slash commands plus a runtime skill that teach
 * the agent when to use them.
 *
 * @module dsh-plannotator
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { registerPlannotatorCommands } from './lib/commands.js'
import { openPlannotatorForAgent } from './lib/launch.js'
import {
  readPlanArgument,
  resolvePlanMode,
  settlePlanDecision,
  shouldInterceptExitPlanMode,
} from './lib/plan.js'

export const name = 'plannotator'

/**
 * Host-plane `tools` only. On `dsh web`, `planMode` lives in the per-preset
 * `planning` isolate, so a hard `inject: ['planMode']` waits forever and the
 * profile never boots. Read it with `ctx.get('planMode')` (no inject needed).
 */
export const inject = ['tools']

const SKILL_FILE = fileURLToPath(new URL('./skills/plannotator/SKILL.md', import.meta.url))
const SKILL_NAME = 'plannotator'
const SKILL_DESCRIPTION =
  'Open the official Plannotator app to review a plan, annotate a file, or send reviewer feedback back to the agent.'

/**
 * Register the runtime skill, slash commands, and the plan-review intercept.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {object} [_config]
 * @returns {() => void}
 */
export function apply(ctx, _config) {
  const disposers = []

  const skills = ctx.get('skills')
  if (skills && typeof skills.register === 'function') {
    try {
      disposers.push(skills.register({
        name: SKILL_NAME,
        description: SKILL_DESCRIPTION,
        content: readFileSync(SKILL_FILE, 'utf8'),
        source: 'runtime',
        provider: 'dsh-plannotator',
      }))
    } catch (error) {
      ctx.logger?.warn?.('dsh-plannotator: failed to register skill: ' + String(error))
    }
  }

  // Optional: wait if the host exposes inject, otherwise register immediately.
  const registerCommands = (commandCtx) => {
    const commands = commandCtx?.commands ?? commandCtx
    if (commands && typeof commands.register === 'function') {
      for (const dispose of registerPlannotatorCommands(commands)) {
        disposers.push(dispose)
      }
    }
  }
  if (typeof ctx.inject === 'function') {
    const injectDispose = ctx.inject(['commands'], registerCommands)
    if (typeof injectDispose === 'function') disposers.push(injectDispose)
  } else {
    registerCommands(ctx.get?.('commands'))
  }

  disposers.push(ctx.on('tools/execute', async (exec, next) => {
    const planMode = resolvePlanMode(ctx, exec.agent)
    if (!shouldInterceptExitPlanMode(exec, planMode)) return next()

    const plan = readPlanArgument(exec.arguments)
    const agent = exec.agent
    if (!agent) return next()

    const decision = await openPlannotatorForAgent(plan, agent, exec.signal)
    return settlePlanDecision(planMode, agent, decision)
  }))

  return () => {
    for (const dispose of disposers) {
      try {
        if (typeof dispose === 'function') dispose()
      } catch {
        // disposal failures must not break unload
      }
    }
  }
}

export { EXIT_PLAN_MODE, isPlanModeActive, leavePlanMode, readPlanArgument, resolvePlanMode, settlePlanDecision, shouldInterceptExitPlanMode } from './lib/plan.js'
export { DISMISS_MESSAGE, DENY_MESSAGE, denyMessage, parsePlanDecision } from './lib/decision.js'
export { openPlannotator } from './lib/launch.js'
