import { updatesMutation } from './documents';
import { originalsOfRow, versionOf } from './entities';
import { rowsToWrite } from './pages';
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

type Planned = { target: Target; operation: IndexedSourceEntityOperation };

const listOf = (names: readonly string[]) => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/**
 * The row one language of one Vendure entity gets, or why nothing may be written for the entity.
 * Vendure keeps a language's texts in one row and has no way to empty a single text, so:
 * - a new row is created only with every required text written, never filled with copies of the
 *   originals, which would later read as translations of texts that changed since; an optional text
 *   the write leaves out is stored empty, which reads as untranslated;
 * - a removed optional text is emptied, and a removed required text is refused.
 * A language without a row, asked only to remove texts, already holds none: nothing is written.
 */
const rowOfLanguage = (
  noun: string,
  locale: string,
  planned: readonly Planned[]
): { row?: TranslationRow; refusal?: SourceEntityError } => {
  const { texts, translations } = planned[0]!.target;
  const exists = translations.some((candidate) => candidate.languageCode === locale);
  if (!exists && planned.every(({ operation }) => !isSetOperation(operation))) return {};

  const row: TranslationRow = { languageCode: locale };
  if (!exists) for (const field of texts.fields) if (!field.required) row[field.name] = '';
  for (const { target, operation } of planned) {
    const required = texts.fields.find((field) => field.name === target.field)!.required;
    if (!isSetOperation(operation)) {
      if (required) {
        return {
          refusal: sourceEntityError(
            SourceEntityErrorCode.unsupported,
            `Vendure cannot remove the ${target.field} of a ${noun} in "${locale}": every language it holds keeps one. Nothing was written.`
          ),
        };
      }
      row[target.field] = '';
      continue;
    }
    row[target.field] = String(operation.value);
  }
  // An existing row keeps the texts the write leaves out; a new one has only what is written.
  const missing = texts.fields
    .filter((field) => field.required && (exists ? row[field.name] === '' : !row[field.name]))
    .map((field) => field.name);
  if (!missing.length) return { row };
  return {
    refusal: sourceEntityError(
      SourceEntityErrorCode.invalid,
      exists ?
        `Vendure needs the ${listOf(missing)} of a ${noun} in "${locale}" not to be empty. Nothing was written.`
      : `Vendure keeps a ${noun}'s texts in "${locale}" in one row, which it does not have yet: a new row needs the ${listOf(
          texts.fields.filter((field) => field.required).map((field) => field.name)
        )} together, and this write has no ${listOf(missing)}. Nothing was written.`
    ),
  };
};

/** The updates of one source entity — itself and its items — or the refusal of the whole entity. */
const planUpdates = (entityId: string, noun: string, targets: readonly Planned[]): PlannedUpdate[] | SourceEntityError => {
  const byNode = new Map<string, { texts: Translatable; languages: Map<string, Planned[]> }>();
  for (const planned of targets) {
    // Core checked the operation against describe, and the write refused the default language: a locale is set.
    const locale = planned.operation.locale!;
    let node = byNode.get(planned.target.id);
    if (!node) byNode.set(planned.target.id, (node = { texts: planned.target.texts, languages: new Map() }));
    node.languages.set(locale, [...(node.languages.get(locale) ?? []), planned]);
  }
  const updates: PlannedUpdate[] = [];
  for (const [id, { texts, languages }] of byNode) {
    const rows: TranslationRow[] = [];
    const operationIndexes: number[] = [];
    for (const [locale, planned] of languages) {
      const { row, refusal } = rowOfLanguage(noun, locale, planned);
      if (refusal) return refusal;
      if (row) rows.push(row);
      operationIndexes.push(...planned.map(({ operation }) => operation.index));
    }
    if (rows.length) updates.push({ entityId, texts, input: { id, translations: rows }, operationIndexes });
  }
  return updates;
};

const isForbidden = (error: GraphQLError | undefined) => error?.extensions?.code === 'FORBIDDEN';

const failureOf = (error: GraphQLError | undefined, noun: string): SourceEntityError => {
  if (isForbidden(error)) return sourceEntityError(SourceEntityErrorCode.readOnly, `The Admin API key's role may not update this ${noun}`);
  if (error?.extensions?.code === 'ENTITY_NOT_FOUND')
    return sourceEntityError(SourceEntityErrorCode.notFound, `Vendure has no such ${noun} any more`);
  return sourceEntityError(SourceEntityErrorCode.failed, error?.message ?? 'Vendure did not answer the update');
};

/**
 * Sends every update in as few requests as failures allow: one, unless an update fails, in which
 * case Vendure stops there and the rest go again in the next request. A refusal of the key's role
 * applies to every update of that mutation, so those fail at once rather than one request each.
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
    const error = errors.find((candidate) => candidate.path?.[0] === `a${at}`);
    const failure = failureOf(error, noun);
    failed.set(pending[at]!, failure);
    const refusedMutation = isForbidden(error) ? pending[at]!.texts.update : undefined;
    pending = pending.slice(at + 1).filter((update) => {
      if (update.texts.update !== refusedMutation) return true;
      failed.set(update, failure);
      return false;
    });
  }
  return failed;
};

/**
 * Writes translations into the channel's other languages. Nothing is written for an entity that is
 * unknown, has no originals, changed since it was read (`ifVersion`), or whose write would leave a
 * language's row without a text Vendure requires; otherwise each operation is written or listed in
 * `failed`. Vendure updates without a condition, so a change between this read and the write is not
 * caught.
 */
export const writeTranslations = async (
  client: VendureClient,
  kind: TranslatableKind,
  args: SourceEntityConnectorWriteArgs
): Promise<SourceEntityConnectorWriteResult[]> => {
  if (args.entities.length === 0) return [];
  const read = await rowsToWrite(
    client,
    kind,
    args.entities.map((entity) => entity.id)
  );
  const { defaultLanguage } = read;
  const rows = new Map(read.rows.map((row) => [row.id, row]));
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
      // The channel's default language may have changed since core described it; the originals are never written.
      if (operation.locale === undefined || operation.locale === defaultLanguage) {
        failed.push({
          index: operation.index,
          error: sourceEntityError(
            SourceEntityErrorCode.readOnly,
            `"${defaultLanguage}" is the channel's default language, which holds the originals`
          ),
        });
        return [];
      }
      const target = targetOf(kind, row, data, operation.path);
      if (target) return [{ target, operation }];
      failed.push({
        index: operation.index,
        error: sourceEntityError(SourceEntityErrorCode.notFound, `No text to translate at ${formatSourcePath(operation.path)}`),
      });
      return [];
    });
    const planned = planUpdates(entity.id, kind.noun, targets);
    if (!Array.isArray(planned)) {
      results.push({ id: entity.id, error: planned });
      continue;
    }
    updates.push(...planned);
    results.push({ id: entity.id, version, failed });
  }

  for (const [update, error] of await sendUpdates(client, updates, kind.noun)) {
    const result = results.find((candidate) => candidate.id === update.entityId);
    result?.failed?.push(...update.operationIndexes.map((index) => ({ index, error })));
  }
  for (const result of results) result.failed?.sort((a, b) => a.index - b.index);
  return results;
};
