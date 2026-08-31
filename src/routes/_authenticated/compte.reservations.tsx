import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Home, Laptop, Loader2, Repeat } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/compte/reservations")({
  head: () => ({
    meta: [
      { title: "Mes demandes de cours — FAUT BARA" },
      {
        name: "description",
        content: "Suivez vos demandes de cours particuliers, leurs créneaux et leur statut.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingsPage,
});

export const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-warning-soft text-warning" },
  accepted: { label: "Acceptée", className: "bg-success-soft text-success" },
  declined: { label: "Refusée", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Annulée", className: "bg-muted text-muted-foreground" },
  completed: { label: "Terminée", className: "bg-primary-soft text-primary-soft-foreground" },
};

export function formatSlot(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BookingsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const bookingsQuery = useQuery({
    queryKey: ["my-bookings", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, price_fcfa, format, commune, status, status_reason, is_recurring, recurrence_end_date, message, teacher_id, children(first_name), teacher_offers(title, subjects(name))",
        )
        .eq("requester_id", user.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled", status_reason: "Annulée par le demandeur" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande annulée");
      queryClient.invalidateQueries({ queryKey: ["my-bookings", user.id] });
    },
    onError: (err) =>
      toast.error("Annulation impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const bookings = bookingsQuery.data ?? [];

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
        Mes demandes de cours
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Suivez l&apos;état de vos demandes. Le professeur accepte, refuse ou propose un autre
        créneau.
      </p>

      {bookingsQuery.isLoading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </div>
      )}

      {!bookingsQuery.isLoading && bookings.length === 0 && (
        <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <p className="font-display text-lg font-bold text-foreground">
            Aucune demande pour le moment
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Trouvez un professeur et envoyez votre première demande de cours.
          </p>
          <Link
            to="/professeurs"
            search={{}}
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Chercher un professeur
          </Link>
        </div>
      )}

      <ul className="mt-8 space-y-4">
        {bookings.map((b) => {
          const status = STATUS_LABELS[b.status] ?? {
            label: b.status,
            className: "bg-muted text-muted-foreground",
          };
          const canCancel = b.status === "pending" || b.status === "accepted";
          return (
            <li
              key={b.id}
              className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">
                    {b.teacher_offers?.subjects?.name}
                  </p>
                  <h2 className="mt-1 font-display text-lg font-bold text-foreground">
                    {b.teacher_offers?.title ?? "Cours"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pour {b.children?.first_name ?? "moi"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                >
                  {status.label}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-4" aria-hidden />
                  {formatSlot(b.scheduled_at)} · {b.duration_minutes} min
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {b.format === "online" ? (
                    <>
                      <Laptop className="size-4" aria-hidden /> En ligne
                    </>
                  ) : (
                    <>
                      <Home className="size-4" aria-hidden /> À domicile
                      {b.commune ? ` · ${b.commune}` : ""}
                    </>
                  )}
                </span>
                {b.is_recurring && (
                  <span className="inline-flex items-center gap-1.5">
                    <Repeat className="size-4" aria-hidden /> Hebdomadaire
                    {b.recurrence_end_date
                      ? ` jusqu'au ${new Date(`${b.recurrence_end_date}T00:00:00`).toLocaleDateString("fr-FR")}`
                      : ""}
                  </span>
                )}
                <span className="font-semibold text-foreground">
                  {b.price_fcfa.toLocaleString("fr-FR")} FCFA / séance
                </span>
              </div>

              {b.status_reason && (
                <p className="mt-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                  {b.status_reason}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/professeurs/$id"
                  params={{ id: b.teacher_id }}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  Voir le professeur
                </Link>
                {canCancel && (
                  <button
                    type="button"
                    onClick={() => cancelMutation.mutate(b.id)}
                    disabled={cancelMutation.isPending}
                    className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                  >
                    Annuler la demande
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
