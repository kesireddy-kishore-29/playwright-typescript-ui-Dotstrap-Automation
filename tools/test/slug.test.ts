import { describe, expect, it } from 'vitest';
import { slugify } from '../src/shared/slug';

describe('slugify', () => {
  it('lowercases and joins words with single hyphens', () => {
    expect(slugify('Checkout — Full Flow (guest)')).toBe('checkout-full-flow-guest');
  });

  it('strips accents and never returns an empty name', () => {
    expect(slugify('Café')).toBe('cafe');
    expect(slugify('!!!')).toBe('test');
  });

  it('caps the length without leaving a trailing hyphen', () => {
    expect(slugify('a b '.repeat(50), 10)).toBe('a-b-a-b-a');
  });
});
