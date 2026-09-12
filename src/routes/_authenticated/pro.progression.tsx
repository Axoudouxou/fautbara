import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Check, Loader2, Star, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ProgressBar, SectionHeading, StatTile } from "@/components/product-ui";
import { TeacherGate } from "@/components/teacher-gate";
import { GRADE_LABELS, formatFcfa, gradeLabel, type TeacherGrade } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/pro/progression")({
  head: () => ({
    meta: [
      { title: "Ma progression — espace intervenant BARA" },
      {
        name: "description",
        content:
          "Votre grade BARA, votre plafond de tarif par séance et les critères déjà atteints.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherProgressPage,
});

/** Seuils du modèle BARA existant (grades acquis à vie). */
const GRADE_STEPS: {
  grade: TeacherGrade;
  sessions: number;
  rating: number;
  reports: number;
  cancel: number;
}[] = [
  { grade: "verified", sessions: 0, rating: 0, reports: 0, cancel: 1 },
  { grade: "confirmed", sessions: 10, rating: 4.5, reports: 0.9, cancel: 0.1 },
  { grade: "referent", sessions: 30, rating: 4.7, reports: 0.95, cancel: 0.07 },
  { grade: "coordinator", sessions: 60, rating: 4.8, reports: 0.98, cancel: 0.05 },
];

function TeacherProgressPage() {
  const { user } = Route.useRouteContext();

  const summaryQuery = useQuery({
    queryKey: ["teacher-earnings", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("teacher_earnings_summary");
      if (error) throw error;
      return data as unknown as { grade: string; rate_cap_fcfa: number };
    },
  });

  const statsQuery = useQuery({
    queryKey: ["teacher-progress-stats", user.id],
    queryFn: async () => {
      const [bookings, reviews, reports] = await Promise.all([
        supabase.from("bookings").select("id, status, cancelled_by").eq("teacher_id", user.id),
        supabase.from("reviews").select("rating").eq("teacher_id", user.id).eq("status", "published"),
        supabase.from("session_reports").select("id").eq("teacher_id", user.id),
      ]);
      if (bookings.error) throw bookings.error;
      if (reviews.error) throw reviews.error;
      if (reports.error) throw reports.error;

      const all = bookings.data ?? [];
      const counted = all.filter((b) => b.status === "completed" || b.status === "no_show_parent");
      const teacherCancel = all.filter(
        (b) =>
          b.status === "no_show_teacher" ||
          ((b.status === "cancelled" || b.status === "lost") && b.cancelled_by === user.id),
      );
      const ratings = (reviews.data ?? []).map((r) => r.rating);
      return {
        sessions: counted.length,
        rating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
        ratingCount: ratings.length,
        reports: counted.length > 0 ? (reports.data ?? []).length / counted.length : 0,
        cancel: all.length > 0 ? teacherCancel.length / all.length : 0,
      };
    },
  });

  const stats = statsQuery.data;
  const currentGrade = (summaryQuery.data?.grade ?? "verified") as TeacherGrade;
  const currentIndex = GRADE_STEPS.findIndex((s) => s.grade === currentGrade);
  const nextStep = GRADE_STEPS[currentIndex + 1];

  const criteria = nextStep && stats
    ? [
        {
          label: `${nextStep.sessions} séances réalisées`,
          value: `${stats.sessions} / ${nextStep.sessions}`,
          ok: stats.sessions >= nextStep.sessions,
          ratio: nextStep.sessions > 0 ? stats.sessions / nextStep.sessions : 1,
        },
        {
          label: `Note moyenne ${nextStep.rating.toLocaleString("fr-FR")} / 5`,
          value: stats.ratingCount > 0 ? `${stats.rating.toFixed(2)} / 5` : "Aucun avis",
          ok: stats.rating >= nextStep.rating,
          ratio: nextStep.rating > 0 ? stats.rating / nextStep.rating : 1,
        },
        {
          label: `${Math.round(nextStep.reports * 100)} % de comptes-rendus remplis`,
          value: `${Math.round(stats.reports * 100)} %`,
          ok: stats.reports >= nextStep.reports,
          ratio: nextStep.reports > 0 ? stats.reports / nextStep.reports : 1,
        },
        {
          label: `Au plus ${Math.round(nextStep.cancel * 100)} % d'annulations de votre fait`,
          value: `${Math.round(stats.cancel * 100)} %`,
          ok: stats.cancel <= nextStep.cancel,
          ratio: stats.cancel <= nextStep.cancel ? 1 : 0,
        },
      ]
    : [];

  const achieved = criteria.filter((c) => c.ok).length;

  return (
    <TeacherGate userId={user.id}>
      <div className="container-page py-6 sm:py-10">
        <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">Ma progression</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Votre grade est acquis à vie et détermine votre plafond de tarif par séance.
        </p>

        <div className="mt-4 rounded-2xl border border-primary/25 bg-primary-soft/40 p-4">
          <span className="flex size-9 items-center justify-center rounded-xl bg-card text-primary">
            <Award className="size-4" aria-hidden />
          </span>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">Grade actuel</p>
          <p className="font-display text-xl font-bold text-foreground">
            {summaryQuery.isLoading ? "…" : gradeLabel(summaryQuery.data?.grade)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Plafond : {summaryQuery.data ? formatFcfa(summaryQuery.data.rate_cap_fcfa) : "—"} par séance
          </p>
        </div>

        {statsQuery.isLoading && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
          </p>
        )}

        {stats && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatTile icon={Check} value={stats.sessions} label="Séances comptées" />
            <StatTile
              icon={Star}
              value={stats.ratingCount > 0 ? stats.rating.toFixed(2) : "—"}
              label={`Note (${stats.ratingCount} avis)`}
            />
            <StatTile icon={Check} value={`${Math.round(stats.reports * 100)} %`} label="Comptes-rendus" />
          </div>
        )}

        {nextStep && stats && (
          <section className="mt-5">
            <SectionHeading title={`Vers le grade ${GRADE_LABELS[nextStep.grade]}`} />
            <div className="mt-3 rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)]">
              <ProgressBar
                value={(achieved / criteria.length) * 100}
                label={`${achieved} critère${achieved > 1 ? "s" : ""} sur ${criteria.length}`}
              />
              <ul className="mt-3 space-y-2">
                {criteria.map((c) => (
                  <li key={c.label} className="flex items-start gap-2 text-sm">
                    <span
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                        c.ok ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.ok ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-foreground">{c.label}</span>
                      <span className="block text-xs text-muted-foreground">{c.value}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {!nextStep && (
          <p className="mt-5 text-sm text-muted-foreground">
            Vous avez atteint le grade le plus élevé du modèle BARA.
          </p>
        )}

        <section className="mt-5">
          <SectionHeading title="Mes tarifs" />
          <p className="mt-2 text-sm text-muted-foreground">
            Vos offres ne peuvent pas dépasser votre plafond actuel. Ajustez-les depuis vos offres.
          </p>
          <Link
            to="/pro/offres"
            className="mt-3 inline-flex rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Gérer mes offres
          </Link>
        </section>
      </div>
    </TeacherGate>
  );
}
