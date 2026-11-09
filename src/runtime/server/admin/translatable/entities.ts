import { z } from 'zod/v4';
import { compareIds } from './pages';
import type { TranslatableRow, TranslationRow } from './documents';
import type { TextField, Translatable, TranslatableKind } from './kinds';
import type { ConnectorSourceEntity, SourceEntityLocale, SourceEntityValues } from '@laioutr-core/core-types/source-entity';

/** The channel's languages: its default one holds the originals, the others their translations. */
export interface ChannelLanguages {
  defaultLanguageCode: string;
  availableLanguageCodes: readonly string[] | null;
}

/** The field kinds a translation service reads: markup to keep intact, and a page's address. */
const FIELD_KINDS = { richtext: 'laioutr.richtext', slug: 'laioutr.slug' } as const;

const textSchema = (field: TextField) =>
  z.string().meta({ field: { localized: true, ...(field.kind === 'text' ? {} : { kind: FIELD_KINDS[field.kind] }) } });

const textsSchema = (texts: Translatable) => Object.fromEntries(texts.fields.map((field) => [field.name, textSchema(field)]));

export const kindSchema = (kind: TranslatableKind) =>
  z.object({
    ...textsSchema(kind),
    ...(kind.items ? { [kind.items.key]: z.array(z.object({ id: z.string().meta({ readOnly: true }), ...textsSchema(kind.items) })) } : {}),
  });

const languageLabel = (code: string) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code.replace('_', '-'));
  } catch {
    return undefined;
  }
};

/** Every language the channel offers; translations are written into each but its default. */
export const channelLocales = (channel: ChannelLanguages): SourceEntityLocale[] =>
  [...new Set([channel.defaultLanguageCode, ...(channel.availableLanguageCodes ?? [])])].map((code) => ({
    code,
    ...(languageLabel(code) ? { label: languageLabel(code) } : {}),
    primary: code === channel.defaultLanguageCode,
    writable: code !== channel.defaultLanguageCode,
  }));

const rowOf = (translations: readonly TranslationRow[], languageCode: string) =>
  translations.find((row) => row.languageCode === languageCode);

/** The texts a row holds; an empty one is no value, in the originals and in a translation alike. */
const valuesOf = (texts: Translatable, row: TranslationRow | undefined): SourceEntityValues =>
  Object.fromEntries(texts.fields.flatMap((field) => (row?.[field.name] ? [[field.name, row[field.name]!]] : [])));

/**
 * Items in id order: Vendure loads a group's options without an order, and the originals' order goes
 * into the version, which must not change unless an original does.
 */
const inIdOrder = <TItem extends { id: string }>(items: readonly TItem[] | undefined): TItem[] =>
  [...(items ?? [])].sort((a, b) => compareIds(a.id, b.id));

const isEmpty = (values: SourceEntityValues) => Object.keys(values).length === 0;

/** Opaque, and the same for the same originals: it changes when an original changes, never with a translation. */
export const versionOf = async (data: SourceEntityValues): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  return [...new Uint8Array(digest).slice(0, 16)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** The originals of a row, or why it has none: an entity without a text in the default language has nothing to translate. */
export const originalsOfRow = (kind: TranslatableKind, row: TranslatableRow, defaultLanguage: string) => {
  const own = rowOf(row.translations, defaultLanguage);
  if (!own) return undefined;
  const data = valuesOf(kind, own);
  if (kind.items) {
    data[kind.items.key] = inIdOrder(row.items).flatMap((item) => {
      const itemOwn = rowOf(item.translations, defaultLanguage);
      return itemOwn ? [{ id: item.id, ...valuesOf(kind.items!, itemOwn) }] : [];
    });
  }
  return data;
};

/** A Vendure entity as a source entity, its translations in `locales` only. Answers a reason instead when it cannot be one. */
export const entityOfRow = async (
  kind: TranslatableKind,
  row: TranslatableRow,
  languages: { defaultLanguage: string; locales: readonly string[] }
): Promise<ConnectorSourceEntity | { skipped: string }> => {
  const hidden = kind.hidden?.of(row);
  if (hidden) return { skipped: hidden };
  const data = originalsOfRow(kind, row, languages.defaultLanguage);
  if (!data) return { skipped: `The ${kind.noun} has no text in the channel's default language "${languages.defaultLanguage}"` };

  const translations = Object.fromEntries(
    languages.locales.map((locale) => {
      const values = valuesOf(kind, rowOf(row.translations, locale));
      if (kind.items) {
        const originals = new Set((data[kind.items.key] as SourceEntityValues[]).map((item) => item.id));
        const items = inIdOrder(row.items).flatMap((item) => {
          const translated = originals.has(item.id) ? valuesOf(kind.items!, rowOf(item.translations, locale)) : {};
          return isEmpty(translated) ? [] : [{ id: item.id, ...translated }];
        });
        if (items.length) values[kind.items.key] = items;
      }
      return [locale, values];
    })
  );

  const label = typeof data.name === 'string' && data.name ? { label: data.name } : {};
  return { id: row.id, ...label, version: await versionOf(data), data, ...(languages.locales.length ? { translations } : {}) };
};
