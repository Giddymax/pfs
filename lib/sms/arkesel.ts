import { createClient } from "@/lib/supabase/server";
import type { SmsRecipientType } from "@/lib/types";

interface SendSmsParams {
  to: string;
  message: string;
  event: string;
  recipientType: SmsRecipientType;
  relatedClientId?: string | null;
}

const ARKESEL_ENDPOINT = "https://sms.arkesel.com/api/v2/sms/send";

/**
 * Sends an SMS via Arkesel and logs the attempt to `sms_log` (which feeds the
 * "SMS Charges" reconciliation line). Never throws — a failed send must not
 * roll back, or even surface as an error in, the financial action that
 * triggered it.
 */
export async function sendSms({ to, message, event, recipientType, relatedClientId }: SendSmsParams): Promise<void> {
  let status: "sent" | "failed" = "failed";
  let cost: number | null = null;

  const apiKey = process.env.ARKESEL_API_KEY;
  const senderId = process.env.ARKESEL_SENDER_ID || "PrimeFin";

  try {
    if (!apiKey) throw new Error("ARKESEL_API_KEY is not configured");

    const res = await fetch(ARKESEL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({ sender: senderId, message, recipients: [to] }),
    });
    const json = (await res.json().catch(() => null)) as { status?: string; data?: { rate?: number } } | null;

    if (res.ok && json?.status === "success") {
      status = "sent";
      cost = typeof json.data?.rate === "number" ? json.data.rate : null;
    }
  } catch {
    status = "failed";
  }

  try {
    const supabase = await createClient();
    await supabase.from("sms_log").insert({
      recipient_phone: to,
      recipient_type: recipientType,
      event,
      message,
      status,
      cost,
      related_client_id: relatedClientId ?? null,
    });
  } catch {
    // Logging failure must not surface either — swallow intentionally.
  }
}
