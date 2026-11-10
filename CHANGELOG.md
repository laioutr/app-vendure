# @laioutr/app-vendure

## 0.1.0 (unreleased)

First version: a Laioutr app that connects a storefront to a Vendure shop through its Shop API.

- Catalog: products, variants, collections as categories, breadcrumbs, listings and search with facet filters and
  sortings, suggested search, the menu from the collection tree, page indexes and Studio query templates.
- Cart: the active order, adding, changing and removing lines, coupon codes.
- Checkout: the app's own `vendure/checkout/*` actions — customer, addresses, shipping method, payment, order by code.
- The `VendureCheckout` section (with `@laioutr-app/ui`): contact, address, delivery, payment and the confirmation on
  one page; the cart's Checkout button leads to it through the `checkoutPath` setting. Methods paid in a provider's own
  flow are named in `providerPaymentMethods`, shown as not payable on the page and refused by `add-payment`; with no
  payable method the step says so. Place order and every step are sent once while on their way; `add-payment` refuses
  an order that already holds an authorized or settled payment. A declined payment moves the order back to
  `AddingItems`, and a cart change on an order awaiting payment reopens it once. The section follows cart changes made
  elsewhere on the page and empties the header's cart once the order is placed; the summary lists every promotion;
  the confirmation survives a reload without the order number in the address; focus and alerts follow the steps.
- The standard product detail page and cart sheet render: variants answer `quantityPrices` and `shipping`, cart lines
  `productData`.
- Accounts: password sign-in, sign-out, registration, email confirmation, password recovery and reset, profile,
  email and password changes, address book.
- Orders: order history, order detail with lines, reorder, monthly statistics.
- Settings per environment in `laioutr.manifest.json`: Shop API URL, channel token, language override.
- Requires Vendure 3.1 or later. The in-stock filter appears only where the search indexes stock.
- A market currency or language the channel does not offer falls back to the channel's default, logged once.
- `vendure/checkout/order-by-code` answers only the browser that placed the order or the signed-in customer who owns it.
- Optional Admin API settings (URL and key, Vendure 3.6 or later): the shop's products, variants, collections,
  facets, facet values, option groups, shipping and payment methods become source entities for Translatr, and its
  assets appear in Studio's media library. Without them, neither is registered.
- The Product resolver answers the `brand` component, from a `brand` facet.
