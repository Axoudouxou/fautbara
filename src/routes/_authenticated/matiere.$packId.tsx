import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  Paperclip,
  Target,
} from "lucide-react";

import { EmptyState } from "@/components/product-ui";
import { supabase } from "@/integrations/supabase/client";
import { learningObjectiveLabel } from "@/lib/education";
import { formatDate } from "@/lib/packs";
import { fileFormatLabel, signReportFile } from "@/lib/session-reports";

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

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function timeRange(iso: string, minutes: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + minutes * 60_000);
  const fmt = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} - ${fmt(end)}`;
}

function SubjectDetailPage() {
  const { packId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<"path" | "report">("path");

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
          .select("id, scheduled_at, status, duration_minutes, session_index")
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
      let assignments: {
        id: string;
        title: string;
        description: string | null;
        due_date: string | null;
        status: string;
      }[] = [];
      let documents: {
        id: string;
        file_name: string;
        file_size: number | null;
        mime_type: string | null;
        url: string | null;
      }[] = [];

      if (bookingIds.length) {
        const { data, error: reportsError } = await supabase
          .from("session_reports")
          .select("id, booking_id, content_note, created_at")
          .in("booking_id", bookingIds)
          .order("created_at", { ascending: false });
        if (reportsError) throw reportsError;
        reports = data ?? [];

        const reportIds = reports.map((report) => report.id);
        if (reportIds.length) {
          const [assignmentsRes, documentsRes] = await Promise.all([
            supabase
              .from("assignments")
              .select("id, title, description, due_date, status")
              .in("session_report_id", reportIds)
              .order("created_at", { ascending: false }),
            supabase
              .from("session_report_documents")
              .select("id, storage_path, file_name, file_size, mime_type")
              .in("report_id", reportIds)
              .order("created_at", { ascending: false }),
          ]);
          if (assignmentsRes.error) throw assignmentsRes.error;
          if (documentsRes.error) throw documentsRes.error;
          assignments = assignmentsRes.data ?? [];
          documents = await Promise.all(
            (documentsRes.data ?? []).map(async (doc) => ({
              id: doc.id,
              file_name: doc.file_name,
              file_size: doc.file_size,
              mime_type: doc.mime_type,
              url: await signReportFile(doc.storage_path),
            })),
          );
        }
      }

      return {
        pack,
        bookings: bookings.data ?? [],
        objective: prefs.data?.objective ?? null,
        teacherName: teacher.data?.display_name ?? "Intervenant",
        reports,
        assignments,
        documents,
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
  const subjectName = pack.teacher_offers?.subjects?.name ?? pack.teacher_offers?.title ?? "Matière";
  const packName = pack.pack_types?.name ?? pack.pack_slug;
  const done = data.bookings.filter((b) => b.status === "completed").length;
  const left = Math.max(pack.sessions_total - pack.sessions_used, 0);
  const now = new Date();
  const nextBooking = data.bookings.find(
    (booking) => booking.status === "accepted" && new Date(booking.scheduled_at) > now,
  );
  const lastReport = data.reports[0] ?? null;
  const reportByBooking = new Map(data.reports.map((r) => [r.booking_id, r]));
  const bookingById = new Map(data.bookings.map((b) => [b.id, b]));

  const sessionLabel = (bookingId: string) => {
    const booking = bookingById.get(bookingId);
    if (!booking) return "Séance";
    const index = booking.session_index
      ? booking.session_index
      : data.bookings.findIndex((b) => b.id === bookingId) + 1;
    return `Séance ${index} – ${shortDate(booking.scheduled_at)}`;
  };

  return (
    <main className="container-page py-4 pb-28 sm:py-8">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Link
          to="/parcours"
          aria-label="Retour à mon parcours"
          className="flex size-9 items-center justify-center rounded-full text-foreground hover:bg-secondary"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="truncate text-center font-display text-base font-bold text-foreground">
          {subjectName}
        </h1>
        <span className="size-9" aria-hidden />
      </header>

      <section className={`mt-3 ${CARD}`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
            <BookOpen className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold text-foreground">{subjectName}</p>
            <p className="truncate text-xs text-muted-foreground">Avec {data.teacherName}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
            <Target className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">Mon objectif</p>
            <p className="truncate text-sm font-semibold text-foreground">
              {learningObjectiveLabel(data.objective) || "À préciser dans Mon parcours"}
            </p>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
          <div className="min-w-0">
            <dd className="font-display text-lg font-bold text-foreground">{done}</dd>
            <dt className="text-[11px] leading-tight text-muted-foreground">
              séance{done > 1 ? "s" : ""} réalisée{done > 1 ? "s" : ""}
            </dt>
          </div>
          <div className="min-w-0">
            <dd className="font-display text-lg font-bold text-foreground">{left}</dd>
            <dt className="text-[11px] leading-tight text-muted-foreground">
              séance{left > 1 ? "s" : ""} restante{left > 1 ? "s" : ""}
            </dt>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] leading-tight text-muted-foreground">Formule</dt>
            <dd className="truncate font-display text-sm font-bold text-foreground">{packName}</dd>
            <dd className="text-[11px] text-muted-foreground">{pack.sessions_total} séances</dd>
          </div>
        </dl>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-secondary p-1" role="tablist">
        {(
          [
            { id: "path", label: "Mon parcours" },
            { id: "report", label: "Compte rendu" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === item.id ? "bg-primary text-primary-foreground" : "text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "path" ? (
        <>
          <h2 className="mt-5 font-display text-lg font-bold text-foreground">Mes séances</h2>

          {data.bookings.length ? (
            <ol className="mt-3">
              {data.bookings.map((booking, index) => {
                const isDone = booking.status === "completed";
                const isNext = nextBooking?.id === booking.id;
                const isLast = index === data.bookings.length - 1;
                const note = reportByBooking.get(booking.id)?.content_note ?? null;
                return (
                  <li key={booking.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${
                          isDone
                            ? "border-primary bg-primary text-primary-foreground"
                            : isNext
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {isDone ? (
                          <Check className="size-4" aria-hidden />
                        ) : isNext ? (
                          <CalendarDays className="size-4" aria-hidden />
                        ) : null}
                      </span>
                      {!isLast && <span className="w-px flex-1 bg-border" aria-hidden />}
                    </div>
                    <Link
                      to="/seance/$bookingId"
                      params={{ bookingId: booking.id }}
                      className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-2xl px-1 py-0.5 hover:bg-secondary/40"
                    >
                      <span className="min-w-0">
                        <span
                          className={`block font-display text-sm font-bold ${
                            isNext ? "text-primary" : "text-foreground"
                          }`}
                        >
                          Séance {booking.session_index ?? index + 1}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {shortDate(booking.scheduled_at)} • {timeRange(booking.scheduled_at, booking.duration_minutes)}
                        </span>
                        {note && (
                          <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">{note}</span>
                        )}
                        {isNext && (
                          <span className="mt-1.5 inline-flex rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary-soft-foreground">
                            Prochain cours
                          </span>
                        )}
                      </span>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Aucune séance programmée pour cette matière.</p>
          )}

          {nextBooking ? (
            <Link
              to="/seance/$bookingId"
              params={{ bookingId: nextBooking.id }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <CalendarDays className="size-4" aria-hidden /> Voir les détails du prochain cours
            </Link>
          ) : (
            pack.status === "active" &&
            left > 0 && (
              <Link
                to="/compte/programmer/$packId"
                params={{ packId: pack.id }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <CalendarDays className="size-4" aria-hidden /> Programmer une séance
              </Link>
            )
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Formule {packName} · valable jusqu’au {formatDate(pack.expires_at)}
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-5 font-display text-lg font-bold text-foreground">Dernier compte rendu</h2>
          {lastReport ? (
            <Link
              to="/compte-rendu/$bookingId"
              params={{ bookingId: lastReport.booking_id }}
              className="mt-2 block rounded-2xl bg-secondary/60 p-4"
            >
              <span className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="truncate text-sm font-semibold text-foreground">
                      {sessionLabel(lastReport.booking_id)}
                    </span>
                  </span>
                  <span className="mt-2 block line-clamp-3 text-xs text-muted-foreground">
                    {lastReport.content_note}
                  </span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
              </span>
              <span className="mt-3 block text-center text-sm font-semibold text-primary">Voir le détail</span>
            </Link>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Les comptes-rendus de votre intervenant apparaîtront ici.
            </p>
          )}

          {data.reports.length > 0 && (
            <>
              <h2 className="mt-5 font-display text-lg font-bold text-foreground">Tous les comptes-rendus</h2>
              <ul className="mt-2 space-y-2">
                {data.reports.map((report) => (
                  <li key={report.id}>
                    <Link
                      to="/compte-rendu/$bookingId"
                      params={{ bookingId: report.booking_id }}
                      className={`${CARD} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-3.5`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
                        <span className="truncate text-sm font-semibold text-foreground">
                          {sessionLabel(report.booking_id)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="flex min-w-0 items-center gap-2 font-display text-lg font-bold text-foreground">
              <ClipboardList className="size-4 shrink-0" aria-hidden /> Devoirs
            </h2>
            <Link to="/devoirs" className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
              Tout voir <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          {data.assignments.length ? (
            <ul className="mt-2 space-y-2">
              {data.assignments.map((assignment) => (
                <li key={assignment.id} className={`${CARD} grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3.5`}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                    <FileText className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{assignment.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {assignment.due_date ? `À rendre avant le ${formatDate(assignment.due_date)}` : "Sans échéance"}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Aucun devoir pour cette matière.</p>
          )}

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="flex min-w-0 items-center gap-2 font-display text-lg font-bold text-foreground">
              <Paperclip className="size-4 shrink-0" aria-hidden /> Documents
            </h2>
          </div>
          {data.documents.length ? (
            <ul className="mt-2 space-y-2">
              {data.documents.map((doc) => (
                <li key={doc.id}>
                  <a
                    href={doc.url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className={`${CARD} grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3.5`}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                      <FileText className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{doc.file_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {fileFormatLabel(doc.file_name, doc.mime_type, doc.file_size)}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Aucun document partagé.</p>
          )}
        </>
      )}
    </main>
  );
}
