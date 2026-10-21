import type { Page } from '@playwright/test';

export interface NavigationTiming {
  ttfb: number;
  domContentLoaded: number;
  load: number;
}

/** The browser's own Navigation Timing entry for the current document, in milliseconds. */
export async function navigationTiming(page: Page): Promise<NavigationTiming> {
  await page.waitForLoadState('load');
  return page.evaluate(() => {
    const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (!entry) {
      throw new Error('No navigation timing entry');
    }
    return {
      ttfb: Math.round(entry.responseStart - entry.startTime),
      domContentLoaded: Math.round(entry.domContentLoadedEventEnd - entry.startTime),
      load: Math.round(entry.loadEventEnd - entry.startTime),
    };
  });
}
