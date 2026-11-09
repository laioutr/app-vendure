import { describe, expect, it } from 'vitest';
import { getImage } from './vendure';

const src = 'https://shop.example.com/assets/preview/a__preview.jpg';

describe('vendure image provider', () => {
  it('asks the asset server for the size, crop and format', () => {
    expect(getImage(src, { modifiers: { width: 300, height: 200, format: 'webp', quality: 80 } } as never, {} as never).url).toBe(`${src}?w=300&h=200&mode=crop&format=webp&q=80`);
  });

  it('fits inside the box for contain, and leaves an unknown format to the server', () => {
    expect(getImage(src, { modifiers: { width: 300, height: 200, fit: 'contain', format: 'gif' } } as never, {} as never).url).toBe(`${src}?w=300&h=200&mode=resize`);
    expect(getImage(src, { modifiers: { width: 300 } } as never, {} as never).url).toBe(`${src}?w=300`);
  });
});
