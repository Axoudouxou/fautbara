import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, FileText, Loader2, Paperclip } from "lucide-react";

import { EmptyState, SectionHeading, UserAvatar } from "@/components/product-ui";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/packs";
import {
  ATTENDANCE_OPTIONS,
  ENGAGEMENT_LEVELS,
  PROGRESS_LEVELS,
  fileFormatLabel,
  labelFor,
  signReportFile,
  type Attendance,
  type EngagementLevel,
  type ProgressLevel,
} from "@/lib/session-reports";

export const Route = createFileRoute("/_authenticated/compte-rendu/$bookingId")({
  head: () => ({
    meta: [
      { title: "Compte-rendu de séance — BARA" },
      { name: "description", content: "Le retour détaillé de votre intervenant après la séance." },
      { property: "og:title", content: "Compte-rendu de séance — BARA" },
      { property: "og:description", content: "Le retour détaillé de votre intervenant après la séance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SessionReportPage,
});

const CARD = "rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]";

function SessionReportPage() {
  const { bookingId } = Route.useParams();

  const reportQuery = useQuery({
    queryKey: ["session-report-detail", bookingId],
    queryFn: async () => {
      const { data: report, error } = await supabase
        .from("session_reports")
        .select(
          "id, teacher_id, child_id, attendance, content_note, progress_level, homework_done, engagement_level, next_steps, created_at",
        )
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (error) throw error;
      if (!report) return null;

      const [booking, teacher, child, documents, assignments] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "scheduled_at, duration_minutes, format, commune, city, session_index, teacher_offers(title, subjects(name)), packs(pack_slug, pack_types(name))",
          )
          .eq("id", bookingId)
          .maybeSingle(),
        supabase.from("profiles").select("display_name, avatar_url").eq("user_id", report.teacher_id).maybeSingle(),
        report.child_id
          ? supabase.from("children").select("first_name").eq("id", report.child_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as const),
        supabase
          .from("session_report_documents")
          .select("id, storage_path, file_name, file_size, mime_type, created_at")
          .eq("report_id", report.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("assignments")
          .select("id, title, description, due_date, status, storage_path, file_name, file_size")
          .eq("session_report_id", report.id)
          .order("created_at", { ascending: true }),
      ]);
      if (booking.error) throw booking.error;

      const docs = await Promise.all(
        (documents.data ?? []).map(async (doc) => ({ ...doc, url: await signReportFile(doc.storage_path) })),
      );

      const start = booking.data ? new Date(booking.data.scheduled_at) : null;
      const end =
        booking.data && start ? new Date(start.getTime() + booking.data.duration_minutes * 60_000) : null;

      return {
        report,
        scheduledAt: booking.data?.scheduled_at ?? null,
        timeRange:
          start && end
            ? `${start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
            : null,
        sessionIndex: booking.data?.session_index ?? null,
        packName: booking.data?.packs?.pack_types?.name ?? booking.data?.packs?.pack_slug ?? null,
        formatLabel:
          booking.data?.format === "online"
            ? "En ligne"
            : booking.data
              ? `À domicile${booking.data.commune ? ` · ${booking.data.commune}` : ""}`
              : null,
        subject: booking.data?.teacher_offers?.subjects?.name ?? booking.data?.teacher_offers?.title ?? "Cours",
        teacherName: teacher.data?.display_name ?? "Intervenant",
        teacherAvatar: teacher.data?.avatar_url ?? null,
        childName: child.data?.first_name ?? null,
        documents: docs,
        assignments: assignments.data ?? [],
      };
    },
  });

  if (reportQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Chargement…
      </div>
    );
  }

  const data = reportQuery.data;
  if (!data) {
    return (
      <div className="container-page py-14">
        <EmptyState
          icon={FileText}
          title="Compte-rendu indisponible"
          description="Aucun compte-rendu n’a encore été rempli pour cette séance."
          action={
            <Link to="/compte/reservations" className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
              Retour à mes cours
            </Link>
          }
        />
      </div>
    );
  }

  const { report } = data;

  return (
    <main className="container-page py-5 pb-24 sm:py-10">
      <Link to="/compte/reservations" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Mes cours
      </Link>

      <h1 className="mt-3 font-display text-xl font-bold text-foreground">Compte-rendu</h1>

      <div className={`mt-3 ${CARD} flex items-center gap-3`}>
        <UserAvatar name={data.teacherName} src={data.teacherAvatar} className="size-11" />
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold text-foreground">{data.subject}</p>
          <p className="truncate text-xs text-muted-foreground">
            {data.scheduledAt ? formatDate(data.scheduledAt) : formatDate(report.created_at)} · Avec {data.teacherName}
            {data.childName ? ` · ${data.childName}` : ""}
          </p>
        </div>
      </div>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="La séance" />
        <dl className="mt-2 grid grid-cols-2 gap-3">
          {[
            { label: "Heure", value: data.timeRange },
            { label: "Séance", value: data.sessionIndex ? `N° ${data.sessionIndex}` : null },
            { label: "Formule", value: data.packName },
            { label: "Format", value: data.formatLabel },
          ]
            .filter((row) => row.value)
            .map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{row.label}</dt>
                <dd className="truncate text-sm font-semibold text-foreground">{row.value}</dd>
              </div>
            ))}
        </dl>
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="Présence" />
        <p className="mt-1 text-sm text-foreground">
          {labelFor(ATTENDANCE_OPTIONS, report.attendance as Attendance) ?? "—"}
        </p>
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="Contenu travaillé" />
        <p className="mt-1 whitespace-pre-line text-sm text-foreground">{report.content_note}</p>
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="Niveau d’avancement" />
        <span className="mt-2 inline-flex rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
          {labelFor(PROGRESS_LEVELS, report.progress_level as ProgressLevel) ?? "—"}
        </span>
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="Travail depuis la dernière séance" />
        <p className="mt-1 whitespace-pre-line text-sm text-foreground">{report.homework_done || "Non renseigné"}</p>
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="Engagement" />
        <span className="mt-2 inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-soft-foreground">
          {labelFor(ENGAGEMENT_LEVELS, report.engagement_level as EngagementLevel) ?? "—"}
        </span>
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="À travailler pour la prochaine séance" />
        <p className="mt-1 whitespace-pre-line text-sm text-foreground">{report.next_steps || "Aucune note."}</p>
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading
          title="Devoirs"
          action={<Link to="/devoirs" className="text-sm font-semibold text-primary">Mes devoirs</Link>}
        />
        {data.assignments.length ? (
          <ul className="mt-2 space-y-2">
            {data.assignments.map((item) => (
              <li key={item.id} className="rounded-xl border border-border p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ClipboardList className="size-4 shrink-0 text-primary" aria-hidden /> {item.title}
                </p>
                {item.description && (
                  <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{item.description}</p>
                )}
                {item.due_date && (
                  <p className="mt-1 text-xs text-muted-foreground">À rendre avant le {formatDate(item.due_date)}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Aucun devoir pour cette séance.</p>
        )}
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="Documents" />
        {data.documents.length ? (
          <ul className="mt-2 space-y-2">
            {data.documents.map((doc) => (
              <li key={doc.id}>
                <a
                  href={doc.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                >
                  <Paperclip className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{doc.file_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {fileFormatLabel(doc.file_name, doc.mime_type, doc.file_size)}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Aucun document joint.</p>
        )}
      </section>
    </main>
  );
}
