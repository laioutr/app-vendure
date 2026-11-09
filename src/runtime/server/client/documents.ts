/**
 * Every GraphQL document the connector sends, each written once.
 *
 * A fragment is a document of its own and an operation names the fragments it spreads, so codegen
 * types both and `withFragments` appends exactly what one operation needs.
 */

export const ErrorResultFields = /* GraphQL */ `
  fragment ErrorResultFields on ErrorResult {
    errorCode
    message
  }
`;

export const AssetFields = /* GraphQL */ `
  fragment AssetFields on Asset {
    id
    name
    type
    mimeType
    preview
    source
    width
    height
    focalPoint {
      x
      y
    }
  }
`;

export const VariantFields = /* GraphQL */ `
  fragment VariantFields on ProductVariant {
    id
    productId
    sku
    name
    price
    priceWithTax
    currencyCode
    stockLevel
    featuredAsset {
      ...AssetFields
    }
    options {
      id
      code
      name
      group {
        id
        code
        name
      }
    }
  }
`;

export const ProductFields = /* GraphQL */ `
  fragment ProductFields on Product {
    id
    name
    slug
    description
    featuredAsset {
      ...AssetFields
    }
    assets {
      ...AssetFields
    }
    optionGroups {
      id
      code
      name
      options {
        id
        code
        name
      }
    }
    variants {
      ...VariantFields
    }
    collections {
      id
      name
      slug
      breadcrumbs {
        id
        name
        slug
      }
    }
    facetValues {
      id
      code
      name
      facet {
        id
        code
        name
      }
    }
  }
`;

export const CollectionFields = /* GraphQL */ `
  fragment CollectionFields on Collection {
    id
    name
    slug
    description
    position
    parentId
    featuredAsset {
      ...AssetFields
    }
    breadcrumbs {
      id
      name
      slug
    }
    children {
      id
      name
      slug
      position
    }
  }
`;

export const OrderAddressFields = /* GraphQL */ `
  fragment OrderAddressFields on OrderAddress {
    fullName
    company
    streetLine1
    streetLine2
    city
    province
    postalCode
    countryCode
    phoneNumber
  }
`;

export const DiscountFields = /* GraphQL */ `
  fragment DiscountFields on Discount {
    adjustmentSource
    type
    description
    amount
    amountWithTax
  }
`;

export const OrderLineFields = /* GraphQL */ `
  fragment OrderLineFields on OrderLine {
    id
    quantity
    unitPrice
    unitPriceWithTax
    discountedUnitPriceWithTax
    linePriceWithTax
    discountedLinePriceWithTax
    proratedLinePriceWithTax
    lineTax
    taxRate
    featuredAsset {
      ...AssetFields
    }
    discounts {
      ...DiscountFields
    }
    productVariant {
      id
      productId
      sku
      name
      stockLevel
      product {
        id
        name
        slug
      }
      options {
        code
        name
        group {
          code
          name
        }
      }
    }
  }
`;

export const OrderFields = /* GraphQL */ `
  fragment OrderFields on Order {
    id
    code
    state
    active
    createdAt
    orderPlacedAt
    totalQuantity
    subTotal
    subTotalWithTax
    shipping
    shippingWithTax
    total
    totalWithTax
    currencyCode
    couponCodes
    discounts {
      ...DiscountFields
    }
    taxSummary {
      description
      taxRate
      taxBase
      taxTotal
    }
    shippingAddress {
      ...OrderAddressFields
    }
    billingAddress {
      ...OrderAddressFields
    }
    shippingLines {
      id
      priceWithTax
      shippingMethod {
        id
        code
        name
      }
    }
    customer {
      id
      firstName
      lastName
      emailAddress
    }
    payments {
      id
      method
      amount
      state
    }
    fulfillments {
      id
      state
      method
      trackingCode
      createdAt
      lines {
        orderLineId
        quantity
      }
    }
    lines {
      ...OrderLineFields
    }
  }
`;

export const AddressFields = /* GraphQL */ `
  fragment AddressFields on Address {
    id
    fullName
    company
    streetLine1
    streetLine2
    city
    province
    postalCode
    country {
      code
    }
    phoneNumber
    defaultShippingAddress
    defaultBillingAddress
  }
`;

export const CustomerFields = /* GraphQL */ `
  fragment CustomerFields on Customer {
    id
    title
    firstName
    lastName
    emailAddress
    phoneNumber
    addresses {
      ...AddressFields
    }
  }
`;

export const SearchItemFields = /* GraphQL */ `
  fragment SearchItemFields on SearchResult {
    productId
    productName
    slug
    productAsset {
      preview
    }
  }
`;


export const ActiveChannelQuery = /* GraphQL */ `
  query ActiveChannel {
    activeChannel {
      code
      defaultLanguageCode
      availableLanguageCodes
      defaultCurrencyCode
      availableCurrencyCodes
    }
  }
`;


/**
 * `SearchInput.inStock` exists only where the DefaultSearchPlugin indexes stock
 * (`indexStockStatus`, off by default). Asking with it is the one check that works whether or not
 * the server allows introspection.
 */
