import { SuggestedSearchProductsLink } from '@laioutr-core/canonical-types/suggested-search';
import { suggestedEntriesToken } from '../../const/passthroughTokens';
import { defineVendureLink } from '../../middleware/defineVendure';

export default defineVendureLink(SuggestedSearchProductsLink, ({ entityIds, passthrough }) => {
  const productIds = (passthrough.get(suggestedEntriesToken) ?? []).flatMap((entry) => (entry.type === 'product' && entry.entityId ? [entry.entityId] : []));
  return { links: entityIds.map((id) => ({ sourceId: id, targetIds: productIds })) };
});
