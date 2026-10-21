/** What the model returned (structured JSON), or why there is nothing to use. */
export interface AiResult {
  json?: unknown;
  status: string;
}

/**
 * A language model behind an interface, so the provider can be swapped and the tools work (rules
 * only) when none is configured. Output is always constrained to a JSON schema.
 */
export interface AiProvider {
  readonly name: string;
  completeJson(system: string, user: string, schema: Record<string, unknown>): Promise<AiResult>;
}
