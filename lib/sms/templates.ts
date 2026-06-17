import { formatGHS } from "@/lib/loan";

export const smsTemplates = {
  depositRecorded: (clientName: string, amount: number, balanceAfter: number, accountNumber: string) =>
    `DEPOSIT: ${clientName}, ${formatGHS(amount)} received on acct ${accountNumber}. Bal: ${formatGHS(balanceAfter)}.`,

  withdrawalRecorded: (clientName: string, amount: number, fee: number, balanceAfter: number, accountNumber: string) =>
    `WITHDRAWAL: ${clientName}, ${formatGHS(amount)}${fee > 0 ? ` (fee ${formatGHS(fee)})` : ""} from acct ${accountNumber}. Bal: ${formatGHS(balanceAfter)}.`,

  transactionReversed: (clientName: string, amount: number, balanceAfter: number) =>
    `${clientName}, a txn of ${formatGHS(amount)} was reversed. Current bal: ${formatGHS(balanceAfter)}.`,

  susuContributionRecorded: (clientName: string, amount: number, dayInCycle: number, totalCollected: number) =>
    `DEPOSIT: ${clientName}, susu ${formatGHS(amount)} recorded (day ${dayInCycle}/31). Total: ${formatGHS(totalCollected)}.`,

  susuBatchRecorded: (clientName: string, entryCount: number, totalAmount: number) =>
    `DEPOSIT: ${clientName}, ${entryCount} susu contributions totalling ${formatGHS(totalAmount)} recorded.`,

  susuMultiDayPayment: (clientName: string, days: number, amountPerDay: number, total: number) =>
    `DEPOSIT: ${clientName}, ${formatGHS(total)} susu received, covering ${days} days (${days} × ${formatGHS(amountPerDay)}). Thank you.`,

  susuWithdrawalRecorded: (clientName: string, amount: number, balanceAfter: number) =>
    `WITHDRAWAL: ${clientName}, susu ${formatGHS(amount)} paid out. Bal: ${formatGHS(balanceAfter)}.`,

  susuClaimApproved: (clientName: string, amount: number) =>
    `${clientName}, your susu claim of ${formatGHS(amount)} is approved. Visit your branch to collect.`,

  susuClaimRejected: (clientName: string) =>
    `${clientName}, your susu claim was not approved. Contact us for details.`,

  susuClaimPaid: (clientName: string, amount: number) =>
    `${clientName}, susu claim payout of ${formatGHS(amount)} has been paid out.`,

  loanRepaymentReceivedClient: (clientName: string, amount: number, remainingBalance: number) =>
    `LOAN: ${clientName}, repayment of ${formatGHS(amount)} received. Outstanding: ${formatGHS(remainingBalance)}.`,

  loanRepaymentReceivedAdmin: (clientName: string, amount: number, remainingBalance: number) =>
    `LOAN: ${clientName} paid ${formatGHS(amount)}. Outstanding: ${formatGHS(remainingBalance)}.`,

  fdEarlyWithdrawalRequestedAdmin: (clientName: string, fdNumber: string, principal: number) =>
    `${clientName} requested early withdrawal on FD ${fdNumber} (${formatGHS(principal)}). Review for approval.`,

  fdEarlyWithdrawalApproved: (clientName: string, fdNumber: string) =>
    `${clientName}, early withdrawal on FD ${fdNumber} approved. Visit your branch to collect. Note: accrued interest is forfeited.`,

  fdEarlyWithdrawalRejected: (clientName: string, fdNumber: string) =>
    `${clientName}, early withdrawal on FD ${fdNumber} was not approved. Your deposit remains active until maturity.`,

  fdEarlyWithdrawalPaidOut: (clientName: string, amount: number) =>
    `WITHDRAWAL: ${clientName}, early FD withdrawal of ${formatGHS(amount)} (principal only) paid out.`,

  fdMaturityPaidOut: (clientName: string, amount: number) =>
    `${clientName}, your fixed deposit matured. ${formatGHS(amount)} (principal + interest) paid out.`,

  fdRolledOver: (clientName: string, oldFdNumber: string, newFdNumber: string, cashInterestPaid: number) =>
    `${clientName}, FD ${oldFdNumber} rolled over to ${newFdNumber}.${
      cashInterestPaid > 0 ? ` Interest of ${formatGHS(cashInterestPaid)} paid in cash.` : " Interest capitalised into new principal."
    }`,

  adminEmergencyClaimAlert: (clientName: string, amount: number) =>
    `${clientName} requested an emergency susu claim of ${formatGHS(amount)}. Review for approval.`,
};
