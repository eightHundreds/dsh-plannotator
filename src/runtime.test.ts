import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPlanArgs,
  buildPlanInput,
  buildPlannotatorEnv,
  resolvePlannotatorCommand,
  resolveSourceEntry,
  sessionCwd,
} from "./runtime.js";

describe("sessionCwd", () => {
  it("prefers the session header cwd", () => {
    expect(sessionCwd({ session: { header: { cwd: "/tmp/project" } } })).toBe("/tmp/project");
  });

  it("falls back to process.cwd", () => {
    expect(sessionCwd(undefined)).toBe(process.cwd());
    expect(sessionCwd({ session: { header: {} } })).toBe(process.cwd());
  });
});

describe("buildPlanArgs", () => {
  it("uses the stock opencode-plan bridge, not Claude hook JSON", () => {
    expect(buildPlanArgs()).toEqual(["opencode-plan"]);
  });
});

describe("buildPlanInput", () => {
  it("wraps the markdown plan in the existing CLI JSON envelope", () => {
    expect(JSON.parse(buildPlanInput("# Title\n\nBody"))).toEqual({
      plan: "# Title\n\nBody",
    });
  });
});

describe("buildPlannotatorEnv", () => {
  it("pins origin and cwd", () => {
    const env = buildPlannotatorEnv("/tmp/ws", { PATH: "/bin", PLANNOTATOR_ORIGIN: "claude-code" });
    expect(env.PLANNOTATOR_ORIGIN).toBe("dsh");
    expect(env.PLANNOTATOR_CWD).toBe("/tmp/ws");
    expect(env.PATH).toBe("/bin");
  });
});

describe("resolveSourceEntry", () => {
  it("returns null unless source mode is requested", () => {
    expect(resolveSourceEntry({ PLANNOTATOR_DSH_USE_SOURCE: "0" })).toBeNull();
  });

  it("honors an explicit source entry", () => {
    const dir = mkdtempSync(join(tmpdir(), "plannotator-dsh-entry-"));
    const entry = join(dir, "index.ts");
    writeFileSync(entry, "");
    expect(resolveSourceEntry({ PLANNOTATOR_DSH_SOURCE_ENTRY: entry })).toBe(entry);
  });

  it("walks up from SOURCE_ROOT to the plannotator checkout", () => {
    const root = mkdtempSync(join(tmpdir(), "plannotator-dsh-root-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "plannotator" }));
    const hookDir = join(root, "apps", "hook", "server");
    mkdirSync(hookDir, { recursive: true });
    const entry = join(hookDir, "index.ts");
    writeFileSync(entry, "");

    expect(resolveSourceEntry({
      PLANNOTATOR_DSH_USE_SOURCE: "1",
      PLANNOTATOR_DSH_SOURCE_ROOT: join(root, "apps", "hook"),
    })).toBe(entry);
  });
});

describe("resolvePlannotatorCommand", () => {
  it("uses PLANNOTATOR_BIN when not in source mode", () => {
    const resolved = resolvePlannotatorCommand({ PLANNOTATOR_BIN: "/opt/plannotator" });
    expect(resolved).toEqual({ command: "/opt/plannotator", args: [], source: "cli" });
  });

  it("runs the checkout through bun in source mode", () => {
    const dir = mkdtempSync(join(tmpdir(), "plannotator-dsh-bun-"));
    const entry = join(dir, "index.ts");
    writeFileSync(entry, "");
    const resolved = resolvePlannotatorCommand({
      PLANNOTATOR_DSH_SOURCE_ENTRY: entry,
      PLANNOTATOR_BUN: "/usr/local/bin/bun",
    });
    expect(resolved).toEqual({
      command: "/usr/local/bin/bun",
      args: [entry],
      source: "source",
    });
  });
});
