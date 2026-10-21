/**
 * The dotstrap.com public pages the live smoke suite visits, and what each must say. A change on
 * the live site is a one-file fix here. Only public pages; /login is excluded (robots.txt).
 */
export interface LivePage {
  path: string;
  title: RegExp;
  heading: RegExp;
}

export const LIVE_PAGES: readonly LivePage[] = [
  { path: '/', title: /Dotstrap/, heading: /Anyone can knock/i },
  { path: '/how-it-works', title: /How it works/, heading: /stranger at your page/i },
  { path: '/front-desk', title: /front desk/i, heading: /always answers the door/i },
  { path: '/pricing', title: /Pricing/, heading: /free/i },
  { path: '/faq', title: /FAQ/, heading: /questions people actually ask/i },
  { path: '/about', title: /About/, heading: /front desk/i },
  { path: '/security', title: /Security/, heading: /protects your data/i },
  { path: '/privacy', title: /Privacy/, heading: /Privacy Policy/i },
  { path: '/terms', title: /Terms/, heading: /Terms/i },
];

/** Pages checked at every width (a subset keeps the suite polite). */
export const RESPONSIVE_PAGES = ['/', '/how-it-works', '/pricing'] as const;

export const WIDTHS = [1440, 1024, 768, 390] as const;

/** Generous budgets: the live site runs on someone else's network, not ours. */
export const LIVE_BUDGET_MS = { domContentLoaded: 6_000, load: 10_000 } as const;
