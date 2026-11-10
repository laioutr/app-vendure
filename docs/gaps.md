# Gaps — what Vendure or the canonical types cannot carry

What this app does not implement, and why. A gap in `@laioutr-core/canonical-types` is listed here, never added:
changing the canonical types is the core owner's decision.

## Canonical tokens left unimplemented, because Vendure's Shop API has no such operation

| Token                                                          | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ecommerce/cart/get-checkout-url`                              | Vendure has no hosted checkout. The cart's `checkoutLink` leads to the storefront page with this app's `VendureCheckout` section (the `checkoutPath` setting), which runs the `vendure/checkout/*` actions.                                                                                                                                                                                                                                                       |
| `ecommerce/order/cancel`                                       | Customers cannot cancel orders through the Shop API; only the merchant can, in the Admin API.                                                                                                                                                                                                                                                                                                                                                                     |
| `ecommerce/order/verify-guest`                                 | Vendure has no "email + postal code" check for a guest's order. A guest reads an order only through `vendure/checkout/order-by-code`, in the browser that placed it (a signed cookie the app sets on payment), while Vendure still answers the code — two hours by default. Vendure's own `orderByCode` answers a guest's order to anyone with the code in that time; the app narrows it to the browser that placed it and to the signed-in customer who owns it. |
| `ecommerce/auth/login-oauth`, `logout-oauth`, `oauth-callback` | Vendure signs customers in with a password (native strategy). An SSO strategy is a server plugin, set up per shop.                                                                                                                                                                                                                                                                                                                                                |
| `ecommerce/product-list/*` (wishlists)                         | Not part of Vendure core.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `ecommerce/product/reviews`, `ecommerce/review/create-review`  | Reviews are an example plugin, not part of the Shop API.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `ecommerce/document/*`                                         | No invoice or document API in the Shop API.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ecommerce/legal/withdrawal`                                   | No withdrawal operation.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `newsletter/*`                                                 | No newsletter subscription in Vendure core.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `blog/*`, content pages                                        | Vendure has no CMS.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `canonical-types/b2b/*`                                        | Companies, quotes, approvals, budgets and cost centres exist only in Vendure Platform, under its commercial licence. Not in the public Shop API.                                                                                                                                                                                                                                                                                                                  |

## Behaviour that differs from the canonical contract

- **Registration with email verification stores no address.** `ecommerce/auth/register` takes an address, but a
  Vendure shop that requires verification (the default, and the demo) does not sign the customer in until the email
  is confirmed, and the Shop API stores an address only for a signed-in customer. The address is stored when
  registration signs the customer in at once.
- **Registration consents are not recorded.** Vendure keeps no consent field; `marketingEmail` has no place without
  a newsletter plugin.
- **`EmailAlreadyInUseError` on registration** is derived: Vendure answers a registration for an existing address
  with success, so the app signs in with the given password and treats a refused password as "the address has an
  account". `AuthRegisterAction` asks for this error, so the app keeps it, at a cost: registration tells whether an
  address has an account, which Vendure's own answer hides, and each such attempt counts as a failed sign-in on that
  account. A storefront that wants Vendure's behaviour back should rate-limit or protect registration (bot
  protection on the action).
- **Stock quantity is 0 when unknown.** Vendure's default stock display reports `IN_STOCK` / `LOW_STOCK` /
  `OUT_OF_STOCK`, not a count. `availability.quantity` is the count only when the shop's `StockDisplayStrategy`
  answers one.
- **No sale prices.** Vendure core has no compare-at price, so `isOnSale` is always false and there is no
  strikethrough price.
- **No price range filter.** Vendure's `DefaultSearchPlugin` cannot filter by price (the Elasticsearch plugin can).
  Filters are facets, and an in-stock filter only where the plugin indexes stock (`indexStockStatus: true`, off by
  default); the app checks once per server and offers the filter only then.
- **Flags come from a badge facet.** Vendure has no product badges. Values of a facet whose code is `flags`,
  `badges` or `labels` (singular too) become `ProductFlags`; a value whose code is a well-known flag (`new`,
  `bestseller`, …) carries it as `wellKnownName`. Brand, category and other facets are not flags, so a shop
  without such a facet shows none.
- **Catalog prices are the anonymous ones.** Product, listing and search reads are cached per market and sent
  without the visitor's session, so a customer-specific price strategy shows only in the cart and checkout.
- **A market currency or language the channel does not offer** is answered in the channel's default, logged once
  per server and market; Vendure would refuse every request otherwise.
- **Facet counts follow the selection.** Vendure counts facet values within the filtered result, so once a value of
  a facet is chosen, the facet's other values disappear from the list.
- **Menus are collection trees.** Vendure has no navigation menus. `ecommerce/menu/by-alias` with `root` (or `main`)
  answers the whole collection tree; any other alias the subtree below the collection with that slug. Every entry
  links to its category.
- **Brand** is read from a facet whose code is `brand`; Vendure has no brand field. A manufacturer is not the brand
  in the canonical model, so a `manufacturer` facet is not read as one.
- **Order line ids are global.** Order items are Vendure order line ids; a line is read with its order.
- **No tier prices, and shipping priced per order.** A variant's `quantityPrices` is empty (Vendure core has no tiered
  prices) and its `shipping` says only that it ships: Vendure prices shipping per order, once it has an address. The
  standard product detail page asks for both, so they are answered rather than left out.
- **No unit price on a cart line.** `CartItemProductData` is answered empty: Vendure keeps no price per kilogram or
  litre. The cart sheet asks for it on every line.
- **A product variant is resolved only through a link.** The Shop API reads no variant by id, so the
  `ProductVariant` resolver answers variants a product, cart line or order line link fetched in the same request.

## Translation and the media library (Admin API)

- **No unset text in a language.** Vendure keeps a language's texts in one row and cannot empty or delete a single
  text of it; a row itself cannot be deleted through the Admin API. So:
  - a write that would create a language's row is accepted only with every text the row requires — the name, and the
    slug for products and collections — and creates the row with exactly those values, an optional description
    empty. A write without them is refused for that entity (`invalid`) and nothing is written for it. The app never
    fills a row with copies of the originals, which would read as translations once an original changes. A shipping
    method's name has a database default in Vendure, but the app still requires it: a row without one shows no name.
  - removing a description empties it; removing a name or a slug is refused for that entity (`unsupported`), as an
    empty one is invalid.
  - every value a row holds is reported as that language's translation, one equal to its original included.
- **Rows filled with copies by the app's first version cannot be told apart.** Before this rule, a row created for one
  text took the originals in its other texts. Such a copy is now reported as a translation; it reads exactly as a
  merchant's own text. Only the local test database is known to hold them.
- **A dropped upload's outcome is unknown.** An upload that Vendure does not answer within a minute may still be
  stored. The media-library contract has no code for an unknown outcome, so it is answered as `upload_failed` with a
  message saying the outcome is unknown and to look in the library before uploading again.
- **No conditional update.** `ifVersion` is checked against a read made just before the write; a change in between
  is not caught.
- **What changed is `updatedAt`.** A change written to the database without Vendure's services is not seen until a
  full read. An option's change does not move its group's `updatedAt`, so the groups of the options changed since the
  moment are read in one more request per page; over a hundred changed options, every group is answered.
- **Offset paging.** The Admin API has no "after this id" filter; the cursor overlaps a page and starts after the last
  id answered, which holds while fewer than a page of entities are deleted between two pages.
- **Asset names are not translated**: they are file names, and the storefront's alt text comes from the product or
  collection.
- **No folders in the media library**: Vendure has tags. No alt text either.
- **No webhooks.** Vendure core sends none, so storefront caches expire by TTL rather than on change.
- **Feeds**: no sale price, GTIN, MPN, specifications or rating in core Vendure; a stock count only with a
  `StockDisplayStrategy` that answers one. Distributr's default cover column reads `media.cover`, which the canonical
  `ProductMedia` component does not have; the cover is `info.cover` (a binding fixes it, for every connector).

## The checkout section

- **Provider payment flows are not run.** A payment method whose Vendure handler needs a step in the browser (the
  Stripe or Mollie plugin's card form or redirect) cannot be paid by `VendureCheckout`. The Shop API does not say
  which handler a method uses, so the merchant names such methods in `providerPaymentMethods`; the section lists them
  as not payable on the page and never sends them.
- **No sign-in link.** The canonical types define no login page type, so the section cannot link to one; a
  signed-in customer is shown, a guest checks out as a guest.
- **Two requests at once can still pay twice.** `add-payment` refuses an order that already holds an authorized or
  settled payment, and the section sends Place order once, but Vendure has no lock on an order: two requests that
  reach the server at the same moment both find no payment yet. Only the shop's payment handler (an idempotency key at
  the provider) can close that.
- **No saved addresses, no coupon field, one shipping method per order** in the section: the actions allow more, the
  section does not offer it yet.
- **The checkout link does not follow markets and languages.** The cart's `checkoutLink` is a `url` link, which
  frontend-core passes on as written: no market path prefix, no translated path, and `checkoutPath` is one value per
  environment. Storefronts with several path-prefixed markets or a translated checkout path cannot point each market
  at its own checkout page (the README says how to set it up meanwhile). A canonical checkout page type in
  `@laioutr-core/canonical-types`, answered as a `pageType` link, would resolve per market and language as other page
  links do; whether to add one is the core owner's decision, so nothing is built here.
- **Surcharges are not shown.** Vendure's `surcharges` (arbitrary order adjustments a server plugin adds) are not read;
  on a server that adds them, the summary's lines + shipping − discounts would differ from the total by them.
- **Shipping is always required.** Variants answer `shipping: { required: true }`, as Vendure core ships per order. A
  server plugin for digital goods would make that wrong for its products.
- **A guest's sign-in check is a 401.** The section asks `customer/get-current` to tell a signed-in customer from a
  guest; for a guest the canonical action answers `UnauthenticatedError`, which the browser logs as a failed request.

## Platform limits found while building

- **No connection test in `laioutr.manifest.json`.** A manifest `test` must name its hosts in advance and its URL
  must start with `https://` literally. A Vendure server can be anywhere, and its whole address is one setting
  (`shopApiUrl`), so no test can be declared. Opening it would need a test whose host comes from a URL field —
  a change to `validateAppManifest` in core-types and the Cockpit's test runner, which is the core owner's.
- **Signed-in flows cannot be tested on the public demo.** The demo requires email verification and its emails go
  nowhere, so no customer can sign in there. The contract tests for a signed-in customer run only with
  `VENDURE_CONTRACT_EMAIL` / `VENDURE_CONTRACT_PASSWORD` against a server where such an account exists.
