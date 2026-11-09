import { describe, expect, it } from 'vitest';
import { type CookieJar, sessionCookies } from './sessionCookies';

const jarOf = (headersSent = false) => {
  const cookies = new Map<string, string>();
  const set: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const jar: CookieJar = {
    get: (name) => cookies.get(name),
    set: (name, value, options) => {
      cookies.set(name, value);
      set.push({ name, value, options });
    },
    delete: (name) => cookies.delete(name),
    headersSent,
  };
  return { jar, cookies, set };
};

describe('session cookie', () => {
  it('keeps the token in an http-only, lax cookie and reads it back', () => {
    const { jar, set } = jarOf();
    const cookies = sessionCookies(jar, 'secret');
    cookies.writeSessionToken('token');
    expect(set[0]).toMatchObject({ name: 'vendure-auth-token', value: 'token', options: { httpOnly: true, sameSite: 'lax', path: '/' } });
    expect(cookies.readSessionToken()).toBe('token');
    cookies.clearSessionToken();
    expect(cookies.readSessionToken()).toBeUndefined();
  });

  it('writes nothing once a streamed answer has sent its headers', () => {
    const { jar, cookies, set } = jarOf(true);
    cookies.set('vendure-auth-token', 'kept');
    const session = sessionCookies(jar, 'secret');
    session.writeSessionToken('token');
    session.clearSessionToken();
    session.rememberPlacedOrder('C1');
    expect(set).toHaveLength(0);
    expect(cookies.get('vendure-auth-token')).toBe('kept');
  });
});

describe('placed orders cookie', () => {
  it('remembers the orders this browser placed, signed and http-only', () => {
    const { jar, set } = jarOf();
    const cookies = sessionCookies(jar, 'secret');
    cookies.rememberPlacedOrder('C1');
    cookies.rememberPlacedOrder('C2');
    expect(cookies.readPlacedOrderCodes()).toEqual(['C1', 'C2']);
    expect(set.at(-1)!.options).toMatchObject({ httpOnly: true, sameSite: 'lax' });
    expect(sessionCookies(jar, 'another-deployment').readPlacedOrderCodes()).toEqual([]);
  });

  it('trusts no code a visitor wrote into the cookie', () => {
    const { jar, cookies } = jarOf();
    const session = sessionCookies(jar, 'secret');
    cookies.set('vendure-placed-orders', 'SOMEONE-ELSES');
    expect(session.readPlacedOrderCodes()).toEqual([]);

    session.rememberPlacedOrder('C1');
    const [codes, signature] = cookies.get('vendure-placed-orders')!.split('.');
    cookies.set('vendure-placed-orders', `${codes}~SOMEONE-ELSES.${signature}`);
    expect(session.readPlacedOrderCodes()).toEqual([]);
  });
});
