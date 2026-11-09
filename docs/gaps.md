# Gaps — what Vendure or the canonical types cannot carry

What this app does not implement, and why. A gap in `@laioutr-core/canonical-types` is listed here, never added:
changing the canonical types is the core owner's decision.

## Canonical tokens left unimplemented, because Vendure's Shop API has no such operation

| Token | Why |
| --- | --- |
| `ecommerce/cart/get-checkout-url` | Vendure has no hosted checkout. Checkout runs through this app's own `vendure/checkout/*` actions. |
| `ecommerce/order/cancel` | Customers cannot cancel orders through the Shop API; only the merchant can, in the Admin API. |
| `ecommerce/order/verify-guest` | Vendure has no "email + postal code" check for a guest's order. A guest reads an order only through `vendure/checkout/order-by-code`, in the browser that placed it (a signed cookie the app sets on payment), while Vendure still answers the code — two hours by default. Vendure's own `orderByCode` answers a guest's order to anyone with the code in that time; the app narrows it to the browser that placed it and to the signed-in customer who owns it. |
| `ecommerce/auth/login-oauth`, `logout-oauth`, `oauth-callback` | Vendure signs customers in with a password (native strategy). An SSO strategy is a server plugin, set up per shop. |
| `ecommerce/product-list/*` (wishlists) | Not part of Vendure core. |
| `ecommerce/product/reviews`, `ecommerce/review/create-review` | Reviews are an example plugin, not part of the Shop API. |
| `ecommerce/document/*` | No invoice or document API in the Shop API. |
| `ecommerce/legal/withdrawal` | No withdrawal operation. |
| `newsletter/*` | No newsletter subscription in Vendure core. |
| `blog/*`, content pages | Vendure has no CMS. |
| `canonical-types/b2b/*` | Companies, quotes, approvals, budgets and cost centres exist only in Vendure Platform, under its commercial licence. Not in the public Shop API. |

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
- **Brand** is read from a facet whose code is `brand` or `manufacturer`; Vendure has no brand field.
- **Order line ids are global.** Order items are Vendure order line ids; a line is read with its order.
- **A product variant is resolved only through a link.** The Shop API reads no variant by id, so the
  `ProductVariant` resolver answers variants a product, cart line or order line link fetched in the same request.

## Translation and the media library (Admin API)

- **No unset text in a language.** Vendure keeps a language's texts in one row with every text required, so a row
  created for one text holds the originals in its others, and a removed translation is set back to the original. A
  text equal to its original reads as not translated (a slug excepted, which reads as that language's address).
  A row cannot be deleted through the Admin API.
- **No conditional update.** `ifVersion` is checked against a read made just before the write; a change in between
  is not caught.
- **What changed is `updatedAt`.** A change written to the database without Vendure's services is not seen until a
  full read.
- **Offset paging.** The Admin API has no "after this id" filter; the cursor overlaps a page and starts after the last
  id answered, which holds while fewer than a page of entities are deleted between two pages.
- **Asset names are not translated**: they are file names, and the storefront's alt text comes from the product or
  collection.
- **No folders in the media library**: Vendure has tags. No alt text either.
- **No webhooks.** Vendure core sends none, so storefront caches expire by TTL rather than on change.
- **Feeds**: no sale price, GTIN, MPN, specifications or rating in core Vendure; a stock count only with a
  `StockDisplayStrategy` that answers one. Distributr's default cover column reads `media.cover`, which the canonical
  `ProductMedia` component does not have; the cover is `info.cover` (a binding fixes it, for every connector).

## Platform limits found while building

- **No connection test in `laioutr.manifest.json`.** A manifest `test` must name its hosts in advance and its URL
  must start with `https://` literally. A Vendure server can be anywhere, and its whole address is one setting
  (`shopApiUrl`), so no test can be declared. Opening it would need a test whose host comes from a URL field —
  a change to `validateAppManifest` in core-types and the Cockpit's test runner, which is the core owner's.
- **Signed-in flows cannot be tested on the public demo.** The demo requires email verification and its emails go
  nowhere, so no customer can sign in there. The contract tests for a signed-in customer run only with
  `VENDURE_CONTRACT_EMAIL` / `VENDURE_CONTRACT_PASSWORD` against a server where such an account exists.
