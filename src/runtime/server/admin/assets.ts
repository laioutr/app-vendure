import { readFile } from 'node:fs/promises';
import { mediaKindForMime, MediaProviderError } from '@laioutr-core/core-types/media-library';
import type { VendureClient } from '../client/VendureClient';
import type { VendureContext } from '../middleware/vendureContext';
import type { AdminAssetFieldsFragment } from '../types/vendure-admin.generated';
import type { MediaAudio, MediaType } from '@laioutr-core/core-types/common';
import type {
  MediaListResult,
  MediaQuery,
  MediaSortOption,
  MediaUpdateAssetArgs,
  ProviderStudioLibraryItem,
  ProviderStudioMediaFile,
  UploadOutcome,
} from '@laioutr-core/core-types/media-library';
import { adminOperations } from '../client/operations';
import { mapAssets, mapImage } from '../mappers/media';

/** The Admin API's default `adminListQueryLimit` is far above this; a picker's page needs no more. */
const MAX_PAGE_SIZE = 100;
/** Files of one upload request: Vendure takes them in one `createAssets`, bounded by its body size limit. */
export const MAX_UPLOAD_BATCH = 10;

export const SORTS: MediaSortOption[] = [
  { key: 'createdAt:desc', label: 'Newest first' },
  { key: 'createdAt:asc', label: 'Oldest first' },
  { key: 'name:asc', label: 'Name (A–Z)' },
  { key: 'name:desc', label: 'Name (Z–A)' },
];

/** The library exists only with the Admin API; the module registers it only then. */
export const assetsClientOf = (context: VendureContext): VendureClient => {
  if (!context.adminClient) throw new MediaProviderError('not_enabled', 'The Vendure Admin API URL and key are not set.');
  return context.adminClient;
};

/** Vendure's preview presets; `small` fits a picker's tile. */
const tileOf = (preview: string) => `${preview}${preview.includes('?') ? '&' : '?'}preset=small`;

/**
 * A Vendure asset as a library item: an image, video or audio a browser shows, else a file. The
 * delivery address of an image is its `preview`, which the asset server resizes on request.
 */
export const libraryItemOf = (asset: AdminAssetFieldsFragment): ProviderStudioLibraryItem => {
  const base = {
    externalId: asset.id,
    fileName: asset.name,
    file: { url: asset.source, mimeType: asset.mimeType, size: asset.fileSize },
    tags: asset.tags.map((tag) => tag.value),
  };
  const kind = asset.type === 'IMAGE' ? 'image' : mediaKindForMime(asset.mimeType);
  // The file name is no description of the picture, so no alt text is offered.
  if (kind === 'image') return { ...base, media: { ...mapImage(asset), alt: undefined }, previewUrl: tileOf(asset.preview) };
  if (kind === 'video') {
    const [video] = mapAssets([asset]);
    return { ...base, media: { ...video!, alt: undefined }, previewUrl: tileOf(asset.preview) };
  }
  if (kind === 'audio') {
    const audio: MediaAudio = { type: 'audio', sources: [{ provider: 'url', src: asset.source, format: asset.mimeType }] };
    return { ...base, media: audio };
  }
  return { ...base, kind: 'file' };
};

/** One condition per kind asked for; Vendure stores audio and documents both as `BINARY`. */
const KIND_FILTERS: Record<MediaType | 'file', Record<string, unknown>> = {
  image: { type: { eq: 'IMAGE' } },
  video: { type: { eq: 'VIDEO' } },
  audio: { _and: [{ type: { eq: 'BINARY' } }, { mimeType: { contains: 'audio/' } }] },
  file: { _and: [{ type: { eq: 'BINARY' } }, { mimeType: { notContains: 'audio/' } }] },
};

const offsetOf = (cursor: string | undefined) => {
  if (cursor === undefined) return 0;
  if (!/^\d+$/.test(cursor)) throw new MediaProviderError('invalid_request', 'Unknown cursor.');
  return Number(cursor);
};

/** The sort a key names, the id after it so that equal names or times keep one order across pages. */
const sortOf = (key: string | undefined) => {
  const option = SORTS.find((candidate) => candidate.key === key) ?? SORTS[0]!;
  const [field, direction] = option.key.split(':') as [string, string];
  return { [field]: direction.toUpperCase(), id: direction.toUpperCase() };
};

