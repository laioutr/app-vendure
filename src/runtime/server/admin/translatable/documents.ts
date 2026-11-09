import type { VendureDocument } from '../../client/operations';
import type { Translatable, TranslatableKind } from './kinds';

/** One row of a translation, as the Admin API lists it: a language and that language's texts. */
export type TranslationRow = { languageCode: string } & Record<string, string | null | undefined>;

export interface TranslatableRow {
  id: string;
  translations: TranslationRow[];
  items?: { id: string; translations: TranslationRow[] }[];
}

export interface ListAnswer<TItem> {
  list: { totalItems: number; items: TItem[] };
}

export interface ListOptions {
  skip?: number;
  take: number;
  sort?: { id: 'ASC' };
  filter?: Record<string, unknown>;
}

const translations = (texts: Translatable) => `translations { languageCode ${texts.fields.map((field) => field.name).join(' ')} }`;

/**
 * The documents of one kind are built from its description rather than written out per kind: every
 * kind is listed, filtered and updated the same way, and only the names differ.
 */
const listQuery = (kind: TranslatableKind, selection: string) =>
  `query VendureTranslatables($options: ${kind.listOptions}) { list: ${kind.list}(options: $options) { totalItems items { ${selection} } } }`;

/** Ids only: the cheap read a page's cursor is placed with, and a count. */
export const idsQuery = (kind: TranslatableKind) =>
  listQuery(kind, 'id') as VendureDocument<ListAnswer<{ id: string }>, { options: ListOptions }>;

/** Every text of each entity, in every language Vendure stores. */
export const rowsQuery = (kind: TranslatableKind) =>
  listQuery(
    kind,
    `id ${translations(kind)}${kind.items ? ` items: ${kind.items.select} { id ${translations(kind.items)} }` : ''}`
  ) as VendureDocument<ListAnswer<TranslatableRow>, { options: ListOptions }>;

/** One update of an entity's translations, sent under its own alias. */
export interface TranslationUpdate {
  texts: Translatable;
  input: { id: string; translations: TranslationRow[] };
}

/**
 * Several updates in one request, `a0`, `a1`, … in order. Vendure runs them one after the other and
 * stops at the first that fails, so a failure's `path` says which alias failed and which never ran.
 */
export const updatesMutation = (updates: readonly TranslationUpdate[]) => {
  const variables = updates.map((update, index) => `$a${index}: ${update.texts.updateInput}!`).join(', ');
  const fields = updates.map((update, index) => `a${index}: ${update.texts.update}(input: $a${index}) { id }`).join(' ');
  return {
    document: `mutation VendureTranslationUpdates(${variables}) { ${fields} }` as VendureDocument<
      Record<string, { id: string } | null>,
      Record<string, unknown>
    >,
    variables: Object.fromEntries(updates.map((update, index) => [`a${index}`, update.input])),
  };
};
