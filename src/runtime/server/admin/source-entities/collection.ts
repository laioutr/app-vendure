import { defineVendureSourceEntity } from '../../middleware/defineVendure';
import { canonicalCollections } from '../translatable/canonical';
import { translatableEntity } from '../translatable/connector';
import { COLLECTION } from '../translatable/kinds';

export default defineVendureSourceEntity({ type: COLLECTION.type, ...translatableEntity(COLLECTION, canonicalCollections) });
