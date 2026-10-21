import type { Page } from '@playwright/test';

export interface Overflow {
  documentWidth: number;
  viewportWidth: number;
  offenders: string[];
}

/** Horizontal overflow: page wider than the viewport, and which elements push it out. */
export async function horizontalOverflow(page: Page): Promise<Overflow> {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > viewportWidth + 1) {
        const id = el.id ? `#${el.id}` : '';
        offenders.push(
          `${el.tagName.toLowerCase()}${id} (right edge ${String(Math.round(rect.right))}px)`,
        );
      }
    }
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth,
      offenders: offenders.slice(0, 5),
    };
  });
}
