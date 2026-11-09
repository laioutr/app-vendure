import { idsQuery, rowsQuery } from './documents';
import { SourceEntityConnectorError, SourceEntityErrorCode } from '@laioutr-core/core-types/source-entity';
import type { VendureClient } from '../../client/VendureClient';
import type { ListOptions, TranslatableRow } from './documents';
import type { TranslatableKind } from './kinds';

/** Where a walk stands: how many ids came before, and the last one answered. */
interface Cursor {
  skip: number;
  lastId: string;
}

export const encodeCursor = (cursor: Cursor): string => `${cursor.skip}:${cursor.lastId}`;

export const decodeCursor = (value: string): Cursor => {
  const match = /^(\d+):(.+)$/.exec(value);
  if (!match) throw new SourceEntityConnectorError(SourceEntityErrorCode.invalid, 'Unknown cursor');
  return { skip: Number(match[1]), lastId: match[2]! };
};

/**
 * Vendure's ids are numbers by default and strings of one length with its UUID strategy; both sort
 * this way in its database.
 */
export const compareIds = (a: string, b: string): number => {
  const numeric = /^\d+$/.test(a) && /^\d+$/.test(b);
  if (numeric && a.length !== b.length) return a.length - b.length;
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

/**
 * Vendure's DateOperators compare strictly, and some databases keep whole seconds: the moment is cut
 * to its second and the comparison opened by a millisecond, so an entity changed in that second is in.
 */
export const changedSinceFilter = (since: string) => ({
  updatedAt: { after: new Date(Math.floor(new Date(since).getTime() / 1000) * 1000 - 1).toISOString() },
});

export interface IdsPage {
  ids: string[];
  nextCursor?: string;
}

/**
 * One page of ids in id order. The Admin API pages by offset only, so the cursor keeps the last id as
 * well: the next page reads from a page earlier than the offset and starts after that id, so up to a
 * page of entities deleted in between moves nothing past it, and an edit moves nothing at all. More
 * deletions than that between two pages can skip entities, which a later full read finds.
 */
export const idsPage = async (
  client: VendureClient,
  kind: TranslatableKind,
  { cursor, limit, changedSince }: { cursor?: string; limit: number; changedSince?: string }
): Promise<IdsPage> => {
  const at = cursor ? decodeCursor(cursor) : undefined;
  const start = at ? Math.max(0, at.skip - limit) : 0;
  const options: ListOptions = {
    skip: start,
    take: at ? at.skip - start + limit : limit,
    sort: { id: 'ASC' },
    ...(changedSince ? { filter: changedSinceFilter(changedSince) } : {}),
  };
  const { list } = await client.request(idsQuery(kind), { options });
  const window = list.items.map((item) => item.id);

  const after = at ? window.filter((id) => compareIds(id, at.lastId) > 0) : window;
  if (at && start > 0 && window.length && after.length === window.length) {
    console.warn(
      `[vendure] ${kind.type}: more than ${limit} entities were deleted while listing; a later full read finds any this page skipped.`
    );
  }
  const ids = after.slice(0, limit);
  const lastId = ids.at(-1) ?? at?.lastId;
  const read = ids.length ? start + window.indexOf(ids.at(-1)!) + 1 : start + window.length;
  const more = lastId !== undefined && (after.length > ids.length || start + window.length < list.totalItems);
  return { ids, ...(more ? { nextCursor: encodeCursor({ skip: read, lastId }) } : {}) };
};

/** The rows `ids` names, in one request; ids Vendure does not know are left out. */
export const rowsByIds = async (client: VendureClient, kind: TranslatableKind, ids: readonly string[]): Promise<TranslatableRow[]> => {
  if (ids.length === 0) return [];
  const { list } = await client.request(rowsQuery(kind), { options: { filter: { id: { in: [...ids] } }, take: ids.length } });
  return list.items;
};

/** Vendure answers its whole count with any page; one id is the smallest it serves. */
export const countOf = async (client: VendureClient, kind: TranslatableKind): Promise<number> =>
  (await client.request(idsQuery(kind), { options: { take: 1 } })).list.totalItems;
