import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell, useIsAdmin } from "@/components/admin-shell";

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
  { value: "approved", label: "Approuvés" },
  { value: "all", label: "Tous" },
];

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
      const { data, error } = await supabase.rpc("admin_list_wallet_withdrawals", {
        p_status: filter === "all" ? undefined : filter,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const process = useMutation({
    mutationFn: async (input: { id: string; status: string; note?: string }) => {
      const { error } = await supabase.rpc("admin_process_wallet_withdrawal", {
        p_request_id: input.id,
        p_status: input.status,
        p_admin_note: input.note?.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande mise à jour");
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdrawals = withdrawalsQuery.data ?? [];

  return (
    <AdminShell
      userId={user.id}
      title="Retraits"
      description="Validez les demandes de retrait vers Mobile Money. Le montant est déjà réservé sur le portefeuille du demandeur dès l'envoi de sa demande ; un refus le lui recrédite automatiquement."
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
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                  {w.status}
                </span>
              </div>

              {(w.status === "pending" || w.status === "approved") && (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={notes[w.id] ?? ""}
                    onChange={(e) => setNotes((s) => ({ ...s, [w.id]: e.target.value }))}
                    rows={2}
                    placeholder="Note (optionnelle) — motif de refus, référence de virement…"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {w.status === "pending" && (
                      <button
                        type="button"
                        disabled={process.isPending}
                        onClick={() => process.mutate({ id: w.id, status: "approved", note: notes[w.id] })}
                        className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                      >
                        Approuver
                      </button>
                    )}
                    {w.status === "approved" && (
                      <button
                        type="button"
                        disabled={process.isPending}
                        onClick={() => process.mutate({ id: w.id, status: "paid", note: notes[w.id] })}
                        className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        Marquer comme envoyé
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={process.isPending}
                      onClick={() => process.mutate({ id: w.id, status: "rejected", note: notes[w.id] })}
                      className="rounded-xl border border-destructive/30 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Refuser (recrédite le portefeuille)
                    </button>
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
