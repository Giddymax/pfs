import type { Settings } from "@/lib/types";

export type ClientSmsEvent = "deposit" | "withdrawal" | "payment" | "susu" | "fixed_deposit" | "reversal";

/**
 * Mirrors the spec's nested switch: a client SMS only goes out when the
 * master switch, the client-message switch and the client's own opt-in are
 * all on — deposit/withdrawal/payment additionally gate on their own
 * per-event toggle, while susu/FD/reversal events ride on the client
 * master switch alone (they have no dedicated toggle in settings).
 */
export function shouldSendClientSms(event: ClientSmsEvent, client: { sms_opt_in: boolean }, settings: Settings): boolean {
  if (!settings.sms.sms_enabled || !settings.sms.sms_client_enabled || !client.sms_opt_in) return false;

  switch (event) {
    case "deposit":
      return settings.sms.sms_deposit;
    case "withdrawal":
      return settings.sms.sms_withdrawal;
    case "payment":
      return settings.sms.sms_payment;
    case "susu":
    case "fixed_deposit":
    case "reversal":
      return true;
  }
}

export function shouldSendAdminSms(settings: Settings): boolean {
  return settings.sms.sms_enabled && settings.sms.sms_admin_enabled && !!settings.sms.company_tel;
}
