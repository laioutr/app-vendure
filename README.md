# @laioutr/app-vendure

Connects a [Laioutr](https://laioutr.com) storefront to a [Vendure](https://vendure.io) shop through Vendure's
public **Shop API** (GraphQL). The Laioutr UI sections for the home page, category listings, product pages, search,
cart, sign-in and the customer account work on Vendure as they do on any other Laioutr commerce app. With an
**Admin API** key as well, the shop's texts can be translated with Translatr and its assets are offered in Studio's
media library.

MIT licensed.

## What it covers

Every canonical ecommerce token of `@laioutr-core/canonical-types` that the Shop API can answer.

| Area               | Tokens                                                                                                                                                                                                                                                                                                                              | Vendure                                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Products           | `product/by-slug`, `by-id`, the Product resolver (base, brand, default variant, description, info, media, option groups, prices, SEO, flags), `product/variants`, `product/breadcrumb`, `product/all-categories`, the ProductVariant resolver (base, info, availability, prices, options, quantity rule, quantity prices, shipping) | `product`, `products`                                                                                                                                                                                                   |
| Listing and search | `product/by-category-slug`, `by-category-id`, `category/products`, `product/search` — facet filters, an in-stock filter where the server indexes stock, sortings by relevance, name and price                                                                                                                                       | `search` (one result per product)                                                                                                                                                                                       |
| Suggested search   | `suggested-search/search`, `entries`, `products`                                                                                                                                                                                                                                                                                    | `search` and a collection name match                                                                                                                                                                                    |
| Categories         | `category/by-slug`, `by-id`, `all`, the Category resolver, `category/breadcrumb`, `category/child-categories`                                                                                                                                                                                                                       | `collection`, `collections`                                                                                                                                                                                             |
| Menu               | `menu/by-alias` — `root` or `main` is the whole collection tree, any other alias the collections below the one with that slug                                                                                                                                                                                                       | `collections`                                                                                                                                                                                                           |
| Cart               | `cart/get-current`, Cart (with the checkout link) and CartItem (with product data) resolvers, `cart/cart-items`, `cart/cart-item-product-variant`, `cart/add-items` (products and coupon codes), `cart/update-items`, `cart/remove-items`                                                                                           | `activeOrder`, `addItemsToOrder`, `adjustOrderLine`, `removeOrderLine`, `applyCouponCode`, `removeCouponCode`                                                                                                           |
| Sign-in            | `auth/login`, `logout`, `register`, `confirm-email`, `recover`, `reset-password`                                                                                                                                                                                                                                                    | `login`, `logout`, `registerCustomerAccount`, `verifyCustomerAccount`, `updateCustomerEmailAddress`, `requestPasswordReset`, `resetPassword`                                                                            |
| Customer           | `customer/get-current`, `update`, `change-email`, `change-password`, `address-get-all`, `address-create`, `address-update`, `address-delete`, `address-set-default`                                                                                                                                                                 | `activeCustomer`, `updateCustomer`, `requestUpdateCustomerEmailAddress`, `updateCustomerPassword`, `*CustomerAddress`                                                                                                   |
| Orders             | `order/all`, `order/by-id`, the Order and OrderItem resolvers, `order/items`, `order-item/product-variant`, `order/reorder`, `order/get-statistics`                                                                                                                                                                                 | `activeCustomer.orders`, `order`                                                                                                                                                                                        |
| Checkout           | the app's own `vendure/checkout/*` actions and the `VendureCheckout` section, see below                                                                                                                                                                                                                                             | `setCustomerForOrder`, `setOrderShippingAddress`, `setOrderBillingAddress`, `eligibleShippingMethods`, `setOrderShippingMethod`, `transitionOrderToState`, `eligiblePaymentMethods`, `addPaymentToOrder`, `orderByCode` |
| Sitemap and Studio | page indexes for the product detail and product listing pages; query templates for product by id, category by id or slug, products by category id or slug, menu by alias                                                                                                                                                            | `products`, `collections`                                                                                                                                                                                               |

With the Admin API settings (see [Admin API](#admin-api)):

| Area                          | What                                                                                                                                                                                                                              | Vendure                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Translation (source entities) | Products, product variants, collections, facets, facet values, product option groups with their options, shipping methods and payment methods: described, counted, listed (also by what changed since a moment), read and written | the Admin API's lists and `update*` mutations with `translations` |
| Media library                 | Assets listed, searched by name, filtered by kind and tag, sorted by date or name; uploaded, renamed, retagged, deleted                                                                                                           | `assets`, `createAssets`, `updateAsset`, `deleteAssets`           |

Errors arrive as the canonical error classes (`ProductStockError`, `CartLineNotFoundError`,
`DiscountCodeNotFoundError`, `InvalidCredentialsError`, `CustomerNotConfirmedError`, `EmailAlreadyInUseError`,
`PasswordResetTokenInvalidError`, …). A refusal without a canonical class — mostly checkout steps — is a
`VendureOrderError` with a `reason` code.

## Setup

```bash
pnpm add @laioutr/app-vendure
```

In a Laioutr project the app is installed in an environment, and its settings are entered in the Cockpit under the
environment's Configuration → Vendure. Outside the Cockpit, in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@laioutr/app-vendure', '@laioutr-core/frontend-core', '@laioutr-core/orchestr'],
  '@laioutr/app-vendure': {
    shopApiUrl: 'https://shop.example.com/shop-api',
  },
});
```

### Settings

| Setting                  | Required | What it does                                                                                                        |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `shopApiUrl`             | yes      | The Shop API endpoint.                                                                                              |
| `channelToken`           | no       | Selects a channel of a multi-channel server; sent as the `vendure-token` header. Empty selects the default channel. |
| `languageCode`           | no       | A Vendure language code sent with every request. Empty sends the visitor's language, when the channel offers it.    |
| `adminApiUrl`            | no       | The Admin API endpoint, e.g. `https://shop.example.com/admin-api`.                                                  |
| `adminApiKey`            | no       | An Admin API key, sent as the `vendure-api-key` header.                                                             |
| `checkoutPath`           | no       | The page holding the `VendureCheckout` section; the cart's Checkout button leads there. `/checkout` when empty.     |
| `providerPaymentMethods` | no       | Codes of payment methods paid in a provider's own flow, comma-separated; the checkout shows them as not available.  |

