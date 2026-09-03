import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Smartphone,
  Wallet,
  Wand2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SectionTabs, accountTabs } from "@/components/section-tabs";

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

export const Route = createFileRoute("/_authenticated/compte/portefeuille")({
  head: () => ({
    meta: [
      { title: "Mon portefeuille — BARA" },
      {
        name: "description",
        content:
          "Consultez le solde de votre portefeuille BARA, l'historique de vos mouvements et demandez un retrait vers Mobile Money.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalletPage,
});

const METHODS = [
  { value: "orange", label: "Orange Money" },
  { value: "mtn", label: "MTN MoMo" },
  { value: "moov", label: "Moov Money" },
  { value: "wave", label: "Wave" },
  { value: "djamo", label: "Djamo" },
];

const WITHDRAWAL_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-warning-soft text-warning" },
  processing: { label: "Envoi en cours", className: "bg-primary-soft text-primary-soft-foreground" },
  approved: { label: "Approuvé", className: "bg-primary-soft text-primary-soft-foreground" },
  paid: { label: "Envoyé", className: "bg-success-soft text-success" },
  rejected: { label: "Refusé", className: "bg-destructive/10 text-destructive" },
  error: { label: "Échec", className: "bg-destructive/10 text-destructive" },
};

function formatFcfa(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

function WalletPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]!.value);
  const [phone, setPhone] = useState("");

  const rolesQuery = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as string);
    },
  });
  const isTeacherAccount = rolesQuery.data?.includes("teacher") ?? false;

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

  const transactionsQuery = useQuery({
    queryKey: ["wallet-transactions", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("id, type, amount_fcfa, balance_after, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const withdrawalsQuery = useQuery({
    queryKey: ["wallet-withdrawals", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_withdrawal_requests")
        .select("id, amount_fcfa, method, status, admin_note, error_message, requested_at, processed_at")
        .order("requested_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    // Un retrait "processing" attend le webhook Jèko (asynchrone) : on
    // surveille sans que l'utilisateur ait à recharger la page.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((w) => w.status === "processing" || w.status === "pending")
        ? 4000
        : false,
  });

  const balance = walletQuery.data ?? 0;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["wallet", user.id] });
    queryClient.invalidateQueries({ queryKey: ["wallet-transactions", user.id] });
    queryClient.invalidateQueries({ queryKey: ["wallet-withdrawals", user.id] });
  };

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("Montant invalide");
      }
      if (value > balance) {
        throw new Error("Le montant dépasse votre solde disponible");
      }
      if (!phone.trim()) {
        throw new Error("Numéro de réception requis");
      }
      const { data: withdrawal, error } = await supabase.rpc("request_wallet_withdrawal", {
        p_amount_fcfa: value,
        p_method: method,
        p_phone: phone.trim(),
      });
      if (error) throw error;

      // Déclenche l'envoi réel vers Jèko. Le solde est déjà réservé (RPC
      // ci-dessus) : en cas d'échec ici (réseau, Jèko indisponible...), la
      // fonction Edge elle-même recrédite le portefeuille — l'utilisateur
      // n'a pas besoin de relancer, la ligne passera à "error".
      await invokeEdgeFunction("jeko-create-payout", { withdrawalId: withdrawal.id });
    },
    onSuccess: () => {
      toast.success("Demande de retrait envoyée", {
        description: "Le transfert Mobile Money est en cours.",
      });
      setShowForm(false);
      setAmount("");
      setPhone("");
      refresh();
    },
    onError: (err) => {
      toast.error("Demande impossible", {
        description: err instanceof Error ? err.message : undefined,
      });
      // Le solde peut déjà avoir été réservé (RPC réussie, envoi à Jèko en
      // échec) : on rafraîchit pour que la demande "En attente" apparaisse,
      // avec un bouton pour relancer l'envoi sans créer un second retrait.
      refresh();
    },
  });

  const retryPayoutMutation = useMutation({
    mutationFn: async (withdrawalId: string) => {
      await invokeEdgeFunction("jeko-create-payout", { withdrawalId });
    },
    onSuccess: () => {
      toast.success("Envoi relancé");
      refresh();
    },
    onError: (err) =>
      toast.error("Nouvel essai impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const transactions = transactionsQuery.data ?? [];
  const withdrawals = withdrawalsQuery.data ?? [];

  return (
    <div className="container-page py-10 sm:py-14">
      <Link to="/compte" className="text-sm font-semibold text-primary hover:underline">
        ← Mon compte
      </Link>

      <h1 className="mt-4 font-display text-2xl font-bold text-foreground sm:text-3xl">
        Mon portefeuille
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Les remboursements (annulation, absence du professeur, report tardif) sont crédités ici et
        réutilisables sur n&apos;importe quelle réservation, ou retirables vers Mobile Money.
      </p>
      <SectionTabs items={accountTabs(isTeacherAccount)} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Wallet className="size-4 text-primary" aria-hidden /> Solde disponible
            </p>
            {walletQuery.isLoading ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
              </div>
            ) : (
              <p className="mt-2 font-display text-3xl font-bold text-foreground">
                {formatFcfa(balance)}
              </p>
            )}

            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              disabled={balance <= 0}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowDownLeft className="size-4" aria-hidden />
              Demander un retrait
            </button>
            {balance <= 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Aucun solde disponible pour l&apos;instant.
              </p>
            )}

            {showForm && (
              <form
                className="mt-5 space-y-4 border-t border-border pt-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  withdrawMutation.mutate();
                }}
              >
                <div>
                  <label htmlFor="wd-amount" className="text-sm font-semibold text-foreground">
                    Montant à retirer
                  </label>
                  <input
                    id="wd-amount"
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                    placeholder={`Max. ${balance.toLocaleString("fr-FR")} FCFA`}
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Moyen de réception</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {METHODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMethod(m.value)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                          method === m.value
                            ? "border-primary bg-primary-soft text-primary-soft-foreground"
                            : "border-border text-foreground hover:bg-secondary"
                        }`}
                      >
                        <Smartphone className="size-4" aria-hidden />
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="wd-phone" className="text-sm font-semibold text-foreground">
                    Numéro de réception
                  </label>
                  <input
                    id="wd-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={withdrawMutation.isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {withdrawMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Envoyer la demande
                </button>
                <p className="text-xs text-muted-foreground">
                  Le montant est réservé dès l&apos;envoi de la demande. Une équipe BARA valide
                  puis effectue le virement Mobile Money.
                </p>
              </form>
            )}
          </section>

          {withdrawals.length > 0 && (
            <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <h2 className="font-display text-sm font-bold text-foreground">Mes demandes de retrait</h2>
              <ul className="mt-3 space-y-2">
                {withdrawals.map((w) => {
                  const s = WITHDRAWAL_STATUS[w.status] ?? {
                    label: w.status,
                    className: "bg-muted text-muted-foreground",
                  };
                  return (
                    <li key={w.id} className="rounded-2xl bg-secondary/50 px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{formatFcfa(w.amount_fcfa)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(w.requested_at).toLocaleDateString("fr-FR", { dateStyle: "medium" })}
                            {w.admin_note ? ` · ${w.admin_note}` : ""}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${s.className}`}>
                          {s.label}
                        </span>
                      </div>
                      {w.status === "error" && w.error_message && (
                        <p className="mt-2 text-xs text-destructive">{w.error_message}</p>
                      )}
                      {w.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => retryPayoutMutation.mutate(w.id)}
                          disabled={retryPayoutMutation.isPending}
                          className="mt-2 rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                        >
                          Relancer l&apos;envoi
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-sm font-bold text-foreground">Historique des mouvements</h2>
          {transactionsQuery.isLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
            </div>
          ) : transactions.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Wand2 className="size-4" aria-hidden /> Aucun mouvement pour l&apos;instant.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {transactions.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-4 py-3 text-sm"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                        t.type === "credit" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {t.type === "credit" ? (
                        <ArrowDownLeft className="size-4" aria-hidden />
                      ) : (
                        <ArrowUpRight className="size-4" aria-hidden />
                      )}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{t.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("fr-FR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 font-display font-bold ${
                      t.type === "credit" ? "text-success" : "text-foreground"
                    }`}
                  >
                    {t.type === "credit" ? "+" : "−"}
                    {formatFcfa(t.amount_fcfa)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
