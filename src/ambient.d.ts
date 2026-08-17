declare module "@deepseek-ai/cordis" {
  export interface Context {
    on(
      name: "tools/execute",
      listener: (
        exec: import("./types.js").ToolDispatchExecution,
        next: () => Promise<unknown>,
      ) => Promise<unknown>,
    ): () => void;
    get(name: "planMode"): import("./types.js").PlanModeService | undefined;
    get(name: string): unknown;
    logger?: {
      info?(...args: unknown[]): void;
      warn?(...args: unknown[]): void;
    };
  }
}

declare module "@deepseek-ai/dsh-plan-mode" {}

declare module "@deepseek-ai/dsh-tools" {}

declare module "@deepseek-ai/dsh-llm" {
  export function createUserMessage(input: {
    content: Array<{ type: "text"; text: string }>;
    source: {
      kind: "plugin";
      plugin: string;
      form?: string;
      summary?: string;
    };
  }): unknown;
}
