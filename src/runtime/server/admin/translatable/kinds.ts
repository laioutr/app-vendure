import type { TranslatableRow } from './documents';

/** How a translatable field is shown and handled: as markup, as a URL slug, or as plain text. */
export type TextFieldKind = 'text' | 'richtext' | 'slug';

export interface TextField {
  name: string;
  kind: TextFieldKind;
  /**
   * Whether a language's row needs it. A row without a name shows an empty name and one without a
   * slug has no address, so a new row is created only with both; an optional text left out of the
   * write is stored empty, which reads as untranslated.
   */
  required: boolean;
}

/** An Admin API entity whose texts Vendure keeps per language, in its `translations`. */
export interface Translatable {
  /** The mutation that takes `translations`, and the type of its `input`. */
  update: string;
  updateInput: string;
  fields: readonly TextField[];
}

/**
 * A source entity type over a Vendure entity. `items` are entities of their own that Vendure lists
 * only with their parent (a group's options): they travel in the parent as an id-addressed array.
 */
export interface TranslatableKind extends Translatable {
  type: string;
  label: string;
  /** What things of this kind are called in a message, e.g. "product". */
  noun: string;
  /** The Admin API list query, e.g. `products`. */
  list: string;
  /** The GraphQL type of that query's `options`. */
  listOptions: string;
  /**
   * `key` is the array's name in the entity, `select` the field the Admin API lists them in. An item
   * changes without moving its parent's `updatedAt`, so `list` and `listOptions` find the items
   * changed since a moment, and `parent` names their parent's id.
   */
  items?: Translatable & { key: string; select: string; list: string; listOptions: string; parent: string };
  /**
   * Entities the storefront never shows, answered as skipped rather than offered for translation:
   * `select` adds what tells them apart to the rows, `of` answers why one is hidden.
   */
  hidden?: { select: string; of: (row: TranslatableRow) => string | undefined };
}

const name: TextField = { name: 'name', kind: 'text', required: true };
const slug: TextField = { name: 'slug', kind: 'slug', required: true };
// Vendure's dashboard edits every description with its rich text editor, so each holds HTML.
const description: TextField = { name: 'description', kind: 'richtext', required: false };

/** A private facet is for the shop's own use: the storefront never shows it or its values. */
const PRIVATE_FACET = 'The facet is private: the storefront does not show it';

export const PRODUCT: TranslatableKind = {
  type: 'Product',
  label: 'Product',
  noun: 'product',
  list: 'products',
  listOptions: 'ProductListOptions',
  update: 'updateProduct',
  updateInput: 'UpdateProductInput',
  fields: [name, slug, description],
};

export const PRODUCT_VARIANT: TranslatableKind = {
  type: 'ProductVariant',
  label: 'Product variant',
  noun: 'product variant',
  list: 'productVariants',
  listOptions: 'ProductVariantListOptions',
  update: 'updateProductVariant',
  updateInput: 'UpdateProductVariantInput',
  fields: [name],
};

export const COLLECTION: TranslatableKind = {
  type: 'Category',
  label: 'Collection',
  noun: 'collection',
  list: 'collections',
  listOptions: 'CollectionListOptions',
  update: 'updateCollection',
  updateInput: 'UpdateCollectionInput',
  fields: [name, slug, description],
};

export const FACET: TranslatableKind = {
  type: 'Facet',
  label: 'Facet',
  noun: 'facet',
  list: 'facets',
  listOptions: 'FacetListOptions',
  update: 'updateFacet',
  updateInput: 'UpdateFacetInput',
  fields: [name],
  hidden: { select: 'isPrivate', of: (row) => (row.isPrivate ? PRIVATE_FACET : undefined) },
};

export const FACET_VALUE: TranslatableKind = {
  type: 'FacetValue',
  label: 'Facet value',
  noun: 'facet value',
  list: 'facetValues',
  listOptions: 'FacetValueListOptions',
  update: 'updateFacetValue',
  updateInput: 'UpdateFacetValueInput',
  fields: [name],
  hidden: { select: 'facet { isPrivate }', of: (row) => (row.facet?.isPrivate ? PRIVATE_FACET : undefined) },
};

/** A group of a product's options ("Size") with its options ("S", "M"), which Vendure keeps per product. */
export const PRODUCT_OPTION_GROUP: TranslatableKind = {
  type: 'ProductOptionGroup',
  label: 'Product option',
  noun: 'option group',
  list: 'productOptionGroups',
  listOptions: 'ProductOptionGroupListOptions',
  update: 'updateProductOptionGroup',
  updateInput: 'UpdateProductOptionGroupInput',
  fields: [name],
  items: {
    key: 'options',
    select: 'options',
    list: 'productOptions',
    listOptions: 'ProductOptionListOptions',
    parent: 'groupId',
    update: 'updateProductOption',
    updateInput: 'UpdateProductOptionInput',
    fields: [name],
  },
};

export const SHIPPING_METHOD: TranslatableKind = {
  type: 'ShippingMethod',
  label: 'Shipping method',
  noun: 'shipping method',
  list: 'shippingMethods',
  listOptions: 'ShippingMethodListOptions',
  update: 'updateShippingMethod',
  updateInput: 'UpdateShippingMethodInput',
  fields: [name, description],
};

export const PAYMENT_METHOD: TranslatableKind = {
  type: 'PaymentMethod',
  label: 'Payment method',
  noun: 'payment method',
  list: 'paymentMethods',
  listOptions: 'PaymentMethodListOptions',
  update: 'updatePaymentMethod',
  updateInput: 'UpdatePaymentMethodInput',
  fields: [name, description],
};
