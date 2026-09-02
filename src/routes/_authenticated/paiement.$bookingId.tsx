import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock,
  Home,
  Laptop,
  Loader2,
  ShieldCheck,
  Smartphone,
  Timer,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatDay, formatTimeRange } from "./compte.reservations";

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

export const Route = createFileRoute("/_authenticated/paiement/$bookingId")({
  head: () => ({
    meta: [
      { title: "Paiement de la séance — BARA" },
      {
        name: "description",
        content:
          "Réglez votre séance de cours particulier. Les fonds sont conservés jusqu'à la réalisation du cours.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentPage,
});

const PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente de paiement", className: "bg-warning-soft text-warning" },
  paid: { label: "Payée", className: "bg-success-soft text-success" },
  cancelled: { label: "Annulée", className: "bg-muted text-muted-foreground" },
  refunded: { label: "Remboursée", className: "bg-muted text-muted-foreground" },
};

const ESCROW_STATUS: Record<string, string> = {
  held: "Fonds conservés par BARA",
  released: "Fonds transmis au professeur",
  refunded: "Fonds restitués au parent",
};

const METHODS = [
  { value: "orange", label: "Orange Money", icon: Smartphone },
  { value: "mtn", label: "MTN MoMo", icon: Smartphone },
  { value: "moov", label: "Moov Money", icon: Smartphone },
  { value: "wave", label: "Wave", icon: Wallet },
  { value: "djamo", label: "Djamo", icon: Wallet },
];

function formatFcfa(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function PaymentPage() {
  const { bookingId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState(METHODS[0]!.value);
  const [useWallet, setUseWallet] = useState(true);
  const [walletAmountInput, setWalletAmountInput] = useState("");

  const bookingQuery = useQuery({
    queryKey: ["payment-booking", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, price_fcfa, format, commune, status, status_reason, hold_expires_at, is_recurring, requester_id, teacher_id, children(first_name), teacher_offers(title, subjects(name))",
        )
        .eq("id", bookingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    // Tant que le verrou de 15 minutes tient, on surveille une confirmation
    // (webhook) ou une expiration (cron) sans que l'utilisateur ait à
    // recharger la page.
    refetchInterval: (query) => (query.state.data?.status === "pending_payment" ? 4000 : false),
  });

  const paymentQuery = useQuery({
    queryKey: ["payment", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, status, escrow_status, amount_fcfa, wallet_used_fcfa, commission_fcfa, commission_rate, teacher_payout_fcfa, escrow_release_at, method, paid_at",
        )
        .eq("booking_id", bookingId)
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
    queryClient.invalidateQueries({ queryKey: ["payment", bookingId] });
    queryClient.invalidateQueries({ queryKey: ["my-bookings", user.id] });
  };

  const startPayment = useMutation({
    mutationFn: async () => {
      // Établit d'abord la ligne de paiement avec le montant portefeuille
      // choisi (le serveur le plafonne de toute façon au solde réel) : un
      // rappel ultérieur (y compris depuis jeko-create-payment) renvoie
      // cette même ligne sans jamais redébiter le portefeuille.
      const walletToUse = useWallet ? Number(walletAmountInput) || 0 : 0;
      const { data: payment, error } = await supabase.rpc("create_booking_payment", {
        p_booking_id: bookingId,
        p_wallet_amount_fcfa: walletToUse,
      });
      if (error) throw error;

      if (payment.status === "paid") {
        // Entièrement réglé par le portefeuille : rien à demander à Jèko.
        return null;
      }

      const data = await invokeEdgeFunction<{ redirectUrl?: string }>("jeko-create-payment", {
        bookingId,
        paymentMethod: method,
      });
      if (!data.redirectUrl) throw new Error("Redirection de paiement introuvable");
      return data.redirectUrl;
    },
    onSuccess: (redirectUrl) => {
      if (!redirectUrl) {
        toast.success("Paiement réglé depuis votre portefeuille", {
          description: "La séance est confirmée.",
        });
        refresh();
        return;
      }
      // Quitte l'application : le checkout Jèko est hébergé.
      window.location.assign(redirectUrl);
    },
    onError: (err) =>
      toast.error("Paiement impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  // Au retour de Jèko (successUrl / errorUrl : ?paiement=succes|echec), on ne
  // fait jamais confiance à l'URL elle-même : on revérifie le statut réel
  // auprès du serveur, qui relit l'état authoritatif auprès de Jèko avant de
  // mettre à jour la DB (Jèko n'envoie pas de webhook pour un échec).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paiement = params.get("paiement");
    if (!paiement) return;
    window.history.replaceState(null, "", window.location.pathname);

    invokeEdgeFunction<{ status?: string }>("jeko-check-payment-status", { bookingId })
      .then((data) => {
        if (data.status === "paid") toast.success("Paiement confirmé");
        else if (data.status === "cancelled") toast.error("Le paiement a échoué ou a été annulé");
        refresh();
      })
      .catch(() => {
        // Le webhook a peut-être déjà traité le paiement, ou Jèko est momentanément indisponible.
        refresh();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // Compte à rebours du verrou de 15 minutes : recalculé à chaque seconde à
  // partir de hold_expires_at (horodatage serveur), donc cohérent même après
  // un rechargement de page ou un changement d'onglet — jamais un simple
  // décompte local qui repartirait de 15:00 au retour sur la page.
  const [now, setNow] = useState(() => Date.now());
  const holdExpiresAt = bookingQuery.data?.status === "pending_payment"
    ? bookingQuery.data.hold_expires_at
    : null;
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
      const { error } = await supabase.rpc("cancel_booking_payment", {
        p_booking_id: bookingId,
        p_reason: "Annulé par l'utilisateur",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paiement annulé");
      refresh();
    },
    onError: (err) =>
      toast.error("Annulation impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  if (bookingQuery.isLoading || paymentQuery.isLoading) {
    return (
      <div className="container-page py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  const booking = bookingQuery.data;
  if (!booking) {
    return (
      <div className="container-page py-16">
        <h1 className="font-display text-2xl font-bold text-foreground">Séance introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette demande n&apos;existe pas ou ne vous est pas accessible.
        </p>
        <Link
          to="/compte/reservations"
          className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Retour à mes demandes
        </Link>
      </div>
    );
  }

  const payment = paymentQuery.data;
  const isPayer = booking.requester_id === user.id;
  const status = payment
    ? (PAYMENT_STATUS[payment.status] ?? {
        label: payment.status,
        className: "bg-muted text-muted-foreground",
      })
    : { label: "Non initié", className: "bg-muted text-muted-foreground" };
  const canPay =
    booking.status === "accepted" ||
    booking.status === "completed" ||
    (booking.status === "pending_payment" && !holdExpired);
  const holdReleased =
    booking.status === "cancelled" &&
    (booking.status_reason?.toLowerCase().includes("délai de paiement") ||
      booking.status_reason?.toLowerCase().includes("paiement échoué"));

  // Le choix du montant portefeuille n'est proposé qu'avant la toute
  // première tentative de paiement : une fois la ligne payments créée, le
  // montant retenu est définitif (voir create_booking_payment, idempotent).
  const walletBalance = walletQuery.data ?? 0;
  const showWalletOption = !payment && canPay && walletBalance > 0;
  const walletMax = Math.min(walletBalance, booking.price_fcfa);
  const requestedWalletAmount = useWallet
    ? Math.min(walletAmountInput === "" ? walletMax : Number(walletAmountInput) || 0, walletMax)
    : 0;
  const previewAmountDue = payment
    ? payment.amount_fcfa
    : Math.max(0, booking.price_fcfa - requestedWalletAmount);
  const fullyCoveredByWallet = showWalletOption && requestedWalletAmount > 0 && previewAmountDue === 0;

  return (
    <div className="container-page py-10 sm:py-14">
      <Link
        to="/compte/reservations"
        className="text-sm font-semibold text-primary hover:underline"
      >
        ← Mes demandes de cours
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Paiement de la séance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.teacher_offers?.subjects?.name} ·{" "}
            {booking.teacher_offers?.title ?? "Cours particulier"}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
          {status.label}
        </span>
      </div>

      {isPayer && booking.status === "pending_payment" && secondsLeft !== null && (
        <div
          className={`mt-6 flex items-center gap-4 rounded-3xl border px-5 py-4 ${
            holdExpired
              ? "border-destructive/30 bg-destructive-soft"
              : secondsLeft <= 60
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
                ? "Le créneau est en cours de libération : quelqu'un d'autre peut désormais le réserver."
                : "Ce créneau vous est réservé le temps de finaliser le paiement. Passé ce délai, il redevient disponible."}
            </p>
          </div>
        </div>
      )}

      {isPayer && holdReleased && (
        <div className="mt-6 rounded-3xl border border-destructive/30 bg-destructive-soft px-5 py-4">
          <p className="font-semibold text-destructive">Ce créneau n&apos;est plus réservé</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.status_reason ?? "Le paiement n'a pas abouti à temps."} Vous pouvez choisir un
            autre créneau dans l&apos;agenda du professeur.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-display font-bold text-foreground">Détail de la séance</h2>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4" aria-hidden />
                {formatDay(booking.scheduled_at)} ·{" "}
                {formatTimeRange(booking.scheduled_at, booking.duration_minutes)} (
                {booking.duration_minutes} min)
              </p>
              <p className="inline-flex items-center gap-1.5">
                {booking.format === "online" ? (
                  <>
                    <Laptop className="size-4" aria-hidden /> Cours en ligne
                  </>
                ) : (
                  <>
                    <Home className="size-4" aria-hidden /> À domicile
                    {booking.commune ? ` · ${booking.commune}` : ""}
                  </>
                )}
              </p>
              <p>Bénéficiaire : {booking.children?.first_name ?? "moi"}</p>
              {booking.is_recurring && (
                <p>
                  Cours hebdomadaire : le paiement affiché concerne la première séance uniquement.
                </p>
              )}
            </div>
          </section>

          {isPayer && (
            <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <h2 className="font-display font-bold text-foreground">Moyen de paiement</h2>
              {!canPay ? (
                <p className="mt-3 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
                  {holdExpired
                    ? "Le délai de paiement de ce créneau est écoulé."
                    : "Cette réservation n'est pas en attente de paiement."}
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
                            placeholder={walletMax.toLocaleString("fr-FR")}
                            className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {!fullyCoveredByWallet && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {METHODS.map((m) => {
                        const Icon = m.icon;
                        const active = method === m.value;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setMethod(m.value)}
                            disabled={payment?.status === "paid"}
                            className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-semibold transition-colors disabled:opacity-60 ${
                              active
                                ? "border-primary bg-primary-soft text-primary-soft-foreground"
                                : "border-border text-foreground hover:bg-secondary"
                            }`}
                          >
                            <Icon className="size-5" aria-hidden />
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    {(!payment || payment.status === "pending") && (
                      <button
                        type="button"
                        onClick={() => startPayment.mutate()}
                        disabled={startPayment.isPending}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                      >
                        {startPayment.isPending && (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        )}
                        {fullyCoveredByWallet
                          ? "Confirmer avec mon portefeuille"
                          : `Payer ${formatFcfa(payment?.amount_fcfa ?? previewAmountDue)}`}
                      </button>
                    )}
                    {payment &&
                      booking.status !== "pending_payment" &&
                      payment.status !== "cancelled" &&
                      payment.status !== "refunded" &&
                      payment.escrow_status !== "released" && (
                        <button
                          type="button"
                          onClick={() => cancelMutation.mutate()}
                          disabled={cancelMutation.isPending}
                          className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                        >
                          {payment.status === "paid"
                            ? "Demander un remboursement"
                            : "Annuler le paiement"}
                        </button>
                      )}
                    {payment?.status === "paid" && (
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/compte/reservations" })}
                        className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
                      >
                        Retour à mes demandes
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        <aside className="h-fit space-y-4 rounded-3xl border border-border bg-secondary/40 p-6 lg:sticky lg:top-24">
          <div className="inline-flex items-center gap-2 font-display font-bold text-foreground">
            <ShieldCheck className="size-5 text-primary" aria-hidden />
            Séquestre BARA
          </div>
          <p className="text-sm text-muted-foreground">
            Le montant est conservé par la plateforme puis transmis au professeur après la séance.
            En cas de problème signalé, il peut être restitué.
          </p>

          <dl className="space-y-2 border-t border-border/70 pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Prix de la séance</dt>
              <dd className="font-semibold text-foreground">{formatFcfa(booking.price_fcfa)}</dd>
            </div>
            {(payment?.wallet_used_fcfa ?? requestedWalletAmount) > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Réglé par le portefeuille</dt>
                <dd className="text-foreground">
                  − {formatFcfa(payment?.wallet_used_fcfa ?? requestedWalletAmount)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="font-semibold text-foreground">
                {payment ? "Encaissé via Mobile Money" : "Reste à payer"}
              </dt>
              <dd className="font-semibold text-foreground">
                {formatFcfa(payment?.amount_fcfa ?? previewAmountDue)}
              </dd>
            </div>
            {payment && (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    Frais de plateforme ({Math.round(Number(payment.commission_rate) * 100)} %)
                  </dt>
                  <dd className="text-foreground">{formatFcfa(payment.commission_fcfa)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Part professeur</dt>
                  <dd className="text-foreground">{formatFcfa(payment.teacher_payout_fcfa)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Séquestre</dt>
                  <dd className="text-foreground">
                    {ESCROW_STATUS[payment.escrow_status] ?? payment.escrow_status}
                  </dd>
                </div>
                {payment.escrow_release_at && payment.escrow_status === "held" && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Libération prévue</dt>
                    <dd className="text-foreground">
                      {new Date(payment.escrow_release_at).toLocaleDateString("fr-FR")}
                    </dd>
                  </div>
                )}
              </>
            )}
          </dl>

          <p className="text-xs text-muted-foreground">
            Les montants, la commission et la date de libération sont calculés côté serveur et ne
            peuvent pas être modifiés depuis le navigateur.
          </p>
        </aside>
      </div>
    </div>
  );
}
