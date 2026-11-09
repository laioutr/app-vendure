import { defineVendureSourceEntity } from '../../middleware/defineVendure';
import { canonicalProducts } from '../translatable/canonical';
import { translatableEntity } from '../translatable/connector';
import { PRODUCT } from '../translatable/kinds';

export default defineVendureSourceEntity({ type: PRODUCT.type, ...translatableEntity(PRODUCT, canonicalProducts) });
