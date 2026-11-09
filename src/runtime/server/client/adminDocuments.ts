/**
 * Every Admin API document with a fixed shape, each written once. The translation documents are
 * built per entity type in `admin/translatable/documents.ts`.
 */

export const AdminAssetFields = /* GraphQL */ `
  fragment AdminAssetFields on Asset {
    id
    createdAt
    name
    type
    mimeType
    fileSize
    width
    height
    source
    preview
    focalPoint {
      x
      y
    }
    tags {
      value
    }
  }
`;

export const AdminAssetsQuery = /* GraphQL */ `
  query AdminAssets($options: AssetListOptions) {
    assets(options: $options) {
      totalItems
      items {
        ...AdminAssetFields
      }
    }
  }
`;

export const AdminCreateAssetsMutation = /* GraphQL */ `
  mutation AdminCreateAssets($input: [CreateAssetInput!]!) {
    createAssets(input: $input) {
      ... on Asset {
        ...AdminAssetFields
      }
      ... on MimeTypeError {
        errorCode
        message
        fileName
        mimeType
      }
    }
  }
`;

export const AdminUpdateAssetMutation = /* GraphQL */ `
  mutation AdminUpdateAsset($input: UpdateAssetInput!) {
    updateAsset(input: $input) {
      ...AdminAssetFields
    }
  }
`;

export const AdminDeleteAssetsMutation = /* GraphQL */ `
  mutation AdminDeleteAssets($input: DeleteAssetsInput!) {
    deleteAssets(input: $input) {
      result
      message
    }
  }
`;
