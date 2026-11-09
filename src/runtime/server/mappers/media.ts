import type { AssetFieldsFragment } from '../types/vendure.generated';
import type { MediaImage, MediaVideo } from '@laioutr-core/core-types/common';

/** The image provider the module registers for Vendure's asset server. */
export const VENDURE_IMAGE_PROVIDER = 'vendure';

/**
 * The longest side of a `preview` image under the AssetServerPlugin's defaults
 * (`previewMaxWidth` / `previewMaxHeight`).
 */
const PREVIEW_MAX_SIDE = 1600;

const previewSize = (width: number, height: number) => {
  if (!width || !height) return {};
  const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

/**
 * The `preview` is the web-sized rendition the asset server transforms on request; `source` may be
 * the uploaded original in any format.
 */
export const mapImage = (asset: Pick<AssetFieldsFragment, 'preview'> & Partial<AssetFieldsFragment>, alt?: string): MediaImage => ({
  type: 'image',
  alt: alt ?? asset.name ?? undefined,
  sources: [
    {
      provider: VENDURE_IMAGE_PROVIDER,
      src: asset.preview,
      ...previewSize(asset.width ?? 0, asset.height ?? 0),
      ...(asset.focalPoint ? { focalPoint: [asset.focalPoint.x, asset.focalPoint.y] as [number, number] } : {}),
    },
  ],
});

/** Images and videos of an asset list, in order; binary files are no media a page can show. */
export const mapAssets = (assets: readonly AssetFieldsFragment[], alt?: string): (MediaImage | MediaVideo)[] =>
  assets.flatMap((asset): (MediaImage | MediaVideo)[] => {
    if (asset.type === 'IMAGE') return [mapImage(asset, alt)];
    if (asset.type === 'VIDEO') {
      return [
        {
          type: 'video',
          alt: alt ?? asset.name,
          sources: [{ provider: 'url', src: asset.source, width: asset.width, height: asset.height, format: asset.mimeType }],
        } as MediaVideo,
      ];
    }
    return [];
  });
