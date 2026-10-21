import { execFileSync } from 'node:child_process';

/** One test as `playwright test --list --reporter=json` describes it. */
export interface ListedTest {
  file: string;
  title: string;
  titlePath: string[];
  tags: string[];
  features: string[];
  projects: string[];
}

interface ListSpec {
  title: string;
  tags: string[];
  file: string;
  tests: { annotations: { type: string; description?: string }[]; projectName: string }[];
}
interface ListSuite {
  title: string;
  file: string;
  specs?: ListSpec[];
  suites?: ListSuite[];
}
interface ListReport {
  suites: ListSuite[];
}

export function flatten(report: ListReport): ListedTest[] {
  const byKey = new Map<string, ListedTest>();
  const walk = (suite: ListSuite, path: string[]): void => {
    for (const spec of suite.specs ?? []) {
      const titlePath = [...path, spec.title];
      const key = `${spec.file} › ${titlePath.join(' › ')}`;
      const existing = byKey.get(key);
      const projects = spec.tests.map((t) => t.projectName);
      const features = spec.tests.flatMap((t) =>
        t.annotations.filter((a) => a.type === 'feature').map((a) => a.description ?? ''),
      );
      if (existing) {
        existing.projects.push(...projects);
      } else {
        byKey.set(key, {
          file: spec.file,
          title: spec.title,
          titlePath,
          tags: spec.tags,
          features: [...new Set(features)],
          projects,
        });
      }
    }
    for (const child of suite.suites ?? []) {
      walk(child, [...path, child.title]);
    }
  };
  for (const fileSuite of report.suites) {
    walk(fileSuite, []);
  }
  return [...byKey.values()];
}

/** Every test in every project, from Playwright itself (so computed titles are exact). */
export function listTests(): ListedTest[] {
  // Run Playwright's CLI through node directly: no shell, nothing to escape.
  const cli = require.resolve('@playwright/test/cli');
  const out = execFileSync(process.execPath, [cli, 'test', '--list', '--reporter=json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
  return flatten(JSON.parse(out) as ListReport);
}

/** The ID quarantine.json uses: `<file> › <describe…> › <title>` (project-independent). */
export function quarantineId(test: ListedTest): string {
  return `${test.file} › ${test.titlePath.join(' › ')}`;
}
