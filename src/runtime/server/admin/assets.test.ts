import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assetsClientOf,
  changingAssetsClientOf,
  deleteAssets,
  libraryItemOf,
  listAssets,
  listOptionsOf,
  updateAsset,
  uploadAssets,
} from './assets';
import type { VendureContext } from '../middleware/vendureContext';
import type { AdminAssetFieldsFragment } from '../types/vendure-admin.generated';
import { fakeShopApi } from '../../../../test/fixtures/fakeShopApi';
import { VendureClient } from '../client/VendureClient';

const admin = () => new VendureClient({ apiUrl: 'https://shop.example.com/admin-api', apiKey: 'key' });

const asset = (overrides: Partial<AdminAssetFieldsFragment> = {}): AdminAssetFieldsFragment => ({
  id: '1',
  createdAt: '2026-11-09T10:00:00.000Z',
  name: 'chair.jpg',
  type: 'IMAGE',
  mimeType: 'image/jpeg',
  fileSize: 1000,
  width: 3200,
  height: 1600,
  source: 'https://shop.example.com/assets/source/chair.jpg',
  preview: 'https://shop.example.com/assets/preview/chair__preview.jpg',
  focalPoint: { x: 0.2, y: 0.4 },
  tags: [{ value: 'summer' }],
  ...overrides,
});

const file = async (name: string, mimeType = 'image/png') => {
  const filepath = join(await mkdtemp(join(tmpdir(), 'vendure-test-')), name);
  await writeFile(filepath, 'bytes');
  return { name, mimeType, size: 5, filepath, getStream: () => undefined as never };
};

describe('libraryItemOf', () => {
  it('answers an image through the resized preview, with its focal point and tags, and no file name as alt text', () => {
    expect(libraryItemOf(asset())).toEqual({
      externalId: '1',
      fileName: 'chair.jpg',
      file: { url: 'https://shop.example.com/assets/source/chair.jpg', mimeType: 'image/jpeg', size: 1000 },
      tags: ['summer'],
      media: {
        type: 'image',
        alt: undefined,
        sources: [
          {
            provider: 'vendure',
            src: 'https://shop.example.com/assets/preview/chair__preview.jpg',
            width: 1600,
            height: 800,
            focalPoint: [0.2, 0.4],
          },
        ],
      },
      previewUrl: 'https://shop.example.com/assets/preview/chair__preview.jpg?preset=small',
    });
  });

  it('answers audio as media and a document as a file', () => {
    expect(libraryItemOf(asset({ type: 'BINARY', mimeType: 'audio/mpeg' }))).toMatchObject({ media: { type: 'audio' } });
    expect(libraryItemOf(asset({ type: 'BINARY', mimeType: 'application/pdf' }))).toMatchObject({ kind: 'file' });
  });
});

describe('listOptionsOf', () => {
  it('pages by offset, searches the name, filters kinds and tags, and keeps one order', () => {
    expect(
      listOptionsOf({ cursor: '20', limit: 500, term: ' chair ', type: ['image', 'file'], tags: ['summer'], sorting: 'name:asc' })
    ).toEqual({
      skip: 20,
      take: 100,
      sort: { name: 'ASC', id: 'ASC' },
      filter: {
        name: { contains: 'chair' },
        _or: [{ type: { eq: 'IMAGE' } }, { _and: [{ type: { eq: 'BINARY' } }, { mimeType: { notContains: 'audio/' } }] }],
      },
      tags: ['summer'],
      tagsOperator: 'AND',
    });
  });

  it('refuses a cursor it did not make', () => {
    expect(() => listOptionsOf({ cursor: 'x', limit: 5 })).toThrow(expect.objectContaining({ code: 'invalid_request' }));
  });
});

