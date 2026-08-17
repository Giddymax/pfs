import { describe, it, expect } from "vitest";
import { computeLoanSchedule, round2, formatGHS } from "@/lib/loan";

describe("computeLoanSchedule", () => {
  it("computes a flat-rate schedule (documented example)", () => {
    // total interest = principal * rate/100; total repayable = principal + interest
    const s = computeLoanSchedule(1000, 10, 5);
    expect(s.totalInterest).toBe(100);
    expect(s.totalRepayable).toBe(1100);
    expect(s.monthlyInstallment).toBe(220);
  });

  it("BASELINE (pre-FIX-9): does not sum back to totalRepayable for tenors that don't divide evenly", () => {
    // Documents the current, known-buggy behaviour so FIX 9 has something
    // concrete to change and this test to update. Principal 1000, flat 10%,
    // 7 months: 157.14 x 7 = 1099.98, two pesewas short of 1100.00.
    const s = computeLoanSchedule(1000, 10, 7);
    expect(s.totalRepayable).toBe(1100);
    expect(s.monthlyInstallment).toBe(157.14);
    const scheduleSum = round2(s.monthlyInstallment * 7);
    expect(scheduleSum).toBe(1099.98);
    expect(scheduleSum).not.toBe(s.totalRepayable); // <- the bug FIX 9 fixes
  });

  it("round2 rounds to 2dp, standard rounding", () => {
    expect(round2(10.126)).toBe(10.13);
    expect(round2(10.124)).toBe(10.12);
  });

  it("BASELINE: round2 is IEEE-754 float, not exact decimal — documents a real, known characteristic", () => {
    // 1.005 is not exactly representable in binary floating point; it's
    // actually stored as ~1.00499999999999989, so Math.round(1.005*100)/100
    // gives 1, not the "obvious" 1.01. This is exactly the money-logic-audit
    // report's item 7 (money representation): the DB layer is exact
    // numeric(12,2), but this TS-layer helper is plain float with post-hoc
    // rounding. Documented here, not silently asserted as "1.01" — a test
    // that expected the wrong answer would hide the very thing worth knowing.
    expect(round2(1.005)).toBe(1);
  });
});

describe("formatGHS", () => {
  it("formats a number as GHS currency", () => {
    expect(formatGHS(1234.5)).toContain("1,234.50");
  });

  it("treats null/undefined as zero", () => {
    expect(formatGHS(null)).toContain("0.00");
    expect(formatGHS(undefined)).toContain("0.00");
  });
});
