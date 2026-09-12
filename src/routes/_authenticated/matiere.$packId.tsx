import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CalendarClock, ClipboardList, FileText, Loader2, Target } from "lucide-react";

import { EmptyState, ProgressBar, SectionHeading } from "@/components/product-ui";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, SESSION_STATUS_LABELS } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/matiere/$packId")({
  head: () => ({
    meta: [
      { title: "Détails matière — BARA" },
      { name: "description", content: "Formule, séances, comptes-rendus et devoirs de la matière suivie." },
      { property: "og:title", content: "Détails matière — BARA" },
      { property: "og:description", content: "Formule, séances, comptes-rendus et devoirs de la matière suivie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SubjectDetailPage,
});

const CARD = "rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]";

function SubjectDetailPage() {
  const { packId } = Route.useParams();
  const { user } = Route.useRouteContext();

  const detailQuery = useQuery({
    queryKey: ["adult-subject-detail", packId, user.id],
    queryFn: async () => {
      const { data: pack, error } = await supabase
        .from("packs")
        .select(
          "id, buyer_id, status, pack_slug, sessions_total, sessions_used, expires_at, teacher_id, format, pack_types(name), teacher_offers(id, title, subjects(name))",
        )
        .eq("id", packId)
        .maybeSingle();
      if (error) throw error;
      if (!pack || pack.buyer_id !== user.id) return null;

      const [bookings, prefs, teacher] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, scheduled_at, status, duration_minutes")
          .eq("pack_id", pack.id)
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("learning_preferences")
          .select("objective")
          .eq("user_id", user.id)
          .eq("role_context", "learner")
          .maybeSingle(),
        supabase.from("profiles").select("display_name").eq("user_id", pack.teacher_id).maybeSingle(),
      ]);
      for (const result of [bookings, prefs, teacher]) if (result.error) throw result.error;

      const bookingIds = (bookings.data ?? []).map((booking) => booking.id);
      let reports: { id: string; booking_id: string; content_note: string; created_at: string }[] = [];
      if (bookingIds.length) {
        const { data, error: reportsError } = await supabase
          .from("session_reports")
          .select("id, booking_id, content_note, created_at")
          .in("booking_id", bookingIds)
          .order("created_at", { ascending: false });
        if (reportsError) throw reportsError;
        reports = data ?? [];
      }

      return {
        pack,
        bookings: bookings.data ?? [],
        objective: prefs.data?.objective ?? null,
        teacherName: teacher.data?.display_name ?? "Intervenant",
        reports,
      };
    },
  });

  if (detailQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Chargement…
      </div>
    );
  }

  const data = detailQuery.data;
  if (!data) {
    return (
      <div className="container-page py-14">
        <EmptyState
          icon={BookOpen}
          title="Matière introuvable"
          description="Cette formule n’existe pas ou ne fait pas partie de votre parcours."
          action={
            <Link to="/parcours" className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
              Retour à mon parcours
            </Link>
          }
        />
      </div>
    );
  }

  const { pack } = data;
  const left = Math.max(pack.sessions_total - pack.sessions_used, 0);
  const now = new Date();
  const nextBooking = data.bookings.find((booking) => booking.status === "accepted" && new Date(booking.scheduled_at) > now);

  return (
    <main className="container-page py-5 pb-24 sm:py-10">
      <Link to="/parcours" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Mon parcours
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
          <BookOpen className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold text-foreground">
            {pack.teacher_offers?.subjects?.name ?? pack.teacher_offers?.title ?? "Matière"}
          </h1>
          <p className="truncate text-xs text-muted-foreground">Avec {data.teacherName}</p>
        </div>
      </div>

      <section className={`mt-4 ${CARD}`}>
        <SectionHeading title={`Formule ${pack.pack_types?.name ?? pack.pack_slug}`} />
        <p className="mt-1 text-sm font-semibold text-foreground">
          {left} séance{left > 1 ? "s" : ""} restante{left > 1 ? "s" : ""}
        </p>
        <div className="mt-3">
          <ProgressBar value={(pack.sessions_used / Math.max(pack.sessions_total, 1)) * 100} label={`Sur ${pack.sessions_total} séances`} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Valable jusqu’au {formatDate(pack.expires_at)}.</p>
        {pack.status === "active" && left > 0 && (
          <Link
            to="/compte/programmer/$packId"
            params={{ packId: pack.id }}
            className="mt-3 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Programmer une séance
          </Link>
        )}
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="Prochain cours" />
        {nextBooking ? (
          <p className="mt-1 text-sm text-foreground">
            {new Date(nextBooking.scheduled_at).toLocaleString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Aucune séance programmée.</p>
        )}
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="Objectif" />
        <p className="mt-1 text-sm text-foreground">{data.objective || "Objectif à préciser dans Mon parcours."}</p>
      </section>

      <section className="mt-3">
        <SectionHeading title="Séances" action={<Link to="/compte/reservations" className="text-sm font-semibold text-primary">Tout voir</Link>} />
        {data.bookings.length ? (
          <ul className="mt-2 space-y-2">
            {data.bookings.slice(0, 6).map((booking) => {
              const status = SESSION_STATUS_LABELS[booking.status];
              return (
                <li key={booking.id} className={`${CARD} flex items-center justify-between gap-3 py-3`}>
                  <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                    <CalendarClock className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="truncate">
                      {new Date(booking.scheduled_at).toLocaleString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                  {status && (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Aucune séance pour cette matière.</p>
        )}
      </section>

      <section className="mt-4">
        <SectionHeading title="Comptes-rendus" />
        {data.reports.length ? (
          <ul className="mt-2 space-y-2">
            {data.reports.slice(0, 5).map((report) => (
              <li key={report.id}>
                <Link to="/compte-rendu/$bookingId" params={{ bookingId: report.booking_id }} className={`${CARD} flex items-start gap-3 py-3`}>
                  <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{report.content_note}</span>
                    <span className="block text-xs text-muted-foreground">{formatDate(report.created_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Les retours de votre intervenant apparaîtront ici.</p>
        )}
      </section>

      <section className="mt-4">
        <SectionHeading title="Devoirs" action={<Link to="/devoirs" className="text-sm font-semibold text-primary">Voir mes devoirs</Link>} />
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList className="size-4 text-primary" aria-hidden /> Le travail demandé est regroupé dans Mes devoirs.
        </p>
      </section>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Target className="size-3.5" aria-hidden /> Formule {pack.pack_types?.name ?? pack.pack_slug} · {pack.format === "online" ? "En ligne" : "À domicile"}
      </p>
    </main>
  );
}
