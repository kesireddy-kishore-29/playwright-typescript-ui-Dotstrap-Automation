import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The dashboard and gallery templates are shared, byte for byte, with the Java repository of the
 * family. Data goes in at one placeholder; nothing else in the file changes.
 */
const PLACEHOLDER = '/*__DATA__*/null';
const TEMPLATE_DIR = join(__dirname, '..', '..', 'templates');

/** JSON that is safe inside a script element: no `</script>`, no line separators. */
export function safeJson(data: unknown): string {
  return JSON.stringify(data)
    .replaceAll('<', '\\u003c')
    .replaceAll(' ', '\\u2028')
    .replaceAll(' ', '\\u2029');
}

export function render(template: 'dashboard.html' | 'gallery.html', data: unknown): string {
  const html = readFileSync(join(TEMPLATE_DIR, template), 'utf8');
  if (!html.includes(PLACEHOLDER)) throw new Error(`${template} has no data placeholder`);
  return html.replace(PLACEHOLDER, () => safeJson(data));
}
