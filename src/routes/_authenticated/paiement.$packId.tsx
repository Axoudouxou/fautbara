import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Smartphone, Timer, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatFcfa, formatDate, PACK_STATUS_LABELS } from "@/lib/packs";

async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    let message = error.message;
    try {
      const context = (error as { context?: Response }).context;
      const parsed = await context?.json();
      if (parsed?.error) message = parsed.error;
    } catch {
      // pas de corps JSON exploitable : on garde le message générique
    }
    throw new Error(message);
  }
  return data as T;
}

export const Route = createFileRoute("/_authenticated/paiement/$packId")({
  head: () => ({
    meta: [
      { title: "Paiement de votre formule — BARA" },
      {
        name: "description",
        content:
          "Réglez votre formule de séances : rémunération de l'intervenant et frais BARA affichés séparément, en francs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentPage,
});

const METHODS = [
  { value: "orange", label: "Orange Money", icon: Smartphone },
  { value: "mtn", label: "MTN MoMo", icon: Smartphone },
  { value: "moov", label: "Moov Money", icon: Smartphone },
  { value: "wave", label: "Wave", icon: Wallet },
  { value: "djamo", label: "Djamo", icon: Wallet },
];

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function PaymentPage() {
  const { packId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState(METHODS[0]!.value);
  const [useWallet, setUseWallet] = useState(true);
  const [walletAmountInput, setWalletAmountInput] = useState("");

  const packQuery = useQuery({
    queryKey: ["pack", packId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packs")
        .select(
          "id, buyer_id, teacher_id, pack_slug, teacher_rate_fcfa, duration_minutes, sessions_total, free_sessions, paid_sessions, sessions_used, teacher_amount_fcfa, platform_fee_fcfa, total_fcfa, status, hold_expires_at, expires_at, format, commune, children(first_name), pack_types(name, validity_days), teacher_offers(title, subjects(name))",
        )
        .eq("id", packId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => (query.state.data?.status === "pending_payment" ? 4000 : false),
  });

  const paymentQuery = useQuery({
    queryKey: ["pack-payment", packId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, status, amount_fcfa, wallet_used_fcfa, platform_fee_fcfa, teacher_amount_fcfa, method, paid_at",
        )
        .eq("pack_id", packId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 4000 : false),
  });

  const walletQuery = useQuery({
    queryKey: ["wallet", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("balance_fcfa")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.balance_fcfa ?? 0;
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["pack", packId] });
    queryClient.invalidateQueries({ queryKey: ["pack-payment", packId] });
    queryClient.invalidateQueries({ queryKey: ["my-packs", user.id] });
  };

  const startPayment = useMutation({
    mutationFn: async () => {
      const walletToUse = useWallet ? Number(walletAmountInput) || 0 : 0;
      const { data: payment, error } = await supabase.rpc("create_pack_payment", {
        p_pack_id: packId,
        p_wallet_amount_fcfa: walletToUse,
      });
      if (error) throw error;
      if (payment.status === "paid") return null;

      const data = await invokeEdgeFunction<{ redirectUrl?: string }>("jeko-create-payment", {
        packId,
        paymentMethod: method,
      });
      if (!data.redirectUrl) throw new Error("Redirection de paiement introuvable");
      return data.redirectUrl;
    },
    onSuccess: (redirectUrl) => {
      if (!redirectUrl) {
        toast.success("Formule réglée depuis votre portefeuille", {
          description: "Vous pouvez programmer vos séances.",
        });
        refresh();
        return;
      }
      window.location.assign(redirectUrl);
    },
    onError: (err) =>
      toast.error("Paiement impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  // Au retour de Jèko (?paiement=succes|echec) on ne fait jamais confiance à
  // l'URL : le serveur relit l'état réel auprès de Jèko avant de conclure.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("paiement")) return;
    window.history.replaceState(null, "", window.location.pathname);

    invokeEdgeFunction<{ status?: string }>("jeko-check-payment-status", { packId })
      .then((data) => {
        if (data.status === "paid") toast.success("Paiement confirmé");
        else if (data.status === "cancelled") toast.error("Le paiement a échoué ou a été annulé");
        refresh();
      })
      .catch(() => refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  const [now, setNow] = useState(() => Date.now());
  const holdExpiresAt =
    packQuery.data?.status === "pending_payment" ? packQuery.data.hold_expires_at : null;
  useEffect(() => {
    if (!holdExpiresAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt]);
  const secondsLeft = holdExpiresAt
    ? Math.max(0, Math.round((new Date(holdExpiresAt).getTime() - now) / 1000))
    : null;
  const holdExpired = secondsLeft === 0;

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_pack_payment", {
        p_pack_id: packId,
        p_reason: "Annulé par l'utilisateur",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Achat annulé");
      refresh();
    },
    onError: (err) =>
      toast.error("Annulation impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  if (packQuery.isLoading || paymentQuery.isLoading) {
    return (
      <div className="container-page py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  const pack = packQuery.data;
  if (!pack) {
    return (
      <div className="container-page py-16">
        <h1 className="font-display text-2xl font-bold text-foreground">Formule introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cet achat n&apos;existe pas ou ne vous est pas accessible.
        </p>
        <Link
          to="/compte/reservations"
          className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Retour à mes cours
        </Link>
      </div>
    );
  }

  const payment = paymentQuery.data;
  const isPayer = pack.buyer_id === user.id;
  const packStatus = PACK_STATUS_LABELS[pack.status] ?? {
    label: pack.status,
    className: "bg-muted text-muted-foreground",
  };
  const canPay = pack.status === "pending_payment" && !holdExpired;

  const walletBalance = walletQuery.data ?? 0;
  const showWalletOption = !payment && canPay && walletBalance > 0;
  const walletMax = Math.min(walletBalance, pack.total_fcfa);
  const requestedWalletAmount = useWallet
    ? Math.min(walletAmountInput === "" ? walletMax : Number(walletAmountInput) || 0, walletMax)
    : 0;
  const amountDue = payment
    ? payment.amount_fcfa
    : Math.max(0, pack.total_fcfa - requestedWalletAmount);

  return (
    <div className="container-page py-10 sm:py-14">
      <Link to="/compte/reservations" className="text-sm font-semibold text-primary hover:underline">
        ← Mes cours et formules
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Paiement de la formule {pack.pack_types?.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pack.teacher_offers?.subjects?.name} ·{" "}
            {pack.teacher_offers?.title ?? "Cours particulier"}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${packStatus.className}`}>
          {packStatus.label}
        </span>
      </div>

      {isPayer && pack.status === "pending_payment" && secondsLeft !== null && (
        <div
          className={`mt-6 flex items-center gap-4 rounded-3xl border px-5 py-4 ${
            holdExpired || secondsLeft <= 60
              ? "border-destructive/30 bg-destructive-soft"
              : "border-warning/30 bg-warning-soft"
          }`}
        >
          <Timer
            className={`size-8 shrink-0 ${holdExpired || secondsLeft <= 60 ? "text-destructive" : "text-warning"}`}
            aria-hidden
          />
          <div>
            <p
              className={`font-display text-2xl font-bold tabular-nums ${
                holdExpired || secondsLeft <= 60 ? "text-destructive" : "text-warning"
              }`}
            >
              {holdExpired ? "Délai écoulé" : formatCountdown(secondsLeft)}
            </p>
            <p className="text-sm text-muted-foreground">
              {holdExpired
                ? "Le délai de paiement est écoulé : relancez l'achat depuis l'offre."
                : "Ce prix vous est réservé le temps de finaliser le paiement."}
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-display font-bold text-foreground">Détail de la formule</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Séances incluses</dt>
                <dd className="text-foreground">
                  {pack.sessions_total} de {pack.duration_minutes} min
                  {pack.free_sessions > 0 ? ` (dont ${pack.free_sessions} offerte par BARA)` : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Tarif par séance</dt>
                <dd className="text-foreground">{formatFcfa(pack.teacher_rate_fcfa)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Rémunération de l&apos;intervenant</dt>
                <dd className="text-foreground">{formatFcfa(pack.teacher_amount_fcfa)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Frais BARA</dt>
                <dd className="text-foreground">{formatFcfa(pack.platform_fee_fcfa)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-2">
                <dt className="font-semibold text-foreground">Total</dt>
                <dd className="font-display text-lg font-bold text-foreground">
                  {formatFcfa(pack.total_fcfa)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Bénéficiaire</dt>
                <dd className="text-foreground">{pack.children?.first_name ?? "moi"}</dd>
              </div>
              {pack.expires_at && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Programmable jusqu&apos;au</dt>
                  <dd className="text-foreground">{formatDate(pack.expires_at)}</dd>
                </div>
              )}
            </dl>
          </section>

          {isPayer && (
            <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <h2 className="font-display font-bold text-foreground">Moyen de paiement</h2>
              {!canPay ? (
                <p className="mt-3 rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
                  {pack.status === "active"
                    ? "Cette formule est réglée : programmez vos séances depuis vos cours."
                    : holdExpired
                      ? "Le délai de paiement est écoulé."
                      : "Cette formule n'est pas en attente de paiement."}
                </p>
              ) : (
                <>
                  {showWalletOption && (
                    <div className="mt-4 rounded-2xl border border-border p-4">
                      <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <input
                          type="checkbox"
                          checked={useWallet}
                          onChange={(e) => setUseWallet(e.target.checked)}
                          className="size-4 rounded border-input"
                        />
                        Utiliser mon portefeuille ({formatFcfa(walletBalance)} disponibles)
                      </label>
                      {useWallet && (
                        <div className="mt-3">
                          <label
                            htmlFor="wallet-amount"
                            className="text-xs font-semibold text-muted-foreground"
                          >
                            Montant à utiliser (max. {formatFcfa(walletMax)})
                          </label>
                          <input
                            id="wallet-amount"
                            type="text"
                            inputMode="numeric"
                            value={walletAmountInput}
                            onChange={(e) => setWalletAmountInput(e.target.value.replace(/\D/g, ""))}
                            placeholder={String(walletMax)}
                            className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {amountDue > 0 && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {METHODS.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setMethod(m.value)}
                          className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                            method === m.value
                              ? "border-primary bg-primary-soft/50 text-foreground"
                              : "border-border text-foreground hover:bg-secondary"
                          }`}
                        >
                          <m.icon className="size-4 text-primary" aria-hidden /> {m.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="mt-4 text-sm text-muted-foreground">
                    Montant à régler maintenant :{" "}
                    <span className="font-semibold text-foreground">{formatFcfa(amountDue)}</span>
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => startPayment.mutate()}
                      disabled={startPayment.isPending}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      {startPayment.isPending && (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      )}
                      {amountDue === 0 ? "Régler avec mon portefeuille" : "Payer maintenant"}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelMutation.mutate()}
                      disabled={cancelMutation.isPending}
                      className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
                    >
                      Annuler l&apos;achat
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        <aside className="h-fit space-y-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <h2 className="font-display font-bold text-foreground">Comment ça marche</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Vous payez une seule fois : aucun abonnement, aucun frais récurrent.</li>
            <li>
              L&apos;intervenant reçoit l&apos;intégralité de son tarif ; les frais BARA sont
              séparés.
            </li>
            <li>
              Vous programmez ensuite vos séances une par une, sans payer davantage, jusqu&apos;à la
              date de validité.
            </li>
            <li>Chaque séance peut être reportée une fois, à plus de 24 h.</li>
          </ul>
          <Link
            to="/comment-fonctionne-le-paiement"
            search={{ retour: "paiement", packId }}
            className="inline-flex text-sm font-semibold text-primary hover:underline"
          >
            En savoir plus
          </Link>
        </aside>
      </div>
    </div>
  );
}
