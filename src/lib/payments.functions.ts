import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Origine publique de l'app, pour construire les URLs de retour Jèko. */
function requestOrigin() {
  const request = getRequest();
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${proto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

/**
 * Prépare le paiement d'une séance chez Jèko et renvoie l'URL de redirection
 * Mobile Money. La ligne `payments` est créée par la RPC existante (commission,
 * escrow, crédits de report) puis complétée avec la référence prestataire.
 */
export const startJekoPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string; method: string }) => {
    if (!input?.bookingId) throw new Error("Réservation manquante");
    if (!input?.method) throw new Error("Moyen de paiement manquant");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { toJekoMethod, createJekoPaymentRequest } = await import("@/lib/jeko.server");
    const method = toJekoMethod(data.method);

    // Crée (ou récupère) la ligne de paiement avec les règles métier BARA.
    const { error: rpcError } = await supabase.rpc("create_booking_payment", {
      p_booking_id: data.bookingId,
    });
    if (rpcError) throw new Error(rpcError.message);

    const { data: payment, error } = await supabase
      .from("payments")
      .select("id, payer_id, amount_fcfa, status, provider_reference, provider_redirect_url")
      .eq("booking_id", data.bookingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!payment) throw new Error("Paiement introuvable");
    if (payment.payer_id !== userId) throw new Error("Accès refusé");
    if (payment.status === "paid") throw new Error("Cette séance est déjà payée");
    if (payment.amount_fcfa < 100) throw new Error("Montant trop faible pour un paiement en ligne");

    const origin = requestOrigin();
    const reference = `BARA-${payment.id.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
    const returnUrl = `${origin}/paiement/${data.bookingId}`;

    const request = await createJekoPaymentRequest({
      amountFcfa: payment.amount_fcfa,
      reference,
      method,
      successUrl: `${returnUrl}?paiement=succes`,
      errorUrl: `${returnUrl}?paiement=echec`,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("payments")
      .update({
        provider: "jeko",
        method: data.method,
        provider_reference: reference,
        provider_request_id: request.id,
        provider_redirect_url: request.redirectUrl,
        provider_status: request.status,
      })
      .eq("id", payment.id);

    if (!request.redirectUrl) {
      throw new Error(
        request.errorReason ?? "Le prestataire n'a pas fourni de lien de paiement.",
      );
    }
    return { redirectUrl: request.redirectUrl, reference };
  });

/**
 * Vérifie auprès de Jèko l'issue d'un paiement (utile au retour de redirection,
 * si le webhook n'est pas encore arrivé) et met le paiement à jour si réussi.
 */
export const syncJekoPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) => {
    if (!input?.bookingId) throw new Error("Réservation manquante");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: payment, error } = await supabase
      .from("payments")
      .select("id, payer_id, status, provider_request_id")
      .eq("booking_id", data.bookingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!payment || payment.payer_id !== userId) throw new Error("Paiement introuvable");
    if (payment.status === "paid") return { status: "paid" as const };
    if (!payment.provider_request_id) return { status: payment.status };

    const { getJekoPaymentRequest } = await import("@/lib/jeko.server");
    const request = await getJekoPaymentRequest(payment.provider_request_id);
    const { markJekoPaymentPaid } = await import("@/lib/payments.server");

    if (request.status === "success") {
      await markJekoPaymentPaid({ paymentId: payment.id, providerStatus: request.status });
      return { status: "paid" as const };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("payments")
      .update({ provider_status: request.status })
      .eq("id", payment.id);
    return { status: request.status };
  });
