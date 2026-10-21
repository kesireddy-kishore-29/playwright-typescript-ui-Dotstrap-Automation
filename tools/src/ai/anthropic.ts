import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider, AiResult } from './provider';

export const MODEL = 'claude-opus-5-5';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** Claude through the official SDK. JSON comes back through structured outputs, never free text. */
export class AnthropicProvider implements AiProvider {
  readonly name = `anthropic:${MODEL}`;

  constructor(private readonly client: Anthropic) {}

  /** Configured from ANTHROPIC_API_KEY; undefined (rules only) when it is not set. */
  static fromEnvironment(env: NodeJS.ProcessEnv): AnthropicProvider | undefined {
    const key = env['ANTHROPIC_API_KEY'];
    if (!key?.trim()) return undefined;
    return new AnthropicProvider(new Anthropic({ apiKey: key, timeout: 120_000, maxRetries: 2 }));
  }

  async completeJson(
    system: string,
    user: string,
    schema: Record<string, unknown>,
  ): Promise<AiResult> {
    try {
      const message = await this.client.beta.messages.create(buildRequest(system, user, schema));
      return readMessage(message);
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError)
        return { status: 'provider rate limited; rules used' };
      if (error instanceof Anthropic.APIConnectionError)
        return { status: 'provider unreachable; rules used' };
      if (error instanceof Anthropic.APIError)
        return { status: `request failed (HTTP ${String(error.status)}); rules used` };
      throw error;
    }
  }
}

/** The request. Exported so a unit test can check its shape without a network. */
export function buildRequest(
  system: string,
  user: string,
  schema: Record<string, unknown>,
): Anthropic.Beta.MessageCreateParamsNonStreaming {
  return {
    model: MODEL,
    max_tokens: 16_000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    // On a safety decline, the API re-runs the request on its recommended fallback model.
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
  };
}

/** Reads the structured answer out of a response; refusals and truncations are not answers. */
export function readMessage(
  message: Pick<Anthropic.Beta.BetaMessage, 'stop_reason' | 'content'>,
): AiResult {
  if (message.stop_reason === 'refusal') return { status: 'model declined (stop_reason=refusal)' };
  if (message.stop_reason === 'max_tokens')
    return { status: 'answer truncated (stop_reason=max_tokens)' };
  for (const block of message.content) {
    if (block.type === 'text') {
      try {
        return { json: JSON.parse(block.text) as unknown, status: 'ok' };
      } catch {
        return { status: 'answer was not valid JSON' };
      }
    }
  }
  return { status: 'no text block in the answer' };
}
