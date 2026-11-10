import * as A from './adminDocuments';
import * as D from './documents';
import type * as AT from '../types/vendure-admin.generated';
import type * as T from '../types/vendure.generated';

/** A document string that carries the types of its answer and variables. */
export type VendureDocument<TData, TVariables> = string & { readonly __data?: TData; readonly __variables?: TVariables };

const FRAGMENT_NAME = /^\s*fragment\s+(\w+)/;
const SPREAD = /\.\.\.\s*([A-Z]\w*)/g;

/**
 * Appends every fragment an operation spreads, directly or through another fragment, once each —
 * from the fragments among `documents`.
 */
export const fragmentLibrary = (documents: Record<string, string>) => {
  const fragments = new Map(
    Object.values(documents).flatMap((source) => {
      const name = FRAGMENT_NAME.exec(source)?.[1];
      return name ? [[name, source] as const] : [];
    })
  );
  return (operation: string): string => {
    const needed = new Set<string>();
    const visit = (source: string) => {
      for (const [, name] of source.matchAll(SPREAD)) {
        if (needed.has(name!)) continue;
        const fragment = fragments.get(name!);
        if (!fragment) throw new Error(`[vendure] fragment "${name}" is spread but not defined`);
        needed.add(name!);
        visit(fragment);
      }
    };
    visit(operation);
    return [operation, ...[...needed].map((name) => fragments.get(name)!)].join('\n');
  };
};

/** The Shop API's fragments. Exported for its test; operations below are built with it at module load. */
export const withFragments = fragmentLibrary(D);
const withAdminFragments = fragmentLibrary(A);

const op = <TData, TVariables = Record<string, never>>(source: string) => withFragments(source) as VendureDocument<TData, TVariables>;
const adminOp = <TData, TVariables = Record<string, never>>(source: string) =>
  withAdminFragments(source) as VendureDocument<TData, TVariables>;

