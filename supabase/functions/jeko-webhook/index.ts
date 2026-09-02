// Récepteur du webhook Jèko (TRANSACTION_COMPLETED). Endpoint public — aucune
// authentification utilisateur, la confiance vient uniquement de la
// signature HMAC. Jèko n'envoie pas de webhook pour un paiement en échec
// (cf. jeko-check-payment-status pour ce cas) et peut réessayer plusieurs
// fois : tout le traitement est donc idempotent (n'agit que sur un paiement
// encore "pending").
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import {
  applyJekoPaymentStatus,
  computeJekoSignature,
  extractPaymentRequestId,
  getJekoPaymentRequest,
  timingSafeEqual,
} from "../_shared/jeko.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Méthode non autorisée", { status: 405 });
  }

  // La signature se calcule sur le corps brut, jamais sur un JSON
  // re-sérialisé après coup — on lit donc le texte avant tout parsing.
  const rawBody = await req.text();
  const signature = req.headers.get("Jeko-Signature");
  const secret = Deno.env.get("JEKO_WEBHOOK_SECRET");

  if (!secret) {
    console.error("jeko-webhook: JEKO_WEBHOOK_SECRET manquant");
    return new Response("Configuration serveur manquante", { status: 500 });
  }
  if (!signature) {
    return new Response("Signature manquante", { status: 401 });
  }

  const expected = await computeJekoSignature(rawBody, secret);
  if (!timingSafeEqual(signature, expected)) {
    console.error("jeko-webhook: signature invalide");
    return new Response("Signature invalide", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Corps JSON invalide", { status: 400 });
  }

  const paymentRequestId = extractPaymentRequestId(body);
  if (!paymentRequestId) {
    console.error("jeko-webhook: impossible d'extraire l'identifiant du payment_request", body);
    // On accuse réception (200) pour éviter des tentatives répétées sur un
    // événement qu'on ne saura de toute façon jamais rattacher.
    return new Response("ok", { status: 200 });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: payment, error: lookupError } = await serviceClient
    .from("payments")
    .select("id, status, amount_fcfa, booking_id")
    .eq("provider_reference", paymentRequestId)
    .maybeSingle();

  if (lookupError) {
    console.error("jeko-webhook: erreur de lecture payments", lookupError);
    return new Response("Erreur serveur", { status: 500 });
  }
  if (!payment) {
    console.error("jeko-webhook: aucun paiement pour provider_reference", paymentRequestId);
    return new Response("ok", { status: 200 });
  }
  if (payment.status !== "pending") {
    // Déjà traité (webhook rejoué, ou confirmé entretemps par
    // jeko-check-payment-status) : rien à refaire.
    return new Response("ok", { status: 200 });
  }

  try {
    // Ne jamais se fier au seul corps du webhook pour créditer un paiement :
    // on relit l'état authoritatif directement auprès de Jèko.
    const jekoResult = await getJekoPaymentRequest(paymentRequestId);

    const expectedCents = Math.round(payment.amount_fcfa * 100);
    const receivedCents = jekoResult.transaction?.amount?.amount;
    if (jekoResult.status === "success" && receivedCents != null && receivedCents !== expectedCents) {
      console.error(
        `jeko-webhook: montant incohérent pour ${paymentRequestId} — attendu ${expectedCents}, reçu ${receivedCents}`,
      );
      return new Response("Montant incohérent", { status: 409 });
    }

    await applyJekoPaymentStatus(serviceClient, payment.id, payment.booking_id, jekoResult);
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("jeko-webhook: erreur de traitement", err);
    return new Response("Erreur serveur", { status: 500 });
  }
});
