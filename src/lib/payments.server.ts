import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Marque un paiement comme encaissé et place les fonds en séquestre.
 * Idempotent : ne fait rien si le paiement est déjà réglé.
 */
export async function markJekoPaymentPaid(params: {
  paymentId: string;
  providerStatus: string;
  method?: string;
}) {
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("id, status")
    .eq("id", params.paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!payment) throw new Error("Paiement introuvable");
  if (payment.status === "paid") return { alreadyPaid: true as const };

  const { error: updateError } = await supabaseAdmin
    .from("payments")
    .update({
      status: "paid",
      escrow_status: "held",
      provider: "jeko",
      provider_status: params.providerStatus,
      provider_notified_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      ...(params.method ? { method: params.method } : {}),
    })
    .eq("id", payment.id)
    .eq("status", "pending");
  if (updateError) throw new Error(updateError.message);
  return { alreadyPaid: false as const };
}

/** Retrouve un paiement à partir de la référence ou de l'ID de demande Jèko. */
export async function findPaymentByProviderRefs(params: {
  reference?: string | null;
  requestId?: string | null;
}) {
  if (params.reference) {
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id, status, booking_id, payer_id, teacher_id")
      .eq("provider_reference", params.reference)
      .maybeSingle();
    if (data) return data;
  }
  if (params.requestId) {
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id, status, booking_id, payer_id, teacher_id")
      .eq("provider_request_id", params.requestId)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}