The settings are server-only runtime config; none reaches the browser. Without both `adminApiUrl` and
`adminApiKey`, translation and the media library are not registered at all, and nothing else changes. They are read
when the storefront is built, so adding them needs a new build.

### Requirements on the Vendure server

- **Vendure 3.1 or later**: adding to the cart sends every row in one `addItemsToOrder`.
- **Bearer tokens**: see Session below.
- **The in-stock filter** needs the DefaultSearchPlugin's `indexStockStatus: true` (off by default). The app checks
  once per server whether the search has it and offers the filter only then; without it, listings and search work
  with facet filters only.
- **No test payment handler on a channel the storefront uses.** `add-payment` hands the storefront's metadata to the
  payment method it names; a channel that still offers Vendure's `dummyPaymentHandler` (or another handler that
  authorizes without a provider) lets anyone place orders without paying.

### Language and currency

The app reads the channel's languages and currencies once every ten minutes, and keeps a failed read for 30 seconds,
so a Vendure outage costs one failing call per interval, not one per request. It sends the visitor's language as
`?languageCode=` (a regional code such as `pt_BR` before the plain `pt`), and the market's currency as
`?currencyCode=`. Vendure refuses a language or currency the channel does not offer, so a market asking for one is
answered in the channel's default instead, and the server log says so once per server and market — add the currency
to the channel, or change the market, to fix it. Prices are shown with tax, in minor units.

Every call to Vendure gives up after ten seconds, so a stalled server fails one request rather than holding every
page open. An upload to the media library waits a minute, as Vendure stores the files and renders previews before it
answers.

### Session

Vendure keeps the cart and the signed-in customer in one session token (bearer mode). The app keeps it in the
storefront's own http-only `SameSite=Lax` cookie `vendure-auth-token` and sends it back as
`Authorization: Bearer …`. Browser code never sees it. Signing in moves the visitor's cart into the customer's,
as Vendure does by default.

Product, collection, search and menu reads are sent without the visitor's session: their answers are cached per
market and served to every visitor, so they must not depend on who asked. A shop whose prices depend on the customer
(a custom `ProductVariantPriceCalculationStrategy`) shows the anonymous price on product pages and listings; the cart
and checkout always use the visitor's session.

