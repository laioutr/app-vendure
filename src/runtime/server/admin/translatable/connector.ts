import { withCanonical } from './canonical';
import { channelLocales, entityOfRow, kindSchema } from './entities';
import { countOf, idsPage, rowsByIds } from './pages';
import { writeTranslations } from './write';
import { SourceEntityConnectorError, SourceEntityErrorCode } from '@laioutr-core/core-types/source-entity';
import type { VendureContext } from '../../middleware/vendureContext';
import type { CanonicalRead } from './canonical';
import type { TranslatableRow } from './documents';
import type { TranslatableKind } from './kinds';
import type { ConnectorSourceEntity, SourceEntityConnector, SourceEntitySkipped } from '@laioutr-core/core-types/source-entity';
import { MAX_PAGE_SIZE } from '../../const';

/** Half the largest list the app reads, as each row carries every language's texts. */
const MAX_SOURCE_PAGE_SIZE = MAX_PAGE_SIZE / 2;
const MAX_WRITE_BATCH = 25;

/** The module registers no source entity without the Admin API, so this answers only a server whose settings went missing since its build. */
export const sourceEntityClientOf = (context: VendureContext) => {
  if (!context.adminClient)
    throw new SourceEntityConnectorError(SourceEntityErrorCode.unsupported, 'The Vendure Admin API URL and key are not set');
  return context.adminClient;
};

const channelOf = (context: VendureContext) => {
  if (!context.channel)
    throw new SourceEntityConnectorError(SourceEntityErrorCode.failed, "The channel's languages could not be read from the Shop API");
  return context.channel;
};

/** Rows as entities in the order of `ids`, each failure of a row costing only that row. */
const toEntities = async (
  kind: TranslatableKind,
  ids: readonly string[],
  rows: readonly TranslatableRow[],
  defaultLanguage: string,
  locales: readonly string[]
) => {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const entities: ConnectorSourceEntity[] = [];
  const skipped: SourceEntitySkipped[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) continue;
    try {
      const entity = await entityOfRow(kind, row, { defaultLanguage, locales });
      if ('skipped' in entity) skipped.push({ id, message: entity.skipped });
      else entities.push(entity);
    } catch (error) {
      skipped.push({ id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { entities, skipped };
};

/**
 * A source entity over one Vendure entity type, read and written through the Admin API: its texts
 * in the channel's default language are the originals, and its other languages the translations.
 * `canonical` reads the storefront entity of a type the storefront shows.
 */
export const translatableEntity = (
  kind: TranslatableKind,
  canonical?: CanonicalRead
): Omit<SourceEntityConnector<VendureContext>, 'type'> => {
  const withStorefront = async (entities: ConnectorSourceEntity[], context: VendureContext) =>
    canonical ? withCanonical(entities, kind.type, context, canonical) : entities;

  return {
    label: kind.label,
    capabilities: { count: true, maxPageSize: MAX_SOURCE_PAGE_SIZE, changedSince: true, write: { maxBatchSize: MAX_WRITE_BATCH } },
    describe: async (context) => ({ schema: kindSchema(kind), locales: channelLocales(channelOf(context)) }),
    count: async (context) => ({ count: await countOf(sourceEntityClientOf(context), kind), exact: true }),
    list: async ({ cursor, limit, locales, changedSince }, context) => {
      const client = sourceEntityClientOf(context);
      const { defaultLanguageCode } = channelOf(context);
      const page = await idsPage(client, kind, { cursor, limit, changedSince });
      const { entities, skipped } = await toEntities(kind, page.ids, await rowsByIds(client, kind, page.ids), defaultLanguageCode, locales);
      return {
        entities: await withStorefront(entities, context),
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
        ...(skipped.length ? { skipped } : {}),
      };
    },
    read: async ({ ids, locales }, context) => {
      const client = sourceEntityClientOf(context);
      const rows = await rowsByIds(client, kind, ids);
      const { entities, skipped } = await toEntities(kind, ids, rows, channelOf(context).defaultLanguageCode, locales);
      const found = new Set(rows.map((row) => row.id));
      return {
        entities: await withStorefront(entities, context),
        missing: ids.filter((id) => !found.has(id)),
        ...(skipped.length ? { skipped } : {}),
      };
    },
    write: async (args, context) => writeTranslations(sourceEntityClientOf(context), kind, args),
  };
};
