import { expect, test } from '../../src/fixtures/app';
import { navigationTiming } from '../../src/support/timing';

/** Navigation Timing budgets for the self-hosted app (local server, so tight budgets). */
const BUDGETS = [
  { path: '/login', ttfb: 300, domContentLoaded: 1_500, load: 2_500 },
  { path: '/inbox', ttfb: 300, domContentLoaded: 1_500, load: 2_500 },
  { path: '/items', ttfb: 300, domContentLoaded: 1_500, load: 2_500 },
];

for (const budget of BUDGETS) {
  test(
    `${budget.path} loads within its navigation-timing budget`,
    { annotation: { type: 'feature', description: 'FEAT-PERF-01' } },
    async ({ page, mocks }, testInfo) => {
      await mocks.messages();
      await page.goto(budget.path);

      const timing = await navigationTiming(page);

      await testInfo.attach('navigation-timing.json', {
        contentType: 'application/json',
        body: JSON.stringify({ path: budget.path, timing, budget }, null, 2),
      });
      expect(timing.ttfb, 'time to first byte (ms)').toBeLessThan(budget.ttfb);
      expect(timing.domContentLoaded, 'DOMContentLoaded (ms)').toBeLessThan(
        budget.domContentLoaded,
      );
      expect(timing.load, 'load (ms)').toBeLessThan(budget.load);
    },
  );
}
