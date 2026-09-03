// Récepteur du webhook Jèko (TRANSACTION_COMPLETED) — paiements entrants ET
// payouts (retraits) partagent le même événement et donc le même endpoint,
// configuré une seule fois dans le Dashboard Business Jèko. Endpoint public
// — aucune authentification utilisateur, la confiance vient uniquement de
// la signature HMAC. Jèko peut réessayer plusieurs fois : tout le
// traitement est donc idempotent (n'agit que sur une ligne encore en
// attente : payments "pending" ou wallet_withdrawal_requests "processing").
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import {
  applyJekoPaymentStatus,
  computeJekoSignature,
  extractPaymentRequestId,
  extractTransferReference,
  getJekoPaymentRequest,
  getJekoTransfer,
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

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Paiement entrant (payment_request) : chemin existant, inchangé.
  const paymentRequestId = extractPaymentRequestId(body);
  if (paymentRequestId) {
    const { data: payment, error: lookupError } = await serviceClient
      .from("payments")
      .select("id, status, amount_fcfa, booking_id")
      .eq("provider_reference", paymentRequestId)
      .maybeSingle();

    if (lookupError) {
      console.error("jeko-webhook: erreur de lecture payments", lookupError);
      return new Response("Erreur serveur", { status: 500 });
    }

    if (payment) {
      if (payment.status !== "pending") {
        // Déjà traité (webhook rejoué, ou confirmé entretemps par
        // jeko-check-payment-status) : rien à refaire.
        return new Response("ok", { status: 200 });
      }

      try {
        // Ne jamais se fier au seul corps du webhook pour créditer un
        // paiement : on relit l'état authoritatif directement auprès de Jèko.
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
        console.error("jeko-webhook: erreur de traitement paiement", err);
        return new Response("Erreur serveur", { status: 500 });
      }
    }
    // Pas de paiement pour cet id : peut-être un transfert dont le champ
    // générique "id" a été confondu avec un identifiant de payment_request
    // — on continue vers le chemin payout ci-dessous plutôt que d'abandonner.
  }

  // 2. Payout (retrait vers Mobile Money) : matché par la référence BARA
  // (transactionDetails.reference côté Jèko), pas par un id Jèko — c'est
  // nous qui l'avons choisie à la création du transfert, donc c'est le
  // point d'ancrage le plus fiable indépendamment de la forme exacte du
  // payload transfert.
  const transferReference = extractTransferReference(body);
  if (!transferReference) {
    console.error("jeko-webhook: aucun identifiant de paiement ni de transfert exploitable", body);
    // On accuse réception (200) pour éviter des tentatives répétées sur un
    // événement qu'on ne saura de toute façon jamais rattacher.
    return new Response("ok", { status: 200 });
  }

  const { data: withdrawal, error: withdrawalLookupError } = await serviceClient
    .from("wallet_withdrawal_requests")
    .select("id, status, amount_fcfa, jeko_transfer_id")
    .eq("jeko_reference", transferReference)
    .maybeSingle();

  if (withdrawalLookupError) {
    console.error("jeko-webhook: erreur de lecture wallet_withdrawal_requests", withdrawalLookupError);
    return new Response("Erreur serveur", { status: 500 });
  }
  if (!withdrawal) {
    console.error("jeko-webhook: aucun retrait pour la référence", transferReference);
    return new Response("ok", { status: 200 });
  }
  if (withdrawal.status !== "processing") {
    // Déjà finalisé (webhook rejoué) ou pas encore marqué "processing" par
    // jeko-create-payout (course très étroite) : rien à faire pour l'instant,
    // un rejeu ultérieur de Jèko (jusqu'à 3 tentatives) laisse le temps à
    // cette transition de se terminer.
    return new Response("ok", { status: 200 });
  }

  try {
    let status: string;
    let feesFcfa = 0;
    let errorReason: string | null = null;

    if (withdrawal.jeko_transfer_id) {
      // Ne jamais se fier au seul corps du webhook : on relit l'état
      // authoritatif auprès de Jèko avant de créditer ou d'échouer quoi
      // que ce soit.
      const transfer = await getJekoTransfer(withdrawal.jeko_transfer_id);
      status = transfer.status;
      feesFcfa = transfer.fees ? Math.round(transfer.fees) / 100 : 0;
      errorReason = transfer.errorReason ?? null;
    } else {
      // Cas limite : la création du transfert avait renvoyé un 409 sans
      // objet exploitable (voir createJekoTransfer), donc aucun id à
      // revérifier — on ne peut se fier qu'au statut porté par le webhook.
      const b = body as Record<string, unknown>;
      status = String(b.status ?? (b.transfer as Record<string, unknown> | undefined)?.status ?? "pending");
      errorReason = (b.errorReason as string | undefined) ?? null;
    }

    if (status === "success") {
      const { error: rpcError } = await serviceClient.rpc("complete_withdrawal_payout", {
        p_withdrawal_id: withdrawal.id,
        p_jeko_transfer_id: withdrawal.jeko_transfer_id,
        p_fees_fcfa: feesFcfa,
      });
      if (rpcError) throw rpcError;
    } else if (status === "error") {
      const { error: rpcError } = await serviceClient.rpc("fail_withdrawal_payout", {
        p_withdrawal_id: withdrawal.id,
        p_error_message: errorReason ?? "Transfert refusé par Jèko",
      });
      if (rpcError) throw rpcError;
    }
    // status "pending" : rien à faire, on attend un futur webhook.

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("jeko-webhook: erreur de traitement payout", err);
    return new Response("Erreur serveur", { status: 500 });
  }
});
