import { defineVendureSourceEntity } from '../../middleware/defineVendure';
import { translatableEntity } from '../translatable/connector';
import { SHIPPING_METHOD } from '../translatable/kinds';

export default defineVendureSourceEntity({ type: SHIPPING_METHOD.type, ...translatableEntity(SHIPPING_METHOD) });