export const InStockSearchProbeQuery = /* GraphQL */ `
  query InStockSearchProbe {
    search(input: { take: 0, inStock: true }) {
      totalItems
    }
  }
`;

export const ProductBySlugQuery = /* GraphQL */ `
  query ProductBySlug($slug: String!) {
    product(slug: $slug) {
      ...ProductFields
    }
  }
`;

export const ProductsByIdsQuery = /* GraphQL */ `
  query ProductsByIds($ids: [String!]!, $take: Int!) {
    products(options: { filter: { id: { in: $ids } }, take: $take }) {
      items {
        ...ProductFields
      }
    }
  }
`;

/** Slugs and SEO fields only, for the page index: the full product would cost a kilobyte per row. */
export const ProductPageEntriesQuery = /* GraphQL */ `
  query ProductPageEntries($options: ProductListOptions) {
    products(options: $options) {
      totalItems
      items {
        id
        name
        slug
        description
        featuredAsset {
          preview
        }
      }
    }
  }
`;

export const SearchQuery = /* GraphQL */ `
  query Search($input: SearchInput!) {
    search(input: $input) {
      totalItems
      items {
        ...SearchItemFields
      }
      facetValues {
        count
        facetValue {
          id
          code
          name
          facet {
            id
            code
            name
          }
        }
      }
    }
  }
`;

export const CollectionBySlugQuery = /* GraphQL */ `
  query CollectionBySlug($slug: String!) {
    collection(slug: $slug) {
      ...CollectionFields
    }
  }
`;

export const CollectionsQuery = /* GraphQL */ `
  query Collections($options: CollectionListOptions) {
    collections(options: $options) {
      totalItems
      items {
        ...CollectionFields
      }
    }
  }
`;


export const ActiveOrderQuery = /* GraphQL */ `
  query ActiveOrder {
    activeOrder {
      ...OrderFields
    }
  }
`;

/** Every row in one call; Vendure answers the rows it refused in the order they were sent. */
export const AddItemsToOrderMutation = /* GraphQL */ `
  mutation AddItemsToOrder($inputs: [AddItemInput!]!) {
    addItemsToOrder(inputs: $inputs) {
      order {
        lines {
          quantity
          productVariant {
            id
          }
        }
      }
      errorResults {
        __typename
        ...ErrorResultFields
        ... on InsufficientStockError {
          quantityAvailable
        }
      }
    }
  }
`;

/** The quantity of each variant in the cart, to tell afterwards what a batch added. */
export const ActiveOrderQuantitiesQuery = /* GraphQL */ `
  query ActiveOrderQuantities {
    activeOrder {
      lines {
        quantity
        productVariant {
          id
        }
      }
    }
  }
`;

export const AdjustOrderLineMutation = /* GraphQL */ `
  mutation AdjustOrderLine($orderLineId: ID!, $quantity: Int!) {
    adjustOrderLine(orderLineId: $orderLineId, quantity: $quantity) {
      __typename
      ...ErrorResultFields
      ... on InsufficientStockError {
        quantityAvailable
      }
    }
  }
`;

export const RemoveOrderLineMutation = /* GraphQL */ `
  mutation RemoveOrderLine($orderLineId: ID!) {
    removeOrderLine(orderLineId: $orderLineId) {
      __typename
      ...ErrorResultFields
    }
  }
`;

export const ApplyCouponCodeMutation = /* GraphQL */ `
  mutation ApplyCouponCode($couponCode: String!) {
    applyCouponCode(couponCode: $couponCode) {
      __typename
      ...ErrorResultFields
    }
  }
`;

/** Answers a bare `Order`, not an error union: spreading `ErrorResult` here is a validation error. */
export const RemoveCouponCodeMutation = /* GraphQL */ `
  mutation RemoveCouponCode($couponCode: String!) {
    removeCouponCode(couponCode: $couponCode) {
      id
    }
  }
`;


export const CheckoutStateQuery = /* GraphQL */ `
  query CheckoutState {
    activeOrder {
      ...OrderFields
    }
    eligibleShippingMethods {
      id
      code
      name
      description
      price
      priceWithTax
    }
    eligiblePaymentMethods {
      id
      code
      name
      description
      isEligible
      eligibilityMessage
    }
    nextOrderStates
    availableCountries {
      code
      name
    }
  }
`;

export const SetCustomerForOrderMutation = /* GraphQL */ `
  mutation SetCustomerForOrder($input: CreateCustomerInput!) {
    setCustomerForOrder(input: $input) {
      __typename
      ...ErrorResultFields
    }
  }
`;

export const SetOrderShippingAddressMutation = /* GraphQL */ `
  mutation SetOrderShippingAddress($input: CreateAddressInput!) {
    setOrderShippingAddress(input: $input) {
      __typename
      ...ErrorResultFields
    }
  }
`;

export const SetOrderBillingAddressMutation = /* GraphQL */ `
  mutation SetOrderBillingAddress($input: CreateAddressInput!) {
    setOrderBillingAddress(input: $input) {
      __typename
      ...ErrorResultFields
    }
  }
`;

