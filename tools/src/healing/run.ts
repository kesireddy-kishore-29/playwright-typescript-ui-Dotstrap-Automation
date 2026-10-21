import { execFileSync } from 'node:child_process';

/** Exit code and output tail of a command run without a shell, with a hard timeout. */
export interface RunResult {
  ok: boolean;
  tail: string;
}

export function run(command: string, args: string[], cwd: string, timeoutMs: number): RunResult {
  try {
    const out = execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
    return { ok: true, tail: tail(out) };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message: string };
    return { ok: false, tail: tail(`${e.stdout ?? ''}${e.stderr ?? ''}` || e.message) };
  }
}

function tail(text: string): string {
  return text.trim().split('\n').slice(-25).join('\n');
}

/** Node tools by script path, so nothing goes through a shell. */
export function nodeTool(
  script: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): RunResult {
  return run(process.execPath, [require.resolve(script), ...args], cwd, timeoutMs);
}

export function git(args: string[], cwd: string): string {
  const result = run('git', args, cwd, 120_000);
  if (!result.ok) throw new Error(`git ${args.join(' ')} failed:\n${result.tail}`);
  return result.tail;
}
