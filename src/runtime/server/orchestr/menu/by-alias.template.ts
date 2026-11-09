import { MenuByAliasQuery } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureQueryTemplateProvider } from '../../middleware/defineVendure';
import { collectionChoices } from '../../services/catalog';

export default defineVendureQueryTemplateProvider({
  for: MenuByAliasQuery,
  run: async ({ input, context }) => [
    ...(input.term ? [] : [{ input: { alias: 'root' }, label: 'All collections' }]),
    ...(await collectionChoices(context.catalogClient, input.term)).map((collection) => ({ input: { alias: collection.slug }, label: collection.name })),
  ],
});
