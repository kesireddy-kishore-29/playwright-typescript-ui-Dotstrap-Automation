import { expect, test } from '../../src/fixtures/app';
import { DemoPage } from '../../src/pages/demo/DemoPage';

/**
 * FAILS ON PURPOSE. Proves the failure-evidence pipeline (video, trace, screenshots, console log,
 * HAR, page source, failure bundle, triage). Runs only in the `demo` project; never gates a merge.
 */
const demo = {
  tag: ['@demo-failure'],
  annotation: { type: 'feature', description: 'FEAT-DEMO-01' },
};

test.describe('deliberate failures (demo)', () => {
  test('DEMO: a wrong expectation about the page', demo, async ({ mocks, inbox }) => {
    await mocks.messages();
    await inbox.open();

    await expect(inbox.heading, 'deliberately wrong expectation').toHaveText('Outbox', {
      timeout: 2_000,
    });
  });

  test('DEMO: an element whose test id no longer exists', demo, async ({ page, mocks, inbox }) => {
    await mocks.messages();
    await inbox.open();

    await expect(new DemoPage(page).vanished).toBeVisible({ timeout: 2_000 });
  });

  test('DEMO: an element that exists but is not ready', demo, async ({ page, mocks, inbox }) => {
    await mocks.empty();
    await inbox.open();

    await new DemoPage(page).verifyBadgeOpens();
  });

  test('DEMO: a host that does not answer', demo, async ({ page }) => {
    await new DemoPage(page).verifyUnreachableHostLoads();
  });
});
