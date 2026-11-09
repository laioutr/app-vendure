import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { SHOP_API_URL } from './client';
import type { TranslatableKind } from '../../src/runtime/server/admin/translatable/kinds';
import { deleteAssets, listAssets, updateAsset, uploadAssets } from '../../src/runtime/server/admin/assets';
import { canonicalCollections, canonicalProducts } from '../../src/runtime/server/admin/translatable/canonical';
import { translatableEntity } from '../../src/runtime/server/admin/translatable/connector';
import * as KINDS from '../../src/runtime/server/admin/translatable/kinds';
import { vendureContext } from '../../src/runtime/server/middleware/vendureContext';

/**
 * The Admin API side — translation and the media library — against a Vendure that grants a key.
 * They write: a translation into the channel's second language, put back to the original afterwards,
 * and one small image, deleted again. Skipped without `VENDURE_CONTRACT_ADMIN_API_URL` and
 * `VENDURE_CONTRACT_ADMIN_API_KEY`.
 */
const ADMIN_API_URL = process.env.VENDURE_CONTRACT_ADMIN_API_URL;
const ADMIN_API_KEY = process.env.VENDURE_CONTRACT_ADMIN_API_KEY;

const context = () =>
  vendureContext(
    { shopApiUrl: SHOP_API_URL, adminApiUrl: ADMIN_API_URL, adminApiKey: ADMIN_API_KEY },
    { market: { slug: 'contract-admin', currency: 'USD' }, localeChain: ['en'], onSessionToken: () => {} }
  );

const KIND_LIST: TranslatableKind[] = [
  KINDS.PRODUCT,
  KINDS.PRODUCT_VARIANT,
  KINDS.COLLECTION,
  KINDS.FACET,
  KINDS.FACET_VALUE,
  KINDS.PRODUCT_OPTION_GROUP,
  KINDS.SHIPPING_METHOD,
  KINDS.PAYMENT_METHOD,
];

