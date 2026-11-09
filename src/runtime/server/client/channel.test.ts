import { afterEach, describe, expect, it, vi } from 'vitest';
import { channelOf } from './channel';
import { fakeShopApi } from '../../../../test/fixtures/fakeShopApi';

const channel = { code: 'default', defaultLanguageCode: 'en', availableLanguageCodes: ['en'], defaultCurrencyCode: 'USD', availableCurrencyCodes: ['USD'] };

// Each test uses its own server address: the cache is per process and keyed by it.
let server = 0;
const nextServer = () => `https://shop${++server}.example.com/shop-api`;

describe('channelOf', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reads the channel and whether search filters on stock once per interval', async () => {
    vi.useFakeTimers();
    const api = fakeShopApi({ ActiveChannel: { data: { activeChannel: channel } }, InStockSearchProbe: { data: { search: { totalItems: 3 } } } });
    const url = nextServer();
    expect(await channelOf(url, undefined)).toEqual({ channel, searchesByStock: true });
    await channelOf(url, undefined);
    expect(api.calls).toHaveLength(2);

    vi.advanceTimersByTime(11 * 60 * 1000);
    await channelOf(url, undefined);
    expect(api.calls).toHaveLength(4);
  });

  it('takes a refused stock filter as a search without it', async () => {
    fakeShopApi({
      ActiveChannel: { data: { activeChannel: channel } },
      InStockSearchProbe: { status: 400, errors: [{ message: 'Field "inStock" is not defined by type "SearchInput".', extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }] },
    });
    expect((await channelOf(nextServer(), undefined)).searchesByStock).toBe(false);
  });

  it('keeps a failed read for a short while, logged once, then asks again', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const api = fakeShopApi({ ActiveChannel: { status: 503 }, InStockSearchProbe: { status: 503 } });
    const url = nextServer();
    await expect(channelOf(url, undefined)).rejects.toThrow();
    await expect(channelOf(url, undefined)).rejects.toThrow();
    expect(api.calls).toHaveLength(2);
    expect(warn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(31 * 1000);
    await expect(channelOf(url, undefined)).rejects.toThrow();
    expect(api.calls).toHaveLength(4);
  });

  it('reads each channel of a server apart', async () => {
    const api = fakeShopApi({ ActiveChannel: { data: { activeChannel: channel } }, InStockSearchProbe: { data: { search: { totalItems: 0 } } } });
    const url = nextServer();
    await channelOf(url, 'a');
    await channelOf(url, 'b');
    expect(api.calls.filter((call) => call.operation === 'ActiveChannel').map((call) => call.headers['vendure-token'])).toEqual(['a', 'b']);
  });
});
