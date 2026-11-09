import { afterEach, describe, expect, it, vi } from 'vitest';
import { vendureContext } from './vendureContext';
import { fakeShopApi } from '../../../../test/fixtures/fakeShopApi';

let server = 0;
const settings = (overrides: { languageCode?: string } = {}) => ({
  shopApiUrl: `https://context${++server}.example.com/shop-api`,
  ...overrides,
});

const channelAnswer = {
  data: {
    activeChannel: {
      code: 'default',
      defaultLanguageCode: 'en',
      availableLanguageCodes: ['en', 'de', 'pt_BR'],
      defaultCurrencyCode: 'USD',
      availableCurrencyCodes: ['USD', 'EUR'],
    },
  },
};

const request = (overrides: Partial<Parameters<typeof vendureContext>[1]> = {}) => ({
  market: { slug: 'germany', currency: 'EUR' },
  localeChain: ['de-DE', 'de'],
  onSessionToken: () => {},
  ...overrides,
});

const searchedWith = (api: ReturnType<typeof fakeShopApi>) => new URL(api.calls.at(-1)!.url).searchParams;

describe('vendureContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("asks in the visitor's language and the market's currency when the channel offers them", async () => {
    const api = fakeShopApi({
      ActiveChannel: channelAnswer,
      InStockSearchProbe: { data: { search: { totalItems: 1 } } },
      ActiveOrder: { data: { activeOrder: null } },
    });
    const context = await vendureContext(settings(), request({ sessionToken: 'visitor' }));
    expect(context).toMatchObject({ currencyCode: 'EUR', searchesByStock: true });

    await context.vendureClient.request((await import('../client/operations')).operations.activeOrder);
    expect(Object.fromEntries(searchedWith(api))).toEqual({ languageCode: 'de', currencyCode: 'EUR' });
    expect(api.calls.at(-1)!.headers.Authorization).toBe('Bearer visitor');
  });

  it("falls back to the channel's default currency and language, warning once per server and market", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fakeShopApi({ ActiveChannel: channelAnswer, InStockSearchProbe: { data: { search: { totalItems: 1 } } } });
    const shop = settings();
    const swiss = request({ market: { slug: 'switzerland', currency: 'CHF' }, localeChain: ['fr-CH', 'fr'] });

    const context = await vendureContext(shop, swiss);
    await vendureContext(shop, swiss);
    expect(context.currencyCode).toBe('USD');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/"switzerland".*"CHF".*"USD"/));
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/"switzerland".*"fr-CH".*"en"/));
  });

  it('sends a configured language only when the channel offers it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const api = fakeShopApi({
      ActiveChannel: channelAnswer,
      InStockSearchProbe: { data: { search: { totalItems: 1 } } },
      ActiveOrder: { data: { activeOrder: null } },
    });
    const { operations } = await import('../client/operations');

    await (await vendureContext(settings({ languageCode: 'pt_BR' }), request())).vendureClient.request(operations.activeOrder);
    expect(searchedWith(api).get('languageCode')).toBe('pt_BR');
    await (await vendureContext(settings({ languageCode: 'it' }), request())).vendureClient.request(operations.activeOrder);
    expect(searchedWith(api).get('languageCode')).toBe('en');
  });

  it("reads the catalog without the visitor's session", async () => {
    const api = fakeShopApi({
      ActiveChannel: channelAnswer,
      InStockSearchProbe: { data: { search: { totalItems: 1 } } },
      ProductBySlug: { data: { product: null } },
    });
    const { operations } = await import('../client/operations');
    const onSessionToken = vi.fn();
    const context = await vendureContext(settings(), request({ sessionToken: 'visitor', onSessionToken }));
    await context.catalogClient.request(operations.productBySlug, { slug: 'x' });
    expect(api.calls.at(-1)!.headers.Authorization).toBeUndefined();
    expect(onSessionToken).not.toHaveBeenCalled();
  });

  it('serves without a channel, sending no language or currency and offering no stock filter', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const api = fakeShopApi({
      ActiveChannel: { status: 503 },
      InStockSearchProbe: { status: 503 },
      ActiveOrder: { data: { activeOrder: null } },
    });
    const context = await vendureContext(settings(), request());
    expect(context).toMatchObject({ currencyCode: 'EUR', searchesByStock: false });
    await context.vendureClient.request((await import('../client/operations')).operations.activeOrder);
    expect([...searchedWith(api)]).toEqual([]);
  });

  it('opens the Admin API only with both its address and its key', async () => {
    fakeShopApi({ ActiveChannel: channelAnswer, InStockSearchProbe: { data: { search: { totalItems: 1 } } } });
    const admin = { adminApiUrl: 'https://shop.example.com/admin-api', adminApiKey: 'secret' };
    expect((await vendureContext({ ...settings(), ...admin }, request())).adminClient).toBeDefined();
    expect((await vendureContext({ ...settings(), adminApiUrl: admin.adminApiUrl }, request())).adminClient).toBeUndefined();
    expect((await vendureContext({ ...settings(), adminApiKey: admin.adminApiKey }, request())).adminClient).toBeUndefined();
  });

  it('refuses to run without a Shop API address', async () => {
    await expect(vendureContext({}, request())).rejects.toThrow('shopApiUrl');
  });
});
