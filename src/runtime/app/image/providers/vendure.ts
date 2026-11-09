import { withQuery } from 'ufo';
import type { ProviderGetImage } from '@nuxt/image';

/** The formats Vendure's AssetServerPlugin converts to; any other is left to the server. */
const FORMATS = new Set(['jpg', 'png', 'webp', 'avif']);

/** `crop` fills the box; the fits that keep the whole image inside it are `resize`. */
const modeOf = (fit: unknown) => (fit === 'contain' || fit === 'inside' ? 'resize' : 'crop');

const formatOf = (format: unknown) => {
  const normalized = typeof format === 'string' ? format.toLowerCase().replace('jpeg', 'jpg') : undefined;
  return normalized && FORMATS.has(normalized) ? normalized : undefined;
};

/**
 * Nuxt Image provider for assets served by Vendure's AssetServerPlugin, which resizes and converts
 * on request: `w`, `h`, `mode` (`crop` fills the box, `resize` fits inside it), `format`, `q`.
 *
 * @see https://docs.vendure.io/reference/core-plugins/asset-server-plugin/
 */
export const getImage: ProviderGetImage = (src, { modifiers = {} } = {}) => ({
  url: withQuery(src, {
    w: modifiers.width || undefined,
    h: modifiers.height || undefined,
    mode: modifiers.width && modifiers.height ? modeOf(modifiers.fit) : undefined,
    format: formatOf(modifiers.format),
    q: modifiers.quality || undefined,
  }),
});
