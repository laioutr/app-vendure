# @laioutr/app-vendure

## 0.1.0 (unreleased)

First version: a Laioutr app that connects a storefront to a Vendure shop through its Shop API.

- Catalog: products, variants, collections as categories, breadcrumbs, listings and search with facet filters and
  sortings, suggested search, the menu from the collection tree, page indexes and Studio query templates.
- Cart: the active order, adding, changing and removing lines, coupon codes.
- Checkout: the app's own `vendure/checkout/*` actions — customer, addresses, shipping method, payment, order by code.
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
