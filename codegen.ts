import type { CodegenConfig } from '@graphql-codegen/cli';

const typesConfig = {
  enumsAsTypes: true,
  avoidOptionals: { field: true, inputValue: false, object: true },
  skipTypename: false,
  nonOptionalTypename: false,
  // A file of a multipart request is `null` in the variables; the request's `map` part fills it.
  scalars: { Money: 'number', DateTime: 'string', JSON: 'Record<string, unknown>', ID: 'string', Upload: 'null' },
  preResolveTypes: true,
};

/**
 * Types for every document in `client/documents.ts`, from the Shop API schema introspected from the
 * Vendure demo, and in `client/adminDocuments.ts`, from the Admin API of a Vendure 3.7. Re-introspect
 * and run `pnpm graphql:codegen` when moving to a newer Vendure.
 */
const config: CodegenConfig = {
  generates: {
    'src/runtime/server/types/vendure.generated.ts': {
      schema: 'docs/research/vendure-shop-api.graphql',
      documents: ['src/runtime/server/client/documents.ts'],
      plugins: ['typescript', 'typescript-operations'],
      config: typesConfig,
    },
    'src/runtime/server/types/vendure-admin.generated.ts': {
      schema: 'docs/research/vendure-admin-api.graphql',
      documents: ['src/runtime/server/client/adminDocuments.ts'],
      plugins: ['typescript', 'typescript-operations'],
      config: typesConfig,
    },
  },
};

export default config;
