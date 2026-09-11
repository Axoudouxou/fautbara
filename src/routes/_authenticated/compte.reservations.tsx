import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Home, Laptop, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { CancelBookingDialog } from "@/components/cancel-booking-dialog";
import { OpenDisputeDialog } from "@/components/open-dispute-dialog";
import { LeaveReviewDialog } from "@/components/leave-review-dialog";
import { BookingLifecycleControls } from "@/components/booking-lifecycle-controls";
import { PackSessionScheduler } from "@/components/pack-session-scheduler";
import { SectionTabs, learnerCoursesTabs } from "@/components/section-tabs";
import {
  PACK_STATUS_LABELS,
  SESSION_STATUS_LABELS,
  formatDate,
} from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/compte/reservations")({
  validateSearch: (search: Record<string, unknown>) => ({
    pack: typeof search.pack === "string" ? search.pack : undefined,
    booking: typeof search.booking === "string" ? search.booking : undefined,
    agenda: search.agenda === true || search.agenda === "1" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Mes formules et séances — BARA" },
      {
        name: "description",
        content:
          "Suivez vos formules achetées, programmez vos séances progressivement et consultez leur historique.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingsPage,
});

export const STATUS_LABELS = SESSION_STATUS_LABELS;

export function formatSlot(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatTime(iso: string | Date) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Heure exacte de la séance : « 16:00 → 17:30 » */
export function formatTimeRange(iso: string, durationMinutes: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return `${formatTime(start)} → ${formatTime(end)}`;
}

function BookingsPage() {
  const { user } = Route.useRouteContext();
  const { pack: packParam, booking: bookingParam, agenda: agendaParam } = Route.useSearch();
  const [cancelTarget, setCancelTarget] = useState<
    { id: string; scheduledAt: string; rescheduleUsed: boolean } | null
  >(null);

  const packsQuery = useQuery({
    queryKey: ["my-packs", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packs")
        .select(
          "id, teacher_id, pack_slug, status, teacher_rate_fcfa, duration_minutes, sessions_total, free_sessions, paid_sessions, sessions_used, teacher_amount_fcfa, platform_fee_fcfa, total_fcfa, purchased_at, expires_at, children(first_name), pack_types(name), teacher_offers(title, subjects(name))",
        )
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const bookingsQuery = useQuery({
    queryKey: ["my-bookings", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, pack_id, scheduled_at, duration_minutes, price_fcfa, format, commune, status, status_reason, message, teacher_id, reschedule_used, is_free_session, session_index, children(first_name), teacher_offers(title, subjects(name))",
        )
        .eq("requester_id", user.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const packs = packsQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];
  const teacherIds = [
    ...new Set([
      ...packs.map((p) => p.teacher_id),
      ...bookings.map((b) => b.teacher_id),
    ]),
  ];
  const teachersQuery = useQuery({
    queryKey: ["my-teachers", teacherIds],
    enabled: teacherIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", teacherIds);
      if (error) throw error;
      return new Map(data.map((t) => [t.user_id, t]));
    },
  });
  const teachers = teachersQuery.data ?? new Map<string, { display_name: string; avatar_url: string | null }>();
  const loading = packsQuery.isLoading || bookingsQuery.isLoading;

  // Arrivée depuis une notification : on amène l'élément concerné à l'écran.
  useEffect(() => {
    if (loading) return;
    const anchor = packParam ? `pack-${packParam}` : bookingParam ? `seance-${bookingParam}` : null;
    if (!anchor) return;
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [loading, packParam, bookingParam]);


  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Mes cours</h1>
      <SectionTabs items={learnerCoursesTabs} />
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Vos formules payées et les séances que vous programmez au fil des semaines dans
        l&apos;agenda de l&apos;intervenant.
      </p>

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </div>
      )}

      {!loading && packs.length === 0 && (
        <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <p className="font-display text-lg font-bold text-foreground">Aucune formule pour le moment</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Choisissez un intervenant, puis une formule de séances ou une séance seule.
          </p>
          <Link
            to="/professeurs"
            search={{}}
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Trouver un intervenant
          </Link>
        </div>
      )}

      {packs.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-foreground">Mes formules</h2>
          <ul className="mt-4 space-y-4">
            {packs.map((p) => {
              const status = PACK_STATUS_LABELS[p.status] ?? {
                label: p.status,
                className: "bg-muted text-muted-foreground",
              };
              const teacher = teachers.get(p.teacher_id);
              const left = Math.max(p.sessions_total - p.sessions_used, 0);
              const expired = Boolean(p.expires_at && new Date(p.expires_at) <= new Date());
              return (
                <li
                  key={p.id}
                  className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">
                        {p.teacher_offers?.subjects?.name}
                      </p>
                      <h3 className="mt-1 font-display text-lg font-bold text-foreground">
                        Formule {p.pack_types?.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Pour {p.children?.first_name ?? "moi"} · {p.teacher_offers?.title}
                      </p>
                      {teacher && (
                        <Link
                          to="/professeurs/$id"
                          params={{ id: p.teacher_id }}
                          className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 hover:bg-secondary"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-xs font-bold text-primary-soft-foreground">
                            {teacher.avatar_url ? (
                              <img
                                src={teacher.avatar_url}
                                alt={`Photo de ${teacher.display_name}`}
                                className="size-full object-cover"
                              />
                            ) : (
                              teacher.display_name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()
                            )}
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {teacher.display_name}
                          </span>
                        </Link>
                      )}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Séances restantes</dt>
                      <dd className="font-semibold text-foreground">
                        {left} / {p.sessions_total}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Programmable jusqu&apos;au</dt>
                      <dd className="text-foreground">{formatDate(p.expires_at)}</dd>
                    </div>
                  </dl>

                  {p.free_sessions > 0 && (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-soft/60 px-3 py-1 text-xs font-semibold text-primary-soft-foreground">
                      <Sparkles className="size-3.5" aria-hidden /> {p.free_sessions} séance offerte
                      par BARA, une seule fois par famille
                    </p>
                  )}

                  {p.status === "pending_payment" && (
                    <Link
                      to="/paiement/$packId"
                      params={{ packId: p.id }}
                      className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Régler cette formule
                    </Link>
                  )}

                  {p.status === "active" && !expired && (
                    <PackSessionScheduler
                      packId={p.id}
                      teacherId={p.teacher_id}
                      teacherName={teacher?.display_name}
                      durationMinutes={p.duration_minutes}
                      sessionsLeft={left}
                      invalidateKeys={[
                        ["my-packs", user.id],
                        ["my-bookings", user.id],
                      ]}
                    />
                  )}

                  {p.status === "active" && expired && (
                    <p className="mt-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                      La validité est écoulée : les séances déjà programmées restent valables, mais
                      aucune nouvelle séance ne peut être ajoutée.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {bookings.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-foreground">Mes séances</h2>
          <ul className="mt-4 space-y-4">
            {bookings.map((b) => {
              const status = SESSION_STATUS_LABELS[b.status] ?? {
                label: b.status,
                className: "bg-muted text-muted-foreground",
              };
              const canCancel = b.status === "accepted";
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
                      <h3 className="mt-1 font-display text-lg font-bold text-foreground">
                        {b.teacher_offers?.title ?? "Cours"}
                        {b.session_index ? ` · séance ${b.session_index}` : ""}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Pour {b.children?.first_name ?? "moi"}
                        {b.is_free_session ? " · séance offerte" : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="size-4" aria-hidden />
                      {formatDay(b.scheduled_at)} ·{" "}
                      {formatTimeRange(b.scheduled_at, b.duration_minutes)} ({b.duration_minutes} min)
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
                  </div>

                  {b.status_reason && (
                    <p className="mt-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                      {b.status_reason}
                    </p>
                  )}

                  <BookingLifecycleControls
                    booking={{
                      id: b.id,
                      status: b.status,
                      scheduled_at: b.scheduled_at,
                      reschedule_used: b.reschedule_used,
                    }}
                    role="learner"
                    invalidateKeys={[
                      ["my-bookings", user.id],
                      ["my-packs", user.id],
                    ]}
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to="/professeurs/$id"
                      params={{ id: b.teacher_id }}
                      className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                    >
                      Voir l&apos;intervenant
                    </Link>
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() =>
                          setCancelTarget({
                            id: b.id,
                            scheduledAt: b.scheduled_at,
                            rescheduleUsed: b.reschedule_used,
                          })
                        }
                        className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
                      >
                        Annuler la séance
                      </button>
                    )}
                    {b.status === "completed" && (
                      <LeaveReviewDialog
                        bookingId={b.id}
                        teacherId={b.teacher_id}
                        authorId={user.id}
                        invalidateKeys={[["my-bookings", user.id]]}
                      />
                    )}
                    {(b.status === "completed" ||
                      b.status === "cancelled" ||
                      b.status === "lost" ||
                      b.status === "no_show_teacher" ||
                      b.status === "no_show_parent") && (
                      <OpenDisputeDialog
                        bookingId={b.id}
                        againstId={b.teacher_id}
                        openedBy={user.id}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {cancelTarget && (
        <CancelBookingDialog
          bookingId={cancelTarget.id}
          scheduledAt={cancelTarget.scheduledAt}
          rescheduleUsed={cancelTarget.rescheduleUsed}
          role="learner"
          onClose={() => setCancelTarget(null)}
          invalidateKeys={[
            ["my-bookings", user.id],
            ["my-packs", user.id],
          ]}
        />
      )}
    </div>
  );
}
