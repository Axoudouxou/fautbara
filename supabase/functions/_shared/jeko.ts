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
  jekoResult: JekoPaymentRequest,
): Promise<"paid" | "cancelled" | "pending"> {
  if (jekoResult.status === "success") {
    const { error } = await serviceClient
      .from("payments")
      .update({
        status: "paid",
        escrow_status: "held",
        paid_at: new Date().toISOString(),
        provider_transaction_id: jekoResult.transaction?.id ?? null,
      })
      .eq("id", paymentId)
      .eq("status", "pending");
    if (error) throw error;
    return "paid";
  }

  if (jekoResult.status === "error") {
    const { error } = await serviceClient
      .from("payments")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", paymentId)
      .eq("status", "pending");
    if (error) throw error;
    return "cancelled";
  }

  return "pending";
}
