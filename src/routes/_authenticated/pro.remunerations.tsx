import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { EmptyState, SectionHeading, StatTile } from "@/components/product-ui";
import { TeacherGate } from "@/components/teacher-gate";
import { formatFcfa } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/pro/remunerations")({
  head: () => ({
    meta: [
      { title: "Mes rémunérations — espace intervenant BARA" },
      {
        name: "description",
        content:
          "Suivez vos rémunérations BARA : montants validés, en attente, réservés et déjà versés.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherEarningsPage,
});

const EARNING_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-warning-soft text-warning" },
  validated: { label: "Validée", className: "bg-success-soft text-success" },
  reserved: { label: "Réservée pour un retrait", className: "bg-primary-soft text-primary-soft-foreground" },
  paid: { label: "Versée", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Annulée", className: "bg-muted text-muted-foreground" },
};

function TeacherEarningsPage() {
  const { user } = Route.useRouteContext();

  const summaryQuery = useQuery({
    queryKey: ["teacher-earnings", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("teacher_earnings_summary");
      if (error) throw error;
      return data as unknown as {
        pending_fcfa: number;
        validated_fcfa: number;
        reserved_fcfa: number;
        paid_fcfa: number;
      };
    },
  });

  const earningsQuery = useQuery({
    queryKey: ["teacher-earnings-list", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_earnings")
        .select("id, amount_fcfa, status, created_at, validated_at, paid_at, bookings(scheduled_at, teacher_offers(subjects(name)))")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const summary = summaryQuery.data;
  const earnings = earningsQuery.data ?? [];

  return (
    <TeacherGate userId={user.id}>
      <div className="container-page py-6 sm:py-10">
        <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">Mes rémunérations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Une séance est rémunérée une fois réalisée et son compte-rendu rempli.
        </p>

        <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted-foreground">Disponible pour un retrait</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {summaryQuery.isLoading ? "…" : formatFcfa(summary?.validated_fcfa)}
          </p>
          <Link
            to="/compte/portefeuille"
            className="mt-3 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Demander un retrait
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatTile icon={Clock} value={formatFcfa(summary?.pending_fcfa)} label="En attente" />
          <StatTile icon={Wallet} value={formatFcfa(summary?.reserved_fcfa)} label="Réservé" />
          <StatTile icon={Wallet} value={formatFcfa(summary?.paid_fcfa)} label="Déjà versé" />
        </div>

        <section className="mt-5">
          <SectionHeading title="Historique" />
          {earningsQuery.isLoading && (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
            </p>
          )}
          {!earningsQuery.isLoading && earnings.length === 0 && (
            <div className="mt-3">
              <EmptyState
                icon={Wallet}
                title="Aucune rémunération pour le moment"
                description="Vos montants apparaissent ici après chaque séance réalisée et son compte-rendu."
                action={
                  <Link
                    to="/pro/demandes"
                    className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Voir mes séances
                  </Link>
                }
              />
            </div>
          )}
          {earnings.length > 0 && (
            <ul className="mt-3 space-y-2">
              {earnings.map((e) => {
                const status = EARNING_STATUS[e.status] ?? {
                  label: e.status,
                  className: "bg-muted text-muted-foreground",
                };
                const when = e.bookings?.scheduled_at ?? e.created_at;
                return (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-card)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-bold text-foreground">
                        {formatFcfa(e.amount_fcfa)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.bookings?.teacher_offers?.subjects?.name ?? "Formule"} ·{" "}
                        {new Date(when).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.className}`}>
                      {status.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </TeacherGate>
  );
}
