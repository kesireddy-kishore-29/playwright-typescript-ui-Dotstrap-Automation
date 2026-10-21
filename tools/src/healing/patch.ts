import type { Category } from '../triage/categories';

/** One file a patch rewrites: repository-relative path (forward slashes), old and new content. */
export interface FileChange {
  path: string;
  before: string;
  after: string;
}

/** A proposed fix: which failure, which provider proposed it, why, and the file changes. */
export interface Patch {
  category: Category;
  testId: string;
  provider: string;
  rationale: string;
  changes: FileChange[];
}

export interface GuardrailViolation {
  rule: string;
  path: string;
  detail: string;
}
