import { warnOnce } from '../utils/warnOnce';

/**
 * The Vendure language code for a visitor's locale chain (`['pt-BR', 'pt']`), among the codes the
 * channel offers. Vendure spells a regional code with an underscore (`pt_BR`). Undefined lets the
 * channel's default language answer.
 */
export const vendureLanguageCode = (localeChain: readonly string[], available: readonly string[]): string | undefined => {
  const offered = new Set(available);
  for (const locale of localeChain) {
    const [language, region] = locale.split(/[-_]/);
    if (!language) continue;
    const regional = region ? `${language.toLowerCase()}_${region.toUpperCase()}` : undefined;
    if (regional && offered.has(regional)) return regional;
    if (offered.has(language.toLowerCase())) return language.toLowerCase();
  }
  return undefined;
};

/**
 * The market's currency when the channel offers it. Vendure refuses a currency the channel does not
 * carry with an error on every field, so an unknown one is not sent and the channel's default
 * answers.
 */
export const vendureCurrencyCode = (currency: string | undefined, available: readonly string[]): string | undefined =>
  currency && available.includes(currency.toUpperCase()) ? currency.toUpperCase() : undefined;

interface ChannelLocales {
  defaultLanguageCode: string;
  availableLanguageCodes?: readonly string[] | null;
  defaultCurrencyCode: string;
  availableCurrencyCodes: readonly string[];
}

interface RequestedLocale {
  /** Names the market in a warning. */
  market: string;
  currency: string;
  localeChain: readonly string[];
  /** A language the settings fix for every visitor, instead of the visitor's own. */
  configuredLanguage?: string;
}

/**
 * The language and currency to ask Vendure for. Vendure refuses a code the channel does not offer
 * with an error on every field, so such a code falls back to the channel's default — once logged per
 * server and market, since the market's setup and the channel disagree for every request alike.
 */
export const requestLocale = (server: string, channel: ChannelLocales, asked: RequestedLocale) => {
  const languages = channel.availableLanguageCodes?.length ? channel.availableLanguageCodes : [channel.defaultLanguageCode];

  let languageCode =
    asked.configuredLanguage ?
      vendureLanguageCode([asked.configuredLanguage], languages)
    : vendureLanguageCode(asked.localeChain, languages);
  if (!languageCode) {
    const wanted = asked.configuredLanguage ?? asked.localeChain[0] ?? 'none';
    warnOnce(
      `${server}|${asked.market}|language|${wanted}`,
      `[vendure] Market "${asked.market}" asks for language "${wanted}", which the channel of ${server} does not offer (${languages.join(', ')}); answering in "${channel.defaultLanguageCode}".`
    );
    languageCode = channel.defaultLanguageCode;
  }

  let currencyCode = vendureCurrencyCode(asked.currency, channel.availableCurrencyCodes);
  if (!currencyCode) {
    warnOnce(
      `${server}|${asked.market}|currency|${asked.currency}`,
      `[vendure] Market "${asked.market}" asks for currency "${asked.currency}", which the channel of ${server} does not offer (${channel.availableCurrencyCodes.join(', ')}); answering in "${channel.defaultCurrencyCode}".`
    );
    currencyCode = channel.defaultCurrencyCode;
  }

  return { languageCode, currencyCode };
};
