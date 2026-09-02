/**
 * Client serveur pour l'API Jèko (paiements Mobile Money / carte, Côte d'Ivoire).
 * Toutes les clés sont lues dans process.env au moment de l'appel : jamais au
 * niveau module (les variables sont injectées par requête sur le runtime edge).
 */

export type JekoMethod = "wave" | "orange" | "mtn" | "moov" | "djamo";

const JEKO_METHODS: Record<string, JekoMethod> = {
  wave: "wave",
  orange: "orange",
  orange_money: "orange",
  mtn: "mtn",
  mtn_momo: "mtn",
  moov: "moov",
  moov_money: "moov",
  djamo: "djamo",
};

export function toJekoMethod(method: string): JekoMethod {
  const mapped = JEKO_METHODS[method];
  if (!mapped) throw new Error(`Moyen de paiement non pris en charge : ${method}`);
  return mapped;
}

function jekoConfig() {
  const baseUrl = process.env["JEKO_API_BASE_URL"] ?? "https://api.jeko.africa";
  const apiKey = process.env["JEKO_API_KEY"];
  const apiKeyId = process.env["JEKO_API_KEY_ID"];
  const storeId = process.env["JEKO_STORE_ID"];
  if (!apiKey || !apiKeyId || !storeId) {
    throw new Error("Configuration de paiement Jèko incomplète.");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, apiKeyId, storeId };
}

async function jekoFetch(path: string, init?: RequestInit) {
  const { baseUrl, apiKey, apiKeyId } = jekoConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "X-API-KEY": apiKey,
      "X-API-KEY-ID": apiKeyId,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`[Jeko] ${path} a échoué [${response.status}] : ${text}`);
    throw new Error(`Le prestataire de paiement a refusé la demande [${response.status}].`);
  }
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

export type JekoPaymentRequest = {
  id: string;
  reference: string;
  status: string;
  redirectUrl: string | null;
  errorReason: string | null;
};

function normalize(raw: Record<string, unknown>): JekoPaymentRequest {
  const details = (raw["paymentDetails"] as { data?: Record<string, unknown> } | undefined)?.data;
  return {
    id: String(raw["id"] ?? ""),
    reference: String(raw["reference"] ?? ""),
    status: String(raw["status"] ?? "pending"),
    redirectUrl:
      (raw["redirectUrl"] as string | undefined) ??
      (details?.["redirectUrl"] as string | undefined) ??
      null,
    errorReason: (raw["errorReason"] as string | null | undefined) ?? null,
  };
}

export async function createJekoPaymentRequest(params: {
  amountFcfa: number;
  reference: string;
  method: JekoMethod;
  successUrl: string;
  errorUrl: string;
}): Promise<JekoPaymentRequest> {
  const { storeId } = jekoConfig();
  const raw = await jekoFetch("/partner_api/payment_requests", {
    method: "POST",
    body: JSON.stringify({
      storeId,
      // Jèko attend des centimes, multiples de 100 (XOF n'a pas de décimales).
      amountCents: Math.round(params.amountFcfa) * 100,
      currency: "XOF",
      reference: params.reference,
      paymentDetails: {
        type: "redirect",
        data: {
          paymentMethod: params.method,
          successUrl: params.successUrl,
          errorUrl: params.errorUrl,
        },
      },
    }),
  });
  return normalize(raw);
}

export async function getJekoPaymentRequest(id: string): Promise<JekoPaymentRequest> {
  return normalize(await jekoFetch(`/partner_api/payment_requests/${id}`));
}
