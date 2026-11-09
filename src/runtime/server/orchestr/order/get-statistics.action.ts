import { OrderGetStatisticsAction } from '@laioutr-core/canonical-types/ecommerce';
import { monthlyStatistics } from '../../mappers/statistics';
import { defineVendureAction } from '../../middleware/defineVendure';
import { customerOrdersOfYear } from '../../services/order';

export default defineVendureAction(OrderGetStatisticsAction, async ({ context, input }) => {
  const year = input.year ?? new Date().getUTCFullYear();
  return { year, months: monthlyStatistics(await customerOrdersOfYear(context.vendureClient, year)) };
});
