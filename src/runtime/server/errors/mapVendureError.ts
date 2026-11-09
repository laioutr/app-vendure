import {
  AddressNotFoundError,
  CartLineNotFoundError,
  CurrentPasswordInvalidError,
  CustomerNotConfirmedError,
  DiscountCodeNotFoundError,
  DiscountCodeNotRedeemableError,
  EmailAlreadyInUseError,
  EmailConfirmationTokenInvalidError,
  InvalidCredentialsError,
  InvalidFieldError,
  OrderNotFoundError,
  PasswordResetTokenInvalidError,
  ProductNotFoundError,
  ProductQuantityError,
  ProductStockError,
  UnauthenticatedError,
} from '@laioutr-core/canonical-types/ecommerce';
import { VendureOrderError } from '../../shared/errors';

/**
 * A failure as Vendure reports it: an `ErrorResult` member of a mutation's union, or a top-level
 * GraphQL error with its `extensions.code` passed as `errorCode`.
 */
export interface VendureFailure {
  errorCode?: string | null;
  message?: string | null;
  quantityAvailable?: number | null;
}

/** What the caller was acting on, so an error can name it — Vendure's own errors carry no id. */
export interface VendureFailureContext {
  variantId?: string;
  lineId?: string;
  couponCode?: string;
  addressId?: string;
  orderId?: string;
  /**
   * An order asked for by its code. Vendure refuses a code the caller may not read — unknown,
   * expired or someone else's — as FORBIDDEN, which here is not found rather than a lost session.
   */
  orderCode?: string;
  /**
   * A password the customer typed to confirm a change, not to sign in: a wrong one is then a 400
   * the form answers, not the 401 that reads as a lost session.
   */
  confirmsWithPassword?: boolean;
  /** The input field a password policy refusal is about. */
  passwordField?: string;
  /**
   * The call went to the Admin API with a key, which has no session to lose: a refusal there means
   * the key or its role, not a signed-out visitor.
   */
  viaApiKey?: boolean;
}

/** Vendure's own message says only that the action is not allowed, not which permission it needs. */
const ADMIN_KEY_REFUSED =
  "Vendure refused the Admin API key: the key is not valid, or its role lacks a permission this needs (the app's README lists them)";

/** A Vendure failure no canonical error describes. Answered as a 500; the message is for the log. */
export class VendureApiError extends Error {
  constructor(
    readonly upstreamCode: string | undefined,
    message: string | undefined
  ) {
    super(`[vendure] ${upstreamCode ?? 'UNKNOWN'}: ${message ?? 'no message'}`);
    this.name = 'VendureApiError';
  }
}

/**
 * The one translation from a Vendure failure to the error a storefront handles. Every handler and
 * the client go through it, so a code is mapped once.
 */
