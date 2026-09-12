import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Baby,
  CalendarDays,
  Clock3,
  FileText,
  Home,
  Laptop,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
} from "lucide-react";
import { toast } from "sonner";

import { BookingLifecycleControls } from "@/components/booking-lifecycle-controls";
import { CancelBookingDialog } from "@/components/cancel-booking-dialog";
import { LeaveReviewDialog } from "@/components/leave-review-dialog";
import { OpenDisputeDialog } from "@/components/open-dispute-dialog";
import { EmptyState, UserAvatar } from "@/components/product-ui";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ensureConversation } from "@/lib/messaging";
import { PACK_STATUS_LABELS, SESSION_STATUS_LABELS } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/seance/$bookingId")({
  head: () => ({
    meta: [
      { title: "Détail de la séance — BARA" },
      { name: "description", content: "Consultez les informations et les actions disponibles pour votre séance BARA." },
      { property: "og:title", content: "Détail de la séance — BARA" },
      { property: "og:description", content: "Consultez les informations et les actions disponibles pour votre séance BARA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingDetailPage,
});

const CARD = "rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]";

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTimeRange(iso: string, durationMinutes: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const time = (date: Date) => date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${time(start)} → ${time(end)}`;
}

function BookingDetailPage() {
  const { user } = Route.useRouteContext();
  const { bookingId } = Route.useParams();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["booking-detail", user.id, bookingId],
    queryFn: async () => {
      const { data: booking, error } = await supabase
        .from("bookings")
        .select(
          "id, requester_id, child_id, teacher_id, offer_id, pack_id, scheduled_at, duration_minutes, price_fcfa, format, city, commune, address, message, status, status_reason, reschedule_used, is_free_session, session_index, children(first_name, school_level), teacher_offers(title, subjects(name))",
        )
        .eq("id", bookingId)
        .eq("requester_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!booking) return null;

      const [teacher, pack, report, review, dispute] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url").eq("user_id", booking.teacher_id).maybeSingle(),
        booking.pack_id
          ? supabase
              .from("packs")
              .select("id, pack_slug, status, sessions_total, sessions_used, expires_at, pack_types(name)")
              .eq("id", booking.pack_id)
              .eq("buyer_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as const),
        supabase.from("session_reports").select("id").eq("booking_id", booking.id).maybeSingle(),
        supabase.from("reviews").select("id").eq("booking_id", booking.id).eq("author_id", user.id).maybeSingle(),
        supabase.from("disputes").select("id, status").eq("booking_id", booking.id).eq("opened_by", user.id).maybeSingle(),
      ]);
      for (const result of [teacher, pack, report, review, dispute]) if (result.error) throw result.error;

      let teacherAvatar = teacher.data?.avatar_url ?? null;
      if (teacherAvatar) {
        const { data: signed } = await supabase.storage.from("teacher-photos").createSignedUrl(teacherAvatar, 3600);
        teacherAvatar = signed?.signedUrl ?? null;
      }

      return {
        booking,
        teacherName: teacher.data?.display_name ?? "Intervenant",
        teacherAvatar,
        pack: pack.data,
        reportId: report.data?.id ?? null,
        hasReview: Boolean(review.data),
        dispute: dispute.data,
      };
    },
  });

  const contactTeacher = useMutation({
    mutationFn: async () => {
      const booking = detailQuery.data?.booking;
      if (!booking) throw new Error("Séance indisponible");
      return ensureConversation({ teacherId: booking.teacher_id, childId: booking.child_id });
    },
    onSuccess: (conversation) => navigate({ to: "/messages", search: { conversation: conversation.id } }),
    onError: () => toast.error("Impossible d’ouvrir la conversation"),
  });

  if (detailQuery.isLoading) {
    return (
      <main className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </main>
    );
  }

  const data = detailQuery.data;
  if (!data) {
    return (
      <main className="container-page py-14">
        <EmptyState
          icon={CalendarDays}
          title="Séance indisponible"
          description="Cette séance n’existe pas ou vous n’êtes pas autorisé à la consulter."
          action={
            <Button asChild>
              <Link to="/accueil">Retour à l’accueil</Link>
            </Button>
          }
        />
      </main>
    );
  }

  const { booking, pack } = data;
  const status = SESSION_STATUS_LABELS[booking.status] ?? {
    label: booking.status,
    className: "bg-muted text-muted-foreground",
  };
  const packStatus = pack ? PACK_STATUS_LABELS[pack.status] : null;
  const subject = booking.teacher_offers?.subjects?.name ?? booking.teacher_offers?.title ?? "Cours particulier";
  const child = booking.children;
  const canCancel = booking.status === "accepted";
  const canOpenAfterSession = ["completed", "cancelled", "lost", "no_show_teacher", "no_show_parent"].includes(booking.status);

  return (
    <main className="container-page py-5 pb-24 sm:py-10">
      <Link to="/accueil" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Accueil
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary">Détail de la séance</p>
          <h1 className="mt-1 truncate font-display text-xl font-bold text-foreground sm:text-2xl">{subject}</h1>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${status.className}`}>{status.label}</span>
      </div>

      <section className={`mt-4 ${CARD}`} aria-label="Date et horaire">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <CalendarDays className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Date</p>
            <p className="mt-0.5 text-sm font-bold capitalize text-foreground">{formatDay(booking.scheduled_at)}</p>
          </div>
          <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <Clock3 className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Horaire</p>
            <p className="mt-0.5 text-sm font-bold text-foreground">
              {formatTimeRange(booking.scheduled_at, booking.duration_minutes)} · {booking.duration_minutes} min
            </p>
          </div>
        </div>
      </section>

      <section className={`mt-3 ${CARD}`} aria-label="Enfant et intervenant">
        {child && (
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <Baby className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Enfant concerné</p>
              <p className="truncate text-sm font-bold text-foreground">{child.first_name}</p>
              {child.school_level && <p className="truncate text-xs text-muted-foreground">{child.school_level}</p>}
            </div>
          </div>
        )}
        <div className={`${child ? "mt-4 border-t border-border pt-4" : ""} flex items-center gap-3`}>
          <UserAvatar name={data.teacherName} src={data.teacherAvatar} className="size-11" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Intervenant</p>
            <p className="truncate text-sm font-bold text-foreground">{data.teacherName}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => contactTeacher.mutate()} disabled={contactTeacher.isPending}>
            {contactTeacher.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <MessageSquare aria-hidden />}
            Message
          </Button>
        </div>
      </section>

      <section className={`mt-3 ${CARD}`} aria-label="Modalité">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            {booking.format === "online" ? <Laptop className="size-5" aria-hidden /> : <Home className="size-5" aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Format</p>
            <p className="text-sm font-bold text-foreground">{booking.format === "online" ? "En ligne" : "À domicile"}</p>
            {booking.format === "online" ? (
              <p className="mt-1 text-xs text-muted-foreground">Le lien de connexion sera transmis par l’intervenant lorsqu’il est disponible.</p>
            ) : (
              <p className="mt-1 inline-flex items-start gap-1 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {[booking.address, booking.commune, booking.city].filter(Boolean).join(" · ") || "Lieu non renseigné"}
              </p>
            )}
          </div>
        </div>
        {booking.message && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground">Informations transmises lors de la réservation</p>
            <p className="mt-1 whitespace-pre-line text-sm text-foreground">{booking.message}</p>
          </div>
        )}
      </section>

      {pack && (
        <section className={`mt-3 ${CARD}`} aria-label="Formule">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <Package className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Formule</p>
                  <p className="text-sm font-bold text-foreground">{pack.pack_types?.name ?? pack.pack_slug}</p>
                </div>
                {packStatus && <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${packStatus.className}`}>{packStatus.label}</span>}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {booking.session_index ? `Séance ${booking.session_index}` : "Séance programmée"} · {pack.sessions_used} sur {pack.sessions_total} utilisée{pack.sessions_used > 1 ? "s" : ""}
                {booking.is_free_session ? " · Séance offerte" : ""}
              </p>
            </div>
          </div>
        </section>
      )}

      {(data.reportId || booking.status === "completed") && (
        <section className={`mt-3 ${CARD}`} aria-label="Compte-rendu">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <FileText className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">Compte-rendu</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.reportId ? "Le compte-rendu de cette séance est disponible." : "L’intervenant n’a pas encore rempli le compte-rendu."}
              </p>
              {data.reportId && (
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/compte-rendu/$bookingId" params={{ bookingId }}>Consulter</Link>
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="mt-5" aria-labelledby="session-actions-title">
        <h2 id="session-actions-title" className="font-display text-base font-bold text-foreground">Actions disponibles</h2>
        <div className={`mt-3 ${CARD}`}>
          <BookingLifecycleControls
            booking={{
              id: booking.id,
              status: booking.status,
              scheduled_at: booking.scheduled_at,
              reschedule_used: booking.reschedule_used,
            }}
            role="learner"
            invalidateKeys={[
              ["booking-detail", user.id, bookingId],
              ["my-bookings", user.id],
              ["my-packs", user.id],
              ["home-learner", user.id, true],
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {canCancel && (
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setCancelOpen(true)}>
                Annuler la séance
              </Button>
            )}
            {booking.status === "completed" && !data.hasReview && (
              <LeaveReviewDialog bookingId={booking.id} teacherId={booking.teacher_id} authorId={user.id} invalidateKeys={[["booking-detail", user.id, bookingId]]} />
            )}
            {canOpenAfterSession && !data.dispute && (
              <OpenDisputeDialog bookingId={booking.id} againstId={booking.teacher_id} openedBy={user.id} />
            )}
          </div>
          {!canCancel && booking.status !== "accepted" && !canOpenAfterSession && (
            <p className="text-sm text-muted-foreground">Aucune autre action n’est disponible pour cette séance.</p>
          )}
          {data.dispute && (
            <p className="mt-2 text-xs text-muted-foreground">Un litige est déjà associé à cette séance.</p>
          )}
        </div>
      </section>

      {cancelOpen && (
        <CancelBookingDialog
          bookingId={booking.id}
          scheduledAt={booking.scheduled_at}
          rescheduleUsed={booking.reschedule_used}
          role="learner"
          onClose={() => setCancelOpen(false)}
          invalidateKeys={[
            ["booking-detail", user.id, bookingId],
            ["my-bookings", user.id],
            ["my-packs", user.id],
            ["home-learner", user.id, true],
          ]}
        />
      )}
    </main>
  );
}