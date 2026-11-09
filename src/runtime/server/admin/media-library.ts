import {
  assetsClientOf,
  changingAssetsClientOf,
  deleteAssets,
  listAssets,
  MAX_UPLOAD_BATCH,
  SORTS,
  updateAsset,
  UPLOAD_ACCEPT,
  uploadAssets,
} from './assets';
import { useRuntimeConfig } from '#imports';
import type { VendureContext } from '../middleware/vendureContext';
import { defineVendureMediaLibrary } from '../middleware/defineVendure';

/**
 * The secret frontend-core's route guard checks: without it the media routes answer anyone. A dev
 * server runs without one, as frontend-core's own source-entity routes allow.
 */
const changingClientOf = (context: VendureContext) =>
  changingAssetsClientOf(context, import.meta.dev || !!useRuntimeConfig().laioutr?.projectSecretKey);

/**
 * Vendure's assets in Studio's media library. Vendure files assets by tag, not in folders, so the
 * library is flat and filters by tag. It has no alt text of its own; the storefront takes an
 * image's alt text from what shows it.
 */
export default defineVendureMediaLibrary({
  capabilities: {
    search: true,
    tags: true,
    folders: false,
    sorts: SORTS,
    upload: { transfer: 'proxied', maxBatchSize: MAX_UPLOAD_BATCH, accept: UPLOAD_ACCEPT },
    deleteAssets: true,
    updateAssets: { name: true, tags: true },
  },
  list: (query, context) => listAssets(assetsClientOf(context), query),
  upload: ({ files }, context) => uploadAssets(changingClientOf(context), files),
  updateAsset: (args, context) => updateAsset(changingClientOf(context), args),
  deleteAssets: ({ assetIds }, context) => deleteAssets(changingClientOf(context), assetIds),
});
