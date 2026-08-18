/**
 * Slash-command handlers that open the official Plannotator CLI.
 * @module dsh-plannotator/lib/commands
 */

import { randomUUID } from 'node:crypto'
import { parsePlanDecision } from './decision.js'
import { invokePlannotator } from './launch.js'
import { sessionCwd } from './runtime.js'
import { lastAssistantText } from './session-text.js'

/**
 * @typedef {object} CommandResult
 * @property {'success' | 'error'} kind
 * @property {string} text
 */

/**
 * @typedef {object} CommandInvocation
 * @property {import('./types.js').PlanAgent} agent
 * @property {string} rawInput
 * @property {AbortSignal} signal
 */

/**
 * @typedef {object} CommandRegistry
 * @property {(definition: { name: string, description: string, input?: { hint: string }, handler: (invocation: CommandInvocation) => CommandResult | Promise<CommandResult> }) => unknown} register
 */

/**
 * @param {CommandRegistry} commands
 * @returns {Array<() => void>}
 */
export function registerPlannotatorCommands(commands) {
  const disposers = []
  track(disposers, commands.register({
    name: 'plannotator-review',
    description: 'Open Plannotator on the current changes or a pull request',
    input: { hint: '[PR_URL]' },
    handler: (invocation) => runReview(invocation),
  }))
  track(disposers, commands.register({
    name: 'plannotator-annotate',
    description: 'Open Plannotator on a file, folder, or URL',
    input: { hint: '<file-or-url>' },
    handler: (invocation) => runAnnotate(invocation),
  }))
  track(disposers, commands.register({
    name: 'plannotator-last',
    description: 'Open Plannotator on the latest assistant reply',
    handler: (invocation) => runLast(invocation),
  }))
  return disposers
}

/**
 * @param {CommandInvocation} invocation
 * @returns {Promise<CommandResult>}
 */
export async function runReview(invocation) {
  const extra = splitArgs(invocation.rawInput)
  return runCli(invocation, ['review', ...extra], { injectPlaintext: true })
}

/**
 * @param {CommandInvocation} invocation
 * @returns {Promise<CommandResult>}
 */
export async function runAnnotate(invocation) {
  const extra = splitArgs(invocation.rawInput)
  if (extra.length === 0) {
    return { kind: 'error', text: 'Name a file, folder, or URL to annotate.' }
  }
  return runCli(invocation, ['annotate', ...extra, '--json'])
}

/**
 * @param {CommandInvocation} invocation
 * @returns {Promise<CommandResult>}
 */
export async function runLast(invocation) {
  const text = lastAssistantText(invocation.agent.session?.events)
  if (!text) {
    return { kind: 'error', text: 'No assistant reply in this session yet.' }
  }
  return runCli(invocation, ['annotate-last', '--stdin', '--json'], { stdin: text })
}

/**
 * @param {CommandInvocation} invocation
 * @param {string[]} args
 * @param {{ stdin?: string, injectPlaintext?: boolean }} [options]
 * @returns {Promise<CommandResult>}
 */
async function runCli(invocation, args, options = {}) {
  /** @type {{ stdout: string, stderr: string, exitCode: number | null }} */
  let result
  try {
    result = await invokePlannotator({
      args,
      stdin: options.stdin,
      cwd: sessionCwd(invocation.agent),
      signal: invocation.signal,
    })
  } catch (error) {
    return {
      kind: 'error',
      text: error instanceof Error ? error.message : String(error),
    }
  }

  const stdout = result.stdout.trim()
  if (options.injectPlaintext) {
    if (result.exitCode !== 0 && result.exitCode !== null) {
      return {
        kind: 'error',
        text: result.stderr.trim() || stdout || 'Plannotator review failed.',
      }
    }
    if (!stdout) return { kind: 'success', text: 'Review closed.' }
    injectAgentText(invocation.agent, stdout)
    return { kind: 'success', text: 'Feedback sent to the agent.' }
  }

  /** @type {import('./types.js').PlanDecision} */
  let decision
  try {
    decision = parsePlanDecision(stdout)
  } catch {
    if (result.exitCode !== 0 && result.exitCode !== null) {
      return {
        kind: 'error',
        text: result.stderr.trim() || stdout || 'Plannotator failed.',
      }
    }
    return { kind: 'success', text: stdout || 'Closed.' }
  }

  const described = describeAnnotateDecision(decision)
  if (described.inject) injectAgentText(invocation.agent, described.inject)
  return { kind: 'success', text: described.ui }
}

/**
 * @param {import('./types.js').PlanDecision} decision
 * @returns {{ ui: string, inject?: string }}
 */
export function describeAnnotateDecision(decision) {
  if (decision.kind === 'approved') {
    if (decision.notes) {
      return {
        ui: 'Approved with notes.',
        inject: `# Approved with Notes\n\n${decision.notes}`,
      }
    }
    return { ui: 'Approved.' }
  }
  if (decision.kind === 'dismissed') return { ui: 'Closed without feedback.' }
  if (decision.feedback) {
    return { ui: 'Feedback sent to the agent.', inject: decision.feedback }
  }
  return { ui: 'Closed without feedback.' }
}

/**
 * @param {string} rawInput
 * @returns {string[]}
 */
export function splitArgs(rawInput) {
  return rawInput.trim().split(/\s+/).filter(Boolean)
}

/**
 * @param {Array<() => void>} disposers
 * @param {unknown} result
 */
function track(disposers, result) {
  if (typeof result === 'function') disposers.push(result)
}

/**
 * @param {import('./types.js').PlanAgent} agent
 * @param {string} text
 */
function injectAgentText(agent, text) {
  try {
    agent.inject({
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text }],
      source: { kind: 'plugin', plugin: 'plannotator', form: 'notice', summary: 'Plannotator feedback' },
    })
  } catch {
    // Command UI text still reports the outcome.
  }
}
