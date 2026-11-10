import { describe, expect, it } from 'vitest';
import { checkoutLinkOf, DEFAULT_CHECKOUT_PATH } from './checkoutPath';

describe('checkoutLinkOf', () => {
  it('leads to the default page while the setting is empty', () => {
    expect(checkoutLinkOf(undefined)).toEqual({ type: 'url', href: DEFAULT_CHECKOUT_PATH });
    expect(checkoutLinkOf('  ')).toEqual({ type: 'url', href: '/checkout' });
  });

  it('keeps a path or a full URL as set, and roots a path typed without its slash', () => {
    expect(checkoutLinkOf('/de/kasse')).toEqual({ type: 'url', href: '/de/kasse' });
    expect(checkoutLinkOf('https://shop.example.com/checkout')).toEqual({ type: 'url', href: 'https://shop.example.com/checkout' });
    expect(checkoutLinkOf('kasse')).toEqual({ type: 'url', href: '/kasse' });
  });
});
