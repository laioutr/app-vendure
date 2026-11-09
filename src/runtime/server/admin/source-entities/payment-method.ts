import { defineVendureSourceEntity } from '../../middleware/defineVendure';
import { translatableEntity } from '../translatable/connector';
import { PAYMENT_METHOD } from '../translatable/kinds';

export default defineVendureSourceEntity({ type: PAYMENT_METHOD.type, ...translatableEntity(PAYMENT_METHOD) });
