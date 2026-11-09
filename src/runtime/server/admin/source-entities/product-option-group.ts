import { defineVendureSourceEntity } from '../../middleware/defineVendure';
import { translatableEntity } from '../translatable/connector';
import { PRODUCT_OPTION_GROUP } from '../translatable/kinds';

export default defineVendureSourceEntity({ type: PRODUCT_OPTION_GROUP.type, ...translatableEntity(PRODUCT_OPTION_GROUP) });
