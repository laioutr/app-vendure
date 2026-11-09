import { afterEach, describe, expect, it, vi } from 'vitest';
import { versionOf } from './entities';
import { PRODUCT, PRODUCT_OPTION_GROUP } from './kinds';
import { writeTranslations } from './write';
import type { FakeAnswer, FakeCall } from '../../../../../test/fixtures/fakeShopApi';
import type { TranslatableRow } from './documents';
import { fakeShopApi } from '../../../../../test/fixtures/fakeShopApi';
import { VendureClient } from '../../client/VendureClient';

const admin = () => new VendureClient({ apiUrl: 'https://shop.example.com/admin-api', apiKey: 'key' });

const chair: TranslatableRow = {
  id: '1',
  translations: [
    { languageCode: 'en', name: 'Chair', slug: 'chair', description: '<p>Comfortable</p>' },
    { languageCode: 'de', name: 'Stuhl', slug: 'stuhl', description: '<p>Bequem</p>' },
  ],
};
const table: TranslatableRow = {
  id: '2',
  translations: [{ languageCode: 'en', name: 'Table', slug: 'table', description: '<p>Sturdy</p>' }],
};
const chairData = { name: 'Chair', slug: 'chair', description: '<p>Comfortable</p>' };

const set = (index: number, path: (string | [string, string])[], value: string, locale = 'de') => ({
  op: 'set' as const,
  index,
  path,
  locale,
  value,
});

const updatesIn = (call: FakeCall) => Object.values(call.variables ?? {});

const adminApi = (rows: TranslatableRow[], updates: (call: FakeCall) => FakeAnswer = () => ({ data: {} }), defaultLanguage = 'en') =>
  fakeShopApi({
    VendureTranslatablesToWrite: (call) => {
      const ids = (call.variables!.options as { filter: { id: { in: string[] } } }).filter.id.in ?? [];
      return {
        data: {
          channel: { defaultLanguageCode: defaultLanguage },
          list: { totalItems: rows.length, items: rows.filter((row) => ids.includes(row.id)) },
        },
      };
    },
    VendureTranslationUpdates: updates,
  });

const remove = (index: number, path: string[], locale = 'de') => ({ op: 'remove' as const, index, path, locale });

