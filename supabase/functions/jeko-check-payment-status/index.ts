// Vérifie le statut réel d'un paiement auprès de Jèko. Utilisée au retour
// sur errorUrl (Jèko n'envoie pas de webhook pour un paiement en échec) et
// comme filet de sécurité si le webhook a été manqué ou retardé.
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { applyJekoPaymentStatus, getJekoPaymentRequest } from "../_shared/jeko.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentification requise" }), { status: 401 });
    }

    const { bookingId } = await req.json();
    if (typeof bookingId !== "string" || !bookingId) {
      return new Response(JSON.stringify({ error: "bookingId requis" }), { status: 400 });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401 });
    }

    // RLS garantit que seuls le payeur ou le professeur de la réservation
    // peuvent lire cette ligne.
    const { data: payment, error: paymentError } = await userClient
      .from("payments")
      .select("id, status, amount_fcfa, provider_reference")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) {
      return new Response(JSON.stringify({ status: "none" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (payment.status !== "pending" || !payment.provider_reference) {
      return new Response(JSON.stringify({ status: payment.status }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const jekoResult = await getJekoPaymentRequest(payment.provider_reference);
    const expectedCents = Math.round(payment.amount_fcfa * 100);
    const receivedCents = jekoResult.transaction?.amount?.amount;
    if (jekoResult.status === "success" && receivedCents != null && receivedCents !== expectedCents) {
      console.error(
        `jeko-check-payment-status: montant incohérent pour ${payment.provider_reference}`,
      );
      return new Response(JSON.stringify({ status: "pending" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const finalStatus = await applyJekoPaymentStatus(serviceClient, payment.id, jekoResult);
    return new Response(JSON.stringify({ status: finalStatus }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("jeko-check-payment-status error:", err);
    const message = err instanceof Error ? err.message : "Erreur inattendue";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