export const listOptionsOf = (query: MediaQuery) => {
  const skip = offsetOf(query.cursor);
  const take = Math.min(Math.max(query.limit, 1), MAX_PAGE_SIZE);
  const kinds = query.type?.length ? query.type.map((kind) => KIND_FILTERS[kind]) : undefined;
  const filter = {
    ...(query.term?.trim() ? { name: { contains: query.term.trim() } } : {}),
    ...(kinds ? { _or: kinds } : {}),
  };
  return {
    skip,
    take,
    sort: sortOf(query.sorting),
    ...(Object.keys(filter).length ? { filter } : {}),
    ...(query.tags?.length ? { tags: query.tags, tagsOperator: 'AND' as const } : {}),
  };
};

export const listAssets = async (client: VendureClient, query: MediaQuery): Promise<MediaListResult> => {
  const options = listOptionsOf(query);
  const { assets } = await client.request(adminOperations.assets, { options: options as never });
  const next = options.skip + assets.items.length;
  return {
    items: assets.items.map(libraryItemOf),
    total: assets.totalItems,
    ...(next < assets.totalItems && assets.items.length ? { nextCursor: String(next) } : {}),
  };
};

/**
 * Uploads the files in one `createAssets`, as the GraphQL multipart request Vendure takes. A file
 * Vendure refuses costs only itself; a request that fails costs every file of it.
 */
export const uploadAssets = async (client: VendureClient, files: readonly ProviderStudioMediaFile[]): Promise<UploadOutcome[]> => {
  const refOf = (index: number) => String(index);
  try {
    const parts = await Promise.all(
      files.map(async (file, index) => ({
        variablePath: `input.${index}.file`,
        file: new Blob([new Uint8Array(await readFile(file.filepath))], { type: file.mimeType }),
        fileName: file.name,
      }))
    );
    const { createAssets } = await client.requestWithFiles(
      adminOperations.createAssets,
      { input: files.map(() => ({ file: null })) },
      parts
    );
    return files.map((file, index): UploadOutcome => {
      const result = createAssets[index];
      if (result && 'id' in result) return { ref: refOf(index), ok: true, item: libraryItemOf(result) };
      const message = result && 'message' in result ? result.message : 'Vendure answered nothing for this file';
      return {
        ref: refOf(index),
        ok: false,
        error: { code: result ? 'unsupported_type' : 'upload_failed', message: `${file.name}: ${message}` },
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return files.map((_, index) => ({ ref: refOf(index), ok: false, error: { code: 'upload_failed', message } }));
  }
};

const isNotFound = (error: unknown) =>
  error instanceof Error && 'upstreamCode' in error && (error as { upstreamCode?: string }).upstreamCode === 'ENTITY_NOT_FOUND';

/** Renames or retags one asset. Vendure keeps the file under its first name, so a rename moves no address. */
export const updateAsset = async (client: VendureClient, args: MediaUpdateAssetArgs): Promise<ProviderStudioLibraryItem> => {
  try {
    const { updateAsset: asset } = await client.request(adminOperations.updateAsset, {
      input: {
        id: args.assetId,
        ...(args.name === undefined ? {} : { name: args.name }),
        ...(args.tags === undefined ? {} : { tags: args.tags }),
      },
    });
    return libraryItemOf(asset);
  } catch (error) {
    if (isNotFound(error)) throw new MediaProviderError('not_found', 'This asset no longer exists in Vendure.');
    throw error;
  }
};

/**
 * Deletes assets. One a product or collection still shows is refused as a whole, rather than forced
 * out of the catalog: Vendure answers `NOT_DELETED` with its reason, which reaches the editor.
 */
export const deleteAssets = async (client: VendureClient, assetIds: readonly string[]): Promise<void> => {
  const { deleteAssets: answer } = await client.request(adminOperations.deleteAssets, { input: { assetIds: [...assetIds] } });
  if (answer.result !== 'DELETED') {
    throw new MediaProviderError(
      'invalid_request',
      answer.message || 'Vendure kept the assets: a product or collection still uses one of them.'
    );
  }
};
