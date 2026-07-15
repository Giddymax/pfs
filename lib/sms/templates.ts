import { formatGHS } from "@/lib/loan";

export const smsTemplates = {
  depositRecorded: (clientName: string, amount: number, balanceAfter: number, accountNumber: string) =>
    `DEPOSIT: ${clientName}, ${formatGHS(amount)} received on acct ${accountNumber}. Bal: ${formatGHS(balanceAfter)}.`,

  withdrawalRecorded: (clientName: string, amount: number, fee: number, balanceAfter: number, accountNumber: string, proxyName?: string | null) =>
    `WITHDRAWAL: ${clientName}, ${formatGHS(amount)}${fee > 0 ? ` (fee ${formatGHS(fee)})` : ""} from acct ${accountNumber}. Bal: ${formatGHS(balanceAfter)}.${proxyName ? ` Withdrawn by: ${proxyName}.` : ""}`,

  transactionReversed: (clientName: string, amount: number, balanceAfter: number) =>
    `${clientName}, a txn of ${formatGHS(amount)} was reversed. Current bal: ${formatGHS(balanceAfter)}.`,

  susuContributionRecorded: (clientName: string, amount: number, dayInCycle: number, totalCollected: number) =>
    `DEPOSIT: ${clientName}, susu ${formatGHS(amount)} recorded (day ${dayInCycle}/31). Total: ${formatGHS(totalCollected)}.`,

  susuBatchRecorded: (clientName: string, entryCount: number, totalAmount: number) =>
    `DEPOSIT: ${clientName}, ${entryCount} susu contributions totalling ${formatGHS(totalAmount)} recorded.`,

  susuMultiDayPayment: (clientName: string, days: number, amountPerDay: number, total: number) =>
    `DEPOSIT: ${clientName}, ${formatGHS(total)} susu received, covering ${days} days (${days} × ${formatGHS(amountPerDay)}). Thank you.`,

  susuWithdrawalRecorded: (clientName: string, amount: number, balanceAfter: number, proxyName?: string | null) =>
    `WITHDRAWAL: ${clientName}, susu ${formatGHS(amount)} paid out. Bal: ${formatGHS(balanceAfter)}.${proxyName ? ` Withdrawn by: ${proxyName}.` : ""}`,

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

  fdOpened: (clientName: string, fdNumber: string, principal: number, maturityDate: string) =>
    `${clientName}, your fixed deposit ${fdNumber} of ${formatGHS(principal)} has been opened. Maturity: ${maturityDate}.`,

  fdOpenedAdmin: (clientName: string, fdNumber: string, principal: number, termMonths: number) =>
    `NEW FD: ${clientName} opened ${fdNumber} — ${formatGHS(principal)} for ${termMonths} month${termMonths === 1 ? "" : "s"}.`,

  fdEarlyWithdrawalRequestedAdmin: (clientName: string, fdNumber: string, principal: number) =>
    `${clientName} requested early withdrawal on FD ${fdNumber} (${formatGHS(principal)}). Review for approval.`,

  fdEarlyWithdrawalApproved: (clientName: string, fdNumber: string) =>
    `${clientName}, early withdrawal on FD ${fdNumber} approved. Visit your branch to collect. Note: accrued interest is forfeited.`,

  fdEarlyWithdrawalApprovedAdmin: (clientName: string, fdNumber: string) =>
    `FD ${fdNumber} early withdrawal for ${clientName} has been approved.`,

  fdEarlyWithdrawalRejected: (clientName: string, fdNumber: string) =>
    `${clientName}, early withdrawal on FD ${fdNumber} was not approved. Your deposit remains active until maturity.`,

  fdEarlyWithdrawalRejectedAdmin: (clientName: string, fdNumber: string) =>
    `FD ${fdNumber} early withdrawal for ${clientName} has been rejected.`,

  fdEarlyWithdrawalPaidOut: (clientName: string, amount: number) =>
    `WITHDRAWAL: ${clientName}, early FD withdrawal of ${formatGHS(amount)} (principal only) paid out.`,

  fdMaturityPaidOut: (clientName: string, amount: number) =>
    `${clientName}, your fixed deposit matured. ${formatGHS(amount)} (principal + interest) paid out.`,

  fdRolledOver: (clientName: string, oldFdNumber: string, newFdNumber: string, cashInterestPaid: number) =>
    `${clientName}, FD ${oldFdNumber} rolled over to ${newFdNumber}.${
      cashInterestPaid > 0 ? ` Interest of ${formatGHS(cashInterestPaid)} paid in cash.` : " Interest capitalised into new principal."
    }`,

  fdRolledOverAdmin: (clientName: string, oldFdNumber: string, newFdNumber: string) =>
    `FD ROLLOVER: ${clientName}'s ${oldFdNumber} rolled over to ${newFdNumber}.`,

  adminEmergencyClaimAlert: (clientName: string, amount: number, reason?: string) =>
    `${clientName} requested an emergency susu claim of ${formatGHS(amount)}.${reason ? ` Reason: ${reason}.` : ""} Review for approval.`,

  susuEmergencyWithdrawal: (clientName: string, payout: number, companyFee: number, balanceAfter: number, proxyName?: string | null) =>
    `EMERGENCY WITHDRAWAL: ${clientName}, ${formatGHS(payout)} paid out (company fee ${formatGHS(companyFee)} deducted). Bal: ${formatGHS(balanceAfter)}.${proxyName ? ` Withdrawn by: ${proxyName}.` : ""}`,

  susuEmergencyWithdrawalAdmin: (clientName: string, payout: number, companyFee: number, reason: string, staffName: string, proxyName?: string | null) =>
    `EMERGENCY WITHDRAWAL: ${clientName}, ${formatGHS(payout)} paid out (fee ${formatGHS(companyFee)}).${reason ? ` Reason: ${reason}.` : ""}${proxyName ? ` Withdrawn by: ${proxyName}.` : ""} By: ${staffName}.`,

  interestDisbursed: (clientName: string, amount: number, balanceAfter: number, accountNumber: string) =>
    `INTEREST: ${clientName}, ${formatGHS(amount)} interest has been credited to acct ${accountNumber}. Bal: ${formatGHS(balanceAfter)}. Thank you for saving with us.`,
};
