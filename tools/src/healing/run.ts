import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';

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

/**
 * A package script's path, also when the package's exports map does not list it (ESLint does not
 * export bin/eslint.js): then the path is taken relative to the package's own package.json.
 */
export function resolveScript(script: string): string {
  try {
    return require.resolve(script);
  } catch {
    const parts = script.split('/');
    const nameLength = script.startsWith('@') ? 2 : 1;
    const name = parts.slice(0, nameLength).join('/');
    return join(dirname(require.resolve(`${name}/package.json`)), ...parts.slice(nameLength));
  }
}

/** Node tools by script path, so nothing goes through a shell. A missing tool is a failed step. */
export function nodeTool(
  script: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): RunResult {
  let path: string;
  try {
    path = resolveScript(script);
  } catch (error) {
    return { ok: false, tail: `Cannot resolve ${script}: ${String(error)}` };
  }
  return run(process.execPath, [path, ...args], cwd, timeoutMs);
}

export function git(args: string[], cwd: string): string {
  const result = run('git', args, cwd, 120_000);
  if (!result.ok) throw new Error(`git ${args.join(' ')} failed:\n${result.tail}`);
  return result.tail;
}
