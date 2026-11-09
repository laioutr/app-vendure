import { assetsClientOf, deleteAssets, listAssets, MAX_UPLOAD_BATCH, SORTS, updateAsset, uploadAssets } from './assets';
import { defineVendureMediaLibrary } from '../middleware/defineVendure';

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
    upload: { transfer: 'proxied', maxBatchSize: MAX_UPLOAD_BATCH, accept: ['image/*', 'video/*', 'audio/*', 'application/pdf'] },
    deleteAssets: true,
    updateAssets: { name: true, tags: true },
  },
  list: (query, context) => listAssets(assetsClientOf(context), query),
  upload: ({ files }, context) => uploadAssets(assetsClientOf(context), files),
  updateAsset: (args, context) => updateAsset(assetsClientOf(context), args),
  deleteAssets: ({ assetIds }, context) => deleteAssets(assetsClientOf(context), assetIds),
});
