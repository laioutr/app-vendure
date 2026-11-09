import { updatesMutation } from './documents';
import { originalsOfRow, versionOf } from './entities';
import { rowsByIds } from './pages';
import { formatSourcePath, isSetOperation, sourceEntityError, SourceEntityErrorCode } from '@laioutr-core/core-types/source-entity';
import type { GraphQLError, VendureClient } from '../../client/VendureClient';
import type { TranslatableRow, TranslationRow, TranslationUpdate } from './documents';
import type { Translatable, TranslatableKind } from './kinds';
import type {
  IndexedSourceEntityOperation,
  SourceEntityConnectorWriteArgs,
  SourceEntityConnectorWriteResult,
  SourceEntityError,
  SourceEntityOperationFailure,
  SourceEntityPath,
  SourceEntityValues,
} from '@laioutr-core/core-types/source-entity';

/** The Vendure entity a path's text lives in — the entity itself or one of its items — and the field. */
interface Target {
  id: string;
  texts: Translatable;
  translations: readonly TranslationRow[];
  originals: SourceEntityValues;
  field: string;
}

const isField = (texts: Translatable, step: unknown): step is string =>
  typeof step === 'string' && texts.fields.some((field) => field.name === step);

export const targetOf = (
  kind: TranslatableKind,
  row: TranslatableRow,
  data: SourceEntityValues,
  path: SourceEntityPath
): Target | undefined => {
  const [first, second] = path;
  if (path.length === 1 && isField(kind, first))
    return { id: row.id, texts: kind, translations: row.translations, originals: data, field: first };
  if (kind.items && path.length === 2 && Array.isArray(first) && first[0] === kind.items.key && isField(kind.items, second)) {
    const item = row.items?.find((candidate) => candidate.id === first[1]);
    const originals = (data[kind.items.key] as SourceEntityValues[] | undefined)?.find((candidate) => candidate.id === first[1]);
    if (item && originals) return { id: item.id, texts: kind.items, translations: item.translations, originals, field: second };
  }
  return undefined;
};

/** The updates of one Vendure entity, with the operations each one carries. */
interface PlannedUpdate extends TranslationUpdate {
  entityId: string;
  operationIndexes: number[];
}

/**
 * Vendure stores a language's texts in one row and refuses a new row with a text left out, so a row
 * created here takes the originals for the texts the write does not set — what the storefront showed
 * in that language before. A removed translation goes back to the original for the same reason:
 * Vendure cannot empty one text of a row.
 */
const planUpdates = (entityId: string, targets: { target: Target; operation: IndexedSourceEntityOperation }[]): PlannedUpdate[] => {
  const byNode = new Map<string, { target: Target; rows: Map<string, TranslationRow>; operationIndexes: number[] }>();
  for (const { target, operation } of targets) {
    // Core checked the operation against describe: the default language is not writable, so a locale is set.
    const locale = operation.locale!;
    let node = byNode.get(target.id);
    if (!node) byNode.set(target.id, (node = { target, rows: new Map(), operationIndexes: [] }));
    let row = node.rows.get(locale);
    if (!row) {
      const existing = target.translations.find((candidate) => candidate.languageCode === locale);
      row = {
        languageCode: locale,
        ...(existing ?
          {}
        : Object.fromEntries(target.texts.fields.map((field) => [field.name, String(target.originals[field.name] ?? '')]))),
      };
      node.rows.set(locale, row);
    }
    row[target.field] = isSetOperation(operation) ? String(operation.value) : String(target.originals[target.field] ?? '');
    node.operationIndexes.push(operation.index);
  }
  return [...byNode.values()].map(({ target, rows, operationIndexes }) => ({
    entityId,
    texts: target.texts,
    input: { id: target.id, translations: [...rows.values()] },
    operationIndexes,
  }));
};

const failureOf = (error: GraphQLError | undefined, noun: string): SourceEntityError => {
  const code = error?.extensions?.code;
  if (code === 'FORBIDDEN')
    return sourceEntityError(SourceEntityErrorCode.readOnly, `The Admin API key's role may not update this ${noun}`);
  if (code === 'ENTITY_NOT_FOUND') return sourceEntityError(SourceEntityErrorCode.notFound, `Vendure has no such ${noun} any more`);
  return sourceEntityError(SourceEntityErrorCode.failed, error?.message ?? 'Vendure did not answer the update');
};

