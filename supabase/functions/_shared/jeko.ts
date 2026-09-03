// Client Jèko partagé par les fonctions serveur (jamais importé côté client :
// tout appel à l'API Jèko doit passer par une fonction Supabase Edge, avec
// les clés JEKO_* lues depuis les secrets de la fonction, jamais exposées
// au navigateur).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.112.4";

const JEKO_API_BASE_URL = Deno.env.get("JEKO_API_BASE_URL") ?? "https://api.jeko.africa";

export type JekoPaymentMethod = "wave" | "orange" | "mtn" | "moov" | "djamo";

export type JekoPaymentRequest = {
  id: string;
  storeId: string;
  reference: string;
  type: string;
  paymentMethod: string;
  status: "pending" | "success" | "error" | string;
  redirectUrl: string | null;
  errorReason: string | null;
  transaction?: {
    id: string;
    status: string;
    amount: { amount: number; currency: string };
  } | null;
};

function jekoHeaders(): HeadersInit {
  const apiKey = Deno.env.get("JEKO_API_KEY");
  const apiKeyId = Deno.env.get("JEKO_API_KEY_ID");
  if (!apiKey || !apiKeyId) {
    throw new Error("Configuration Jèko manquante (JEKO_API_KEY / JEKO_API_KEY_ID)");
  }
  return {
    "X-API-KEY": apiKey,
    "X-API-KEY-ID": apiKeyId,
    "Content-Type": "application/json",
  };
}

