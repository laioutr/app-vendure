import { describe, expect, it } from 'vitest';
import { channelLocales, entityOfRow, versionOf } from './entities';
import { PRODUCT, PRODUCT_OPTION_GROUP } from './kinds';
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

  it("answers a copied original as no translation, except a slug, which is the language's address", async () => {
    const entity = await entityOfRow(PRODUCT, product({ name: 'Stuhl', slug: 'chair', description: '<p>Comfortable</p>' }), languages);
    expect(entity).toMatchObject({ translations: { de: { name: 'Stuhl', slug: 'chair' } } });
    expect((entity as { translations: Record<string, object> }).translations.de).not.toHaveProperty('description');
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
      translations: { de: { name: 'Größe', options: [{ id: 'o1', name: 'Klein' }] } },
    });
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
