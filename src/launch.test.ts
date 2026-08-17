import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openPlannotator, runPlannotator } from "./launch.js";

function writeFixture(source: string, executable = false): string {
  const dir = mkdtempSync(join(tmpdir(), "plannotator-dsh-cli-"));
  const path = join(dir, executable ? "plannotator" : "cli.mjs");
  writeFileSync(path, source);
  if (executable) chmodSync(path, 0o755);
  return path;
}

describe("runPlannotator", () => {
  it("captures stdout from a child and forwards stdin", async () => {
    const cli = writeFixture(`
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { data += chunk; });
      process.stdin.on("end", () => {
        process.stdout.write(JSON.stringify({ heard: data.trim() }) + "\\n");
      });
    `);

    const result = await runPlannotator({
      command: process.execPath,
      args: [cli],
      cwd: process.cwd(),
      env: { ...process.env as Record<string, string> },
      stdin: "# Plan\n",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"heard":"# Plan"');
  });

  it("kills the child when the call is aborted", async () => {
    const cli = writeFixture(`
      setInterval(() => {}, 1000);
    `);
    const controller = new AbortController();
    const pending = runPlannotator({
      command: process.execPath,
      args: [cli],
      cwd: process.cwd(),
      env: { ...process.env as Record<string, string> },
      stdin: "# Plan\n",
      signal: controller.signal,
    });

    controller.abort(new Error("turn cancelled"));
    await expect(pending).rejects.toThrow("turn cancelled");
  });
});

describe("openPlannotator", () => {
  it("parses a structured plan decision from the child", async () => {
    const cli = writeFixture(`#!/usr/bin/env node
process.stdout.write(JSON.stringify({ decision: "denied", feedback: "Split it" }) + "\\n");
`, true);

    const decision = await openPlannotator("# Title\n\nBody", {
      env: {
        ...process.env,
        PLANNOTATOR_BIN: cli,
        PLANNOTATOR_DSH_USE_SOURCE: "0",
      },
    });

    expect(decision).toEqual({ kind: "denied", feedback: "Split it" });
  });

  it("sends the opencode-plan JSON envelope on stdin", async () => {
    const cli = writeFixture(`#!/usr/bin/env node
let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { data += chunk; });
process.stdin.on("end", () => {
  const parsed = JSON.parse(data);
  process.stdout.write(JSON.stringify({ approved: !parsed.plan.includes("deny"), feedback: parsed.plan }) + "\\n");
});
`, true);

    const decision = await openPlannotator("# Title\n\nPlease deny", {
      env: {
        ...process.env,
        PLANNOTATOR_BIN: cli,
        PLANNOTATOR_DSH_USE_SOURCE: "0",
      },
    });

    expect(decision).toEqual({
      kind: "denied",
      feedback: "# Title\n\nPlease deny",
    });
  });

  it("surfaces a CLI failure when stdout is not a decision", async () => {
    const cli = writeFixture(`#!/usr/bin/env node
process.stderr.write("boom\\n");
process.exit(1);
`, true);

    await expect(openPlannotator("# Title\n", {
      env: {
        ...process.env,
        PLANNOTATOR_BIN: cli,
        PLANNOTATOR_DSH_USE_SOURCE: "0",
      },
    })).rejects.toThrow(/Plannotator CLI failed: boom/);
  });
});
