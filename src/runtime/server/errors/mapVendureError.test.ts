import { describe, expect, it } from 'vitest';
import { isErrorResult, mapVendureError, VendureApiError } from './mapVendureError';
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

const map = (errorCode: string, context = {}, extra = {}) => mapVendureError({ errorCode, message: 'm', ...extra }, context);

describe('mapVendureError', () => {
  it('maps cart failures with the variant, line or code they are about', () => {
    expect(map('INSUFFICIENT_STOCK_ERROR', { variantId: 'v1' }, { quantityAvailable: 0 })).toEqual(new ProductStockError('v1', 'OUT_OF_STOCK'));
    expect((map('INSUFFICIENT_STOCK_ERROR', { variantId: 'v1' }, { quantityAvailable: 2 }) as ProductStockError).data.reason).toBe('NOT_ENOUGH_STOCK');
    expect(map('NEGATIVE_QUANTITY_ERROR', { variantId: 'v1' })).toBeInstanceOf(ProductQuantityError);
    expect((map('ORDER_LIMIT_ERROR', { variantId: 'v1' }) as ProductQuantityError).data.reason).toBe('MAXIMUM_EXCEEDED');
    expect(map('COUPON_CODE_INVALID_ERROR', { couponCode: 'X' })).toEqual(new DiscountCodeNotFoundError('X'));
    expect((map('COUPON_CODE_EXPIRED_ERROR', { couponCode: 'X' }) as DiscountCodeNotRedeemableError).data.reason).toBe('CURRENTLY_INACTIVE');
    expect((map('COUPON_CODE_LIMIT_ERROR', { couponCode: 'X' }) as DiscountCodeNotRedeemableError).data.reason).toBe('USAGE_LIMIT_REACHED');
  });

  it('maps checkout refusals to the app error with a reason', () => {
    expect((map('ORDER_STATE_TRANSITION_ERROR') as VendureOrderError).data.reason).toBe('order-not-ready');
    expect((map('INELIGIBLE_SHIPPING_METHOD_ERROR') as VendureOrderError).data.reason).toBe('shipping-method-not-eligible');
    expect((map('PAYMENT_DECLINED_ERROR') as VendureOrderError).data.reason).toBe('payment-declined');
    expect((map('ORDER_MODIFICATION_ERROR') as VendureOrderError).data.reason).toBe('order-not-modifiable');
  });

  it('maps account failures', () => {
    expect(map('INVALID_CREDENTIALS_ERROR')).toBeInstanceOf(InvalidCredentialsError);
    expect(map('INVALID_CREDENTIALS_ERROR', { confirmsWithPassword: true })).toBeInstanceOf(CurrentPasswordInvalidError);
    expect(map('NOT_VERIFIED_ERROR')).toBeInstanceOf(CustomerNotConfirmedError);
    expect(map('EMAIL_ADDRESS_CONFLICT_ERROR')).toBeInstanceOf(EmailAlreadyInUseError);
    expect(map('PASSWORD_VALIDATION_ERROR', { passwordField: 'newPassword' })).toEqual(new InvalidFieldError('INVALID_VALUE', ['newPassword']));
    expect(map('MISSING_PASSWORD_ERROR')).toEqual(new InvalidFieldError('MISSING', ['password']));
    expect((map('PASSWORD_RESET_TOKEN_EXPIRED_ERROR') as PasswordResetTokenInvalidError).data.reason).toBe('expired');
    expect(map('VERIFICATION_TOKEN_INVALID_ERROR')).toBeInstanceOf(EmailConfirmationTokenInvalidError);
    expect(map('IDENTIFIER_CHANGE_TOKEN_EXPIRED_ERROR')).toBeInstanceOf(EmailConfirmationTokenInvalidError);
  });

  it('maps top-level errors by what the call was about', () => {
    expect(map('FORBIDDEN', { lineId: 'l1' })).toBeInstanceOf(UnauthenticatedError);
    expect(map('USER_INPUT_ERROR', { lineId: 'l1' })).toEqual(new CartLineNotFoundError('l1'));
    expect(map('ENTITY_NOT_FOUND', { addressId: 'a1' })).toEqual(new AddressNotFoundError('a1'));
    expect(map('ENTITY_NOT_FOUND', { orderId: 'o1' })).toEqual(new OrderNotFoundError('o1'));
    expect(map('ENTITY_NOT_FOUND', { variantId: 'v1' })).toEqual(new ProductNotFoundError('v1'));
    expect(map('ENTITY_NOT_FOUND')).toBeInstanceOf(VendureApiError);
  });

  it("maps a refusal of an Admin API key to the key's permissions, not to a lost session", () => {
    const error = map('FORBIDDEN', { viaApiKey: true });
    expect(error).toBeInstanceOf(VendureApiError);
    expect(error.message).toContain("lacks a permission");
  });

  it('maps a refused order code to not found, not to a lost session', () => {
    expect(map('FORBIDDEN', { orderCode: 'C1' })).toEqual(new OrderNotFoundError('C1'));
    expect(map('ENTITY_NOT_FOUND', { orderCode: 'C1' })).toEqual(new OrderNotFoundError('C1'));
  });

  it('leaves an unknown code a server error carrying the upstream code', () => {
    const error = map('SOMETHING_NEW');
    expect(error).toBeInstanceOf(VendureApiError);
    expect((error as VendureApiError).upstreamCode).toBe('SOMETHING_NEW');
  });
});

describe('isErrorResult', () => {
  it('tells an error member from a payload', () => {
    expect(isErrorResult({ __typename: 'NotVerifiedError', errorCode: 'NOT_VERIFIED_ERROR' })).toBe(true);
    expect(isErrorResult({ __typename: 'Order', id: '1' })).toBe(false);
    expect(isErrorResult(null)).toBe(false);
  });
});