The Vendure server must issue bearer tokens: `authOptions.tokenMethod` set to `'bearer'` or `['cookie', 'bearer']`
(Vendure's own default is `'cookie'`), with the default header name `vendure-auth-token`.

### Images

Product and collection images are served by Vendure's `AssetServerPlugin`. The app registers a `vendure` image
provider for `@nuxt/image`, which asks the asset server for the size and format a component needs
(`?w=&h=&mode=&format=&q=`).

## Admin API

Translation and the media library work on the shop's own data, which only the Admin API reaches. The app reaches it
with an API key.

### Setting up the key

1. **Vendure 3.6 or later**, with API keys among the token methods:

   ```ts
   authOptions: {
     tokenMethod: ['bearer', 'api-key'];
   } // keep the methods you have, add 'api-key'
   ```

2. Create a role on the channel the storefront uses, with exactly these permissions:

   | Permission                                               | What the app does with it                                                 |
   | -------------------------------------------------------- | ------------------------------------------------------------------------- |
   | `ReadProduct`, `UpdateProduct`                           | read and write the texts of products, variants, option groups and options |
   | `ReadCollection`, `UpdateCollection`                     | read and write collection names, slugs and descriptions                   |
   | `ReadFacet`, `UpdateFacet`                               | read and write facet and facet value names                                |
   | `ReadShippingMethod`, `UpdateShippingMethod`             | read and write shipping method names and descriptions                     |
   | `ReadPaymentMethod`, `UpdatePaymentMethod`               | read and write payment method names and descriptions                      |
   | `ReadAsset`, `CreateAsset`, `UpdateAsset`, `DeleteAsset` | the media library: list, upload, rename and tag, delete                   |

   Vendure's resolvers accept either the per-entity permission or the broad one (`ReadCatalog`, `UpdateCatalog`,
   `ReadSettings`, …), so the broad ones are not needed. Nor is `ReadChannel`: the channel's languages are read
   through the Shop API. The media library needs all four asset permissions; a call the role does not
   allow fails with a message saying the key's role lacks a permission.

3. Create an API key with that role alone, and enter it with the Admin API URL in the
   environment's Configuration → Vendure.

### Translation

Each type below is a source entity of `@laioutr/app-vendure`. Vendure keeps a text per language, so the channel's
**default language holds the originals** and every other language the channel offers is a translation, written by
the app.

| Type                              | Texts                          | In the storefront as                                    |
| --------------------------------- | ------------------------------ | ------------------------------------------------------- |
| `Product`                         | name, slug, description (HTML) | the Product and its variants, read through the Shop API |
| `ProductVariant`                  | name                           | —                                                       |
| `Category` (collections)          | name, slug, description (HTML) | the Category                                            |
| `Facet`, `FacetValue`             | name                           | —                                                       |
| `ProductOptionGroup`              | name, and each option's name   | —                                                       |
| `ShippingMethod`, `PaymentMethod` | name, description (HTML)       | —                                                       |

- **Pages** are in id order, 50 entities at most, two requests each whatever their size — three for products and
  collections, whose storefront entity is read too, and for option groups listed by what changed. The Admin API
  pages by offset, so the cursor keeps the last id too and the next page starts after it: entities deleted while a
  source is read move nothing past it, up to a page of them between two pages.
- **What changed** is filtered by the entity's `updatedAt`. Vendure moves it with every update made through its API
  or dashboard — a translation written by this app included. An option is renamed or added without moving its
  group's, so the groups of the options changed since then are listed too; when more than a hundred options changed,
  every group is listed. A change written straight into the database is not seen until the next full read.
- **The version** is a hash of the originals, so a translation changes nothing, and a write that names an older
  version is refused. Vendure updates without a condition, so a change between the app's read and its write is not
  caught. The channel's default language is read again with every write, and the originals are never written.
- **A language's texts are one row in Vendure, and every value it holds is reported as that language's**, one equal
  to its original included. A row is never filled with copies: a write that would create a language's row is taken
  only with every text the row requires — the name, and the slug where the type has one — and the row then holds
  exactly what was written, an optional description left empty. Otherwise the entity is refused with the reason and
  nothing is written for it. A removed description is emptied; a name or slug cannot be removed, and such a write is
  refused (see [docs/gaps.md](docs/gaps.md)).
- **Private facets** and their values are never shown by the storefront, so they are skipped rather than offered.
- Asset names are not offered for translation: Vendure names an asset after its file, and the storefront takes an
  image's alt text from the product or collection that shows it.

### Media library

