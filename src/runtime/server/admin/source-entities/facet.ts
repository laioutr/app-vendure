import { defineVendureSourceEntity } from '../../middleware/defineVendure';
import { translatableEntity } from '../translatable/connector';
import { FACET } from '../translatable/kinds';

export default defineVendureSourceEntity({ type: FACET.type, ...translatableEntity(FACET) });
