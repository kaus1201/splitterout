export type CurrencyCode = 'USD' | 'INR';

export const currencySymbol = (c: CurrencyCode) => (c === 'INR' ? '₹' : '$');

export const currencyLabel = (c: CurrencyCode) =>
  c === 'INR' ? 'INR ₹' : 'USD $';