Vendure's assets appear in Studio as the library "Vendure". Vendure files assets by tag, not in folders, so the
library is flat and filters by tag. An upload goes through the storefront (Vendure has no direct upload) and takes
images, videos, audio and PDFs, ten files at a time; the app refuses more files, another type, and a file whose
extension does not match its type before anything reaches Vendure. **SVG files are refused**: Vendure stores and serves
them as they are, scripts included, from the shop's domain. A rename keeps the asset's address: Vendure keeps the file
under its first name. An asset a product or collection still uses is not deleted; Vendure says which.

Uploading, renaming, retagging and deleting are refused while the storefront has no project secret (they are allowed
on a dev server): without one, the storefront's media routes answer anyone, and these change the merchant's own shop.
Listing stays open, as it shows only what the asset server serves anyway. An upload Vendure does not answer within a
minute is reported as of unknown outcome — look for the file in the library before uploading it again.

### Product feeds

Distributr reads the catalogue through the storefront's `ecommerce/product/search` with an empty term, page by page.
The search answers every product once, ordered by name, with its variants. Filled from Vendure: name, slug,
description, price (with tax), images, brand (from a `brand` facet), SKU, options and stock status. Empty, because
core Vendure has no such field: a sale price, a GTIN or MPN, a stock quantity unless a custom `StockDisplayStrategy`
answers counts, product specifications and ratings. A shop that keeps a GTIN or a brand in a custom field needs it
exposed as a component first. The `specifications` and `rating` components are not answered; a request for them
names them in its error, so a feed can ask again without them.

### Not built

- **Cache invalidation on change.** Vendure has no built-in webhooks; storefront caches expire by their TTL (a day
  for products, an hour for collections).
- **Consent or campaign attributes on an order.** They would need custom fields on Vendure's `Order`, which a shop
  sets up itself.

## Checkout

Vendure has no hosted checkout and `@laioutr-core/canonical-types` has no checkout tokens, so the app defines its
own actions under `vendure/checkout/*` (exported from `@laioutr/app-vendure/runtime`):

| Action                                                                | Does                                                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `VendureCheckoutGetStateAction`                                       | The order, eligible shipping and payment methods, next states and countries, in one call.                                      |
| `VendureCheckoutSetCustomerAction`                                    | Names the customer of a guest order.                                                                                           |
| `VendureCheckoutSetShippingAddressAction`, `…SetBillingAddressAction` | Sets the addresses.                                                                                                            |
| `VendureCheckoutSetShippingMethodAction`                              | Sets the shipping method.                                                                                                      |
| `VendureCheckoutTransitionAction`                                     | Moves the order to `ArrangingPayment`, or back to `AddingItems`.                                                               |
| `VendureCheckoutAddPaymentAction`                                     | Adds a payment with a method's code and the provider's metadata; refuses a second one.                                         |
| `VendureCheckoutOrderByCodeAction`                                    | Reads a placed order (by code, or the newest placed here) — only in the browser that placed it, or for its signed-in customer. |

Vendure answers a guest's order to anyone who knows its code for a while after it is placed. The app does not:
`add-payment` remembers the placed order's code in a signed, http-only cookie (`vendure-placed-orders`, signed with
the project's secret key), and `order-by-code` answers only that browser or the signed-in customer who owns the order.
Everyone else gets `OrderNotFoundError`, as for an unknown or expired code. Vendure's own Shop API still answers the
code to anyone for its anonymous access window (`orderByCodeAccessStrategy`, two hours by default), so a merchant who
wants less shortens that window or sets a stricter strategy on the server. The section keeps the code out of the page
address and out of every analytics event but the purchase.

`add-payment` adds a payment once: a method named in `providerPaymentMethods`, an order not in `ArrangingPayment`
and an order that already has an authorized or settled payment are refused before the shop's payment handler is
reached. A declined or failed payment moves the order back to `AddingItems`, and a cart change (add, quantity,
remove) on an order still awaiting payment — a shopper who left checkout on the payment step — moves it back once and
runs again, so the cart never refuses a change because of an unfinished checkout.

A real payment provider (Stripe, Mollie, …) is a Vendure server plugin; its client-side step (a card form, a
redirect) runs in the storefront and hands its result to `add-payment` as `metadata`.

### The checkout section

