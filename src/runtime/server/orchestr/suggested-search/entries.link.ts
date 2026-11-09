import { SuggestedSearchEntriesLink } from '@laioutr-core/canonical-types/suggested-search';
import { suggestedEntriesToken } from '../../const/passthroughTokens';
import { defineVendureLink } from '../../middleware/defineVendure';

export default defineVendureLink(SuggestedSearchEntriesLink, ({ entityIds, passthrough }) => {
  const entries = passthrough.get(suggestedEntriesToken) ?? [];
  return { links: entityIds.map((id) => ({ sourceId: id, targetIds: entries.map((entry) => entry.id) })) };
});
