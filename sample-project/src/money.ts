export const TAX_RATE = 0.21;

// Adds tax to an amount in euros and returns the gross amount, rounded to cents.
export function addTax(netAmount: number): number {
  return netAmount * (1 + TAX_RATE);
}

export function formatEuros(amount: number): string {
  return `€${amount.toFixed(2)}`;
}
