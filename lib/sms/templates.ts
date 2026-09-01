import { formatGHS } from "@/lib/loan";

export const smsTemplates = {
  depositRecorded: (clientName: string, amount: number, balanceAfter: number, accountNumber: string) =>
    `DEPOSIT: ${clientName}, ${formatGHS(amount)} received on acct ${accountNumber}. Bal: ${formatGHS(balanceAfter)}.`,

  withdrawalRecorded: (clientName: string, amount: number, fee: number, balanceAfter: number, accountNumber: string, proxyName?: string | null) =>
    `WITHDRAWAL: ${clientName}, ${formatGHS(amount)}${fee > 0 ? ` (fee ${formatGHS(fee)})` : ""} from acct ${accountNumber}. Bal: ${formatGHS(balanceAfter)}.${proxyName ? ` Withdrawn by: ${proxyName}.` : ""}`,

  transactionReversed: (clientName: string, amount: number, balanceAfter: number) =>
    `${clientName}, a txn of ${formatGHS(amount)} was reversed. Current bal: ${formatGHS(balanceAfter)}.`,

  susuContributionRecorded: (clientName: string, amount: number, dayInCycle: number, totalCollected: number, balanceAfter: number) =>
    `DEPOSIT: ${clientName}, susu ${formatGHS(amount)} recorded (day ${dayInCycle}/31). Total: ${formatGHS(totalCollected)}. Bal: ${formatGHS(balanceAfter)}.`,

  susuBatchRecorded: (clientName: string, entryCount: number, totalAmount: number, balanceAfter: number) =>
    `DEPOSIT: ${clientName}, ${entryCount} susu contributions totalling ${formatGHS(totalAmount)} recorded. Bal: ${formatGHS(balanceAfter)}.`,

  susuMultiDayPayment: (clientName: string, days: number, amountPerDay: number, total: number, balanceAfter: number) =>
    `DEPOSIT: ${clientName}, ${formatGHS(total)} susu received, covering ${days} days (${days} × ${formatGHS(amountPerDay)}). Bal: ${formatGHS(balanceAfter)}. Thank you.`,

  susuDay31FeeTaken: (clientName: string, feeAmount: number, remainingClaimable: number) =>
    `SUSU: ${clientName}, your 31-day cycle is complete. Company fee of ${formatGHS(feeAmount)} has been taken. ${formatGHS(remainingClaimable)} is available in your account.`,

  loanRepaymentReceivedClient: (clientName: string, amount: number, remainingBalance: number) =>
    `LOAN: ${clientName}, repayment of ${formatGHS(amount)} received. Outstanding: ${formatGHS(remainingBalance)}.`,

  loanRepaymentReceivedAdmin: (clientName: string, amount: number, remainingBalance: number) =>
    `LOAN: ${clientName} paid ${formatGHS(amount)}. Outstanding: ${formatGHS(remainingBalance)}.`,

  clientRegisteredAdmin: (clientName: string, clientCode: string, registeredBy?: string | null) =>
    `NEW CLIENT: ${clientName} (${clientCode}) registered${registeredBy ? ` by ${registeredBy}` : ""}.`,

  interestDisbursed: (clientName: string, amount: number, balanceAfter: number, accountNumber: string) =>
    `INTEREST: ${clientName}, ${formatGHS(amount)} interest has been credited to acct ${accountNumber}. Bal: ${formatGHS(balanceAfter)}. Thank you for saving with us.`,
};
