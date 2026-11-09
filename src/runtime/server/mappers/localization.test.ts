import { describe, expect, it } from 'vitest';
import { vendureCurrencyCode, vendureLanguageCode } from './localization';

describe('vendureLanguageCode', () => {
  it('prefers the regional code, then the language, along the locale chain', () => {
    expect(vendureLanguageCode(['pt-BR', 'pt'], ['en', 'pt', 'pt_BR'])).toBe('pt_BR');
    expect(vendureLanguageCode(['de-AT', 'de'], ['en', 'de'])).toBe('de');
    expect(vendureLanguageCode(['fr-FR', 'en'], ['en', 'de'])).toBe('en');
  });

  it('leaves the language to the channel when none is offered', () => {
    expect(vendureLanguageCode(['fr-FR'], ['en', 'de'])).toBeUndefined();
  });
});

describe('vendureCurrencyCode', () => {
  it('sends only a currency the channel offers', () => {
    expect(vendureCurrencyCode('eur', ['USD', 'EUR'])).toBe('EUR');
    expect(vendureCurrencyCode('GBP', ['USD', 'EUR'])).toBeUndefined();
    expect(vendureCurrencyCode(undefined, ['USD'])).toBeUndefined();
  });
});
