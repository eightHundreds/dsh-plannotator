export interface PlanModeState {
  active: boolean;
  pending?: boolean;
}

export interface PlanModeService {
  get(agent: PlanAgent): PlanModeState;
  set(agent: PlanAgent, active: boolean): "committed" | "queued" | "cancelled" | "noop";
}

export interface PlanSessionEvent {
  type: string;
  data?: {
    active?: boolean;
  };
}

export interface PlanAgent {
  inject(message: unknown): void;
  ctx?: {
    planMode?: PlanModeService;
    get?(name: string): unknown;
  };
  session?: {
    header?: {
      cwd?: string;
    };
    events?: readonly PlanSessionEvent[];
    append?(type: "plan/mode", data: { active: boolean }): void;
  };
}

export interface ToolDispatchExecution {
  name: string;
  arguments: unknown;
  agent?: PlanAgent;
  signal: AbortSignal;
}

export type PlanDecision =
  | { kind: "approved"; notes?: string }
  | { kind: "denied"; feedback?: string }
  | { kind: "dismissed" };
