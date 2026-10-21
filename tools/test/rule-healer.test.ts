import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPatch } from '../src/healing/guardrails';
import { closestTestId, proposeTestIdHeal, similarity } from '../src/healing/rule-healer';

const DOM =
  '<button><span class="badge" data-test="unread-badge">2</span></button>' +
  '<ul><li data-test="message-row"><span data-test="unread-dot"></span></li></ul>';

/** A repository like the real one: the bell uses 'unread-count', the inbox uses 'unread-dot'. */
function repoWithBell(): string {
  const root = mkdtempSync(join(tmpdir(), 'heal-'));
  for (const dir of ['src/pages', 'src/components', 'src/fixtures', 'src/data', 'src/clients']) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  writeFileSync(
    join(root, 'src/components/NotificationBell.ts'),
    "this.badge = page.getByTestId('unread-count');\n",
  );
  writeFileSync(
    join(root, 'src/pages/InboxPage.ts'),
    "return this.message(subject).getByTestId('unread-dot');\n",
  );
  return root;
}

describe('rule-based test-id healer', () => {
  it('ranks a renamed id above unrelated ids', () => {
    expect(similarity('unread-count', 'unread-badge')).toBeGreaterThan(
      similarity('unread-count', 'message-row'),
    );
  });

  it('never picks an id another locator already uses, even when its name is closer', () => {
    expect(similarity('unread-count', 'unread-dot')).toBeGreaterThan(
      similarity('unread-count', 'unread-badge'),
    );
    expect(closestTestId('unread-count', DOM, ['unread-dot'])?.id).toBe('unread-badge');
  });

  it('swaps the id only in the component that defines it, and the patch passes the guardrails', () => {
    const patch = proposeTestIdHeal(repoWithBell(), 't', "getByTestId('unread-count')", DOM);

    expect(patch?.changes.map((c) => c.path)).toEqual(['src/components/NotificationBell.ts']);
    expect(patch?.changes[0]?.after).toContain("getByTestId('unread-badge')");
    expect(patch && checkPatch(patch)).toEqual([]);
  });

  it('proposes nothing when the id still exists, nothing related survives, or it is not a test id', () => {
    const root = repoWithBell();
    const stillThere = '<span data-test="unread-count"></span>';
    const unrelated = '<div data-test="footer"></div>';

    expect(proposeTestIdHeal(root, 't', "getByTestId('unread-count')", stillThere)).toBeUndefined();
    expect(proposeTestIdHeal(root, 't', "getByTestId('unread-count')", unrelated)).toBeUndefined();
    expect(proposeTestIdHeal(root, 't', "getByRole('button')", DOM)).toBeUndefined();
  });
});
