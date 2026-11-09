import type { VendureClient } from '../client/VendureClient';
import { operations } from '../client/operations';
import { MAX_PAGE_SIZE } from '../const';

export const productPageEntriesPage = async (client: VendureClient, options: { skip: number; take: number; term?: string }) =>
  (
    await client.request(operations.productPageEntries, {
      options: {
        skip: options.skip,
        take: Math.min(options.take, MAX_PAGE_SIZE),
        sort: { id: 'ASC' },
        ...(options.term ? { filter: { name: { contains: options.term } } } : {}),
      },
    })
  ).products;
