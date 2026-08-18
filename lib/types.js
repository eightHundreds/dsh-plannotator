/**
 * Shared typedefs for the host plugin. No runtime exports.
 * @module dsh-plannotator/lib/types
 */

/**
 * @typedef {object} PlanModeState
 * @property {boolean} active
 * @property {boolean} [pending]
 */

/**
 * @typedef {object} PlanModeService
 * @property {(agent: PlanAgent) => PlanModeState} get
 * @property {(agent: PlanAgent, active: boolean) => 'committed' | 'queued' | 'cancelled' | 'noop'} set
 */

/**
 * @typedef {object} PlanSessionEvent
 * @property {string} type
 * @property {{ active?: boolean, message?: { content?: unknown } }} [data]
 */

/**
 * @typedef {object} PlanAgent
 * @property {(message: unknown) => void} inject
 * @property {{ planMode?: PlanModeService, get?: (name: string) => unknown }} [ctx]
 * @property {{ header?: { cwd?: string }, events?: readonly PlanSessionEvent[], append?: (type: 'plan/mode', data: { active: boolean }) => void }} [session]
 */

/**
 * @typedef {object} ToolDispatchExecution
 * @property {string} name
 * @property {unknown} arguments
 * @property {PlanAgent} [agent]
 * @property {AbortSignal} signal
 */

/**
 * @typedef {{ kind: 'approved', notes?: string } | { kind: 'denied', feedback?: string } | { kind: 'dismissed' }} PlanDecision
 */

export {}
