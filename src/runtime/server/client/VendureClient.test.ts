import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminOperations, operations } from './operations';
import { VendureClient } from './VendureClient';
import { UnauthenticatedError } from '@laioutr-core/canonical-types/ecommerce';
import { VendureApiError } from '../errors/mapVendureError';

const answer = (body: unknown, headers: Record<string, string> = {}, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('VendureClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends channel, language, currency and session, and keeps a token Vendure issues', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(answer({ data: { activeOrder: null } }, { 'vendure-auth-token': 'new' }))
      .mockResolvedValueOnce(answer({ data: { activeOrder: null } }));
    vi.stubGlobal('fetch', fetch);
    const onSessionToken = vi.fn();
    const client = new VendureClient({
      apiUrl: 'https://shop.example.com/shop-api',
      channelToken: 'ch',
      languageCode: 'de',
      currencyCode: 'EUR',
      sessionToken: 'old',
      onSessionToken,
    });

    await client.request(operations.activeOrder);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://shop.example.com/shop-api?languageCode=de&currencyCode=EUR');
    expect(init.headers).toMatchObject({ 'vendure-token': 'ch', Authorization: 'Bearer old' });
    expect(onSessionToken).toHaveBeenCalledWith('new');

    await client.request(operations.activeOrder);
    expect(fetch.mock.calls[1]![1].headers.Authorization).toBe('Bearer new');
  });

  it('throws a top-level error through the mapping, and an HTTP failure as an upstream error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(answer({ errors: [{ message: 'no', extensions: { code: 'FORBIDDEN' } }] }))
        .mockResolvedValueOnce(answer({}, {}, 502))
    );
    const client = new VendureClient({ apiUrl: 'https://shop.example.com/shop-api' });
    await expect(client.request(operations.activeCustomer)).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(client.request(operations.activeCustomer)).rejects.toBeInstanceOf(VendureApiError);
  });

  it("reads a refusal on the Admin API as the key's, not as a lost session", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer({ errors: [{ message: 'no', extensions: { code: 'FORBIDDEN' } }] })));
    const client = new VendureClient({ apiUrl: 'https://shop.example.com/admin-api', apiKey: 'key' });
    await expect(client.request(operations.activeCustomer)).rejects.toThrow(/Admin API key/);
  });

  it('unwraps an error result of a mutation', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          answer({ data: { login: { __typename: 'NotVerifiedError', errorCode: 'NOT_VERIFIED_ERROR', message: 'verify' } } })
        )
    );
    const client = new VendureClient({ apiUrl: 'https://shop.example.com/shop-api' });
    await expect(client.mutate(operations.login, { username: 'a', password: 'b' }, 'login')).rejects.toMatchObject({
      name: expect.stringContaining('CustomerNotConfirmedError'),
    });
  });

  it('sends no session from a detached client and keeps none of its tokens', async () => {
    const fetch = vi.fn().mockResolvedValue(answer({ data: { activeOrder: null } }, { 'vendure-auth-token': 'other' }));
    vi.stubGlobal('fetch', fetch);
    const onSessionToken = vi.fn();
    const client = new VendureClient({ apiUrl: 'https://shop.example.com/shop-api', sessionToken: 'mine', onSessionToken });
    await client.withoutSession().request(operations.activeOrder);
    expect(fetch.mock.calls[0]![1].headers.Authorization).toBeUndefined();
    expect(onSessionToken).not.toHaveBeenCalled();
  });

  it('gives up on a server that does not answer in time', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        expect(init.signal).toBeInstanceOf(AbortSignal);
        return Promise.reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));
      })
    );
    await expect(new VendureClient({ apiUrl: 'https://shop.example.com/shop-api' }).request(operations.activeOrder)).rejects.toMatchObject({
      upstreamCode: 'TIMEOUT',
    });
  });

  it('authenticates an Admin API key and keeps no session, whatever the server sends', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) =>
      answer({ data: { activeOrder: null } }, { 'vendure-auth-token': 'issued' })
    );
    vi.stubGlobal('fetch', fetch);
    const client = new VendureClient({ apiUrl: 'https://shop.example.com/admin-api', apiKey: 'secret', channelToken: 'ch' });
    await client.request(operations.activeOrder);
    await client.request(operations.activeOrder);
    expect(fetch.mock.calls[1]![1]!.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'vendure-token': 'ch',
      'vendure-api-key': 'secret',
    });
    expect(client.hasSession).toBe(false);
  });

  it('answers the errors of several aliased fields beside the data, throwing only for a failed request', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(answer({ data: null, errors: [{ message: 'no', path: ['a1'], extensions: { code: 'X' } }] }))
        .mockResolvedValueOnce(answer({}, {}, 500))
    );
    const client = new VendureClient({ apiUrl: 'https://shop.example.com/admin-api', apiKey: 'secret' });
    expect(await client.requestEach(operations.activeOrder)).toEqual({
      data: null,
      errors: [{ message: 'no', path: ['a1'], extensions: { code: 'X' } }],
    });
    await expect(client.requestEach(operations.activeOrder)).rejects.toMatchObject({ upstreamCode: 'HTTP_500' });
  });

  it('sends files as a GraphQL multipart request', async () => {
    const fetch = vi.fn().mockResolvedValue(answer({ data: { createAssets: [] } }));
    vi.stubGlobal('fetch', fetch);
    const client = new VendureClient({ apiUrl: 'https://shop.example.com/admin-api', apiKey: 'secret' });
    await client.requestWithFiles(adminOperations.createAssets, { input: [{ file: null }] }, [
      { variablePath: 'input.0.file', file: new Blob(['x']), fileName: 'a.png' },
    ]);
    const init = fetch.mock.calls[0]![1] as RequestInit & { headers: Record<string, string> };
    const form = init.body as FormData;
    expect(JSON.parse(String(form.get('map')))).toEqual({ 0: ['variables.input.0.file'] });
    expect(form.get('0')).toBeInstanceOf(Blob);
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers['apollo-require-preflight']).toBe('true');
  });

  it('reports a page that is not JSON as an upstream error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    );
    await expect(new VendureClient({ apiUrl: 'https://shop.example.com/shop-api' }).request(operations.activeOrder)).rejects.toMatchObject({
      upstreamCode: 'INVALID_RESPONSE',
    });
  });
});
