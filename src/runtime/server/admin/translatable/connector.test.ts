import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalComponents, withCanonical } from './canonical';
import { translatableEntity } from './connector';
import { PRODUCT } from './kinds';
import type { VendureContext } from '../../middleware/vendureContext';
import { fakeShopApi } from '../../../../../test/fixtures/fakeShopApi';
import { VendureClient } from '../../client/VendureClient';

const channel = { defaultLanguageCode: 'en', availableLanguageCodes: ['en', 'de'] };
const context = (overrides: Partial<VendureContext> = {}) =>
  ({
    adminClient: new VendureClient({ apiUrl: 'https://shop.example.com/admin-api', apiKey: 'key' }),
    channel,
    ...overrides,
  }) as VendureContext;

const rows = [
  { id: '1', translations: [{ languageCode: 'en', name: 'Chair', slug: 'chair', description: '' }] },
  { id: '2', translations: [{ languageCode: 'de', name: 'Nur Deutsch', slug: 'x', description: '' }] },
  { id: '3', translations: [{ languageCode: 'en', name: 'Table', slug: 'table', description: '' }] },
];

const adminApi = () =>
  fakeShopApi({
    VendureTranslatables: (call) => {
      const options = call.variables!.options as { filter?: { id?: { in: string[] } }; take: number };
      const items =
        options.filter?.id ?
          rows.filter((row) => options.filter!.id!.in.includes(row.id))
        : rows.slice(0, options.take).map(({ id }) => ({ id }));
      return { data: { list: { totalItems: rows.length, items } } };
    },
  });

describe('translatableEntity', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists a page in two requests whatever its size, skipping an entity without originals', async () => {
    const api = adminApi();
    const page = await translatableEntity(PRODUCT).list({ limit: 3, locales: [] }, context());
    expect(page.entities.map((entity) => entity.id)).toEqual(['1', '3']);
    expect(page.skipped).toEqual([{ id: '2', message: expect.stringContaining('default language') }]);
    expect(api.calls).toHaveLength(2);
  });

  it('reads by id and names the ids Vendure does not know', async () => {
    adminApi();
    const read = await translatableEntity(PRODUCT).read({ ids: ['3', '1', '8'], locales: [] }, context());
    expect(read.entities.map((entity) => entity.id)).toEqual(['3', '1']);
    expect(read.missing).toEqual(['8']);
  });

  it('refuses without the Admin API, and fails without the channel', async () => {
    await expect(translatableEntity(PRODUCT).count!(context({ adminClient: undefined }))).rejects.toMatchObject({ code: 'unsupported' });
    await expect(translatableEntity(PRODUCT).describe(context({ channel: undefined }))).rejects.toMatchObject({ code: 'failed' });
  });

  it('adds the storefront entity, null for one the storefront does not show', async () => {
    adminApi();
    const page = await translatableEntity(PRODUCT, async () => new Map([['1', { components: { base: { name: 'Chair' } } }]])).list(
      { limit: 3, locales: [] },
      context()
    );
    expect(page.entities.map((entity) => entity.canonical)).toEqual([{ components: { base: { name: 'Chair' } } }, null]);
  });
});

describe('withCanonical', () => {
  it('stores the page without storefront entities when they cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entities = [{ id: '1', version: 'v', data: {} }];
    expect(await withCanonical(entities, 'Product', context(), async () => Promise.reject(new Error('down')))).toEqual(entities);
    expect(warn).toHaveBeenCalled();
  });
});

describe('canonicalComponents', () => {
  it('computes each component, leaving out one that throws or answers nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      canonicalComponents(
        {
          base: () => ({ name: 'Chair' }),
          broken: () => {
            throw new Error('bad data');
          },
          empty: () => undefined,
          plain: { value: 1 },
        },
        'product 1'
      )
    ).toEqual({ base: { name: 'Chair' }, plain: { value: 1 } });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('broken'), expect.any(Error));
  });
});
