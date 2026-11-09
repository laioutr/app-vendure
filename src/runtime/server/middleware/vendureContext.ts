import { channelOf } from '../client/channel';
import { VendureClient } from '../client/VendureClient';
import { requestLocale } from '../mappers/localization';

export interface VendureSettings {
  shopApiUrl?: string;
  channelToken?: string;
  languageCode?: string;
  adminApiUrl?: string;
  adminApiKey?: string;
}

export interface VendureRequest {
  market: { slug: string; currency: string };
  localeChain: readonly string[];
  /** The visitor's session, restored from the storefront's cookie. */
  sessionToken?: string;
  /** Persists a session token Vendure issued. */
  onSessionToken: (token: string) => void;
}

/**
 * Everything a handler gets for one request: the visitor's client, a client without their session
 * for catalog reads, and the channel's money and search settings.
 */
export const vendureContext = async (settings: VendureSettings | undefined, request: VendureRequest) => {
  if (!settings?.shopApiUrl) throw new Error('[vendure] "shopApiUrl" is not set in the @laioutr/app-vendure settings.');
  const shopApiUrl = settings.shopApiUrl;
  const channelToken = settings.channelToken || undefined;

  // Without the channel nothing is sent and the channel's defaults answer; its read logs the failure.
  const read = await channelOf(shopApiUrl, channelToken).catch(() => undefined);
  const locale =
    read ?
      requestLocale(shopApiUrl, read.channel, {
        market: request.market.slug,
        currency: request.market.currency,
        localeChain: request.localeChain,
        configuredLanguage: settings.languageCode || undefined,
      })
    : { languageCode: settings.languageCode || undefined, currencyCode: undefined };

  const vendureClient = new VendureClient({
    apiUrl: shopApiUrl,
    channelToken,
    ...locale,
    sessionToken: request.sessionToken,
    onSessionToken: request.onSessionToken,
  });

  return {
    vendureClient,
    /**
     * For product, collection, search and menu reads. Their answers are cached per market and served
     * to every visitor, so they must not depend on whose session asked.
     */
    catalogClient: vendureClient.withoutSession(),
    /** The currency prices are answered in, for amounts Vendure sends without one. */
    currencyCode: locale.currencyCode ?? request.market.currency,
    /** The channel's languages and currencies; absent while the Shop API cannot be read. */
    channel: read?.channel,
    /** Whether listings offer the in-stock filter. */
    searchesByStock: read?.searchesByStock ?? false,
    /**
     * The Admin API of the same channel, with the key's role; absent without both Admin API settings.
     * Only translation and the media library use it.
     */
    adminClient: adminClientOf(settings, channelToken),
  };
};

const adminClientOf = (settings: VendureSettings, channelToken: string | undefined) =>
  settings.adminApiUrl && settings.adminApiKey ?
    new VendureClient({ apiUrl: settings.adminApiUrl, apiKey: settings.adminApiKey, channelToken })
  : undefined;

export type VendureContext = Awaited<ReturnType<typeof vendureContext>>;
