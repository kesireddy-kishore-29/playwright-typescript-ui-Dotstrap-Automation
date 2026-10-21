import type { PlaywrightWorkerOptions } from '@playwright/test';
import type { RecordModeValue } from './env';

type EvidenceOptions = Pick<PlaywrightWorkerOptions, 'video' | 'trace' | 'screenshot'>;

/**
 * One switch, three values, the same in every repository of the family:
 * `failures` keeps evidence for failed or retried tests, `all` keeps it for every test (nightly and
 * local analysis), `off` keeps nothing beyond the report.
 */
export function evidenceOptions(mode: RecordModeValue): EvidenceOptions {
  switch (mode) {
    case 'all':
      return { video: 'on', trace: 'on', screenshot: 'on' };
    case 'off':
      return { video: 'off', trace: 'off', screenshot: 'off' };
    case 'failures':
      return {
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
      };
  }
}
