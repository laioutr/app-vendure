import { SuggestedSearchBase } from '@laioutr-core/canonical-types/entity/suggested-search';
import { defineVendureComponentResolver } from '../../middleware/defineVendure';

const ID_PREFIX = 'suggested-search:';

export default defineVendureComponentResolver({
  entityType: 'SuggestedSearch',
  label: 'Vendure Suggested Search Resolver',
  provides: [SuggestedSearchBase],
  resolve: ({ entityIds, $entity }) => ({
    entities: entityIds.map((id) => $entity({ id, base: () => ({ query: id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : id }) })),
  }),
});