The app ships a section, **Vendure Checkout** (`VendureCheckout`, Studio kit "Checkout", tag "Checkout & Cart"),
built on these actions with the components of `@laioutr-app/ui`. It is registered only where the storefront installs
`@laioutr-app/ui` as a module — in `modules` of its nuxt.config or among its laioutrrc apps — and the package is
present (an optional peer dependency). A package that is only present is not enough; without it the app logs once that
the section is not offered and works as before.

Put it on a page of its own (a landing page at `/checkout`) and point the `checkoutPath` setting there if the page
lives elsewhere — the cart's `checkoutLink` is that path, so the cart sheet's Checkout button opens it.

**Markets and languages under a path prefix.** The link is a plain `url` link: frontend-core passes it on as written,
without the market's path prefix or a translated path. The setting is one value per environment, so:

- with one market, or markets on their own domains, set the path the page has (`/checkout`, `/kasse`);
- with one market under a prefix, write the prefix into the setting (`/de/kasse`);
- with several markets under prefixes (`/de`, `/at`) or a checkout path translated per language, one value cannot
  lead each market to its own page. Give the checkout page the same path in every market and language, at the
  domain's root, or use a full URL per environment. A link that resolves per market and language needs a page type
  for the checkout (see [docs/gaps.md](docs/gaps.md)).

The shopper walks four steps on one page, with the order summary beside them (below them on a phone):

1. **Contact** — email, first and last name of a guest (`set-customer`). A signed-in customer is the order's
   customer already and is shown as "Signed in as …". No sign-in link is offered: the canonical types name no login
   page a section could link to.
2. **Address** — the shipping address, with the countries the channel ships to; the billing address is the same
   unless the shopper unticks it (`set-shipping-address`, `set-billing-address`).
3. **Delivery** — the eligible shipping methods with their prices (`set-shipping-method`).
4. **Payment** — the payment methods, the total and "Place order" (`transition` to `ArrangingPayment`, then
   `add-payment`). "Place order" is disabled while the order is on its way, and a second press or Enter sends
   nothing. The page then shows the confirmation, read back with `order-by-code`, and the header's cart empties. A
   reload in the same tab shows the confirmation again: the tab remembers that it placed an order (session storage,
   no order number), and the server answers the newest order its signed cookie names. A later visit with an empty
   cart shows the empty cart.

