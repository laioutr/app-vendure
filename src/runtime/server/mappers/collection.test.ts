import { describe, expect, it } from 'vitest';
import { categoryComponents, categoryCrumb, collectionTrail, flattenCollectionTree } from './collection';

describe('collectionTrail', () => {
  it('leaves out the root collection', () => {
    expect(collectionTrail([{ id: '1', name: 'root', slug: '__root_collection__' }, { id: '2', name: 'A', slug: 'a' }])).toEqual([{ id: '2', name: 'A', slug: 'a' }]);
  });
});

describe('categoryCrumb', () => {
  it('links a step to its category and marks only the current page', () => {
    expect(categoryCrumb({ id: '2', name: 'A', slug: 'a' })).toEqual({
      id: 'breadcrumb:category:2',
      base: { name: 'A', link: { type: 'reference', reference: { type: 'Category', slug: 'a', id: '2' } } },
    });
    expect(categoryCrumb({ id: '2', name: 'A', slug: 'a' }, true).base).toMatchObject({ isCurrentPage: true });
  });
});

describe('categoryComponents', () => {
  it('describes the category for search engines in plain text', () => {
    const collection = { id: '1', name: 'Tea', slug: 'tea', description: '<p>Green&nbsp;&amp; black</p>', position: 0, parentId: '0', featuredAsset: null, breadcrumbs: [], children: [] };
    expect(categoryComponents(collection).seo).toEqual({ title: 'Tea', description: 'Green & black' });
  });
});

describe('flattenCollectionTree', () => {
  const node = (id: string, parentId: string, position: number) => ({ id, name: `N${id}`, slug: `n${id}`, parentId, position });
  const tree = [node('2', '1', 1), node('3', '2', 1), node('4', '2', 0), node('5', '1', 0), node('6', '9', 0)];

  it('walks depth first in position order, without the root itself', () => {
    expect(flattenCollectionTree(tree, '1').map((entry) => [entry.id, entry.parentInTree, entry.childIds])).toEqual([
      ['5', undefined, []],
      ['2', undefined, ['4', '3']],
      ['4', '2', []],
      ['3', '2', []],
    ]);
  });

  it('answers a subtree for a collection', () => {
    expect(flattenCollectionTree(tree, '2').map((entry) => entry.id)).toEqual(['4', '3']);
  });
});
