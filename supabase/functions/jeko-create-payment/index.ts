// Crée le payment_request Jèko pour une réservation, puis renvoie l'URL de
// checkout hébergé vers laquelle le navigateur doit être redirigé. Appelée
// par le client authentifié (jamais les clés Jèko côté navigateur) — tout le
// dialogue avec Jèko se fait ici, côté serveur.
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { createJekoPaymentRequest, type JekoPaymentMethod } from "../_shared/jeko.ts";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";

const ALLOWED_METHODS: JekoPaymentMethod[] = ["wave", "orange", "mtn", "moov", "djamo"];

Deno.serve(async (req) => {
  // Préflight navigateur : doit répondre 2xx avec les en-têtes CORS.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authentification requise" }, 401);
    }

    const { bookingId, paymentMethod } = await req.json();
    if (typeof bookingId !== "string" || !bookingId) {
      return jsonResponse({ error: "bookingId requis" }, 400);
    }
    if (!ALLOWED_METHODS.includes(paymentMethod)) {
      return jsonResponse({ error: "Moyen de paiement invalide" }, 400);
    }

    // Client au nom de l'utilisateur appelant : RLS et auth.uid() s'appliquent
    // normalement, exactement comme pour un appel RPC direct depuis le client.
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
      return jsonResponse({ error: "Session invalide" }, 401);
    }

    // Idempotent : calcule (ou relit) le montant dû, net des éventuels
    // crédits de report, et crée la ligne payments si elle n'existe pas.
    const { data: payment, error: paymentError } = await userClient
      .rpc("create_booking_payment", { p_booking_id: bookingId })
      .single();
    if (paymentError) {
      return jsonResponse({ error: paymentError.message }, 400);
    }
    if (payment.status !== "pending") {
      return jsonResponse({ error: "Ce paiement est déjà finalisé ou annulé" }, 409);
    }

    const appUrl = Deno.env.get("PUBLIC_APP_URL");
    if (!appUrl) throw new Error("Configuration manquante (PUBLIC_APP_URL)");

    const jekoPayment = await createJekoPaymentRequest({
      amountFcfa: payment.amount_fcfa,
      // Unique par tentative : un nouvel essai après échec ne réutilise
      // jamais la même référence auprès de Jèko.
      reference: `${payment.id}-${Date.now()}`,
      paymentMethod,
      successUrl: `${appUrl}/paiement/${bookingId}?status=success`,
      errorUrl: `${appUrl}/paiement/${bookingId}?status=error`,
    });

    if (!jekoPayment.redirectUrl) {
      throw new Error("Jèko n'a renvoyé aucune URL de paiement");
    }

    const { error: saveError } = await userClient.rpc("jeko_save_payment_request", {
      p_booking_id: bookingId,
      p_provider_reference: jekoPayment.id,
      p_method: paymentMethod,
    });
    if (saveError) throw saveError;

    return jsonResponse({ redirectUrl: jekoPayment.redirectUrl });
  } catch (err) {
    console.error("jeko-create-payment error:", err);
    const message = err instanceof Error ? err.message : "Erreur inattendue";
    return jsonResponse({ error: message }, 500);
  }
});
