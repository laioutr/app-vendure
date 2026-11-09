import { ProductByIdQuery } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureQuery } from '../../middleware/defineVendure';

// The id is the entity id; the Product resolver reads it and answers not found for an unknown one.
export default defineVendureQuery(ProductByIdQuery, ({ input }) => ({ id: input.id }));