export const operations = {
  activeChannel: op<T.ActiveChannelQuery>(D.ActiveChannelQuery),
  inStockSearchProbe: op<T.InStockSearchProbeQuery>(D.InStockSearchProbeQuery),

  productBySlug: op<T.ProductBySlugQuery, T.ProductBySlugQueryVariables>(D.ProductBySlugQuery),
  productsByIds: op<T.ProductsByIdsQuery, T.ProductsByIdsQueryVariables>(D.ProductsByIdsQuery),
  productPageEntries: op<T.ProductPageEntriesQuery, T.ProductPageEntriesQueryVariables>(D.ProductPageEntriesQuery),
  search: op<T.SearchQuery, T.SearchQueryVariables>(D.SearchQuery),
  collectionBySlug: op<T.CollectionBySlugQuery, T.CollectionBySlugQueryVariables>(D.CollectionBySlugQuery),
  collections: op<T.CollectionsQuery, T.CollectionsQueryVariables>(D.CollectionsQuery),

  activeOrder: op<T.ActiveOrderQuery>(D.ActiveOrderQuery),
  activeOrderQuantities: op<T.ActiveOrderQuantitiesQuery>(D.ActiveOrderQuantitiesQuery),
  addItemsToOrder: op<T.AddItemsToOrderMutation, T.AddItemsToOrderMutationVariables>(D.AddItemsToOrderMutation),
  adjustOrderLine: op<T.AdjustOrderLineMutation, T.AdjustOrderLineMutationVariables>(D.AdjustOrderLineMutation),
  removeOrderLine: op<T.RemoveOrderLineMutation, T.RemoveOrderLineMutationVariables>(D.RemoveOrderLineMutation),
  applyCouponCode: op<T.ApplyCouponCodeMutation, T.ApplyCouponCodeMutationVariables>(D.ApplyCouponCodeMutation),
  removeCouponCode: op<T.RemoveCouponCodeMutation, T.RemoveCouponCodeMutationVariables>(D.RemoveCouponCodeMutation),

  checkoutState: op<T.CheckoutStateQuery>(D.CheckoutStateQuery),
  setCustomerForOrder: op<T.SetCustomerForOrderMutation, T.SetCustomerForOrderMutationVariables>(D.SetCustomerForOrderMutation),
  setOrderShippingAddress: op<T.SetOrderShippingAddressMutation, T.SetOrderShippingAddressMutationVariables>(
    D.SetOrderShippingAddressMutation
  ),
  setOrderBillingAddress: op<T.SetOrderBillingAddressMutation, T.SetOrderBillingAddressMutationVariables>(D.SetOrderBillingAddressMutation),
  setOrderShippingMethod: op<T.SetOrderShippingMethodMutation, T.SetOrderShippingMethodMutationVariables>(D.SetOrderShippingMethodMutation),
  transitionOrderToState: op<T.TransitionOrderToStateMutation, T.TransitionOrderToStateMutationVariables>(D.TransitionOrderToStateMutation),
  activeOrderPaymentState: op<T.ActiveOrderPaymentStateQuery>(D.ActiveOrderPaymentStateQuery),
  addPaymentToOrder: op<T.AddPaymentToOrderMutation, T.AddPaymentToOrderMutationVariables>(D.AddPaymentToOrderMutation),
  orderByCode: op<T.OrderByCodeQuery, T.OrderByCodeQueryVariables>(D.OrderByCodeQuery),

  login: op<T.LoginMutation, T.LoginMutationVariables>(D.LoginMutation),
  logout: op<T.LogoutMutation>(D.LogoutMutation),
  registerCustomerAccount: op<T.RegisterCustomerAccountMutation, T.RegisterCustomerAccountMutationVariables>(
    D.RegisterCustomerAccountMutation
  ),
  verifyCustomerAccount: op<T.VerifyCustomerAccountMutation, T.VerifyCustomerAccountMutationVariables>(D.VerifyCustomerAccountMutation),
  requestPasswordReset: op<T.RequestPasswordResetMutation, T.RequestPasswordResetMutationVariables>(D.RequestPasswordResetMutation),
  resetPassword: op<T.ResetPasswordMutation, T.ResetPasswordMutationVariables>(D.ResetPasswordMutation),

  activeCustomer: op<T.ActiveCustomerQuery>(D.ActiveCustomerQuery),
  updateCustomer: op<T.UpdateCustomerMutation, T.UpdateCustomerMutationVariables>(D.UpdateCustomerMutation),
  updateCustomerPassword: op<T.UpdateCustomerPasswordMutation, T.UpdateCustomerPasswordMutationVariables>(D.UpdateCustomerPasswordMutation),
  requestUpdateCustomerEmailAddress: op<T.RequestUpdateCustomerEmailAddressMutation, T.RequestUpdateCustomerEmailAddressMutationVariables>(
    D.RequestUpdateCustomerEmailAddressMutation
  ),
  updateCustomerEmailAddress: op<T.UpdateCustomerEmailAddressMutation, T.UpdateCustomerEmailAddressMutationVariables>(
    D.UpdateCustomerEmailAddressMutation
  ),
  createCustomerAddress: op<T.CreateCustomerAddressMutation, T.CreateCustomerAddressMutationVariables>(D.CreateCustomerAddressMutation),
  updateCustomerAddress: op<T.UpdateCustomerAddressMutation, T.UpdateCustomerAddressMutationVariables>(D.UpdateCustomerAddressMutation),
  deleteCustomerAddress: op<T.DeleteCustomerAddressMutation, T.DeleteCustomerAddressMutationVariables>(D.DeleteCustomerAddressMutation),

  customerOrders: op<T.CustomerOrdersQuery, T.CustomerOrdersQueryVariables>(D.CustomerOrdersQuery),
  orderById: op<T.OrderByIdQuery, T.OrderByIdQueryVariables>(D.OrderByIdQuery),
};

/** Operations of the Admin API, sent with the key's client. */
export const adminOperations = {
  assets: adminOp<AT.AdminAssetsQuery, AT.AdminAssetsQueryVariables>(A.AdminAssetsQuery),
  createAssets: adminOp<AT.AdminCreateAssetsMutation, AT.AdminCreateAssetsMutationVariables>(A.AdminCreateAssetsMutation),
  updateAsset: adminOp<AT.AdminUpdateAssetMutation, AT.AdminUpdateAssetMutationVariables>(A.AdminUpdateAssetMutation),
  deleteAssets: adminOp<AT.AdminDeleteAssetsMutation, AT.AdminDeleteAssetsMutationVariables>(A.AdminDeleteAssetsMutation),
};
