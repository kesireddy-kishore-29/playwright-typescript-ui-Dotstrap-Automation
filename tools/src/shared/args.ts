/** Minimal `--name value` / `--flag` parsing for the CLI commands. */
export type Args = ReadonlyMap<string, string>;

export function parseArgs(argv: readonly string[]): Args {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument '${arg}'`);
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      values.set(arg.slice(2), next);
      i++;
    } else {
      values.set(arg.slice(2), 'true');
    }
  }
  return values;
}

export function arg(args: Args, name: string, fallback: string): string {
  return args.get(name) ?? fallback;
}