export const SetOrderShippingMethodMutation = /* GraphQL */ `
  mutation SetOrderShippingMethod($ids: [ID!]!) {
    setOrderShippingMethod(shippingMethodId: $ids) {
      __typename
      ...ErrorResultFields
    }
  }
`;

export const TransitionOrderToStateMutation = /* GraphQL */ `
  mutation TransitionOrderToState($state: String!) {
    transitionOrderToState(state: $state) {
      __typename
      ...ErrorResultFields
      ... on OrderStateTransitionError {
        transitionError
      }
    }
  }
`;

export const AddPaymentToOrderMutation = /* GraphQL */ `
  mutation AddPaymentToOrder($input: PaymentInput!) {
    addPaymentToOrder(input: $input) {
      __typename
      ... on Order {
        code
        state
      }
      ...ErrorResultFields
      ... on PaymentFailedError {
        paymentErrorMessage
      }
      ... on PaymentDeclinedError {
        paymentErrorMessage
      }
    }
  }
`;

/** With the signed-in customer, to tell their own order from someone else's. */
export const OrderByCodeQuery = /* GraphQL */ `
  query OrderByCode($code: String!) {
    activeCustomer {
      id
    }
    orderByCode(code: $code) {
      ...OrderFields
    }
  }
`;


export const LoginMutation = /* GraphQL */ `
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password, rememberMe: true) {
      __typename
      ...ErrorResultFields
    }
  }
`;

export const LogoutMutation = /* GraphQL */ `
  mutation Logout {
    logout {
      success
    }
  }
`;

export const RegisterCustomerAccountMutation = /* GraphQL */ `
  mutation RegisterCustomerAccount($input: RegisterCustomerInput!) {
    registerCustomerAccount(input: $input) {
      __typename
      ...ErrorResultFields
    }
  }
`;

export const VerifyCustomerAccountMutation = /* GraphQL */ `
  mutation VerifyCustomerAccount($token: String!) {
    verifyCustomerAccount(token: $token) {
      __typename
      ...ErrorResultFields
    }
  }
`;

export const RequestPasswordResetMutation = /* GraphQL */ `
  mutation RequestPasswordReset($emailAddress: String!) {
    requestPasswordReset(emailAddress: $emailAddress) {
      __typename
      ...ErrorResultFields
    }
  }
`;

export const ResetPasswordMutation = /* GraphQL */ `
  mutation ResetPassword($token: String!, $password: String!) {
    resetPassword(token: $token, password: $password) {
      __typename
      ...ErrorResultFields
    }
  }
`;


export const ActiveCustomerQuery = /* GraphQL */ `
  query ActiveCustomer {
    activeCustomer {
      ...CustomerFields
    }
  }
`;

export const UpdateCustomerMutation = /* GraphQL */ `
  mutation UpdateCustomer($input: UpdateCustomerInput!) {
    updateCustomer(input: $input) {
      id
    }
  }
`;

export const UpdateCustomerPasswordMutation = /* GraphQL */ `
  mutation UpdateCustomerPassword($currentPassword: String!, $newPassword: String!) {
    updateCustomerPassword(currentPassword: $currentPassword, newPassword: $newPassword) {
      __typename
      ...ErrorResultFields
    }
  }
`;

export const RequestUpdateCustomerEmailAddressMutation = /* GraphQL */ `
  mutation RequestUpdateCustomerEmailAddress($password: String!, $newEmailAddress: String!) {
    requestUpdateCustomerEmailAddress(password: $password, newEmailAddress: $newEmailAddress) {
      __typename
      ...ErrorResultFields
    }
  }
`;

export const UpdateCustomerEmailAddressMutation = /* GraphQL */ `
  mutation UpdateCustomerEmailAddress($token: String!) {
    updateCustomerEmailAddress(token: $token) {
      __typename
      ...ErrorResultFields
    }
  }
`;

export const CreateCustomerAddressMutation = /* GraphQL */ `
  mutation CreateCustomerAddress($input: CreateAddressInput!) {
    createCustomerAddress(input: $input) {
      id
    }
  }
`;

export const UpdateCustomerAddressMutation = /* GraphQL */ `
  mutation UpdateCustomerAddress($input: UpdateAddressInput!) {
    updateCustomerAddress(input: $input) {
      id
    }
  }
`;

export const DeleteCustomerAddressMutation = /* GraphQL */ `
  mutation DeleteCustomerAddress($id: ID!) {
    deleteCustomerAddress(id: $id) {
      success
    }
  }
`;


export const CustomerOrdersQuery = /* GraphQL */ `
  query CustomerOrders($options: OrderListOptions) {
    activeCustomer {
      id
      orders(options: $options) {
        totalItems
        items {
          ...OrderFields
        }
      }
    }
  }
`;

export const OrderByIdQuery = /* GraphQL */ `
  query OrderById($id: ID!) {
    activeCustomer {
      id
    }
    order(id: $id) {
      ...OrderFields
    }
  }
`;
