import { healCommand } from './healing/heal';
import { parseArgs, type Args } from './shared/args';
import { flakyHistoryCommand } from './quarantine/flaky-history';
import { quarantineCheckCommand } from './quarantine/quarantine';
import { mergeCommand } from './reporting/merge';
import { redactTracesCommand } from './reporting/redact-traces';
import { reportCommand } from './reporting/report';
import { traceabilityCommand } from './traceability/traceability';
import { triageCommand } from './triage/triage';

type Command = (args: Args, log: (line: string) => void) => number | Promise<number>;

const COMMANDS: Record<string, { summary: string; run: Command }> = {
  triage: {
    summary: 'classify the failures of a run (rules first, optional LLM for UNKNOWN)',
    run: triageCommand,
  },
  heal: {
    summary: 'propose guarded, verified fixes on heal/* branches (never auto-merged)',
    run: healCommand,
  },
  'quarantine-check': {
    summary: 'fail on expired, ownerless or unmatched quarantine entries',
    run: quarantineCheckCommand,
  },
  'flaky-history': {
    summary: 'record flaky tests; --propose quarantines those flaky 3+ times in 14 days',
    run: flakyHistoryCommand,
  },
  traceability: {
    summary: 'fail on tests without a feature ID; write the coverage matrix',
    run: traceabilityCommand,
  },
  merge: {
    summary: 'combine the run folders of Playwright shards into one run',
    run: mergeCommand,
  },
  'redact-traces': {
    summary: 'redact Playwright traces copied by other reporters (Allure, HTML report)',
    run: redactTracesCommand,
  },
  report: {
    summary: 'dashboard, history, gallery, step summary, accessibility, performance, visual',
    run: reportCommand,
  },
};

export function help(): string {
  return [
    'usage: npm run qa -- <command> [options]',
    '',
    'commands:',
    ...Object.entries(COMMANDS).map(([name, c]) => `  ${name.padEnd(18)} ${c.summary}`),
  ].join('\n');
}

export async function main(argv: readonly string[], log: (line: string) => void): Promise<number> {
  const [name, ...rest] = argv;
  if (!name || name === 'help' || name === '--help') {
    log(help());
    return 0;
  }
  const command = COMMANDS[name];
  if (!command) {
    log(`Unknown command '${name}'.\n${help()}`);
    return 2;
  }
  return command.run(parseArgs(rest), log);
}

if (require.main === module) {
  main(process.argv.slice(2), (line) => {
    console.log(line);
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
}