If no payment method can be paid on the page (all of them run in a provider's flow), the step says so and asks the
shopper to contact the shop, and the server logs once that no method is payable. If the payment is declined, the
order goes back to `AddingItems` by itself: the payment step shows why, the cart can be changed, and Place order tries
again.

Every step writes to the order in Vendure and reads it back, so a shopper who returns, or reloads, continues where
they left off; "Change" reopens an earlier step (and moves an order awaiting payment back to `AddingItems`). The
section reads the order again whenever the cart changes elsewhere on the page (the header's cart sheet) or the tab
comes back into view, so the summary and the total are the ones Vendure will charge. Fields are checked in the browser
first; a refusal from Vendure is shown in the words of the step ("The payment was declined…", "This email address
belongs to a customer account…"), never as Vendure's own message. An empty cart shows an empty state with "Continue
shopping".

The summary lists the lines and shipping at their prices before promotions and every promotion — on a line, on the
order, on shipping — by its name, so lines + shipping − discounts = total. Coupon codes show as badges.

For keyboard and screen-reader users, the focus moves to the next step's heading once a step is saved, to the first
refused field when a form is refused (with an alert saying to check the marked fields), and to the confirmation once
the order is placed. Refusals are announced (`role="alert"`). ui-kit's `Field` does not tie its error text to the
input (`aria-describedby`), which is the ui-kit's to add.

The analytics events `ecommerce/add_shipping_info`, `ecommerce/add_payment_info` and `ecommerce/purchase` are tracked
when the shipping method is set, when the order is placed and once it is placed. `add_payment_info` is sent once per
order and method, not again on a retry after a decline. The order number goes only into the purchase, as its
`orderId` (the transaction id); no event carries the shopper's name, email or address. `begin_checkout` stays with the
cart sheet's Checkout button, as in ui-app, so a direct visit to the checkout page (a bookmark, the back button) sends
none.

Studio fields: the heading, the empty cart's heading, text and "Continue shopping" link, and the confirmation's
heading and text (`{code}` and `{email}` are filled in). The default confirmation text promises no email — whether one
is sent depends on the Vendure server's email plugin, which the storefront cannot see; a merchant whose server sends
confirmations may say so in the field. Every empty field falls back to the section's own text in
the page's language — English, German, French, Dutch, Spanish, Italian and Polish; English for any other.

**Payment methods.** A method whose Vendure handler completes the payment inside `addPaymentToOrder` — the built-in
dummy handler, an invoice or cash-on-delivery handler — is paid by the section with empty metadata. A method that
needs a provider's own step in the browser (the Stripe or Mollie plugin's, any card form or redirect) cannot be paid
by this section yet: name its code in `providerPaymentMethods` and the section lists it as "Cannot be paid on this
page yet" and never sends it. The Shop API does not tell which handler a method uses, so the setting says it. A method
Vendure answers as not eligible shows Vendure's eligibility message.

**Not supported yet:** provider payment flows (above), choosing a saved address of a signed-in customer, entering a
coupon in the checkout (the cart sheet takes coupons), splitting an order across several shipping methods, and a
sign-in link (no canonical login page).

## What Vendure cannot do here

See [docs/gaps.md](docs/gaps.md) for the full list. In short: no hosted checkout URL, no customer order cancellation,
no guest order lookup by email and postal code, no OAuth sign-in, no wishlists, reviews, documents, newsletter,
blog or content pages, no sale (compare-at) prices and no price range filter in Vendure's default search. Menus are
collection trees.

### B2B

The public Shop API has no companies, quotes, approvals, budgets or cost centres. Vendure offers them only in
**Vendure Platform**, under its commercial licence. The B2B tokens of `@laioutr-core/canonical-types/b2b` would need
a Vendure Platform licence and an adapter for its API; this app does not include one.

## Development

```bash
pnpm install          # needs access to the @laioutr-core registry (.npmrc)
pnpm dev              # playground against https://readonlydemo.vendure.io/shop-api
pnpm test             # unit tests
pnpm test:contract    # contract tests against the live demo (or VENDURE_CONTRACT_SHOP_API_URL)
pnpm typecheck
pnpm lint
pnpm graphql:codegen  # regenerate the operation types from docs/research/vendure-{shop,admin}-api.graphql
```

Every Shop API document is in `src/runtime/server/client/documents.ts`, every fixed Admin API document in
`client/adminDocuments.ts`, and the translation documents are built per type from `admin/translatable/kinds.ts`; each fragment is written once and appended to
the operations that spread it. The orchestr handlers are in `src/runtime/server/orchestr`, the mapping from Vendure
to the canonical shapes in `src/runtime/server/mappers` (pure functions with unit tests), and every Vendure failure
is translated in one place, `src/runtime/server/errors/mapVendureError.ts`.

The playground is a small storefront configured against Vendure's public read-only demo, which accepts carts and
guest checkout but requires email verification for new accounts. Its pages come from `playground/laioutrrc.example.json`
— a home page with a product slider, a product detail page, the cart sheet in the header and `/checkout` with the
checkout section; a git-ignored `playground/laioutrrc.json` takes its place when present. The example holds no
secret. `pnpm dev:build` builds it and `node playground/.output/server/index.mjs` serves it. Point it at another server with `VENDURE_SHOP_API_URL`,
`VENDURE_CHANNEL_TOKEN` and `VENDURE_LANGUAGE_CODE` (and the checkout settings with `VENDURE_CHECKOUT_PATH` and
`VENDURE_PROVIDER_PAYMENT_METHODS`). The signed-in contract tests run with
`VENDURE_CONTRACT_EMAIL` and `VENDURE_CONTRACT_PASSWORD` of a verified customer — on a local Vendure with
verification off, a customer registered through `registerCustomerAccount` can sign in at once.

The Admin API contract tests run with `VENDURE_CONTRACT_ADMIN_API_URL` and `VENDURE_CONTRACT_ADMIN_API_KEY` (the
playground takes `VENDURE_ADMIN_API_URL` and `VENDURE_ADMIN_API_KEY`). They write a translation into the channel's
second language and set it back, change a product's description in the default language and set it back, create one
product's row in Italian (which the channel does not offer; a row cannot be deleted, so it stays), and upload one
image and delete it. The feed contract test sends a
product feed's catalogue read to a running playground named by `VENDURE_CONTRACT_STOREFRONT_URL`.

## Open

1. Provider payment flows in the checkout section (a card widget or redirect before `add-payment`).
2. A connection test for the settings form — the manifest's test contract cannot name a host that a setting chooses
   (see [docs/gaps.md](docs/gaps.md)).
3. Publishing to npmjs, once approved.
