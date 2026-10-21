import { randomUUID } from 'node:crypto';

/** A name nobody else's test will use: `qa-<label>-<8 hex>`. */
export function uniqueName(label: string): string {
  return `qa-${label}-${randomUUID().slice(0, 8)}`;
}

export function uniqueEmail(): string {
  return `${uniqueName('user')}@example.test`;
}
