// Déclenche le payout réel Jèko pour une demande de retrait déjà créée par
// request_wallet_withdrawal (solde déjà réservé côté BARA, inchangé ici).
// Appelée par le client juste après cette RPC. Flux : contact bénéficiaire
// (créé ou réutilisé) -> vérification du solde du magasin BARA -> création
// du transfert (référence unique = idempotence Jèko) -> statut "processing"
// en attendant le webhook (jeko-webhook gère la confirmation/l'échec).
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import {
  createJekoContact,
  createJekoTransfer,
  getJekoStoreBalance,
  type JekoPaymentMethod,
} from "../_shared/jeko.ts";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";

const ALLOWED_METHODS: JekoPaymentMethod[] = ["wave", "orange", "mtn", "moov", "djamo"];

/** Jèko exige un numéro au format international ; le champ saisi côté BARA
 * est une donnée libre (voir profiles.phone) — on normalise au mieux plutôt
 * que de rejeter une demande sur un simple manque de "+225". */
function toE164(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("0")) return `+225${digits.slice(1)}`;
  if (digits.length === 8 || digits.length === 9) return `+225${digits}`;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée" }, 405);
  }

  let withdrawalId: string | undefined;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authentification requise" }, 401);
    }

    const body = await req.json();
    withdrawalId = body?.withdrawalId;
    if (typeof withdrawalId !== "string" || !withdrawalId) {
      return jsonResponse({ error: "withdrawalId requis" }, 400);
    }

    // RLS restreint cette lecture au propriétaire de la demande.
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

    const { data: withdrawal, error: withdrawalError } = await userClient
      .from("wallet_withdrawal_requests")
      .select("id, user_id, amount_fcfa, method, phone, status")
      .eq("id", withdrawalId)
      .maybeSingle();
    if (withdrawalError) throw withdrawalError;
    if (!withdrawal) {
      return jsonResponse({ error: "Demande de retrait introuvable" }, 404);
    }
    if (withdrawal.status !== "pending") {
      // Déjà en cours ou finalisée (rappel client, double-clic...) : rien à
      // refaire, ce n'est pas une erreur.
      return jsonResponse({ status: withdrawal.status });
    }
    if (!ALLOWED_METHODS.includes(withdrawal.method as JekoPaymentMethod)) {
      throw new Error(`Moyen de retrait non supporté par Jèko : ${withdrawal.method}`);
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const method = withdrawal.method as JekoPaymentMethod;
    const phoneE164 = toE164(withdrawal.phone);

    // 1. Contact bénéficiaire — réutilisé s'il existe déjà pour ce
    // (utilisateur, moyen, numéro), sinon créé auprès de Jèko puis mis en
    // cache pour les prochains retraits.
    const { data: cachedContact, error: cacheError } = await serviceClient
      .from("wallet_payout_contacts")
      .select("jeko_contact_id")
      .eq("user_id", withdrawal.user_id)
      .eq("method", method)
      .eq("phone", phoneE164)
      .maybeSingle();
    if (cacheError) throw cacheError;

    let contactId = cachedContact?.jeko_contact_id ?? null;
    if (!contactId) {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("display_name")
        .eq("user_id", withdrawal.user_id)
        .maybeSingle();

      const contact = await createJekoContact({
        name: profile?.display_name ?? "Intervenant BARA",
        method,
        phoneE164,
      });
      contactId = contact.id;

      const { error: insertContactError } = await serviceClient
        .from("wallet_payout_contacts")
        .upsert(
          { user_id: withdrawal.user_id, method, phone: phoneE164, jeko_contact_id: contactId },
          { onConflict: "user_id,method,phone" },
        );
      if (insertContactError) throw insertContactError;
    }

    // 2. Le magasin BARA doit couvrir le transfert (les frais éventuels ne
    // sont connus qu'après coup côté Jèko, donc non inclus dans ce contrôle
    // préalable — voir jeko_fees_fcfa, enregistré une fois le transfert
    // terminé).
    const amountCents = Math.round(withdrawal.amount_fcfa * 100);
    const storeBalanceCents = await getJekoStoreBalance();
    if (storeBalanceCents < amountCents) {
      const { error: rpcError } = await serviceClient.rpc("fail_withdrawal_payout", {
        p_withdrawal_id: withdrawalId,
        p_error_message: "Solde du magasin BARA insuffisant pour ce transfert",
      });
      if (rpcError) throw rpcError;
      return jsonResponse({ error: "Solde du magasin BARA insuffisant, réessayez plus tard" }, 503);
    }

    // 3. Transfert — référence stable et unique par retrait : un rappel de
    // cette fonction pour le même withdrawalId (retry réseau) envoie
    // exactement la même référence, donc Jèko répond 409 (déjà géré par
    // createJekoTransfer) plutôt que de créer un second transfert.
    const reference = `BARA-PAYOUT-${withdrawalId}`;
    const transfer = await createJekoTransfer({
      contactId,
      amountFcfa: withdrawal.amount_fcfa,
      reference,
      description: "Retrait intervenant BARA",
    });

    const { data: updated, error: markError } = await serviceClient.rpc("mark_withdrawal_processing", {
      p_withdrawal_id: withdrawalId,
      p_jeko_contact_id: contactId,
      p_jeko_transfer_id: transfer.id || null,
      p_jeko_reference: reference,
    });
    if (markError) throw markError;

    return jsonResponse({ status: updated?.status ?? "processing" });
  } catch (err) {
    console.error("jeko-create-payout error:", err);
    const message = err instanceof Error ? err.message : "Erreur inattendue";

    // Échec avant/pendant l'appel Jèko : on ne laisse jamais une demande
    // bloquée en "pending" sans explication ni fonds recrédités.
    if (withdrawalId) {
      try {
        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await serviceClient.rpc("fail_withdrawal_payout", {
          p_withdrawal_id: withdrawalId,
          p_error_message: message,
        });
      } catch (cleanupErr) {
        console.error("jeko-create-payout: échec du recrédit après erreur", cleanupErr);
      }
    }

    return jsonResponse({ error: message }, 500);
  }
});
