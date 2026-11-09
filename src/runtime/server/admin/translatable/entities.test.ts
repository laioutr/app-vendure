import { describe, expect, it } from 'vitest';
import { channelLocales, entityOfRow, versionOf } from './entities';
import { FACET, FACET_VALUE, PRODUCT, PRODUCT_OPTION_GROUP } from './kinds';
import type { TranslatableRow } from './documents';

const languages = { defaultLanguage: 'en', locales: ['de'] };

const product = (de?: Record<string, string>): TranslatableRow => ({
  id: '1',
  translations: [
    { languageCode: 'en', name: 'Chair', slug: 'chair', description: '<p>Comfortable</p>' },
    ...(de ? [{ languageCode: 'de', ...de }] : []),
  ],
});

describe('entityOfRow', () => {
  it('answers the default language as the originals and another language as its translations', async () => {
    const entity = await entityOfRow(PRODUCT, product({ name: 'Stuhl', slug: 'stuhl', description: '<p>Bequem</p>' }), languages);
    expect(entity).toMatchObject({
      id: '1',
      label: 'Chair',
      data: { name: 'Chair', slug: 'chair', description: '<p>Comfortable</p>' },
      translations: { de: { name: 'Stuhl', slug: 'stuhl', description: '<p>Bequem</p>' } },
    });
  });

  it('answers every value a language holds, one equal to its original too, and an empty one as none', async () => {
    const entity = await entityOfRow(PRODUCT, product({ name: 'Chair', slug: 'chair', description: '' }), languages);
    expect((entity as { translations: Record<string, object> }).translations.de).toEqual({ name: 'Chair', slug: 'chair' });
  });

  it('answers a row written with some texts as holding only those, whatever the originals became since', async () => {
    const row = product({ name: 'Stuhl', slug: 'stuhl', description: '' });
    row.translations[0]!.description = '<p>Comfortable and new</p>';
    expect(await entityOfRow(PRODUCT, row, languages)).toMatchObject({ translations: { de: { name: 'Stuhl', slug: 'stuhl' } } });
    expect(((await entityOfRow(PRODUCT, row, languages)) as { translations: Record<string, object> }).translations.de).not.toHaveProperty(
      'description'
    );
  });

  it('leaves an empty original out of the data', async () => {
    const row: TranslatableRow = { id: '1', translations: [{ languageCode: 'en', name: 'Chair', slug: 'chair', description: '' }] };
    expect(await entityOfRow(PRODUCT, row, languages)).toMatchObject({ data: { name: 'Chair', slug: 'chair' } });
    expect(((await entityOfRow(PRODUCT, row, languages)) as { data: object }).data).not.toHaveProperty('description');
  });

  it('skips a private facet and its values, which the storefront never shows', async () => {
    const facet: TranslatableRow = { id: '1', isPrivate: true, translations: [{ languageCode: 'en', name: 'Internal' }] };
    expect(await entityOfRow(FACET, facet, languages)).toEqual({ skipped: expect.stringContaining('private') });
    expect(await entityOfRow(FACET, { ...facet, isPrivate: false }, languages)).toMatchObject({ id: '1' });
    const value: TranslatableRow = { id: '2', facet: { isPrivate: true }, translations: [{ languageCode: 'en', name: 'Hidden' }] };
    expect(await entityOfRow(FACET_VALUE, value, languages)).toEqual({ skipped: expect.stringContaining('private') });
  });

  it('answers an empty language for one without a row, and none when no language was asked', async () => {
    expect(await entityOfRow(PRODUCT, product(), languages)).toMatchObject({ translations: { de: {} } });
    expect(await entityOfRow(PRODUCT, product(), { defaultLanguage: 'en', locales: [] })).not.toHaveProperty('translations');
  });

  it('skips an entity without a text in the default language', async () => {
    expect(
      await entityOfRow(
        PRODUCT,
        { id: '9', translations: [{ languageCode: 'de', name: 'Nur Deutsch', slug: 'x', description: '' }] },
        languages
      )
    ).toEqual({
      skipped: expect.stringContaining('"en"'),
    });
  });

  it('carries the items of a group by id, each translated on its own', async () => {
    const row: TranslatableRow = {
      id: 'g1',
      translations: [
        { languageCode: 'en', name: 'Size' },
        { languageCode: 'de', name: 'Größe' },
      ],
      items: [
        {
          id: 'o1',
          translations: [
            { languageCode: 'en', name: 'Small' },
            { languageCode: 'de', name: 'Klein' },
          ],
        },
        {
          id: 'o2',
          translations: [
            { languageCode: 'en', name: 'XL' },
            { languageCode: 'de', name: 'XL' },
          ],
        },
      ],
    };
    expect(await entityOfRow(PRODUCT_OPTION_GROUP, row, languages)).toMatchObject({
      data: {
        name: 'Size',
        options: [
          { id: 'o1', name: 'Small' },
          { id: 'o2', name: 'XL' },
        ],
      },
      translations: {
        de: {
          name: 'Größe',
          options: [
            { id: 'o1', name: 'Klein' },
            { id: 'o2', name: 'XL' },
          ],
        },
      },
    });
  });

  it("orders a group's items by id, so the order Vendure answers them in moves no version", async () => {
    const group = (order: string[]): TranslatableRow => ({
      id: 'g1',
      translations: [{ languageCode: 'en', name: 'Size' }],
      items: order.map((id) => ({ id, translations: [{ languageCode: 'en', name: `Option ${id}` }] })),
    });
    const sorted = await entityOfRow(PRODUCT_OPTION_GROUP, group(['2', '10', '1']), languages);
    expect(((sorted as { data: Record<string, unknown> }).data.options as { id: string }[]).map((option) => option.id)).toEqual([
      '1',
      '2',
      '10',
    ]);
    expect((sorted as { version: string }).version).toBe(
      ((await entityOfRow(PRODUCT_OPTION_GROUP, group(['1', '2', '10']), languages)) as { version: string }).version
    );
  });
});

describe('versionOf', () => {
  it('changes with an original and only with it', async () => {
    const before = await entityOfRow(PRODUCT, product(), languages);
    const translated = await entityOfRow(PRODUCT, product({ name: 'Stuhl', slug: 'stuhl', description: 'x' }), languages);
    expect((translated as { version: string }).version).toBe((before as { version: string }).version);
    expect(await versionOf({ name: 'Chair!' })).not.toBe(await versionOf({ name: 'Chair' }));
  });
});

describe('channelLocales', () => {
  it('makes the default language the primary one, the only one not written', () => {
    expect(channelLocales({ defaultLanguageCode: 'en', availableLanguageCodes: ['de', 'en'] })).toEqual([
      { code: 'en', label: 'English', primary: true, writable: false },
      { code: 'de', label: 'German', primary: false, writable: true },
    ]);
  });
});
