export const STANDARD_VAT_RATE_PERCENT = 18;

export type VatSummary = {
  vatRatePercent: number;
  vatTotal: number;
  totalIncludingVat: number;
};

export function calculateVatSummary(
  netTotal: number,
  vatRatePercent = STANDARD_VAT_RATE_PERCENT,
): VatSummary {
  const vatTotal = roundCurrency(netTotal * (vatRatePercent / 100));

  return {
    vatRatePercent,
    vatTotal,
    totalIncludingVat: roundCurrency(netTotal + vatTotal),
  };
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

