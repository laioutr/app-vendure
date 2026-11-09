import { CategoryBySlugQuery } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureQueryTemplateProvider } from '../../middleware/defineVendure';
import { collectionChoices } from '../../services/catalog';

export default defineVendureQueryTemplateProvider({
  for: CategoryBySlugQuery,
  run: async ({ input, context }) =>
    (await collectionChoices(context.catalogClient, input.term)).map((collection) => ({
      input: { slug: collection.slug },
      label: collection.name,
    })),
});