describe('writeTranslations', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads every entity in one request and writes every update in one more', async () => {
    const api = adminApi([chair, table]);
    const results = await writeTranslations(admin(), PRODUCT, {
      entities: [
        { id: '1', operations: [set(0, ['name'], 'Sessel')] },
        { id: '2', operations: [set(0, ['name'], 'Tisch'), set(1, ['slug'], 'tisch')] },
      ],
    });
    expect(api.operations()).toEqual(['VendureTranslatablesToWrite', 'VendureTranslationUpdates']);
    expect(results).toEqual([
      { id: '1', version: await versionOf(chairData), failed: [] },
      { id: '2', version: expect.any(String), failed: [] },
    ]);
    expect(updatesIn(api.calls[1]!)).toEqual([
      { id: '1', translations: [{ languageCode: 'de', name: 'Sessel' }] },
      // No German row yet: it holds what is written, and the optional description empty, never the original.
      { id: '2', translations: [{ languageCode: 'de', description: '', name: 'Tisch', slug: 'tisch' }] },
    ]);
  });

  it('writes nothing for an entity changed since it was read, or unknown', async () => {
    const api = adminApi([chair]);
    const results = await writeTranslations(admin(), PRODUCT, {
      entities: [
        { id: '1', ifVersion: 'old', operations: [set(0, ['name'], 'Sessel')] },
        { id: '7', operations: [set(0, ['name'], 'X')] },
      ],
    });
    expect(results).toEqual([
      { id: '1', error: expect.objectContaining({ code: 'stale' }) },
      { id: '7', error: expect.objectContaining({ code: 'not_found' }) },
    ]);
    expect(api.operations()).toEqual(['VendureTranslatablesToWrite']);
  });

  it('refuses a write that would create a row without every required text, and writes nothing for it', async () => {
    const api = adminApi([chair, table]);
    const results = await writeTranslations(admin(), PRODUCT, {
      entities: [
        { id: '2', operations: [set(0, ['name'], 'Tisch')] },
        { id: '1', operations: [set(0, ['name'], 'Sessel')] },
      ],
    });
    expect(results[0]).toEqual({
      id: '2',
      error: { code: 'invalid', message: expect.stringContaining('this write has no slug') },
    });
    expect(results[1]).toMatchObject({ id: '1', failed: [] });
    expect(updatesIn(api.calls[1]!)).toEqual([{ id: '1', translations: [{ languageCode: 'de', name: 'Sessel' }] }]);
  });

  it('empties a removed optional text, refuses a removed or emptied required one, and removes nothing from a missing row', async () => {
    const api = adminApi([chair, table]);
    const results = await writeTranslations(admin(), PRODUCT, {
      entities: [
        { id: '1', operations: [remove(0, ['description'])] },
        { id: '2', operations: [remove(0, ['description'])] },
      ],
    });
    expect(results).toEqual([
      { id: '1', version: expect.any(String), failed: [] },
      { id: '2', version: expect.any(String), failed: [] },
    ]);
    expect(updatesIn(api.calls[1]!)).toEqual([{ id: '1', translations: [{ languageCode: 'de', description: '' }] }]);

    const refused = await writeTranslations(admin(), PRODUCT, {
      entities: [
        { id: '1', operations: [remove(0, ['slug'])] },
        { id: '1', operations: [set(0, ['name'], '')] },
      ],
    });
    expect(refused).toEqual([
      { id: '1', error: { code: 'unsupported', message: expect.stringContaining('cannot remove the slug') } },
      { id: '1', error: { code: 'invalid', message: expect.stringContaining('name') } },
    ]);
    expect(api.operations().slice(2)).toEqual(['VendureTranslatablesToWrite']);
  });

  it("refuses the channel's default language as Vendure answers it at the write, not as described before", async () => {
    const api = adminApi([chair], undefined, 'de');
    const [result] = await writeTranslations(admin(), PRODUCT, { entities: [{ id: '1', operations: [set(0, ['name'], 'Sessel')] }] });
    expect(result).toMatchObject({ failed: [{ index: 0, error: { code: 'read_only' } }] });
    expect(api.operations()).toEqual(['VendureTranslatablesToWrite']);
  });

  it('fails a path with no text, and writes the rest', async () => {
    adminApi([chair]);
    const [result] = await writeTranslations(admin(), PRODUCT, {
      entities: [{ id: '1', operations: [set(0, ['price'], '1'), set(1, ['name'], 'Sessel')] }],
    });
    expect(result).toMatchObject({ failed: [{ index: 0, error: { code: 'not_found' } }] });
  });

  it('writes an item through its own update, refusing an item the entity does not hold', async () => {
    const group: TranslatableRow = {
      id: 'g',
      translations: [{ languageCode: 'en', name: 'Size' }],
      items: [{ id: 'o1', translations: [{ languageCode: 'en', name: 'Small' }] }],
    };
    const api = adminApi([group]);
    const [result] = await writeTranslations(admin(), PRODUCT_OPTION_GROUP, {
      entities: [
        {
          id: 'g',
          operations: [set(0, [['options', 'o1'], 'name'], 'Klein'), set(1, [['options', 'o9'], 'name'], 'X'), set(2, ['name'], 'Größe')],
        },
      ],
    });
    expect(result).toMatchObject({ failed: [{ index: 1, error: { code: 'not_found' } }] });
    expect(api.calls[1]!.query).toContain('a0: updateProductOption(input: $a0)');
    expect(api.calls[1]!.query).toContain('a1: updateProductOptionGroup(input: $a1)');
    expect(updatesIn(api.calls[1]!)).toEqual([
      { id: 'o1', translations: [{ languageCode: 'de', name: 'Klein' }] },
      { id: 'g', translations: [{ languageCode: 'de', name: 'Größe' }] },
    ]);
  });

  it('reports a failed update on its entity alone and sends the updates Vendure did not reach again', async () => {
    let round = 0;
    const api = adminApi([chair, { ...chair, id: '1b' }], () =>
      ++round === 1 ?
        { data: null, errors: [{ message: 'slug taken', path: ['a0'], extensions: { code: 'USER_INPUT_ERROR' } }] }
      : { data: {} }
    );
    const results = await writeTranslations(admin(), PRODUCT, {
      entities: [
        { id: '1', operations: [set(0, ['name'], 'Sessel')] },
        { id: '1b', operations: [set(0, ['name'], 'Tisch')] },
      ],
    });
    expect(results[0]).toMatchObject({ failed: [{ index: 0, error: { code: 'failed', message: 'slug taken' } }] });
    expect(results[1]).toMatchObject({ failed: [] });
    expect(api.operations()).toEqual(['VendureTranslatablesToWrite', 'VendureTranslationUpdates', 'VendureTranslationUpdates']);
    expect(updatesIn(api.calls[2]!)).toEqual([{ id: '1b', translations: [{ languageCode: 'de', name: 'Tisch' }] }]);
  });

  it("fails every update at once when the key's role may not run them, in one request", async () => {
    const api = adminApi([chair, { ...chair, id: '1b' }, { ...chair, id: '1c' }], () => ({
      data: null,
      errors: [{ message: 'You are not currently authorized to perform this action', path: ['a0'], extensions: { code: 'FORBIDDEN' } }],
    }));
    const results = await writeTranslations(admin(), PRODUCT, {
      entities: ['1', '1b', '1c'].map((id) => ({ id, operations: [set(0, ['name'], 'Sessel')] })),
    });
    expect(results.map((result) => ('failed' in result ? result.failed[0]?.error.code : undefined))).toEqual([
      'read_only',
      'read_only',
      'read_only',
    ]);
    expect(api.operations()).toEqual(['VendureTranslatablesToWrite', 'VendureTranslationUpdates']);
  });

  it('never throws once something may be written: a failed request fails each operation it carried', async () => {
    adminApi([chair], () => ({ status: 502 }));
    const [result] = await writeTranslations(admin(), PRODUCT, { entities: [{ id: '1', operations: [set(0, ['name'], 'Sessel')] }] });
    expect(result).toMatchObject({ failed: [{ index: 0, error: { code: 'failed' } }] });
  });
});
