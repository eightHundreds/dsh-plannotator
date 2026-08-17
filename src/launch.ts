import { spawn, type ChildProcess } from "node:child_process";
import { parsePlanDecision } from "./decision.js";
import {
  buildPlanArgs,
  buildPlanInput,
  buildPlannotatorEnv,
  resolvePlannotatorCommand,
  sessionCwd,
} from "./runtime.js";
import type { PlanAgent, PlanDecision } from "./types.js";

const INSTALL_HINT = "Install it with: curl -fsSL https://plannotator.ai/install.sh | bash";

export interface OpenPlannotatorOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

export async function openPlannotator(
  plan: string,
  options: OpenPlannotatorOptions = {},
): Promise<PlanDecision> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const runtime = resolvePlannotatorCommand(env);
  const result = await runPlannotator({
    command: runtime.command,
    args: [...runtime.args, ...buildPlanArgs()],
    cwd,
    env: buildPlannotatorEnv(cwd, env),
    stdin: buildPlanInput(plan),
    signal: options.signal,
  });

  try {
    return parsePlanDecision(result.stdout);
  } catch (error) {
    const detail = result.stderr.trim() || (error instanceof Error ? error.message : String(error));
    throw new Error(`Plannotator CLI failed: ${detail}`);
  }
}

export function openPlannotatorForAgent(
  plan: string,
  agent: PlanAgent | undefined,
  signal?: AbortSignal,
): Promise<PlanDecision> {
  return openPlannotator(plan, { cwd: sessionCwd(agent), signal });
}

export async function invokePlannotator(options: {
  args: string[];
  stdin?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const runtime = resolvePlannotatorCommand(env);
  return runPlannotator({
    command: runtime.command,
    args: [...runtime.args, ...options.args],
    cwd,
    env: buildPlannotatorEnv(cwd, env),
    stdin: options.stdin ?? "",
    signal: options.signal,
  });
}

interface RunOptions {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  stdin: string;
  signal?: AbortSignal;
}

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export async function runPlannotator(options: RunOptions): Promise<RunResult> {
  options.signal?.throwIfAborted();

  const detached = options.signal !== undefined && process.platform !== "win32";
  let child: ChildProcess | undefined;
  let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;

  try {
    return await new Promise<RunResult>((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let processError: NodeJS.ErrnoException | undefined;
      let aborted = false;

      const requestTermination = () => {
        if (!child || child.exitCode !== null || child.signalCode !== null) return;
        try {
          signalChild(child, "SIGTERM", detached);
        } catch (error) {
          processError = error instanceof Error ? error : new Error(String(error));
        }
        if (forceKillTimer !== undefined) return;
        forceKillTimer = setTimeout(() => {
          if (!child || child.exitCode !== null || child.signalCode !== null) return;
          try {
            signalChild(child, "SIGKILL", detached);
          } catch {
            // close/error handlers report the original failure.
          }
        }, 1000);
      };

      try {
        child = spawn(options.command, options.args, {
          cwd: options.cwd,
          env: options.env,
          stdio: ["pipe", "pipe", "pipe"],
          detached,
        });
      } catch (error) {
        reject(asSpawnError(error));
        return;
      }

      if (!child.stdin || !child.stdout || !child.stderr) {
        processError = new Error("Failed to open pipes for the plannotator CLI process.");
        requestTermination();
      } else {
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          stdout += chunk;
        });
        child.stderr.on("data", (chunk: string) => {
          stderr += chunk;
        });
        child.stdin.once("error", (error: NodeJS.ErrnoException) => {
          processError ??= error;
          requestTermination();
        });
        child.stdin.end(options.stdin);
      }

      child.once("error", (error: NodeJS.ErrnoException) => {
        processError ??= error;
        requestTermination();
      });

      child.once("close", () => {
        if (aborted && options.signal) {
          reject(abortReason(options.signal));
          return;
        }
        if (processError?.code === "ENOENT") {
          reject(new Error(
            `Could not find \`${options.command}\`. ${INSTALL_HINT}`,
          ));
          return;
        }
        if (processError) {
          reject(processError);
          return;
        }
        resolve({ stdout, stderr, exitCode: child?.exitCode ?? null });
      });

      if (options.signal) {
        abortListener = () => {
          aborted = true;
          requestTermination();
        };
        options.signal.addEventListener("abort", abortListener, { once: true });
        if (options.signal.aborted) abortListener();
      }
    });
  } finally {
    if (forceKillTimer !== undefined) clearTimeout(forceKillTimer);
    if (options.signal && abortListener) {
      options.signal.removeEventListener("abort", abortListener);
    }
  }
}

function signalChild(child: ChildProcess, signal: NodeJS.Signals, detached: boolean): void {
  if (detached && child.pid !== undefined) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch (error) {
      if (errorCode(error) !== "ESRCH") throw error;
      return;
    }
  }
  child.kill(signal);
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function errorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const code = Reflect.get(error, "code");
  return typeof code === "string" ? code : undefined;
}

function asSpawnError(error: unknown): Error {
  if (error instanceof Error && errorCode(error) === "ENOENT") {
    return new Error(`Could not find the plannotator CLI. ${INSTALL_HINT}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}


