/**
 * Deterministic, filesystem-safe name for a test, used in every evidence path:
 * `run-evidence/<repo>/<run-id>/<suite>/<test-slug>/<attempt>/`.
 */
export function slugify(title: string, maxLength = 80): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (slug.length > 0 ? slug : 'test').slice(0, maxLength).replace(/-+$/, '');
}
