// Discretionary interest for high-balance clients: a flat, manually-entered
// amount credited to savings/susu accounts that held more than the threshold
// balance once the qualifying period has fully elapsed. To start a new round,
// just update these two constants — nothing else needs to change.
export const INTEREST_PERIOD_START = "2026-08-01";
export const INTEREST_MIN_BALANCE = 5000;

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// End of the 3rd month of the window (e.g. 2026-08-01 -> 2026-10-31).
export const INTEREST_PERIOD_END = (() => {
  const end = new Date(addMonths(INTEREST_PERIOD_START, 3) + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
})();

/** The flag only becomes active once the full 3-month window has elapsed. */
export function isInterestWindowElapsed(today = new Date().toISOString().slice(0, 10)): boolean {
  return today > INTEREST_PERIOD_END;
}
