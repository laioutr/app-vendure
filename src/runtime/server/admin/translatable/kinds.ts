/** How a translatable field is shown and handled: as markup, as a URL slug, or as plain text. */
export type TextFieldKind = 'text' | 'richtext' | 'slug';

export interface TextField {
  name: string;
  kind: TextFieldKind;
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
  /** `key` is the array's name in the entity, `select` the field the Admin API lists them in. */
  items?: Translatable & { key: string; select: string };
}

const name: TextField = { name: 'name', kind: 'text' };
const slug: TextField = { name: 'slug', kind: 'slug' };
// Vendure's dashboard edits every description with its rich text editor, so each holds HTML.
const description: TextField = { name: 'description', kind: 'richtext' };

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
