/**
 * Price formatting utilities for AUD display.
 * §3.8 All prices GST-inclusive, displayed with $ prefix and 2 decimal places.
 */

const AUD_FORMATTER = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format cents (integer) to AUD display string e.g. 4999 → "$49.99" */
export function formatPrice(cents: number): string {
  return AUD_FORMATTER.format(cents / 100);
}

/** Calculate GST component (10% inclusive) from a GST-inclusive cent amount */
export function extractGst(cents: number): number {
  return Math.round(cents - cents / 1.1);
}

/** Format GST amount from a GST-inclusive cent amount */
export function formatGst(cents: number): string {
  return formatPrice(extractGst(cents));
}

/** Calculate ex-GST amount from a GST-inclusive cent amount */
export function exGstAmount(cents: number): number {
  return Math.round(cents / 1.1);
}

/** Format ex-GST amount */
export function formatExGst(cents: number): string {
  return formatPrice(exGstAmount(cents));
}
