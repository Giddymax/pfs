/**
 * Simple flat-rate term loan calculations.
 * total interest = principal * (flatRatePercent / 100)
 * total repayable = principal + total interest
 * monthly installment = total repayable / tenorMonths
 */
export function computeLoanSchedule(
  principal: number,
  flatRatePercent: number,
  tenorMonths: number
) {
  const totalInterest = round2(principal * (flatRatePercent / 100));
  const totalRepayable = round2(principal + totalInterest);
  const monthlyInstallment = round2(totalRepayable / tenorMonths);

  return { totalInterest, totalRepayable, monthlyInstallment };
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatGHS(amount: number | null | undefined) {
  const value = amount ?? 0;
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(value);
}

export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}
