import { operations } from './operations';
import { VendureClient } from './VendureClient';
import type { ActiveChannelQuery } from '../types/vendure.generated';
import { VendureApiError } from '../errors/mapVendureError';

/** The channel the settings select, and what that server's search can do. */
export interface VendureChannel {
  channel: ActiveChannelQuery['activeChannel'];
  /** Whether the search filters on stock; only with the DefaultSearchPlugin's `indexStockStatus`. */
  searchesByStock: boolean;
}

/** Languages, currencies and plugins change only with the shop's setup, so one read serves many requests. */
const CHANNEL_TTL_MS = 10 * 60 * 1000;

/**
 * While Vendure is down, every request would otherwise wait for a failing read first. Short, so a
 * server that comes back is used again soon.
 */
const FAILED_CHANNEL_TTL_MS = 30 * 1000;

const channels = new Map<string, { expires: number; channel: Promise<VendureChannel> }>();

/** A validation refusal answers "this server has no such field"; anything else is a failure. */
const isValidationRefusal = (error: unknown) =>
  error instanceof VendureApiError && (error.upstreamCode === 'HTTP_400' || error.upstreamCode === 'GRAPHQL_VALIDATION_FAILED');

const searchesByStock = (client: VendureClient): Promise<boolean> =>
  client.request(operations.inStockSearchProbe).then(
    () => true,
    (error: unknown) => {
      if (isValidationRefusal(error)) return false;
      throw error;
    }
  );

const readChannel = async (client: VendureClient): Promise<VendureChannel> => {
  const [{ activeChannel }, byStock] = await Promise.all([client.request(operations.activeChannel), searchesByStock(client)]);
  return { channel: activeChannel, searchesByStock: byStock };
};

/**
 * The channel the settings select, read once per process and interval. A failed read is kept for a
 * short while and logged once, so an outage costs one failing call per interval, not one per request.
 */
export const channelOf = (shopApiUrl: string, channelToken: string | undefined): Promise<VendureChannel> => {
  const key = `${shopApiUrl}#${channelToken ?? ''}`;
  const cached = channels.get(key);
  if (cached && cached.expires > Date.now()) return cached.channel;

  const channel = readChannel(new VendureClient({ apiUrl: shopApiUrl, channelToken }));
  channels.set(key, { expires: Date.now() + CHANNEL_TTL_MS, channel });
  channel.catch((error: unknown) => {
    console.warn(`[vendure] Could not read the channel of ${shopApiUrl}; trying again in ${FAILED_CHANNEL_TTL_MS / 1000} s.`, error);
    channels.set(key, { expires: Date.now() + FAILED_CHANNEL_TTL_MS, channel });
  });
  return channel;
};
