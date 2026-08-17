import { parsePlanDecision } from "./decision.js";
import { invokePlannotator } from "./launch.js";
import { sessionCwd } from "./runtime.js";
import { lastAssistantText } from "./session-text.js";
import type { PlanAgent, PlanDecision } from "./types.js";

export interface CommandResult {
  kind: "success" | "error";
  text: string;
}

export interface CommandInvocation {
  agent: PlanAgent;
  rawInput: string;
  signal: AbortSignal;
}

export interface CommandRegistry {
  register(definition: {
    name: string;
    description: string;
    input?: { hint: string };
    handler: (invocation: CommandInvocation) => CommandResult | Promise<CommandResult>;
  }): unknown;
}

export function registerPlannotatorCommands(commands: CommandRegistry): void {
  commands.register({
    name: "plannotator-review",
    description: "Open Plannotator on the current changes or a pull request",
    input: { hint: "[PR_URL]" },
    handler: (invocation) => runReview(invocation),
  });
  commands.register({
    name: "plannotator-annotate",
    description: "Open Plannotator on a file, folder, or URL",
    input: { hint: "<file-or-url>" },
    handler: (invocation) => runAnnotate(invocation),
  });
  commands.register({
    name: "plannotator-last",
    description: "Open Plannotator on the latest assistant reply",
    handler: (invocation) => runLast(invocation),
  });
}

export async function runReview(invocation: CommandInvocation): Promise<CommandResult> {
  const extra = splitArgs(invocation.rawInput);
  return runCli(invocation, ["review", ...extra], { injectPlaintext: true });
}

export async function runAnnotate(invocation: CommandInvocation): Promise<CommandResult> {
  const extra = splitArgs(invocation.rawInput);
  if (extra.length === 0) {
    return { kind: "error", text: "Name a file, folder, or URL to annotate." };
  }
  return runCli(invocation, ["annotate", ...extra, "--json"]);
}

export async function runLast(invocation: CommandInvocation): Promise<CommandResult> {
  const text = lastAssistantText(invocation.agent.session?.events);
  if (!text) {
    return { kind: "error", text: "No assistant reply in this session yet." };
  }
  return runCli(invocation, ["annotate-last", "--stdin", "--json"], { stdin: text });
}

async function runCli(
  invocation: CommandInvocation,
  args: string[],
  options: { stdin?: string; injectPlaintext?: boolean } = {},
): Promise<CommandResult> {
  let result: { stdout: string; stderr: string; exitCode: number | null };
  try {
    result = await invokePlannotator({
      args,
      stdin: options.stdin,
      cwd: sessionCwd(invocation.agent),
      signal: invocation.signal,
    });
  } catch (error) {
    return {
      kind: "error",
      text: error instanceof Error ? error.message : String(error),
    };
  }

  const stdout = result.stdout.trim();
  if (options.injectPlaintext) {
    if (result.exitCode !== 0 && result.exitCode !== null) {
      return {
        kind: "error",
        text: result.stderr.trim() || stdout || "Plannotator review failed.",
      };
    }
    if (!stdout) return { kind: "success", text: "Review closed." };
    injectAgentText(invocation.agent, stdout);
    return { kind: "success", text: "Feedback sent to the agent." };
  }

  let decision: PlanDecision;
  try {
    decision = parsePlanDecision(stdout);
  } catch {
    if (result.exitCode !== 0 && result.exitCode !== null) {
      return {
        kind: "error",
        text: result.stderr.trim() || stdout || "Plannotator failed.",
      };
    }
    return { kind: "success", text: stdout || "Closed." };
  }

  const described = describeAnnotateDecision(decision);
  if (described.inject) injectAgentText(invocation.agent, described.inject);
  return { kind: "success", text: described.ui };
}

export function describeAnnotateDecision(decision: PlanDecision): { ui: string; inject?: string } {
  if (decision.kind === "approved") {
    if (decision.notes) {
      return {
        ui: "Approved with notes.",
        inject: `# Approved with Notes\n\n${decision.notes}`,
      };
    }
    return { ui: "Approved." };
  }
  if (decision.kind === "dismissed") return { ui: "Closed without feedback." };
  if (decision.feedback) {
    return { ui: "Feedback sent to the agent.", inject: decision.feedback };
  }
  return { ui: "Closed without feedback." };
}

export function splitArgs(rawInput: string): string[] {
  return rawInput.trim().split(/\s+/).filter(Boolean);
}

function injectAgentText(agent: PlanAgent, text: string): void {
  try {
    agent.inject({
      id: crypto.randomUUID(),
      role: "user",
      content: [{ type: "text", text }],
      source: { kind: "plugin", plugin: "plannotator", form: "notice", summary: "Plannotator feedback" },
    });
  } catch {
    // Command UI text still reports the outcome.
  }
}