export const mapVendureError = (failure: VendureFailure, context: VendureFailureContext = {}): Error => {
  const code = failure.errorCode ?? undefined;
  const variantId = context.variantId ?? '';

  switch (code) {
    // Cart
    case 'INSUFFICIENT_STOCK_ERROR':
      return new ProductStockError(variantId, (failure.quantityAvailable ?? 0) > 0 ? 'NOT_ENOUGH_STOCK' : 'OUT_OF_STOCK');
    case 'NEGATIVE_QUANTITY_ERROR':
      return new ProductQuantityError('MINIMUM_NOT_MET', variantId);
    case 'ORDER_LIMIT_ERROR':
      return new ProductQuantityError('MAXIMUM_EXCEEDED', variantId);
    case 'COUPON_CODE_INVALID_ERROR':
      return new DiscountCodeNotFoundError(context.couponCode ?? '');
    case 'COUPON_CODE_EXPIRED_ERROR':
      return new DiscountCodeNotRedeemableError(context.couponCode ?? '', 'CURRENTLY_INACTIVE');
    case 'COUPON_CODE_LIMIT_ERROR':
      return new DiscountCodeNotRedeemableError(context.couponCode ?? '', 'USAGE_LIMIT_REACHED');
    case 'ORDER_MODIFICATION_ERROR':
      return new VendureOrderError('order-not-modifiable');
    case 'ORDER_INTERCEPTOR_ERROR':
      return new VendureOrderError('order-rejected');

    // Checkout
    case 'ORDER_STATE_TRANSITION_ERROR':
      return new VendureOrderError('order-not-ready');
    case 'NO_ACTIVE_ORDER_ERROR':
      return new VendureOrderError('no-active-order');
    case 'INELIGIBLE_SHIPPING_METHOD_ERROR':
      return new VendureOrderError('shipping-method-not-eligible');
    case 'INELIGIBLE_PAYMENT_METHOD_ERROR':
      return new VendureOrderError('payment-method-not-eligible');
    case 'PAYMENT_FAILED_ERROR':
      return new VendureOrderError('payment-failed');
    case 'PAYMENT_DECLINED_ERROR':
      return new VendureOrderError('payment-declined');
    case 'ORDER_PAYMENT_STATE_ERROR':
      return new VendureOrderError('order-not-awaiting-payment');
    case 'COUPON_REMOVED_DURING_CHECKOUT_ERROR':
      return new VendureOrderError('coupon-removed');
    case 'GUEST_CHECKOUT_ERROR':
      return new VendureOrderError('guest-checkout-disabled');
    case 'ALREADY_LOGGED_IN_ERROR':
      return new VendureOrderError('already-signed-in');

    // Accounts
    case 'INVALID_CREDENTIALS_ERROR':
      return context.confirmsWithPassword ? new CurrentPasswordInvalidError() : new InvalidCredentialsError();
    case 'NOT_VERIFIED_ERROR':
      return new CustomerNotConfirmedError();
    case 'EMAIL_ADDRESS_CONFLICT_ERROR':
      return new EmailAlreadyInUseError();
    case 'PASSWORD_VALIDATION_ERROR':
      return new InvalidFieldError('INVALID_VALUE', [context.passwordField ?? 'password']);
    case 'MISSING_PASSWORD_ERROR':
      return new InvalidFieldError('MISSING', [context.passwordField ?? 'password']);
    case 'PASSWORD_RESET_TOKEN_INVALID_ERROR':
      return new PasswordResetTokenInvalidError('invalid');
    case 'PASSWORD_RESET_TOKEN_EXPIRED_ERROR':
      return new PasswordResetTokenInvalidError('expired');
    case 'VERIFICATION_TOKEN_INVALID_ERROR':
    case 'VERIFICATION_TOKEN_EXPIRED_ERROR':
    case 'IDENTIFIER_CHANGE_TOKEN_INVALID_ERROR':
    case 'IDENTIFIER_CHANGE_TOKEN_EXPIRED_ERROR':
      return new EmailConfirmationTokenInvalidError();

    // Top-level GraphQL errors. The Shop API answers a missing session with FORBIDDEN, and an id
    // that is not the visitor's — a line, an address, an order — as not found or as bad input.
    case 'FORBIDDEN':
    case 'UNAUTHORIZED':
      if (context.viaApiKey) return new VendureApiError(code, ADMIN_KEY_REFUSED);
      return context.orderCode ? new OrderNotFoundError(context.orderCode) : new UnauthenticatedError();
    case 'ENTITY_NOT_FOUND':
    case 'USER_INPUT_ERROR':
      if (context.lineId) return new CartLineNotFoundError(context.lineId);
      if (context.addressId) return new AddressNotFoundError(context.addressId);
      if (context.orderId ?? context.orderCode) return new OrderNotFoundError((context.orderId ?? context.orderCode)!);
      if (context.variantId) return new ProductNotFoundError(context.variantId);
      return new VendureApiError(code, failure.message ?? undefined);

    default:
      return new VendureApiError(code, failure.message ?? undefined);
  }
};

/** True when a union member is an `ErrorResult` rather than the payload. */
export const isErrorResult = (value: unknown): value is VendureFailure & { errorCode: string } =>
  !!value && typeof value === 'object' && typeof (value as { errorCode?: unknown }).errorCode === 'string';
