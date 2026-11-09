import { ProductByIdQuery } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureQueryTemplateProvider } from '../../middleware/defineVendure';
import { productPageEntriesPage } from '../../services/pageIndex';

export default defineVendureQueryTemplateProvider({
  for: ProductByIdQuery,
  run: async ({ input, context }) => {
    const { items } = await productPageEntriesPage(context.catalogClient, { skip: 0, take: 25, term: input.term || undefined });
    return items.map((product) => ({ input: { id: product.id }, label: product.name }));
  },
});
