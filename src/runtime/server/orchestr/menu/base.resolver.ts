import { MenuItemBase } from '@laioutr-core/canonical-types/entity/menuItem';
import { menuToken } from '../../const/passthroughTokens';
import { defineVendureComponentResolver } from '../../middleware/defineVendure';
import { menuBelow } from '../../services/catalog';

export default defineVendureComponentResolver({
  entityType: 'MenuItem',
  label: 'Vendure Menu Resolver',
  provides: [MenuItemBase],
  cache: { ttl: '1 hour' },
  resolve: async ({ entityIds, context, passthrough, $entity }) => {
    const entries = passthrough.get(menuToken) ?? (await menuBelow(context.catalogClient, 'root')) ?? [];
    const byId = new Map(entries.map((entry) => [entry.id, entry]));

    const entities = entityIds.flatMap((id) => {
      const entry = byId.get(id);
      if (!entry) return [];
      return [
        $entity({
          id,
          base: () => ({
            type: 'link' as const,
            name: entry.name,
            link: { type: 'reference' as const, reference: { type: 'Category' as const, slug: entry.slug, id: entry.id } },
            parentId: entry.parentInTree,
            childIds: entry.childIds,
          }),
        }),
      ];
    });

    return { entities, notFound: entityIds.filter((id) => !byId.has(id)) };
  },
});