describe('the media library', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is not enabled without the Admin API', () => {
    expect(() => assetsClientOf({} as VendureContext)).toThrow(expect.objectContaining({ code: 'not_enabled' }));
  });

  it('answers a next page only while Vendure holds more', async () => {
    fakeShopApi({ AdminAssets: { data: { assets: { totalItems: 3, items: [asset(), asset({ id: '2' })] } } } });
    expect((await listAssets(admin(), { limit: 2 })).nextCursor).toBe('2');
    fakeShopApi({ AdminAssets: { data: { assets: { totalItems: 3, items: [asset({ id: '3' })] } } } });
    expect(await listAssets(admin(), { limit: 2, cursor: '2' })).not.toHaveProperty('nextCursor');
  });

  it('uploads every file in one multipart request, a refused file costing only itself', async () => {
    const api = fakeShopApi({
      AdminCreateAssets: {
        data: {
          createAssets: [asset({ id: '9' }), { errorCode: 'MIME_TYPE_ERROR', message: 'not allowed', fileName: 'b.tif', mimeType: 'x' }],
        },
      },
    });
    const outcomes = await uploadAssets(admin(), [await file('a.png'), await file('b.tif', 'image/tiff')]);
    expect(outcomes).toEqual([
      { ref: '0', ok: true, item: expect.objectContaining({ externalId: '9' }) },
      { ref: '1', ok: false, error: { code: 'unsupported_type', message: 'b.tif: not allowed' } },
    ]);
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]!.variables).toEqual({ input: [{ file: null }, { file: null }] });
    expect(Object.keys(api.calls[0]!.files!)).toEqual(['0', '1']);
    expect(api.calls[0]!.headers['apollo-require-preflight']).toBe('true');
  });

  it('refuses more files than a batch takes, before reading any', async () => {
    const api = fakeShopApi({});
    const files = await Promise.all(Array.from({ length: 11 }, (_, index) => file(`${index}.png`)));
    await expect(uploadAssets(admin(), files)).rejects.toMatchObject({ code: 'invalid_request' });
    expect(api.calls).toHaveLength(0);
  });

  it('refuses a file of a type it does not take, an SVG, or one whose name hides another type, and sends the rest', async () => {
    const api = fakeShopApi({ AdminCreateAssets: { data: { createAssets: [asset({ id: '9' })] } } });
    const outcomes = await uploadAssets(admin(), [
      await file('archive.pdf', 'application/zip'),
      await file('logo.png', 'image/svg+xml'),
      await file('logo.svg', 'image/png'),
      await file('page.html', 'image/png'),
      await file('ok.png'),
    ]);
    expect(outcomes.map((outcome) => (outcome.ok ? 'ok' : outcome.error.message))).toEqual([
      expect.stringContaining('not an image'),
      expect.stringContaining('SVG'),
      expect.stringContaining('extension'),
      expect.stringContaining('extension'),
      'ok',
    ]);
    expect(outcomes.slice(0, 4).every((outcome) => !outcome.ok && outcome.error.code === 'unsupported_type')).toBe(true);
    expect(outcomes[4]).toMatchObject({ ref: '4' });
    expect(api.calls[0]!.variables).toEqual({ input: [{ file: null }] });
    expect(Object.keys(api.calls[0]!.files!)).toEqual(['0']);

    fakeShopApi({});
    expect(await uploadAssets(admin(), [await file('a.exe', 'application/x-msdownload')])).toMatchObject([{ ok: false }]);
  });

  it('waits longer for an upload, and says its outcome is unknown when the wait runs out', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' })));
    expect(await uploadAssets(admin(), [await file('a.png')])).toEqual([
      { ref: '0', ok: false, error: { code: 'upload_failed', message: expect.stringContaining('unknown') } },
    ]);
    expect(timeout).toHaveBeenCalledWith(60_000);
  });

  it('changes nothing in the shop while the storefront has no project secret', () => {
    const context = { adminClient: admin() } as VendureContext;
    expect(() => changingAssetsClientOf(context, false)).toThrow(expect.objectContaining({ code: 'not_enabled' }));
    expect(changingAssetsClientOf(context, true)).toBe(context.adminClient);
  });

  it('fails every file of a request that fails, without throwing', async () => {
    fakeShopApi({ AdminCreateAssets: { status: 413 } });
    expect(await uploadAssets(admin(), [await file('a.png')])).toEqual([
      { ref: '0', ok: false, error: { code: 'upload_failed', message: expect.stringContaining('413') } },
    ]);
  });

  it('renames and retags, and says when the asset is gone', async () => {
    const api = fakeShopApi({ AdminUpdateAsset: { data: { updateAsset: asset({ name: 'Chair' }) } } });
    await updateAsset(admin(), { assetId: '1', name: 'Chair', tags: [] });
    expect(api.calls[0]!.variables).toEqual({ input: { id: '1', name: 'Chair', tags: [] } });
    fakeShopApi({ AdminUpdateAsset: { errors: [{ message: 'gone', extensions: { code: 'ENTITY_NOT_FOUND' } }] } });
    await expect(updateAsset(admin(), { assetId: '1', name: 'x' })).rejects.toMatchObject({ code: 'not_found' });
  });

  it('refuses to delete an asset the catalog still uses, never forcing it out', async () => {
    const api = fakeShopApi({ AdminDeleteAssets: { data: { deleteAssets: { result: 'NOT_DELETED', message: 'used by 1 product' } } } });
    await expect(deleteAssets(admin(), ['1'])).rejects.toMatchObject({ code: 'invalid_request', message: 'used by 1 product' });
    expect(api.calls[0]!.variables).toEqual({ input: { assetIds: ['1'] } });
  });
});
