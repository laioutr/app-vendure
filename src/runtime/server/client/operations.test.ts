import { describe, expect, it } from 'vitest';
import { operations, withFragments } from './operations';

describe('withFragments', () => {
  it('appends each spread fragment once, also through other fragments', () => {
    const document = withFragments('query X { product(slug: "a") { ...ProductFields } }');
    expect(document.match(/fragment ProductFields /g)).toHaveLength(1);
    expect(document.match(/fragment VariantFields /g)).toHaveLength(1);
    expect(document.match(/fragment AssetFields /g)).toHaveLength(1);
    expect(document).not.toContain('fragment OrderFields');
  });

  it('refuses a fragment that is not defined', () => {
    expect(() => withFragments('query X { a { ...Missing } }')).toThrow('fragment "Missing"');
  });

  it('leaves inline fragments alone', () => {
    expect(withFragments('query X { a { ... on Order { id } } }')).toBe('query X { a { ... on Order { id } } }');
  });

  it('builds every operation', () => {
    for (const document of Object.values(operations)) expect(document).toMatch(/^\s*(query|mutation) /);
  });
});
