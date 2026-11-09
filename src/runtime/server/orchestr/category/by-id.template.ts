import { CategoryByIdQuery } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureQueryTemplateProvider } from '../../middleware/defineVendure';
import { collectionChoices } from '../../services/catalog';

export default defineVendureQueryTemplateProvider({
  for: CategoryByIdQuery,
  run: async ({ input, context }) =>
    (await collectionChoices(context.catalogClient, input.term)).map((collection) => ({ input: { id: collection.id }, label: collection.name })),
});