/**
 * Sends every update in as few requests as failures allow: one, unless an update fails, in which
 * case Vendure stops there and the rest go again in the next request.
 */
const sendUpdates = async (
  client: VendureClient,
  updates: PlannedUpdate[],
  noun: string
): Promise<Map<PlannedUpdate, SourceEntityError>> => {
  const failed = new Map<PlannedUpdate, SourceEntityError>();
  let pending = updates;
  while (pending.length) {
    const { document, variables } = updatesMutation(pending);
    let errors: GraphQLError[];
    try {
      errors = (await client.requestEach(document, variables)).errors;
    } catch (error) {
      // Whether any of them was written is unknown, so each is reported as failed.
      const failure = sourceEntityError(SourceEntityErrorCode.failed, error instanceof Error ? error.message : String(error));
      for (const update of pending) failed.set(update, failure);
      return failed;
    }
    const at = errors
      .map((error) => Number(String(error.path?.[0] ?? '').slice(1)))
      .find((index) => Number.isInteger(index) && index >= 0 && index < pending.length);
    if (at === undefined) {
      if (errors.length) for (const update of pending) failed.set(update, failureOf(errors[0], noun));
      return failed;
    }
    failed.set(
      pending[at]!,
      failureOf(
        errors.find((error) => error.path?.[0] === `a${at}`),
        noun
      )
    );
    pending = pending.slice(at + 1);
  }
  return failed;
};

/**
 * Writes translations into the channel's other languages. Nothing is written for an entity that is
 * unknown, has no originals or changed since it was read (`ifVersion`); otherwise each operation is
 * written or listed in `failed`. Vendure updates without a condition, so a change between this read
 * and the write is not caught.
 */
export const writeTranslations = async (
  client: VendureClient,
  kind: TranslatableKind,
  defaultLanguage: string,
  args: SourceEntityConnectorWriteArgs
): Promise<SourceEntityConnectorWriteResult[]> => {
  const rows = new Map(
    (
      await rowsByIds(
        client,
        kind,
        args.entities.map((entity) => entity.id)
      )
    ).map((row) => [row.id, row])
  );
  const results: (SourceEntityConnectorWriteResult & { failed?: SourceEntityOperationFailure[] })[] = [];
  const updates: PlannedUpdate[] = [];

  for (const entity of args.entities) {
    const row = rows.get(entity.id);
    const data = row && originalsOfRow(kind, row, defaultLanguage);
    if (!row || !data) {
      results.push({
        id: entity.id,
        error: sourceEntityError(
          SourceEntityErrorCode.notFound,
          `Vendure has no ${kind.noun} with this id and texts in "${defaultLanguage}"`
        ),
      });
      continue;
    }
    const version = await versionOf(data);
    if (entity.ifVersion !== undefined && entity.ifVersion !== version) {
      results.push({ id: entity.id, error: sourceEntityError(SourceEntityErrorCode.stale, `The ${kind.noun} changed since it was read`) });
      continue;
    }
    const failed: SourceEntityOperationFailure[] = [];
    const targets = entity.operations.flatMap((operation) => {
      const target = targetOf(kind, row, data, operation.path);
      if (target) return [{ target, operation }];
      failed.push({
        index: operation.index,
        error: sourceEntityError(SourceEntityErrorCode.notFound, `No text to translate at ${formatSourcePath(operation.path)}`),
      });
      return [];
    });
    updates.push(...planUpdates(entity.id, targets));
    results.push({ id: entity.id, version, failed });
  }

  for (const [update, error] of await sendUpdates(client, updates, kind.noun)) {
    const result = results.find((candidate) => candidate.id === update.entityId);
    result?.failed?.push(...update.operationIndexes.map((index) => ({ index, error })));
  }
  for (const result of results) result.failed?.sort((a, b) => a.index - b.index);
  return results;
};
