import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell, useIsAdmin } from "@/components/admin-shell";

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

export const Route = createFileRoute("/_authenticated/admin/retraits")({
  head: () => ({
    meta: [
      { title: "Retraits — Administration BARA" },
      {
        name: "description",
        content: "Validez et traitez les demandes de retrait de portefeuille vers Mobile Money.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminWithdrawals,
});

const FILTERS = [
  { value: "pending", label: "En attente" },
  { value: "processing", label: "Envoi en cours" },
  { value: "error", label: "Échecs" },
  { value: "paid", label: "Envoyés" },
  { value: "all", label: "Tous" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  processing: "Envoi en cours (Jèko)",
  approved: "Approuvé",
  paid: "Envoyé",
  rejected: "Refusé",
  error: "Échec",
};

const METHOD_LABEL: Record<string, string> = {
  orange: "Orange Money",
  mtn: "MTN MoMo",
  moov: "Moov Money",
  wave: "Wave",
  djamo: "Djamo",
};

function formatFcfa(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

function AdminWithdrawals() {
  const { user } = Route.useRouteContext();
  const adminQuery = useIsAdmin(user.id);
  const isAdmin = adminQuery.data ?? false;
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const withdrawalsQuery = useQuery({
    queryKey: ["admin-withdrawals", filter],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_list_wallet_withdrawals",
        filter === "all" ? {} : { p_status: filter },
      );
      if (error) throw error;
      return data ?? [];
    },
  });

  const process = useMutation({
    mutationFn: async (input: { id: string; status: string; note?: string | undefined }) => {
      const note = input.note?.trim();
      const { error } = await supabase.rpc("admin_process_wallet_withdrawal", {
        p_request_id: input.id,
        p_status: input.status,
        ...(note ? { p_admin_note: note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande mise à jour");
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retryPayout = useMutation({
    mutationFn: async (withdrawal: { id: string; status: string }) => {
      // jeko-create-payout ne traite que les demandes "pending" (elle
      // ignore silencieusement le reste, pour ne jamais relancer un
      // transfert déjà en cours) : un retrait en "error" doit d'abord être
      // remis en file d'attente (montant re-réservé) avant de rappeler la
      // fonction, sinon rien ne se passe alors que l'appel réussit.
      if (withdrawal.status === "error") {
        const { error } = await supabase.rpc("retry_withdrawal_payout", {
          p_withdrawal_id: withdrawal.id,
        });
        if (error) throw error;
      }
      await invokeEdgeFunction("jeko-create-payout", { withdrawalId: withdrawal.id });
    },
    onSuccess: () => {
      toast.success("Envoi relancé auprès de Jèko");
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdrawals = withdrawalsQuery.data ?? [];

  return (
    <AdminShell
      userId={user.id}
      title="Retraits"
      description="Les retraits sont envoyés automatiquement vers Jèko dès la demande. Cette page sert à surveiller les échecs et relancer un envoi bloqué — le montant est recrédité automatiquement en cas d'échec confirmé."
    >
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "border border-border text-foreground hover:bg-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {withdrawalsQuery.isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </p>
      ) : withdrawals.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Aucune demande pour ce filtre.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {withdrawals.map((w) => (
            <li key={w.id} className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-2 font-display font-bold text-foreground">
                    <Wallet className="size-4 text-primary" aria-hidden /> {formatFcfa(w.amount_fcfa)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {w.display_name ?? "Utilisateur"} · {METHOD_LABEL[w.method] ?? w.method} ·{" "}
                    {w.phone}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Demandé le{" "}
                    {new Date(w.requested_at).toLocaleDateString("fr-FR", { dateStyle: "medium" })}
                  </p>
                  {w.admin_note && (
                    <p className="mt-2 max-w-xl rounded-2xl bg-muted p-3 text-sm text-foreground">
                      {w.admin_note}
                    </p>
                  )}
                  {w.status === "error" && w.error_message && (
                    <p className="mt-2 max-w-xl rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
                      {w.error_message}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                  {STATUS_LABEL[w.status] ?? w.status}
                </span>
              </div>

              {w.status === "processing" && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Transfert envoyé à Jèko, en attente de confirmation (webhook).
                </p>
              )}

              {(w.status === "pending" || w.status === "error") && (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={notes[w.id] ?? ""}
                    onChange={(e) => setNotes((s) => ({ ...s, [w.id]: e.target.value }))}
                    rows={2}
                    placeholder="Note (optionnelle) — motif de refus…"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={retryPayout.isPending}
                      onClick={() => retryPayout.mutate({ id: w.id, status: w.status })}
                      className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Réessayer l&apos;envoi Jèko
                    </button>
                    {w.status === "pending" && (
                      <button
                        type="button"
                        disabled={process.isPending}
                        onClick={() => process.mutate({ id: w.id, status: "rejected", note: notes[w.id] })}
                        className="rounded-xl border border-destructive/30 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        Refuser (recrédite le portefeuille)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
