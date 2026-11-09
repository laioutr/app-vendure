import { defineVendureSourceEntity } from '../../middleware/defineVendure';
import { translatableEntity } from '../translatable/connector';
import { PRODUCT_VARIANT } from '../translatable/kinds';

export default defineVendureSourceEntity({ type: PRODUCT_VARIANT.type, ...translatableEntity(PRODUCT_VARIANT) });
