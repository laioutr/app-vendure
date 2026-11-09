import { z } from 'zod/v4';
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

const originalsOf = (texts: Translatable, row: TranslationRow): SourceEntityValues =>
  Object.fromEntries(texts.fields.map((field) => [field.name, row[field.name] ?? '']));

/**
 * The values a language's row holds as its own. Vendure keeps a language's texts in one row, so a row
 * created for one text holds copies of the originals in its other fields; a copy is no translation,
 * and is answered as missing so it gets translated. A slug is the exception: whatever a row holds is
 * that language's address, kept as it is.
 */
const translatedOf = (texts: Translatable, row: TranslationRow | undefined, originals: SourceEntityValues): SourceEntityValues => {
  if (!row) return {};
  return Object.fromEntries(
    texts.fields.flatMap((field) => {
      const value = row[field.name];
      if (!value) return [];
      if (field.kind !== 'slug' && value === originals[field.name]) return [];
      return [[field.name, value]];
    })
  );
};

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
  const data = originalsOf(kind, own);
  if (kind.items) {
    data[kind.items.key] = (row.items ?? []).flatMap((item) => {
      const itemOwn = rowOf(item.translations, defaultLanguage);
      return itemOwn ? [{ id: item.id, ...originalsOf(kind.items!, itemOwn) }] : [];
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
  const data = originalsOfRow(kind, row, languages.defaultLanguage);
  if (!data) return { skipped: `The ${kind.noun} has no text in the channel's default language "${languages.defaultLanguage}"` };

  const translations = Object.fromEntries(
    languages.locales.map((locale) => {
      const values = translatedOf(kind, rowOf(row.translations, locale), data);
      if (kind.items) {
        const items = (row.items ?? []).flatMap((item) => {
          const original = (data[kind.items!.key] as SourceEntityValues[]).find((candidate) => candidate.id === item.id);
          const translated = original ? translatedOf(kind.items!, rowOf(item.translations, locale), original) : {};
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
