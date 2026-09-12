import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Baby, CalendarClock, ChevronRight, Home, Laptop, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { CancelBookingDialog } from "@/components/cancel-booking-dialog";
import { OpenDisputeDialog } from "@/components/open-dispute-dialog";
import { LeaveReviewDialog } from "@/components/leave-review-dialog";
import { BookingLifecycleControls } from "@/components/booking-lifecycle-controls";
import { SectionTabs, learnerCoursesTabs } from "@/components/section-tabs";
import { UserAvatar } from "@/components/product-ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSessionRoles } from "@/hooks/use-session-roles";
import {
  PACK_STATUS_LABELS,
  SESSION_STATUS_LABELS,
  formatDate,
} from "@/lib/packs";

type ReservationsSearch = { pack?: string; booking?: string; agenda?: boolean; enfant?: string };

export const Route = createFileRoute("/_authenticated/compte/reservations")({
  validateSearch: (search: Record<string, unknown>): ReservationsSearch => {
    const out: ReservationsSearch = {};
    if (typeof search["pack"] === "string") out.pack = search["pack"];
    if (typeof search["booking"] === "string") out.booking = search["booking"];
    if (search["agenda"] === true || search["agenda"] === "1") out.agenda = true;
    if (typeof search["enfant"] === "string") out.enfant = search["enfant"];
    return out;
  },
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
  const { primaryRole } = useSessionRoles();
  const isParent = primaryRole === "parent";
  const { pack: packParam, booking: bookingParam, enfant: childParam } = Route.useSearch();
  const [cancelTarget, setCancelTarget] = useState<
    { id: string; scheduledAt: string; rescheduleUsed: boolean } | null
  >(null);

  const packsQuery = useQuery({
    queryKey: ["my-packs", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packs")
        .select(
          "id, child_id, teacher_id, pack_slug, status, teacher_rate_fcfa, duration_minutes, sessions_total, free_sessions, paid_sessions, sessions_used, teacher_amount_fcfa, platform_fee_fcfa, total_fcfa, purchased_at, expires_at, children(first_name), pack_types(name), teacher_offers(title, subjects(name))",
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
          "id, child_id, pack_id, scheduled_at, duration_minutes, price_fcfa, format, commune, status, status_reason, message, teacher_id, reschedule_used, is_free_session, session_index, children(first_name), teacher_offers(title, subjects(name))",
        )
        .eq("requester_id", user.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const childrenQuery = useQuery({
    queryKey: ["my-course-children", user.id],
    enabled: isParent,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id, first_name, school_level")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const packs = packsQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];
  const children = childrenQuery.data ?? [];
  const visiblePacks = childParam ? packs.filter((pack) => pack.child_id === childParam) : packs;
  const visibleBookings = childParam ? bookings.filter((booking) => booking.child_id === childParam) : bookings;
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
      const paths = data.map((teacher) => teacher.avatar_url).filter((path): path is string => Boolean(path));
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage.from("teacher-photos").createSignedUrls(paths, 3600);
        const signedByPath = new Map(
          (signed ?? []).map((entry, index) => [paths[index], entry.signedUrl]),
        );
        for (const teacher of data) {
          if (teacher.avatar_url) teacher.avatar_url = signedByPath.get(teacher.avatar_url) ?? null;
        }
      }
      return new Map(data.map((t) => [t.user_id, t]));
    },
  });
  const teachers = teachersQuery.data ?? new Map<string, { display_name: string; avatar_url: string | null }>();
  const loading = packsQuery.isLoading || bookingsQuery.isLoading || (isParent && childrenQuery.isLoading);
  const selectedChild = childParam ? children.find((child) => child.id === childParam) : null;
  const visibleTeacherIds = [
    ...new Set([
      ...visiblePacks.map((pack) => pack.teacher_id),
      ...visibleBookings.map((booking) => booking.teacher_id),
    ]),
  ];

  // Arrivée depuis une notification : on amène l'élément concerné à l'écran.
  useEffect(() => {
    if (loading) return;
    const anchor = packParam ? `pack-${packParam}` : bookingParam ? `seance-${bookingParam}` : null;
    if (!anchor) return;
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [loading, packParam, bookingParam]);

  const renderSession = (booking: (typeof bookings)[number]) => {
    const status = SESSION_STATUS_LABELS[booking.status] ?? {
      label: booking.status,
      className: "bg-muted text-muted-foreground",
    };
    const canCancel = booking.status === "accepted";
    return (
      <li
        key={booking.id}
        id={`seance-${booking.id}`}
        className={`relative pb-5 pl-7 last:pb-0 before:absolute before:left-[5px] before:top-3 before:h-full before:w-px before:bg-border last:before:hidden ${
          bookingParam === booking.id ? "rounded-xl bg-primary-soft/40 pr-2 pt-2" : ""
        }`}
      >
        <span className="absolute left-0 top-2.5 size-3 rounded-full border-2 border-primary bg-card" />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold capitalize text-foreground">
              {formatDay(booking.scheduled_at)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatTimeRange(booking.scheduled_at, booking.duration_minutes)} · {booking.duration_minutes} min
            </p>
          </div>
          <span className={`h-fit shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}>
            {status.label}
          </span>
        </div>
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
          {booking.format === "online" ? <Laptop className="size-3.5" aria-hidden /> : <Home className="size-3.5" aria-hidden />}
          {booking.format === "online" ? "En ligne" : `À domicile${booking.commune ? ` · ${booking.commune}` : ""}`}
          {booking.is_free_session ? " · offerte" : ""}
        </p>
        {booking.status_reason && (
          <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{booking.status_reason}</p>
        )}
        <BookingLifecycleControls
          booking={{
            id: booking.id,
            status: booking.status,
            scheduled_at: booking.scheduled_at,
            reschedule_used: booking.reschedule_used,
          }}
          role="learner"
          invalidateKeys={[["my-bookings", user.id], ["my-packs", user.id]]}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {canCancel && (
            <button
              type="button"
              onClick={() => setCancelTarget({ id: booking.id, scheduledAt: booking.scheduled_at, rescheduleUsed: booking.reschedule_used })}
              className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/10"
            >
              Annuler
            </button>
          )}
          {booking.status === "completed" && (
            <Link to="/compte-rendu/$bookingId" params={{ bookingId: booking.id }} className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-secondary">
              Compte-rendu
            </Link>
          )}
          {booking.status === "completed" && (
            <LeaveReviewDialog bookingId={booking.id} teacherId={booking.teacher_id} authorId={user.id} invalidateKeys={[["my-bookings", user.id]]} />
          )}
          {(booking.status === "completed" || booking.status === "cancelled" || booking.status === "lost" || booking.status === "no_show_teacher" || booking.status === "no_show_parent") && (
            <OpenDisputeDialog bookingId={booking.id} againstId={booking.teacher_id} openedBy={user.id} />
          )}
        </div>
      </li>
    );
  };


  return (
    <div className="container-page py-5 pb-24 sm:py-14">
      <h1 className="font-display text-xl font-bold text-foreground sm:text-3xl">Mes cours</h1>
      <SectionTabs items={learnerCoursesTabs} />
      <p className="mt-3 hidden max-w-2xl text-sm text-muted-foreground sm:block">
        Vos formules payées et les séances que vous programmez au fil des semaines dans
        l&apos;agenda de l&apos;intervenant.
      </p>
      {isParent && !loading && !childParam && children.length > 0 && (
        <section className="mt-5" aria-labelledby="children-courses-title">
          <h2 id="children-courses-title" className="font-display text-base font-bold text-foreground">
            Pour quel enfant ?
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {children.map((child) => {
              const childPacks = packs.filter((pack) => pack.child_id === child.id);
              const childBookings = bookings.filter((booking) => booking.child_id === child.id);
              const hasCourses = childPacks.length > 0 || childBookings.length > 0;
              return (
                <Link
                  key={child.id}
                  to={hasCourses ? "/compte/reservations" : "/professeurs"}
                  search={{ enfant: child.id }}
                  aria-label={hasCourses ? `Voir les cours de ${child.first_name}` : `Trouver un intervenant pour ${child.first_name}`}
                  className="group grid min-h-36 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition hover:border-primary/40 hover:-translate-y-0.5"
                >
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
                    <Baby className="size-7" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-lg font-bold text-foreground">{child.first_name}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">{child.school_level ?? "Niveau non renseigné"}</span>
                    <span className="mt-3 block text-xs font-semibold text-primary">
                      {hasCourses ? `${childPacks.length} formule${childPacks.length > 1 ? "s" : ""} · ${childBookings.length} séance${childBookings.length > 1 ? "s" : ""}` : "Trouver un professeur"}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {isParent && selectedChild && (
        <div className="mt-5">
          <Link to="/compte/reservations" search={{}} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <ArrowLeft className="size-3.5" aria-hidden /> Changer d&apos;enfant
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground"><Baby className="size-5" aria-hidden /></span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-foreground">Les cours de {selectedChild.first_name}</h2>
              <p className="truncate text-xs text-muted-foreground">{selectedChild.school_level ?? "Niveau non renseigné"}</p>
            </div>
          </div>
        </div>
      )}


      {loading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </div>
      )}

      {!loading && packs.length === 0 && !isParent && (
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

      {!loading && isParent && children.length === 0 && (
        <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <p className="font-display text-lg font-bold text-foreground">Aucun enfant enregistré</p>
          <p className="mt-2 text-sm text-muted-foreground">Ajoutez d’abord un enfant pour rechercher et organiser ses cours.</p>
          <Link to="/compte/enfants" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Ajouter un enfant
          </Link>
        </div>
      )}

      {!loading && (!isParent || childParam) && visibleTeacherIds.length > 0 && (
        <section className="mt-6" aria-labelledby="teachers-courses-title">
          <h2 id="teachers-courses-title" className="font-display text-base font-bold text-foreground">Mes professeurs</h2>
          <Accordion type="multiple" defaultValue={visibleTeacherIds.slice(0, 1)} className="mt-3 space-y-3">
            {visibleTeacherIds.map((teacherId) => {
              const teacher = teachers.get(teacherId);
              const teacherPacks = visiblePacks.filter((pack) => pack.teacher_id === teacherId);
              const teacherBookings = visibleBookings.filter((booking) => booking.teacher_id === teacherId);
              const subject = teacherPacks[0]?.teacher_offers?.subjects?.name ?? teacherBookings[0]?.teacher_offers?.subjects?.name ?? "Cours";
              return (
                <AccordionItem key={teacherId} value={teacherId} className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]">
                  <AccordionTrigger className="px-4 py-4 hover:no-underline sm:px-5">
                    <span className="flex min-w-0 items-center gap-3 text-left">
                      <UserAvatar name={teacher?.display_name ?? "Professeur"} src={teacher?.avatar_url} className="size-12 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate font-display text-sm font-bold text-foreground">{teacher?.display_name ?? "Professeur"}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subject}</span>
                        <span className="mt-1 block text-[11px] font-semibold text-primary">{teacherPacks.length} formule{teacherPacks.length > 1 ? "s" : ""} · {teacherBookings.length} séance{teacherBookings.length > 1 ? "s" : ""}</span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 sm:px-5 sm:pb-5">
                    <Link to="/professeurs/$id" params={{ id: teacherId }} className="mb-4 inline-flex text-xs font-semibold text-primary">Voir le profil du professeur</Link>
                    <div className="space-y-4">
                      {teacherPacks.map((pack) => {
                        const status = PACK_STATUS_LABELS[pack.status] ?? { label: pack.status, className: "bg-muted text-muted-foreground" };
                        const left = Math.max(pack.sessions_total - pack.sessions_used, 0);
                        const expired = Boolean(pack.expires_at && new Date(pack.expires_at) <= new Date());
                        const packBookings = teacherBookings.filter((booking) => booking.pack_id === pack.id).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
                        return (
                          <article key={pack.id} id={`pack-${pack.id}`} className={`rounded-2xl border p-4 ${packParam === pack.id ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                              <div className="min-w-0"><h3 className="truncate font-display text-sm font-bold text-foreground">Formule {pack.pack_types?.name}</h3><p className="mt-0.5 truncate text-xs text-muted-foreground">{pack.teacher_offers?.title}</p></div>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span><strong className="text-foreground">{left}</strong> séance{left > 1 ? "s" : ""} restante{left > 1 ? "s" : ""}</span><span>Valable jusqu&apos;au {formatDate(pack.expires_at)}</span></div>
                            {pack.free_sessions > 0 && <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary"><Sparkles className="size-3" aria-hidden /> {pack.free_sessions} séance offerte par BARA</p>}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {pack.status === "pending_payment" && <Link to="/paiement/$packId" params={{ packId: pack.id }} className="rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Régler</Link>}
                              {pack.status === "active" && !expired && <Link to="/compte/programmer/$packId" params={{ packId: pack.id }} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><CalendarClock className="size-3.5" aria-hidden /> Programmer</Link>}
                            </div>
                            {pack.status === "active" && expired && <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">La formule est arrivée à expiration. Les séances déjà programmées restent valables.</p>}
                            <div className="mt-5 border-t border-border pt-4">
                              <h4 className="text-xs font-bold text-foreground">Séances programmées</h4>
                              {packBookings.length > 0 ? <ul className="mt-3">{packBookings.map(renderSession)}</ul> : <p className="mt-2 text-xs text-muted-foreground">Aucune séance programmée pour cette formule.</p>}
                            </div>
                          </article>
                        );
                      })}
                      {teacherBookings.some((booking) => !booking.pack_id) && (
                        <article className="rounded-2xl border border-border p-4">
                          <h3 className="font-display text-sm font-bold text-foreground">Autres séances</h3>
                          <ul className="mt-3">{teacherBookings.filter((booking) => !booking.pack_id).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()).map(renderSession)}</ul>
                        </article>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </section>
      )}

      {!loading && isParent && childParam && visibleTeacherIds.length === 0 && (
        <div className="mt-6 rounded-3xl border border-border bg-card p-7 text-center shadow-[var(--shadow-card)]">
          <p className="font-display text-base font-bold text-foreground">Aucun cours pour {selectedChild?.first_name}</p>
          <Link to="/professeurs" search={{ enfant: childParam }} className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground">Trouver un professeur</Link>
        </div>
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