describe.skipIf(!ADMIN_API_URL || !ADMIN_API_KEY)('source entities against the Admin API', () => {
  const restore: (() => Promise<unknown>)[] = [];
  afterAll(async () => {
    for (const undo of restore.reverse()) await undo();
  });

  it.each(KIND_LIST)('describes, counts and walks every $type once', async (kind) => {
    const ctx = await context();
    const connector = translatableEntity(kind);
    const description = await connector.describe(ctx);
    const primary = description.locales.find((locale) => locale.primary)!;
    expect(primary.writable).toBe(false);
    const { count } = await connector.count!(ctx);

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await connector.list(
        { cursor, limit: 7, locales: description.locales.filter((locale) => !locale.primary).map((locale) => locale.code) },
        ctx
      );
      seen.push(...page.entities.map((entity) => entity.id), ...(page.skipped ?? []).map((skipped) => skipped.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen.length).toBe(count);
    expect(new Set(seen).size).toBe(count);
  });

  it('reads products and collections with their storefront entities, and names what is missing', async () => {
    const ctx = await context();
    const products = translatableEntity(KINDS.PRODUCT, canonicalProducts);
    const { entities, missing } = await products.read({ ids: ['1', 'no-such-id'], locales: [] }, ctx);
    expect(missing).toEqual(['no-such-id']);
    expect(entities[0]!.canonical?.components).toHaveProperty('prices');
    expect(entities[0]!.canonical?.children?.ProductVariant?.length).toBeGreaterThan(0);

    const collections = translatableEntity(KINDS.COLLECTION, canonicalCollections);
    const page = await collections.list({ limit: 3, locales: [] }, ctx);
    expect(page.entities[0]!.canonical?.components).toHaveProperty('base');
  });

  it('writes a translation, refuses a stale one, finds the entity as changed, and puts it back', async () => {
    const ctx = await context();
    const connector = translatableEntity(KINDS.PRODUCT);
    const locale = (await connector.describe(ctx)).locales.find((candidate) => !candidate.primary)!.code;
    const before = Date.now() - 1000;
    // A product that already has a row in the language, so the test only changes a text and puts it back.
    const product = (await connector.list({ limit: 50, locales: [locale] }, ctx)).entities.find(
      (entity) => typeof entity.translations?.[locale]?.name === 'string'
    )!;
    const original = product.translations![locale]!.name as string;
    restore.push(() =>
      connector.write!({ entities: [{ id: product.id, operations: [{ op: 'set', index: 0, path: ['name'], locale, value: original }] }] }, ctx)
    );

    const written = await connector.write!(
      {
        entities: [
          {
            id: product.id,
            ifVersion: product.version,
            operations: [{ op: 'set', index: 0, path: ['name'], locale, value: 'Vertragstest' }],
          },
        ],
      },
      ctx
    );
    expect(written).toEqual([{ id: product.id, version: product.version, failed: [] }]);
    const [again] = (await connector.read({ ids: [product.id], locales: [locale] }, ctx)).entities;
    expect(again!.translations?.[locale]?.name).toBe('Vertragstest');

    const stale = await connector.write!(
      { entities: [{ id: product.id, ifVersion: 'old', operations: [{ op: 'set', index: 0, path: ['name'], locale, value: 'x' }] }] },
      ctx
    );
    expect(stale[0]).toMatchObject({ error: { code: 'stale' } });

    const changed = await connector.list({ limit: 50, locales: [], changedSince: new Date(before).toISOString() }, ctx);
    expect(changed.entities.map((entity) => entity.id)).toContain(product.id);
  });

  it("writes an option of a group through the group, and lists the group as changed though only the option's moment moved", async () => {
    const ctx = await context();
    const connector = translatableEntity(KINDS.PRODUCT_OPTION_GROUP);
    const locale = (await connector.describe(ctx)).locales.find((candidate) => !candidate.primary)!.code;
    // A group with an option already translated, so the test changes that text and puts it back.
    const page = await connector.list({ limit: 50, locales: [locale] }, ctx);
    const group = page.entities.find((entity) => (entity.translations?.[locale]?.options as unknown[] | undefined)?.length)!;
    const option = (group.translations![locale]!.options as { id: string; name: string }[])[0]!;
    const optionPath = [['options', option.id] as [string, string], 'name'];
    restore.push(() =>
      connector.write!({ entities: [{ id: group.id, operations: [{ op: 'set', index: 0, path: optionPath, locale, value: option.name }] }] }, ctx)
    );
    const before = new Date().toISOString();

    const [result] = await connector.write!(
      { entities: [{ id: group.id, operations: [{ op: 'set', index: 0, path: optionPath, locale, value: `${option.name} (Test)` }] }] },
      ctx
    );
    expect(result).toMatchObject({ failed: [] });
    const [again] = (await connector.read({ ids: [group.id], locales: [locale] }, ctx)).entities;
    expect(again!.translations?.[locale]?.options).toContainEqual({ id: option.id, name: `${option.name} (Test)` });

    const changed = await connector.list({ limit: 50, locales: [], changedSince: before }, ctx);
    expect(changed.entities.map((entity) => entity.id)).toContain(group.id);
  });

  it('creates a language row only with every required text, holding just what was written, and never a copy', async () => {
    const ctx = await context();
    const connector = translatableEntity(KINDS.PRODUCT);
    // A language the channel does not offer: Vendure stores it like any other, and the storefront's languages stay as they are.
    const locale = 'it';
    const product = (await connector.list({ limit: 50, locales: [locale] }, ctx)).entities.find(
      (entity) => Object.keys(entity.translations?.[locale] ?? {}).length === 0 && typeof entity.data.description === 'string'
    )!;
    const set = (index: number, path: string, value: string) => ({ op: 'set' as const, index, path: [path], locale, value });

    const partial = await connector.write!({ entities: [{ id: product.id, operations: [set(0, 'name', 'Prova')] }] }, ctx);
    expect(partial[0]).toMatchObject({ error: { code: 'invalid' } });
    expect((await connector.read({ ids: [product.id], locales: [locale] }, ctx)).entities[0]!.translations?.[locale]).toEqual({});

    const slug = `contract-${Date.now()}`;
    const created = await connector.write!(
      { entities: [{ id: product.id, operations: [set(0, 'name', 'Prova'), set(1, 'slug', slug)] }] },
      ctx
    );
    expect(created[0]).toMatchObject({ failed: [] });

    const description = product.data.description as string;
    const { adminClient } = ctx;
    const setOriginal = (value: string) =>
      adminClient!.request(
        `mutation VendureContractOriginal($input: UpdateProductInput!) { updateProduct(input: $input) { id } }` as never,
        { input: { id: product.id, translations: [{ languageCode: ctx.channel!.defaultLanguageCode, description: value }] } } as never
      );
    await setOriginal(`${description} (changed)`);
    try {
      const [read] = (await connector.read({ ids: [product.id], locales: [locale] }, ctx)).entities;
      expect(read!.data.description).toBe(`${description} (changed)`);
      expect(read!.translations?.[locale]).toEqual({ name: 'Prova', slug });
    } finally {
      await setOriginal(description);
    }

    const removed = await connector.write!(
      { entities: [{ id: product.id, operations: [{ op: 'remove', index: 0, path: ['name'], locale }] }] },
      ctx
    );
    expect(removed[0]).toMatchObject({ error: { code: 'unsupported' } });
  });
});

/** A 1×1 PNG. */
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

describe.skipIf(!ADMIN_API_URL || !ADMIN_API_KEY)('media library against the Admin API', () => {
  it('lists, searches and filters assets, page by page', async () => {
    const { adminClient } = await context();
    const first = await listAssets(adminClient!, { limit: 5 });
    expect(first.items.length).toBe(5);
    expect(first.nextCursor).toBe('5');
    const second = await listAssets(adminClient!, { limit: 5, cursor: first.nextCursor });
    expect(second.items.map((item) => item.externalId)).not.toContain(first.items[0]!.externalId);
    const images = await listAssets(adminClient!, { limit: 5, type: ['image'] });
    expect(images.items.every((item) => item.kind !== 'file' && item.media.type === 'image')).toBe(true);
    const files = await listAssets(adminClient!, { limit: 5, type: ['file'] });
    expect(files.items.every((item) => item.kind === 'file')).toBe(true);
  });

  it('uploads an image, renames and tags it, finds it by tag and term, and deletes it', async () => {
    const { adminClient } = await context();
    const directory = await mkdtemp(join(tmpdir(), 'vendure-contract-'));
    const filepath = join(directory, 'contract-pixel.png');
    await writeFile(filepath, PIXEL);
    const [uploaded] = await uploadAssets(adminClient!, [
      { name: 'contract-pixel.png', mimeType: 'image/png', size: PIXEL.length, filepath, getStream: () => undefined as never },
    ]);
    expect(uploaded).toMatchObject({ ok: true });
    const id = uploaded!.ok ? uploaded!.item.externalId! : '';
    try {
      const tag = `contract-${Date.now()}`;
      const updated = await updateAsset(adminClient!, { assetId: id, name: 'Contract pixel', tags: [tag] });
      expect(updated).toMatchObject({ fileName: 'Contract pixel', tags: [tag] });
      expect((await listAssets(adminClient!, { limit: 5, tags: [tag] })).items.map((item) => item.externalId)).toEqual([id]);
      expect((await listAssets(adminClient!, { limit: 5, term: 'Contract pix' })).items.map((item) => item.externalId)).toContain(id);
    } finally {
      await deleteAssets(adminClient!, [id]);
    }
    expect((await listAssets(adminClient!, { limit: 5, term: 'Contract pix' })).items.map((item) => item.externalId)).not.toContain(id);
  });

  it('refuses a file type the library does not take, without sending it', async () => {
    const { adminClient } = await context();
    const directory = await mkdtemp(join(tmpdir(), 'vendure-contract-'));
    const filepath = join(directory, 'contract.exe');
    await writeFile(filepath, Buffer.from('MZ'));
    const [refused] = await uploadAssets(adminClient!, [
      { name: 'contract.exe', mimeType: 'application/x-msdownload', size: 2, filepath, getStream: () => undefined as never },
    ]);
    expect(refused).toMatchObject({ ok: false, error: { code: 'unsupported_type' } });
  });
});
