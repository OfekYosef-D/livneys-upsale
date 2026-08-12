export function getReceiptAmountForOutstanding(outstanding: number): string {
  return outstanding > 0 ? String(outstanding) : '';
}
