import { defineVendureSourceEntity } from '../../middleware/defineVendure';
import { translatableEntity } from '../translatable/connector';
import { FACET_VALUE } from '../translatable/kinds';

export default defineVendureSourceEntity({ type: FACET_VALUE.type, ...translatableEntity(FACET_VALUE) });
