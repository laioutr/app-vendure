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
import { MAX_PAGE_SIZE } from '../const';
import { VendureApiError } from '../errors/mapVendureError';
import { mapAssets, mapImage } from '../mappers/media';

/** Files of one upload request: Vendure takes them in one `createAssets`, bounded by its body size limit. */
export const MAX_UPLOAD_BATCH = 10;

/** What the library takes: what Vendure's default `permittedFileTypes` permits and a page can show or link. */
export const UPLOAD_ACCEPT = ['image/*', 'video/*', 'audio/*', 'application/pdf'];

/**
 * The asset server picks a file's content type by its extension, so a file is checked by both: a
 * permitted type named `page.html` would otherwise be served as a page from the shop's domain.
 */
const UPLOAD_EXTENSIONS: Record<string, readonly string[]> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'tif', 'tiff', 'bmp', 'heic', 'heif'],
  video: ['mp4', 'm4v', 'mov', 'webm', 'ogv', 'ogg'],
  audio: ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'flac', 'opus'],
  application: ['pdf'],
};

/**
 * SVG is an image Vendure stores and serves as it is, scripts included, from the shop's domain;
 * Vendure does not clean it, so it is refused.
 */
const SVG_MIME = 'image/svg+xml';

const matchesAccept = (mimeType: string) =>
  UPLOAD_ACCEPT.some((pattern) => (pattern.endsWith('/*') ? mimeType.startsWith(pattern.slice(0, -1)) : mimeType === pattern));

/** Why the library does not take a file, or nothing when it does. */
export const uploadRefusalOf = (file: Pick<ProviderStudioMediaFile, 'name' | 'mimeType'>): string | undefined => {
  const mimeType = file.mimeType.toLowerCase();
  const extension = /\.([^./]+)$/.exec(file.name)?.[1]?.toLowerCase();
  if (mimeType === SVG_MIME) return 'SVG files are not taken: Vendure serves them unchecked';
  if (!matchesAccept(mimeType)) return `${file.mimeType || 'This type'} is not an image, video, audio file or PDF`;
  if (!extension || !UPLOAD_EXTENSIONS[mimeType.split('/')[0]!]?.includes(extension))
    return `The file name's extension does not match its type ${file.mimeType}`;
  return undefined;
};

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

/**
 * For a change to the shop's assets. The media routes are open to anyone while the storefront has
 * no project secret, and a change here uploads into or deletes from the merchant's own shop, so it
 * is refused then; listing shows only what the storefront serves anyway.
 */
export const changingAssetsClientOf = (context: VendureContext, hasProjectSecret: boolean): VendureClient => {
  const client = assetsClientOf(context);
  if (!hasProjectSecret) {
    throw new MediaProviderError(
      'not_enabled',
      "Uploading, changing and deleting Vendure's assets need the storefront's project secret, which is not set."
    );
  }
  return client;
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

const UNKNOWN_OUTCOME =
  'Vendure did not answer in time, so whether it stored the file is unknown: look for it in the library before uploading it again.';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const isTimeout = (error: unknown) => error instanceof VendureApiError && error.upstreamCode === 'TIMEOUT';

/**
 * Uploads the files in one `createAssets`, as the GraphQL multipart request Vendure takes. A file
 * the library or Vendure refuses costs only itself; a request that fails costs every file of it.
 */
export const uploadAssets = async (client: VendureClient, files: readonly ProviderStudioMediaFile[]): Promise<UploadOutcome[]> => {
  if (files.length > MAX_UPLOAD_BATCH)
    throw new MediaProviderError('invalid_request', `At most ${MAX_UPLOAD_BATCH} files are uploaded at a time.`);
  const refOf = (index: number) => String(index);
  const outcomes: (UploadOutcome | undefined)[] = files.map((file, index) => {
    const refusal = uploadRefusalOf(file);
    return refusal ? { ref: refOf(index), ok: false, error: { code: 'unsupported_type', message: `${file.name}: ${refusal}` } } : undefined;
  });
  const sent = files.flatMap((file, index) => (outcomes[index] ? [] : [{ file, index }]));
  if (!sent.length) return outcomes as UploadOutcome[];
  try {
    const parts = await Promise.all(
      sent.map(async ({ file }, position) => ({
        variablePath: `input.${position}.file`,
        file: new Blob([new Uint8Array(await readFile(file.filepath))], { type: file.mimeType }),
        fileName: file.name,
      }))
    );
    const { createAssets } = await client.requestWithFiles(
      adminOperations.createAssets,
      { input: sent.map(() => ({ file: null })) },
      parts
    );
    sent.forEach(({ file, index }, position) => {
      const result = createAssets[position];
      if (result && 'id' in result) {
        outcomes[index] = { ref: refOf(index), ok: true, item: libraryItemOf(result) };
        return;
      }
      const message = result && 'message' in result ? result.message : 'Vendure answered nothing for this file';
      outcomes[index] = {
        ref: refOf(index),
        ok: false,
        error: { code: result ? 'unsupported_type' : 'upload_failed', message: `${file.name}: ${message}` },
      };
    });
  } catch (error) {
    // Vendure may still store what it received after the wait ran out; a blind retry would store it twice.
    const message = isTimeout(error) ? UNKNOWN_OUTCOME : messageOf(error);
    for (const { index } of sent) outcomes[index] = { ref: refOf(index), ok: false, error: { code: 'upload_failed', message } };
  }
  return outcomes as UploadOutcome[];
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
