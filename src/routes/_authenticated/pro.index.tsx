import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Award,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Eye,
  FileText,
  Inbox,
  Loader2,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { DOSSIER_LABEL, dossierStatus } from "@/lib/verification";
import { EmptyState, SectionHeading, StatTile } from "@/components/product-ui";
import { TeacherGate } from "@/components/teacher-gate";
import { formatFcfa, gradeLabel } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/pro/")({
  head: () => ({
    meta: [
      { title: "Mon activité — espace intervenant BARA" },
      {
        name: "description",
        content:
          "Vos séances du jour, vos demandes, vos comptes-rendus à rédiger et vos rémunérations BARA.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherDashboard,
});

function timeRange(iso: string, minutes: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + minutes * 60_000);
  const fmt = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} → ${fmt(end)}`;
}

function TeacherDashboard() {
  const { user } = Route.useRouteContext();

  const profileQuery = useQuery({
    queryKey: ["teacher-profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const nameQuery = useQuery({
    queryKey: ["my-profile-name", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.display_name ?? null;
    },
  });

  const sessionsQuery = useQuery({
    queryKey: ["teacher-today", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, status, format, commune, requester_id, child_id, children(first_name), teacher_offers(subjects(name))",
        )
        .eq("teacher_id", user.id)
        .in("status", ["accepted", "completed"])
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const reportsQuery = useQuery({
    queryKey: ["teacher-session-reports", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_reports")
        .select("booking_id")
        .eq("teacher_id", user.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.booking_id));
    },
  });

  const offersQuery = useQuery({
    queryKey: ["teacher-offers", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_offers")
        .select("id, status")
        .eq("teacher_id", user.id);
      if (error) throw error;
      return data;
    },
  });

  const availabilitiesQuery = useQuery({
    queryKey: ["availabilities-count", user.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("availabilities")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", user.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const earningsQuery = useQuery({
    queryKey: ["teacher-earnings", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("teacher_earnings_summary");
      if (error) throw error;
      return data as unknown as {
        pending_fcfa: number;
        validated_fcfa: number;
        reserved_fcfa: number;
        paid_fcfa: number;
        grade: string;
        rate_cap_fcfa: number;
      };
    },
  });

  const sessions = sessionsQuery.data ?? [];
  const reported = reportsQuery.data ?? new Set<string>();
  const offers = offersQuery.data ?? [];
  const published = offers.filter((o) => o.status === "published");
  const teacher = profileQuery.data;
  const firstName = (nameQuery.data ?? "").split(/\s+/)[0] ?? "";

  const now = Date.now();
  const today = new Date().toDateString();
  const todaySessions = sessions.filter(
    (s) => new Date(s.scheduled_at).toDateString() === today,
  );
  const upcoming = sessions.filter(
    (s) => s.status === "accepted" && new Date(s.scheduled_at).getTime() >= now,
  );
  const toClose = sessions.filter(
    (s) => s.status === "accepted" && new Date(s.scheduled_at).getTime() < now,
  );
  const missingReports = sessions.filter((s) => s.status === "completed" && !reported.has(s.id));
  const students = new Set(sessions.map((s) => `${s.requester_id}:${s.child_id ?? ""}`)).size;

  const setupSteps = [
    { label: "Compléter mon profil public", done: Boolean(teacher?.headline && teacher?.bio), to: "/pro/profil" as const },
    { label: "Créer une offre de cours", done: offers.length > 0, to: "/pro/offres" as const },
    { label: "Publier une offre", done: published.length > 0, to: "/pro/offres" as const },
    { label: "Renseigner mes disponibilités", done: (availabilitiesQuery.data ?? 0) > 0, to: "/pro/disponibilites" as const },
  ].filter((s) => !s.done);

  if (profileQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  return (
    <TeacherGate userId={user.id}>
      <div className="container-page py-6 sm:py-10">
        <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">
          Bonjour {firstName || "à vous"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {todaySessions.length > 0
            ? `${todaySessions.length} séance${todaySessions.length > 1 ? "s" : ""} aujourd'hui.`
            : "Aucune séance aujourd'hui."}
        </p>

        <VerificationBanner teacher={teacher} />

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile icon={CalendarDays} value={upcoming.length} label="Séances à venir" />
          <StatTile icon={Users} value={students} label="Élèves suivis" />
          <StatTile
            icon={FileText}
            value={toClose.length + missingReports.length}
            label="Actions à faire"
          />
        </div>

        <section className="mt-5">
          <SectionHeading
            title="Aujourd'hui"
            action={
              <Link to="/pro/agenda" className="text-xs font-semibold text-primary">
                Mon agenda
              </Link>
            }
          />
          {sessionsQuery.isLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Chargement…</p>
          ) : todaySessions.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon={CalendarClock}
                title="Journée libre"
                description="Vos prochaines séances programmées apparaissent dans votre agenda."
                action={
                  <Link
                    to="/pro/agenda"
                    className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Voir mon agenda
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {todaySessions.map((s) => (
                <li
                  key={s.id}
                  className="rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-card)]"
                >
                  <p className="font-display text-sm font-bold text-foreground">
                    {timeRange(s.scheduled_at, s.duration_minutes)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {s.teacher_offers?.subjects?.name ?? "Cours"} ·{" "}
                    {s.children?.first_name ?? "Élève"} ·{" "}
                    {s.format === "online" ? "En ligne" : (s.commune ?? "À domicile")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(toClose.length > 0 || missingReports.length > 0) && (
          <section className="mt-5">
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
              <p className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                <AlertCircle className="size-4 text-destructive" aria-hidden />
                Séances à mettre à jour
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {toClose.length > 0 &&
                  `${toClose.length} séance${toClose.length > 1 ? "s" : ""} passée${toClose.length > 1 ? "s" : ""} sans statut renseigné. `}
                {missingReports.length > 0 &&
                  `${missingReports.length} compte-rendu${missingReports.length > 1 ? "s" : ""} à rédiger.`}
              </p>
              <Link
                to="/pro/seances"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Voir les séances <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </section>
        )}

        {setupSteps.length > 0 && (
          <section className="mt-5">
            <SectionHeading title="À faire" />
            <ul className="mt-3 space-y-2">
              {setupSteps.map((s) => (
                <li key={s.label}>
                  <Link
                    to={s.to}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-card)] hover:bg-secondary/40"
                  >
                    <span className="min-w-0 flex-1 text-sm text-foreground">{s.label}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-5">
          <SectionHeading title="Mon activité BARA" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link
              to="/pro/remunerations"
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-card)] hover:bg-secondary/40"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <Wallet className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">Rémunérations validées</span>
                <span className="block font-display text-sm font-bold text-foreground">
                  {earningsQuery.isLoading ? "…" : formatFcfa(earningsQuery.data?.validated_fcfa)}
                </span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
            <Link
              to="/pro/progression"
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-card)] hover:bg-secondary/40"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <Award className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">
                  Grade · plafond{" "}
                  {earningsQuery.data ? formatFcfa(earningsQuery.data.rate_cap_fcfa) : "—"}
                </span>
                <span className="block font-display text-sm font-bold text-foreground">
                  {earningsQuery.isLoading ? "…" : gradeLabel(earningsQuery.data?.grade)}
                </span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </div>
        </section>

        <section className="mt-5">
          <SectionHeading title="Raccourcis" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { to: "/pro/seances" as const, icon: FileText, label: "Mes séances" },
              { to: "/pro/eleves" as const, icon: Users, label: "Mes élèves" },
              { to: "/pro/demandes" as const, icon: Inbox, label: "Demandes" },
              { to: "/pro/offres" as const, icon: BookOpen, label: "Mes offres" },
              { to: "/pro/disponibilites" as const, icon: CalendarClock, label: "Disponibilités" },
              { to: "/pro/messages" as const, icon: MessageSquare, label: "Messages & devoirs" },
              { to: "/pro/profil" as const, icon: UserCog, label: "Mon profil" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-card)] hover:bg-secondary/40"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                  <item.icon className="size-4" aria-hidden />
                </span>
                <span className="text-xs font-semibold text-foreground">{item.label}</span>
              </Link>
            ))}
            <Link
              to="/professeurs/$id"
              params={{ id: user.id }}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-card)] hover:bg-secondary/40"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <Eye className="size-4" aria-hidden />
              </span>
              <span className="text-xs font-semibold text-foreground">Ma fiche publique</span>
            </Link>
          </div>
        </section>
      </div>
    </TeacherGate>
  );
}

