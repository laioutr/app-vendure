import { CategoryByIdQuery } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureQuery } from '../../middleware/defineVendure';

// The Category resolver reads the collection and answers not found for an unknown id.
export default defineVendureQuery(CategoryByIdQuery, ({ input }) => ({ id: input.id }));
