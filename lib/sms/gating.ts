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

/**
 * Admin/company alerts fire for every event by default. Deposit and
 * withdrawal are the only events with their own admin-side toggle
 * (sms_admin_deposit / sms_admin_withdrawal) — every other event (susu, FD,
 * reversal, payment, claims, etc.) rides on the admin master switch alone,
 * matching the existing behaviour for all their call sites.
 */
export function shouldSendAdminSms(settings: Settings, event?: "deposit" | "withdrawal"): boolean {
  if (!settings.sms.sms_enabled || !settings.sms.sms_admin_enabled || !settings.sms.company_tel) return false;

  switch (event) {
    case "deposit":
      return settings.sms.sms_admin_deposit;
    case "withdrawal":
      return settings.sms.sms_admin_withdrawal;
    default:
      return true;
  }
}
