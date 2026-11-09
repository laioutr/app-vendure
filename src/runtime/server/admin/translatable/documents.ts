import type { VendureDocument } from '../../client/operations';
import type { Translatable, TranslatableKind } from './kinds';

/** One row of a translation, as the Admin API lists it: a language and that language's texts. */
export type TranslationRow = { languageCode: string } & Record<string, string | null | undefined>;

export interface TranslatableRow {
  id: string;
  translations: TranslationRow[];
  items?: { id: string; translations: TranslationRow[] }[];
  /** Selected only for the kinds whose `hidden` asks for them. */
  isPrivate?: boolean;
  facet?: { isPrivate: boolean };
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
 * kind is listed, filtered and updated the same way, and only the names differ. `extra` asks for
 * more top-level fields in the same request.
 */
const listQuery = (kind: TranslatableKind, selection: string, name = 'VendureTranslatables', extra = '') =>
  `query ${name}($options: ${kind.listOptions}) { ${extra}list: ${kind.list}(options: $options) { totalItems items { ${selection} } } }`;

/** Ids only: the cheap read a page's cursor is placed with, and a count. */
export const idsQuery = (kind: TranslatableKind) =>
  listQuery(kind, 'id') as VendureDocument<ListAnswer<{ id: string }>, { options: ListOptions }>;

const rowSelection = (kind: TranslatableKind) =>
  `id ${translations(kind)}${kind.hidden ? ` ${kind.hidden.select}` : ''}${kind.items ? ` items: ${kind.items.select} { id ${translations(kind.items)} }` : ''}`;

/** Every text of each entity, in every language Vendure stores. */
export const rowsQuery = (kind: TranslatableKind) =>
  listQuery(kind, rowSelection(kind)) as VendureDocument<ListAnswer<TranslatableRow>, { options: ListOptions }>;

/**
 * The rows a write changes, with the channel's default language read in the same request: the
 * language the originals are in is checked when the write happens, not taken from a cached read.
 */
export const rowsToWriteQuery = (kind: TranslatableKind) =>
  listQuery(kind, rowSelection(kind), 'VendureTranslatablesToWrite', 'channel: activeChannel { defaultLanguageCode } ') as VendureDocument<
    ListAnswer<TranslatableRow> & { channel: { defaultLanguageCode: string } },
    { options: ListOptions }
  >;

/** The parents of the items changed since a moment, which an item's change does not mark as changed. */
export const changedItemsQuery = (items: NonNullable<TranslatableKind['items']>) =>
  `query VendureChangedItems($options: ${items.listOptions}) { list: ${items.list}(options: $options) { totalItems items { parent: ${items.parent} } } }` as VendureDocument<
    ListAnswer<{ parent: string }>,
    { options: ListOptions }
  >;

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
