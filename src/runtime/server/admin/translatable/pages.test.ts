import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT, PRODUCT_OPTION_GROUP } from './kinds';
import { changedSinceFilter, compareIds, countOf, decodeCursor, idsPage } from './pages';
import type { FakeCall } from '../../../../../test/fixtures/fakeShopApi';
import { fakeShopApi } from '../../../../../test/fixtures/fakeShopApi';
import { VendureClient } from '../../client/VendureClient';

const admin = () => new VendureClient({ apiUrl: 'https://shop.example.com/admin-api', apiKey: 'key' });

/** An Admin API holding `ids` in id order, answering a list page as Vendure does. */
const listing = (ids: () => string[]) => (call: FakeCall) => {
  const options = call.variables!.options as { skip?: number; take: number };
  const all = ids();
  const skip = options.skip ?? 0;
  return { data: { list: { totalItems: all.length, items: all.slice(skip, skip + options.take).map((id) => ({ id })) } } };
};

const walk = async (client: VendureClient, limit: number, between: (page: number) => void = () => {}) => {
  const seen: string[] = [];
  let cursor: string | undefined;
  let page = 0;
  do {
    const answer = await idsPage(client, PRODUCT, { cursor, limit });
    seen.push(...answer.ids);
    cursor = answer.nextCursor;
    between(++page);
  } while (cursor);
  return seen;
};

describe('idsPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('walks every id once, in id order', async () => {
    const ids = Array.from({ length: 23 }, (_, index) => String(index + 1));
    fakeShopApi({ VendureTranslatables: listing(() => ids) });
    expect(await walk(admin(), 5)).toEqual(ids);
  });

  it('skips nothing when entities before the cursor are deleted between two pages', async () => {
    let ids = Array.from({ length: 20 }, (_, index) => String(index + 1));
    fakeShopApi({ VendureTranslatables: listing(() => ids) });
    const seen = await walk(admin(), 5, (page) => {
      if (page === 2) ids = ids.filter((id) => !['2', '3', '7'].includes(id));
    });
    // Pages 1 and 2 answered 1–10 before three of them went; an offset alone would start page 3 at 14.
    expect(seen).toEqual(Array.from({ length: 20 }, (_, index) => String(index + 1)));
  });

  it('sorts by id and filters by the moment of change, opened to the whole second', async () => {
    const api = fakeShopApi({ VendureTranslatables: listing(() => ['1']) });
    await idsPage(admin(), PRODUCT, { limit: 5, changedSince: '2026-11-09T10:00:00.750Z' });
    expect(api.calls[0]!.variables!.options).toEqual({
      skip: 0,
      take: 5,
      sort: { id: 'ASC' },
      filter: { updatedAt: { after: '2026-11-09T09:59:59.999Z' } },
    });
    expect(api.calls[0]!.headers['vendure-api-key']).toBe('key');
  });

  it("finds a group whose option changed, though the option's change leaves the group's moment, in one more request", async () => {
    const api = fakeShopApi({
      VendureChangedItems: { data: { list: { totalItems: 2, items: [{ parent: '3' }, { parent: '3' }] } } },
      VendureTranslatables: listing(() => ['1', '3']),
    });
    await idsPage(admin(), PRODUCT_OPTION_GROUP, { limit: 5, changedSince: '2026-11-09T10:00:00.000Z' });
    expect(api.operations()).toEqual(['VendureChangedItems', 'VendureTranslatables']);
    expect(api.calls[0]!.query).toContain('productOptions(options: $options)');
    expect(api.calls[0]!.variables!.options).toEqual({ take: 100, filter: { updatedAt: { after: '2026-11-09T09:59:59.999Z' } } });
    expect((api.calls[1]!.variables!.options as { filter: unknown }).filter).toEqual({
      _or: [{ updatedAt: { after: '2026-11-09T09:59:59.999Z' } }, { id: { in: ['3'] } }],
    });
  });

  it('lists every group when more options changed than one request answers', async () => {
    const api = fakeShopApi({
      VendureChangedItems: { data: { list: { totalItems: 101, items: Array.from({ length: 100 }, () => ({ parent: '3' })) } } },
      VendureTranslatables: listing(() => ['1', '3']),
    });
    const page = await idsPage(admin(), PRODUCT_OPTION_GROUP, { limit: 5, changedSince: '2026-11-09T10:00:00.000Z' });
    expect(page.ids).toEqual(['1', '3']);
    expect(api.calls[1]!.variables!.options).not.toHaveProperty('filter');
  });

  it('refuses a cursor it did not make', () => {
    expect(() => decodeCursor('nonsense')).toThrow('Unknown cursor');
  });
});

describe('compareIds', () => {
  it('orders numeric ids by number and others as strings', () => {
    expect(['10', '9', '100'].sort(compareIds)).toEqual(['9', '10', '100']);
    expect(['b0', 'a1'].sort(compareIds)).toEqual(['a1', 'b0']);
  });
});

describe('changedSinceFilter', () => {
  it('includes the second the moment falls in', () => {
    expect(changedSinceFilter('2026-11-09T10:00:00.000Z')).toEqual({ updatedAt: { after: '2026-11-09T09:59:59.999Z' } });
  });
});

describe('countOf', () => {
  it('reads the count with one id, never a page of zero, which Vendure answers in full', async () => {
    const api = fakeShopApi({ VendureTranslatables: { data: { list: { totalItems: 54, items: [{ id: '1' }] } } } });
    expect(await countOf(admin(), PRODUCT)).toBe(54);
    expect(api.calls[0]!.variables!.options).toEqual({ take: 1 });
  });
});
