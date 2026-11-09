import { SuggestedSearchEntryBase } from '@laioutr-core/canonical-types/entity/suggested-search-entry';
import { suggestedEntriesToken } from '../../const/passthroughTokens';
import { suggestedEntryBase } from '../../mappers/suggestedSearch';
import { defineVendureComponentResolver } from '../../middleware/defineVendure';

export default defineVendureComponentResolver({
  entityType: 'SuggestedSearchEntry',
  label: 'Vendure Suggested Search Entry Resolver',
  provides: [SuggestedSearchEntryBase],
  resolve: ({ entityIds, passthrough, $entity }) => {
    const byId = new Map((passthrough.get(suggestedEntriesToken) ?? []).map((entry) => [entry.id, entry]));
    return {
      entities: entityIds.flatMap((id) => {
        const entry = byId.get(id);
        return entry ? [$entity({ id, base: () => suggestedEntryBase(entry) })] : [];
      }),
      notFound: entityIds.filter((id) => !byId.has(id)),
    };
  },
});
