import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, Star } from "lucide-react";

import { EmptyState, SectionHeading, UserAvatar } from "@/components/product-ui";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/packs";
import { ATTENDANCE_OPTIONS, HOMEWORK_DONE_OPTIONS, PROGRESS_LEVELS } from "@/lib/session-reports";

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

function label(options: { value: string; label: string }[], value: string | null | undefined) {
  return options.find((option) => option.value === value)?.label ?? null;
}

function SessionReportPage() {
  const { bookingId } = Route.useParams();

  const reportQuery = useQuery({
    queryKey: ["session-report-detail", bookingId],
    queryFn: async () => {
      const { data: report, error } = await supabase
        .from("session_reports")
        .select(
          "id, teacher_id, child_id, attendance, content_note, progress_level, homework_done, engagement_rating, next_steps, created_at",
        )
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (error) throw error;
      if (!report) return null;

      const [booking, teacher, child] = await Promise.all([
        supabase
          .from("bookings")
          .select("scheduled_at, teacher_offers(title, subjects(name))")
          .eq("id", bookingId)
          .maybeSingle(),
        supabase.from("profiles").select("display_name, avatar_url").eq("user_id", report.teacher_id).maybeSingle(),
        report.child_id
          ? supabase.from("children").select("first_name").eq("id", report.child_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as const),
      ]);
      if (booking.error) throw booking.error;

      return {
        report,
        scheduledAt: booking.data?.scheduled_at ?? null,
        subject: booking.data?.teacher_offers?.subjects?.name ?? booking.data?.teacher_offers?.title ?? "Cours",
        teacherName: teacher.data?.display_name ?? "Intervenant",
        teacherAvatar: teacher.data?.avatar_url ?? null,
        childName: child.data?.first_name ?? null,
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
        <SectionHeading title="Présence" />
        <p className="mt-1 text-sm text-foreground">{label(ATTENDANCE_OPTIONS, report.attendance) ?? "—"}</p>
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="Contenu travaillé" />
        <p className="mt-1 whitespace-pre-line text-sm text-foreground">{report.content_note}</p>
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="Niveau d’avancement" />
        <span className="mt-2 inline-flex rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
          {label(PROGRESS_LEVELS, report.progress_level) ?? "—"}
        </span>
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="Travail fait depuis la dernière fois" />
        <p className="mt-1 text-sm text-foreground">{label(HOMEWORK_DONE_OPTIONS, report.homework_done) ?? "Non renseigné"}</p>
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="Engagement" />
        <div className="mt-2 flex items-center gap-1" aria-label={`Engagement ${report.engagement_rating} sur 5`}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Star
              key={value}
              className={`size-4 ${value <= report.engagement_rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
              aria-hidden
            />
          ))}
        </div>
      </section>

      <section className={`mt-3 ${CARD}`}>
        <SectionHeading title="Note pour la prochaine fois" />
        <p className="mt-1 whitespace-pre-line text-sm text-foreground">{report.next_steps || "Aucune note."}</p>
      </section>
    </main>
  );
}
