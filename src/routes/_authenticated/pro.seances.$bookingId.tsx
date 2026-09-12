import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  FileText,
  Home,
  Laptop,
  Loader2,
  MessageSquare,
  UserX,
} from "lucide-react";

import { CancelBookingDialog } from "@/components/cancel-booking-dialog";
import { TeacherGate } from "@/components/teacher-gate";
import { supabase } from "@/integrations/supabase/client";
import { SESSION_STATUS_LABELS } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/pro/seances/$bookingId")({
  head: () => ({
    meta: [
      { title: "Détail de la séance — espace intervenant BARA" },
      {
        name: "description",
        content: "Mettez à jour le statut de la séance puis rédigez le compte-rendu de l’apprenant.",
      },
      { property: "og:title", content: "Détail de la séance — BARA" },
      {
        property: "og:description",
        content: "Mettez à jour le statut de la séance puis rédigez le compte-rendu de l’apprenant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherSessionDetail,
});

const CARD = "rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]";

function TeacherSessionDetail() {
  const { user } = Route.useRouteContext();
  const { bookingId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);

  const bookingQuery = useQuery({
    queryKey: ["teacher-session-detail", user.id, bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, status, format, commune, city, address, session_index, reschedule_used, requester_id, child_id, children(first_name, school_level), teacher_offers(title, subjects(name)), packs(pack_slug, pack_types(name))",
        )
        .eq("id", bookingId)
        .eq("teacher_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", data.requester_id)
        .maybeSingle();
      const { data: report } = await supabase
        .from("session_reports")
        .select("id")
        .eq("booking_id", bookingId)
        .maybeSingle();
      return {
        ...data,
        learnerName: data.children?.first_name ?? profile?.display_name ?? "Apprenant",
        hasReport: Boolean(report),
      };
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["teacher-session-detail", user.id, bookingId] });
    queryClient.invalidateQueries({ queryKey: ["teacher-sessions-status", user.id] });
    queryClient.invalidateQueries({ queryKey: ["teacher-bookings", user.id] });
    queryClient.invalidateQueries({ queryKey: ["teacher-today", user.id] });
    queryClient.invalidateQueries({ queryKey: ["teacher-earnings"] });
  };

  const complete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("complete_booking", { p_booking_id: bookingId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Séance terminée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Mise à jour impossible"),
  });

  const noShow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("report_parent_no_show", { p_booking_id: bookingId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Absence de l’apprenant signalée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Signalement impossible"),
  });

  const booking = bookingQuery.data;
  const start = booking ? new Date(booking.scheduled_at) : null;
  const end = booking && start ? new Date(start.getTime() + booking.duration_minutes * 60_000) : null;
  const timeFmt = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const started = start ? start.getTime() <= Date.now() : false;
  const status = booking ? SESSION_STATUS_LABELS[booking.status] : undefined;

  return (
    <TeacherGate userId={user.id}>
      <main className="container-page py-5 pb-24 sm:py-10">
        <Link
          to="/pro/seances"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden /> Mes séances
        </Link>

        {bookingQuery.isLoading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
          </p>
        ) : !booking ? (
          <div className={`mt-6 ${CARD}`}>
            <p className="font-display text-base font-bold text-foreground">Séance introuvable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cette séance n’existe pas ou ne fait pas partie de vos cours.
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-4 font-display text-xl font-bold text-foreground sm:text-2xl">
              {booking.teacher_offers?.subjects?.name ?? booking.teacher_offers?.title ?? "Cours"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {booking.learnerName}
              {booking.children?.school_level ? ` · ${booking.children.school_level}` : ""}
            </p>
            {status && (
              <span
                className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
              >
                {status.label}
              </span>
            )}

            <section className={`mt-4 ${CARD}`}>
              <dl className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Date</dt>
                  <dd className="text-sm font-semibold text-foreground">
                    {start!.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Heure</dt>
                  <dd className="text-sm font-semibold text-foreground">
                    {timeFmt(start!)} – {timeFmt(end!)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Séance</dt>
                  <dd className="text-sm font-semibold text-foreground">
                    {booking.session_index ? `N° ${booking.session_index}` : "—"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Formule</dt>
                  <dd className="truncate text-sm font-semibold text-foreground">
                    {booking.packs?.pack_types?.name ?? booking.packs?.pack_slug ?? "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                {booking.format === "online" ? (
                  <Laptop className="size-4 shrink-0" aria-hidden />
                ) : (
                  <Home className="size-4 shrink-0" aria-hidden />
                )}
                {booking.format === "online"
                  ? "En ligne"
                  : booking.address ||
                    [booking.commune, booking.city].filter(Boolean).join(", ") ||
                    "À domicile"}
              </p>
            </section>

            <section className="mt-4">
              <h2 className="font-display text-base font-bold text-foreground">Après la séance</h2>

              {booking.status === "accepted" && !started && (
                <div className="mt-2 flex items-start gap-3 rounded-2xl border border-border bg-secondary/50 p-4">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    Vous pourrez renseigner le statut à partir de l’heure prévue de la séance.
                  </p>
                </div>
              )}

              {booking.status === "accepted" && started && (
                <div className="mt-2 space-y-2">
                  <button
                    type="button"
                    disabled={complete.isPending}
                    onClick={() => complete.mutate()}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {complete.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-4" aria-hidden />
                    )}
                    Séance terminée
                  </button>
                  <button
                    type="button"
                    disabled={noShow.isPending}
                    onClick={() => noShow.mutate()}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
                  >
                    <UserX className="size-4" aria-hidden /> Apprenant absent
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10"
                  >
                    Annuler la séance
                  </button>
                </div>
              )}

              {booking.status === "completed" && (
                <div className="mt-2 space-y-2">
                  <p className="flex items-center gap-2 rounded-2xl bg-secondary/50 px-4 py-3 text-sm text-foreground">
                    <Check className="size-4 text-primary" aria-hidden /> Séance terminée
                  </p>
                  <Link
                    to="/pro/compte-rendu/$bookingId"
                    params={{ bookingId: booking.id }}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <FileText className="size-4" aria-hidden />
                    {booking.hasReport ? "Modifier le compte-rendu" : "Écrire le compte-rendu"}
                  </Link>
                </div>
              )}
            </section>

            <section className="mt-4">
              <Link
                to="/pro/messages"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                <MessageSquare className="size-4" aria-hidden /> Discussion avec la famille
              </Link>
            </section>

            {cancelOpen && (
              <CancelBookingDialog
                bookingId={booking.id}
                scheduledAt={booking.scheduled_at}
                rescheduleUsed={booking.reschedule_used}
                role="teacher"
                onClose={() => {
                  setCancelOpen(false);
                  invalidate();
                  navigate({ to: "/pro/seances" });
                }}
                invalidateKeys={[["teacher-session-detail", user.id, booking.id]]}
              />
            )}
          </>
        )}
      </main>
    </TeacherGate>
  );
}