/** Crée un payment_request Jèko (checkout hébergé) pour un montant en FCFA. */
export async function createJekoPaymentRequest(params: {
  amountFcfa: number;
  reference: string;
  paymentMethod: JekoPaymentMethod;
  successUrl: string;
  errorUrl: string;
}): Promise<JekoPaymentRequest> {
  const storeId = Deno.env.get("JEKO_STORE_ID");
  if (!storeId) throw new Error("Configuration Jèko manquante (JEKO_STORE_ID)");

  const res = await fetch(`${JEKO_API_BASE_URL}/partner_api/payment_requests`, {
    method: "POST",
    headers: jekoHeaders(),
    body: JSON.stringify({
      storeId,
      // Jèko exprime les montants en centimes ; le FCFA n'a pas de sous-unité
      // dans l'usage courant, donc amount_fcfa * 100.
      amountCents: Math.round(params.amountFcfa * 100),
      currency: "XOF",
      reference: params.reference,
      paymentDetails: {
        type: "redirect",
        data: {
          paymentMethod: params.paymentMethod,
          successUrl: params.successUrl,
          errorUrl: params.errorUrl,
        },
      },
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message ?? `Jèko a refusé la création du paiement (HTTP ${res.status})`);
  }
  return body as JekoPaymentRequest;
}

/** Relit l'état authoritatif d'un payment_request auprès de Jèko (jamais se fier au seul corps du webhook). */
export async function getJekoPaymentRequest(paymentRequestId: string): Promise<JekoPaymentRequest> {
  const res = await fetch(`${JEKO_API_BASE_URL}/partner_api/payment_requests/${paymentRequestId}`, {
    headers: jekoHeaders(),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message ?? `Impossible de lire le statut du paiement (HTTP ${res.status})`);
  }
  return body as JekoPaymentRequest;
}

/** Comparaison en temps constant, pour éviter une attaque par timing sur la vérification de signature. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** HMAC-SHA256(corps brut, secret webhook) en hexadécimal, tel qu'attendu dans l'en-tête Jeko-Signature. */
export async function computeJekoSignature(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------
// Payout (retraits vers Mobile Money) : contacts, solde du magasin,
// transferts. Le paiement entrant ci-dessus n'est pas modifié.
// ---------------------------------------------------------------------

// L'API Contacts de Jèko attend "orange_money", alors que l'API Payment
// Requests (ci-dessus) attend "orange" — les deux valeurs viennent de deux
// endpoints Jèko distincts avec des vocabulaires différents pour le même
// opérateur ; on garde "orange" comme valeur interne BARA (déjà utilisée
// partout ailleurs, y compris à l'écran) et on ne mappe qu'ici.
const JEKO_CONTACT_PAYMENT_METHOD: Record<JekoPaymentMethod, string> = {
  wave: "wave",
  orange: "orange_money",
  mtn: "mtn",
  moov: "moov",
  djamo: "djamo",
};

export type JekoContact = {
  id: string;
  name: string;
  paymentMethod: string;
  identifier: { number: string };
};

/** Crée le bénéficiaire Jèko requis avant tout transfert vers un Mobile Money. */
export async function createJekoContact(params: {
  name: string;
  method: JekoPaymentMethod;
  phoneE164: string;
}): Promise<JekoContact> {
  const res = await fetch(`${JEKO_API_BASE_URL}/partner_api/contacts`, {
    method: "POST",
    headers: jekoHeaders(),
    body: JSON.stringify({
      name: params.name,
      paymentMethod: JEKO_CONTACT_PAYMENT_METHOD[params.method],
      identifier: { number: params.phoneE164 },
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message ?? `Jèko a refusé la création du contact (HTTP ${res.status})`);
  }
  return body as JekoContact;
}

/** Solde du magasin BARA, en centimes — à vérifier avant de créer un transfert. */
export async function getJekoStoreBalance(): Promise<number> {
  const storeId = Deno.env.get("JEKO_STORE_ID");
  if (!storeId) throw new Error("Configuration Jèko manquante (JEKO_STORE_ID)");

  const res = await fetch(`${JEKO_API_BASE_URL}/partner_api/stores/${storeId}/balance`, {
    headers: jekoHeaders(),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message ?? `Impossible de lire le solde du magasin (HTTP ${res.status})`);
  }
  // La doc ne fixe pas un nom de champ unique pour le solde : on couvre les
  // formes plausibles plutôt que de supposer une seule forme exacte.
  const record = body as Record<string, unknown>;
  const candidates = [
    record.balanceCents,
    record.balance,
    record.availableBalance,
    record.amountCents,
  ];
  for (const c of candidates) {
    if (typeof c === "number") return c;
  }
  throw new Error("Réponse de solde Jèko illisible (aucun champ de montant reconnu)");
}

export type JekoTransfer = {
  id: string;
  storeId: string;
  contactId: string;
  reference: string;
  amountCents: number;
  currency: string;
  status: "pending" | "success" | "error" | string;
  fees?: number | null;
  errorReason?: string | null;
};

/**
 * Crée le transfert. La référence doit être unique par intention de
 * transfert (on utilise l'id du retrait BARA) : un 409 de Jèko est une
 * protection d'idempotence, pas une erreur — on retourne alors le transfert
 * existant si le corps de la réponse le contient, sinon un objet minimal
 * portant seulement la référence (le webhook fera foi via cette référence).
 */
export async function createJekoTransfer(params: {
  contactId: string;
  amountFcfa: number;
  reference: string;
  description?: string;
}): Promise<JekoTransfer> {
  const storeId = Deno.env.get("JEKO_STORE_ID");
  if (!storeId) throw new Error("Configuration Jèko manquante (JEKO_STORE_ID)");

  const res = await fetch(`${JEKO_API_BASE_URL}/partner_api/transfers`, {
    method: "POST",
    headers: jekoHeaders(),
    body: JSON.stringify({
      storeId,
      contactId: params.contactId,
      amountCents: Math.round(params.amountFcfa * 100),
      currency: "XOF",
      description: params.description?.slice(0, 255),
      reference: params.reference,
    }),
  });
  const body = await res.json().catch(() => null);

  if (res.status === 409) {
    const existing = (body?.transfer ?? body?.data ?? body) as Record<string, unknown> | null;
    if (existing && typeof existing.id === "string") {
      return existing as unknown as JekoTransfer;
    }
    // Corps de conflit sans transfert exploitable : on sait au moins que la
    // référence est déjà connue de Jèko, le webhook la résoudra.
    return {
      id: "",
      storeId,
      contactId: params.contactId,
      reference: params.reference,
      amountCents: Math.round(params.amountFcfa * 100),
      currency: "XOF",
      status: "pending",
    };
  }

  if (!res.ok) {
    throw new Error(body?.message ?? `Jèko a refusé la création du transfert (HTTP ${res.status})`);
  }
  return body as JekoTransfer;
}

/** Relit l'état authoritatif d'un transfert (jamais se fier au seul corps du webhook). */
export async function getJekoTransfer(transferId: string): Promise<JekoTransfer> {
  const res = await fetch(`${JEKO_API_BASE_URL}/partner_api/transfers/${transferId}`, {
    headers: jekoHeaders(),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message ?? `Impossible de lire le statut du transfert (HTTP ${res.status})`);
  }
  return body as JekoTransfer;
}

/**
 * Cherche l'identifiant de payment_request dans le corps du webhook, sans
 * supposer une forme unique : la doc Jèko ne précise pas si l'objet est à la
 * racine, sous `data`, ou sous `transaction`.
 */
export function extractPaymentRequestId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const candidates = [
    (body as Record<string, unknown>).id,
    (body as Record<string, unknown>).paymentRequestId,
    (body as Record<string, unknown>).payment_request_id,
    (body as Record<string, unknown>).data &&
      (
        (body as Record<string, Record<string, unknown>>).data.id ??
        (body as Record<string, Record<string, unknown>>).data.paymentRequestId
      ),
    (body as Record<string, unknown>).transaction &&
      (body as Record<string, Record<string, unknown>>).transaction.paymentRequestId,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return null;
}

/**
 * Cherche la référence BARA d'un transfert dans le corps du webhook. La doc
 * Jèko pointe explicitement `transactionDetails.reference`, mais on couvre
 * aussi les variantes plausibles vues côté paiement (racine, `data`,
 * `transfer`) plutôt que de supposer une forme unique.
 */
export function extractTransferReference(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const nested = (obj: unknown): Record<string, unknown> | null =>
    obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
  const candidates = [
    nested(b.transactionDetails)?.reference,
    b.reference,
    nested(b.transfer)?.reference,
    nested(b.data)?.reference,
    nested(nested(b.data)?.transactionDetails)?.reference,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return null;
}

/**
 * Applique l'état authoritatif Jèko (relu via getJekoPaymentRequest, jamais
 * le seul corps du webhook) à la ligne payments correspondante. Idempotent :
 * ne touche que les paiements encore "pending", donc un webhook rejoué ou
 * une vérification manuelle répétée ne double-crédite jamais rien. Exécuté
 * uniquement avec la clé de service (RLS contournée volontairement, ce
 * chemin ne passe jamais par un JWT utilisateur).
 */
export async function applyJekoPaymentStatus(
  serviceClient: SupabaseClient,
  paymentId: string,
  bookingId: string,
  jekoResult: JekoPaymentRequest,
): Promise<"paid" | "cancelled" | "pending"> {
  if (jekoResult.status === "success") {
    const { data, error } = await serviceClient
      .from("payments")
      .update({
        status: "paid",
        escrow_status: "held",
        paid_at: new Date().toISOString(),
        provider_transaction_id: jekoResult.transaction?.id ?? null,
      })
      .eq("id", paymentId)
      .eq("status", "pending")
      .select("id");
    if (error) throw error;
    if (data && data.length > 0) {
      // Bascule la réservation (verrou de 15 min → confirmée) et notifie le
      // professeur ; no-op si elle n'était pas en pending_payment (ancien
      // flux "accepted" déjà en place, ou déjà confirmée par ailleurs).
      const { error: confirmError } = await serviceClient.rpc("confirm_paid_booking", {
        p_booking_id: bookingId,
      });
      if (confirmError) throw confirmError;
    }
    return "paid";
  }

  if (jekoResult.status === "error") {
    const { data, error } = await serviceClient
      .from("payments")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", paymentId)
      .eq("status", "pending")
      .select("id");
    if (error) throw error;
    if (data && data.length > 0) {
      const { error: cancelError } = await serviceClient.rpc("cancel_unpaid_booking_hold", {
        p_booking_id: bookingId,
      });
      if (cancelError) throw cancelError;
    }
    return "cancelled";
  }

  return "pending";
}
