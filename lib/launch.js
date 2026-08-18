/**
 * Spawn the official Plannotator CLI and wait for a decision.
 * @module dsh-plannotator/lib/launch
 */

import { spawn } from 'node:child_process'
import { parsePlanDecision } from './decision.js'
import {
  buildPlanArgs,
  buildPlanInput,
  buildPlannotatorEnv,
  resolvePlannotatorCommand,
  sessionCwd,
} from './runtime.js'

const INSTALL_HINT = 'Install it with: curl -fsSL https://plannotator.ai/install.sh | bash'

/**
 * @typedef {object} OpenPlannotatorOptions
 * @property {string} [cwd]
 * @property {NodeJS.ProcessEnv} [env]
 * @property {AbortSignal} [signal]
 */

/**
 * @param {string} plan
 * @param {OpenPlannotatorOptions} [options]
 * @returns {Promise<import('./types.js').PlanDecision>}
 */
export async function openPlannotator(plan, options = {}) {
  const cwd = options.cwd ?? process.cwd()
  const env = options.env ?? process.env
  const runtime = resolvePlannotatorCommand(env)
  const result = await runPlannotator({
    command: runtime.command,
    args: [...runtime.args, ...buildPlanArgs()],
    cwd,
    env: buildPlannotatorEnv(cwd, env),
    stdin: buildPlanInput(plan),
    signal: options.signal,
  })

  try {
    return parsePlanDecision(result.stdout)
  } catch (error) {
    const detail = result.stderr.trim() || (error instanceof Error ? error.message : String(error))
    throw new Error(`Plannotator CLI failed: ${detail}`)
  }
}

/**
 * @param {string} plan
 * @param {import('./types.js').PlanAgent | undefined} agent
 * @param {AbortSignal} [signal]
 * @returns {Promise<import('./types.js').PlanDecision>}
 */
export function openPlannotatorForAgent(plan, agent, signal) {
  return openPlannotator(plan, { cwd: sessionCwd(agent), signal })
}

/**
 * @param {object} options
 * @param {string[]} options.args
 * @param {string} [options.stdin]
 * @param {string} [options.cwd]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number | null }>}
 */
export async function invokePlannotator(options) {
  const cwd = options.cwd ?? process.cwd()
  const env = options.env ?? process.env
  const runtime = resolvePlannotatorCommand(env)
  return runPlannotator({
    command: runtime.command,
    args: [...runtime.args, ...options.args],
    cwd,
    env: buildPlannotatorEnv(cwd, env),
    stdin: options.stdin ?? '',
    signal: options.signal,
  })
}

/**
 * @typedef {object} RunOptions
 * @property {string} command
 * @property {string[]} args
 * @property {string} cwd
 * @property {Record<string, string>} env
 * @property {string} stdin
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {object} RunResult
 * @property {string} stdout
 * @property {string} stderr
 * @property {number | null} exitCode
 */

/**
 * @param {RunOptions} options
 * @returns {Promise<RunResult>}
 */
export async function runPlannotator(options) {
  options.signal?.throwIfAborted()

  const detached = options.signal !== undefined && process.platform !== 'win32'
  /** @type {import('node:child_process').ChildProcess | undefined} */
  let child
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let forceKillTimer
  /** @type {(() => void) | undefined} */
  let abortListener

  try {
    return await new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''
      /** @type {NodeJS.ErrnoException | undefined} */
      let processError
      let aborted = false

      const requestTermination = () => {
        if (!child || child.exitCode !== null || child.signalCode !== null) return
        try {
          signalChild(child, 'SIGTERM', detached)
        } catch (error) {
          processError = error instanceof Error ? error : new Error(String(error))
        }
        if (forceKillTimer !== undefined) return
        forceKillTimer = setTimeout(() => {
          if (!child || child.exitCode !== null || child.signalCode !== null) return
          try {
            signalChild(child, 'SIGKILL', detached)
          } catch {
            // close/error handlers report the original failure.
          }
        }, 1000)
      }

      try {
        child = spawn(options.command, options.args, {
          cwd: options.cwd,
          env: options.env,
          stdio: ['pipe', 'pipe', 'pipe'],
          detached,
        })
      } catch (error) {
        reject(asSpawnError(error))
        return
      }

      if (!child.stdin || !child.stdout || !child.stderr) {
        processError = new Error('Failed to open pipes for the plannotator CLI process.')
        requestTermination()
      } else {
        child.stdout.setEncoding('utf8')
        child.stderr.setEncoding('utf8')
        child.stdout.on('data', (chunk) => {
          stdout += chunk
        })
        child.stderr.on('data', (chunk) => {
          stderr += chunk
        })
        child.stdin.once('error', (error) => {
          processError ??= error
          requestTermination()
        })
        child.stdin.end(options.stdin)
      }

      child.once('error', (error) => {
        processError ??= error
        requestTermination()
      })

      child.once('close', () => {
        if (aborted && options.signal) {
          reject(abortReason(options.signal))
          return
        }
        if (processError?.code === 'ENOENT') {
          reject(new Error(
            `Could not find \`${options.command}\`. ${INSTALL_HINT}`,
          ))
          return
        }
        if (processError) {
          reject(processError)
          return
        }
        resolve({ stdout, stderr, exitCode: child?.exitCode ?? null })
      })

      if (options.signal) {
        abortListener = () => {
          aborted = true
          requestTermination()
        }
        options.signal.addEventListener('abort', abortListener, { once: true })
        if (options.signal.aborted) abortListener()
      }
    })
  } finally {
    if (forceKillTimer !== undefined) clearTimeout(forceKillTimer)
    if (options.signal && abortListener) {
      options.signal.removeEventListener('abort', abortListener)
    }
  }
}

/**
 * @param {import('node:child_process').ChildProcess} child
 * @param {NodeJS.Signals} signal
 * @param {boolean} detached
 */
function signalChild(child, signal, detached) {
  if (detached && child.pid !== undefined) {
    try {
      process.kill(-child.pid, signal)
      return
    } catch (error) {
      if (errorCode(error) !== 'ESRCH') throw error
      return
    }
  }
  child.kill(signal)
}

/**
 * @param {AbortSignal} signal
 * @returns {unknown}
 */
function abortReason(signal) {
  return signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
}

/**
 * @param {unknown} error
 * @returns {string | undefined}
 */
function errorCode(error) {
  if (!(error instanceof Error)) return undefined
  const code = Reflect.get(error, 'code')
  return typeof code === 'string' ? code : undefined
}

/**
 * @param {unknown} error
 * @returns {Error}
 */
function asSpawnError(error) {
  if (error instanceof Error && errorCode(error) === 'ENOENT') {
    return new Error(`Could not find the plannotator CLI. ${INSTALL_HINT}`)
  }
  return error instanceof Error ? error : new Error(String(error))
}
