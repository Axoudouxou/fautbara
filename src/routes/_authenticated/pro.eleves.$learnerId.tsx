import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, FileText, Loader2, MessageSquare, Target } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { learningObjectiveLabel } from "@/lib/education";
import { EmptyState, ProgressBar, SectionHeading, StatTile } from "@/components/product-ui";
import { TeacherGate } from "@/components/teacher-gate";
import { SESSION_STATUS_LABELS } from "@/lib/packs";
import {
  ATTENDANCE_OPTIONS,
  ENGAGEMENT_LEVELS,
  PROGRESS_LEVELS,
  labelFor,
} from "@/lib/session-reports";
import type { SessionReport } from "@/lib/session-reports";

export const Route = createFileRoute("/_authenticated/pro/eleves/$learnerId")({
  validateSearch: (search: Record<string, unknown>): { enfant?: string } =>
    typeof search["enfant"] === "string" ? { enfant: search["enfant"] } : {},
  head: () => ({
    meta: [
      { title: "Fiche élève — espace intervenant BARA" },
      {
        name: "description",
        content: "Suivi pédagogique d'un élève : séances, comptes-rendus et informations partagées.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherStudentPage,
});

type StudentProfile = {
  name: string | null;
  is_child: boolean;
  school_level: string | null;
  subjects: string[];
  sessions_count: number;
  first_session_at: string | null;
  levels: string[];
  filiere: string | null;
  learning_style: string | null;
  objective: string | null;
  interest_subjects: string[];
};

function dayTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TeacherStudentPage() {
  const { user } = Route.useRouteContext();
  const { learnerId } = Route.useParams();
  const { enfant } = Route.useSearch();
  const childId = enfant ?? null;

  const profileQuery = useQuery({
    queryKey: ["teacher-student-profile", learnerId, childId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("teacher_student_profile", {
        p_learner_id: learnerId,
        ...(childId ? { p_child_id: childId } : {}),
      });
      if (error) throw error;
      return data as unknown as StudentProfile;
    },
  });

  const sessionsQuery = useQuery({
    queryKey: ["teacher-student-sessions", user.id, learnerId, childId],
    queryFn: async () => {
      let query = supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, status, format, commune, teacher_offers(title, subjects(name))",
        )
        .eq("teacher_id", user.id)
        .eq("requester_id", learnerId)
        .order("scheduled_at", { ascending: false });
      query = childId ? query.eq("child_id", childId) : query.is("child_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const reportsQuery = useQuery({
    queryKey: ["teacher-student-reports", user.id, learnerId, childId],
    queryFn: async () => {
      let query = supabase
        .from("session_reports")
        .select("*")
        .eq("teacher_id", user.id)
        .eq("learner_id", learnerId)
        .order("created_at", { ascending: false });
      query = childId ? query.eq("child_id", childId) : query.is("child_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data as SessionReport[];
    },
  });

  const profile = profileQuery.data;
  const sessions = sessionsQuery.data ?? [];
  const reports = reportsQuery.data ?? [];
  const now = Date.now();
  const next = [...sessions]
    .filter((s) => s.status === "accepted" && new Date(s.scheduled_at).getTime() >= now)
    .sort((a, b) => (a.scheduled_at < b.scheduled_at ? -1 : 1))[0];
  const done = sessions.filter((s) => s.status === "completed").length;

  if (profileQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <div className="container-page py-14">
        <EmptyState
          icon={Target}
          title="Fiche indisponible"
          description="Vous ne suivez pas cet élève, ou aucune séance ne vous relie à lui."
          action={
            <Link
              to="/pro/eleves"
              className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Retour à mes élèves
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <TeacherGate userId={user.id}>
      <div className="container-page py-6 sm:py-10">
        <Link
          to="/pro/eleves"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" aria-hidden /> Mes élèves
        </Link>

        <h1 className="mt-3 font-display text-xl font-bold text-foreground sm:text-2xl">
          {profile.name ?? "Élève"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[profile.school_level, ...profile.levels, profile.filiere].filter(Boolean).join(" · ") ||
            "Aucun niveau renseigné"}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile icon={CalendarDays} value={done} label="Séances réalisées" />
          <StatTile icon={FileText} value={reports.length} label="Comptes-rendus" />
          <StatTile icon={Target} value={sessions.length} label="Séances au total" />
        </div>

        {sessions.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)]">
            <ProgressBar
              value={(done / sessions.length) * 100}
              label={`${done} séance${done > 1 ? "s" : ""} sur ${sessions.length}`}
            />
          </div>
        )}

        <section className="mt-5">
          <SectionHeading title="Prochaine séance" />
          {next ? (
            <div className="mt-3 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-card)]">
              <p className="font-display text-sm font-bold text-foreground">{dayTime(next.scheduled_at)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {next.teacher_offers?.subjects?.name ?? "Cours"} ·{" "}
                {next.format === "online" ? "En ligne" : (next.commune ?? "À domicile")} ·{" "}
                {next.duration_minutes} min
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Aucune séance programmée.</p>
          )}
        </section>

        {(profile.learning_style || profile.objective || profile.interest_subjects.length > 0) && (
          <section className="mt-5">
            <SectionHeading title="Profil pédagogique" />
            <dl className="mt-3 space-y-2 rounded-2xl border border-border bg-card p-3.5 text-sm shadow-[var(--shadow-card)]">
              {profile.objective && (
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Objectif</dt>
                  <dd className="text-foreground">{learningObjectiveLabel(profile.objective) ?? profile.objective}</dd>
                </div>
              )}
              {profile.learning_style && (
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Manière d'apprendre</dt>
                  <dd className="text-foreground">{profile.learning_style}</dd>
                </div>
              )}
              {profile.interest_subjects.length > 0 && (
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Matières souhaitées</dt>
                  <dd className="text-foreground">{profile.interest_subjects.join(", ")}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        <section className="mt-5">
          <SectionHeading
            title="Séances"
            action={
              <Link
                to="/pro/messages"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
              >
                <MessageSquare className="size-3.5" aria-hidden /> Conversation
              </Link>
            }
          />
          {sessionsQuery.isLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Chargement…</p>
          ) : sessions.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Aucune séance enregistrée.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sessions.map((s) => {
                const status = SESSION_STATUS_LABELS[s.status] ?? {
                  label: s.status,
                  className: "bg-muted text-muted-foreground",
                };
                return (
                  <li
                    key={s.id}
                    className="rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-card)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-bold text-foreground">
                          {dayTime(s.scheduled_at)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.teacher_offers?.subjects?.name ?? "Cours"} · {s.duration_minutes} min
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-5">
          <SectionHeading
            title="Comptes-rendus"
            action={
              <Link to="/pro/demandes" className="text-xs font-semibold text-primary">
                Rédiger
              </Link>
            }
          />
          {reports.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Aucun compte-rendu rédigé.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-card)]"
                >
                  <p className="text-xs font-semibold text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{r.content_note}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {labelFor(ATTENDANCE_OPTIONS, r.attendance)} ·{" "}
                    {labelFor(PROGRESS_LEVELS, r.progress_level)}
                    {r.homework_done ? ` · Travail : ${r.homework_done}` : ""} · Engagement{" "}
                    {labelFor(ENGAGEMENT_LEVELS, r.engagement_level)}
                  </p>
                  {r.next_steps && (
                    <p className="mt-1 text-xs text-foreground">
                      À travailler pour la prochaine séance : {r.next_steps}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </TeacherGate>
  );
}