function VerificationBanner({
  teacher,
}: {
  teacher:
    | {
        verification_status?: string | null;
        verification_submitted_at?: string | null;
        verification_note?: string | null;
      }
    | null
    | undefined;
}) {
  const status = dossierStatus(teacher ?? {});
  if (status === "approved") return null;

  const tone =
    status === "rejected"
      ? "border-destructive/30 bg-destructive/10"
      : status === "review"
        ? "border-primary/30 bg-secondary/70"
        : "border-primary/30 bg-primary-soft";

  return (
    <div className={`mt-4 rounded-2xl border p-3.5 ${tone}`}>
      <p className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
        {status === "rejected" ? (
          <ShieldAlert className="size-4 text-destructive" aria-hidden />
        ) : (
          <ShieldCheck className="size-4 text-primary" aria-hidden />
        )}
        {DOSSIER_LABEL[status]}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {status === "none"
          ? "Lancez la vérification d'identité pour obtenir le badge « Profil vérifié »."
          : status === "review"
            ? "Votre dossier est en cours de vérification, généralement traité sous 48 h."
            : teacher?.verification_note || "Redéposez la pièce concernée puis renvoyez votre dossier."}
      </p>
      <Link
        to="/pro/verification"
        className="mt-3 inline-flex rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {status === "review" ? "Voir mon dossier" : status === "none" ? "Commencer" : "Corriger mon dossier"}
      </Link>
    </div>
  );
}
