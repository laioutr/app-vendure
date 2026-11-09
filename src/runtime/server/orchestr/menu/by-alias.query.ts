import { MenuByAliasQuery } from '@laioutr-core/canonical-types/ecommerce';
import { menuToken } from '../../const/passthroughTokens';
import { defineVendureQuery } from '../../middleware/defineVendure';
import { menuBelow } from '../../services/catalog';

/**
 * A menu is the collection tree: `root` (or `main`) names the whole tree, any other alias the
 * collection whose descendants form the menu.
 */
export default defineVendureQuery({
  implements: MenuByAliasQuery,
  cache: {
    ttl: '1 hour',
    swr: true,
    staleMaxAge: '1 day',
    // The resolver reads the tree from the passthrough; a cache hit without it would fetch it again.
    includePassthrough: true,
  },
  run: async ({ context, input, passthrough }) => {
    const entries = await menuBelow(context.catalogClient, input.alias);
    if (!entries) {
      console.warn(`[vendure] Menu "${input.alias}": no collection has that slug, so the menu stays empty.`);
      return { ids: [] };
    }

    passthrough.set(menuToken, entries);
    return { ids: entries.map((entry) => entry.id), total: entries.length };
  },
});
