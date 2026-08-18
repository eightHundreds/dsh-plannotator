/**
 * Plan-review decision messages and CLI stdout parsing.
 * @module dsh-plannotator/lib/decision
 */

export const DISMISS_MESSAGE =
  'The user dismissed the plan review to speak instead; stay in plan mode, stop here, and wait for their message.'

export const DENY_MESSAGE =
  'The user chose to keep planning; revise the plan and present it again.'

/**
 * @param {string} [feedback]
 * @returns {string}
 */
export function denyMessage(feedback) {
  const trimmed = feedback?.trim()
  return trimmed
    ? `The user chose to keep planning; their feedback: ${trimmed}`
    : DENY_MESSAGE
}

/**
 * @param {Exclude<import('./types.js').PlanDecision, { kind: 'approved' }>} decision
 * @returns {never}
 */
export function throwDecision(decision) {
  if (decision.kind === 'dismissed') {
    throw new Error(DISMISS_MESSAGE)
  }
  throw new Error(denyMessage(decision.feedback))
}

/**
 * Read the last JSON object from CLI stdout. Wrapper noise may precede it.
 * @param {string} stdout
 * @returns {import('./types.js').PlanDecision}
 */
export function parsePlanDecision(stdout) {
  const parsed = parseLastJson(stdout)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Plannotator CLI did not return a JSON decision.')
  }

  const record = /** @type {Record<string, unknown>} */ (parsed)
  const decision = record.decision
  const feedback = readOptionalString(record.feedback)

  if (decision === 'approved' || record.approved === true) {
    return feedback ? { kind: 'approved', notes: feedback } : { kind: 'approved' }
  }
  if (decision === 'dismissed' || record.exit === true) {
    return { kind: 'dismissed' }
  }
  if (decision === 'denied' || decision === 'annotated' || record.approved === false) {
    return { kind: 'denied', feedback }
  }

  throw new Error('Plannotator CLI returned an unrecognized decision.')
}

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function readOptionalString(value) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

/**
 * @param {string} stdout
 * @returns {unknown}
 */
function parseLastJson(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]
    if (!line?.startsWith('{')) continue
    try {
      return JSON.parse(line)
    } catch {
      // Keep scanning earlier JSON lines.
    }
  }

  const trimmed = stdout.trim()
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed)
  }

  return undefined
}
