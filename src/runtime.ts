import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ORIGIN = "dsh";

export interface PlannotatorCommand {
  command: string;
  args: string[];
  source: "cli" | "source";
}

export function sessionCwd(agent: { session?: { header?: { cwd?: string } } } | undefined): string {
  const cwd = agent?.session?.header?.cwd;
  return typeof cwd === "string" && cwd.trim() ? cwd : process.cwd();
}

export function resolvePlannotatorCommand(
  env: NodeJS.ProcessEnv = process.env,
  pluginDir: string = currentPluginDir(),
): PlannotatorCommand {
  const sourceEntry = resolveSourceEntry(env, pluginDir);
  if (sourceEntry) {
    return {
      command: resolveBunExecutable(env),
      args: [sourceEntry],
      source: "source",
    };
  }

  const bin = resolvePlannotatorBin(env);
  return { command: bin, args: [], source: "cli" };
}

/**
 * Stock Plannotator CLI (0.19+) already has this internal plan-review
 * bridge. It reads `{ plan }` on stdin and prints `{ approved, feedback? }`.
 * We do not invent Claude hook JSON, and we do not require a fork of
 * Plannotator.
 */
export function buildPlanArgs(): string[] {
  return ["opencode-plan"];
}

export function buildPlanInput(plan: string): string {
  return JSON.stringify({ plan });
}

export function buildPlannotatorEnv(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") next[key] = value;
  }
  next.PLANNOTATOR_ORIGIN = ORIGIN;
  next.PLANNOTATOR_CWD = cwd;
  return next;
}

export function resolveSourceEntry(
  env: NodeJS.ProcessEnv = process.env,
  pluginDir: string = currentPluginDir(),
): string | null {
  const explicit = env.PLANNOTATOR_DSH_SOURCE_ENTRY?.trim();
  if (explicit) {
    const resolved = resolve(explicit);
    return existsSync(resolved) ? resolved : null;
  }

  if (env.PLANNOTATOR_DSH_USE_SOURCE !== "1") return null;

  const roots = [
    env.PLANNOTATOR_DSH_SOURCE_ROOT?.trim(),
    process.cwd(),
    pluginDir,
  ].filter((value): value is string => Boolean(value));

  for (const start of roots) {
    const entry = findSourceEntry(start);
    if (entry) return entry;
  }

  return null;
}

function resolvePlannotatorBin(env: NodeJS.ProcessEnv): string {
  const explicit = env.PLANNOTATOR_BIN?.trim();
  if (explicit) return explicit;

  const home = env.HOME?.trim() || env.USERPROFILE?.trim() || homedir();
  if (process.platform === "win32") {
    const localAppData = env.LOCALAPPDATA?.trim();
    if (localAppData) {
      const candidate = join(localAppData, "plannotator", "plannotator.exe");
      if (existsSync(candidate)) return candidate;
    }
    const userBin = join(home, ".local", "bin", "plannotator.exe");
    if (existsSync(userBin)) return userBin;
    return "plannotator";
  }

  const userBin = join(home, ".local", "bin", "plannotator");
  if (existsSync(userBin)) return userBin;
  return "plannotator";
}

function resolveBunExecutable(env: NodeJS.ProcessEnv): string {
  const explicit = env.PLANNOTATOR_BUN?.trim() || env.BUN?.trim();
  if (explicit) return explicit;
  return "bun";
}

function findSourceEntry(startDir: string): string | null {
  const root = findRepoRoot(startDir);
  if (!root) return null;
  const sourceEntry = join(root, "apps", "hook", "server", "index.ts");
  return existsSync(sourceEntry) ? sourceEntry : null;
}

function findRepoRoot(startDir: string): string | null {
  let dir = resolve(startDir);
  while (true) {
    const packageJsonPath = join(dir, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: unknown };
        if (pkg.name === "plannotator") return dir;
      } catch {
        // Ignore malformed package.json while walking upward.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function currentPluginDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return isAbsolute(here) ? here : resolve(here);
}
