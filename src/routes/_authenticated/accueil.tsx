import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Baby,
  BadgeCheck,
  Bell,
  BookOpen,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Home,
  Inbox,
  Laptop,
  Loader2,
  Wallet,
  UserPlus,
} from "lucide-react";


import { RowCard, SectionHeading, StatTile } from "@/components/product-ui";

import { supabase } from "@/integrations/supabase/client";
import { HomeShortcutTabs } from "@/components/home-shortcut-tabs";
import { NotificationsFeed } from "@/components/notifications-feed";
import { AdminAlertsSection, TeacherTasksSection } from "@/components/home-role-sections";
import { useConversations } from "@/lib/messaging";
import { useMessagingPanel } from "@/lib/messaging-panel-context";
import { budgetRangeToPriceArgs, type BudgetRange } from "@/lib/education";

export const Route = createFileRoute("/_authenticated/accueil")({
  head: () => ({
    meta: [
      { title: "Mon espace BARA" },
      {
        name: "description",
        content:
          "Votre accueil personnalisé BARA : prochaine séance, demandes de cours et nouveautés de la plateforme.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomeScreen,
});

type BookingRow = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  format: string;
  status: string;
  created_at: string;
  teacher_id: string;
  child_id?: string | null;
  children: { first_name: string } | null;
  teacher_offers: {
    title: string;
    subject_id?: string;
    subjects: { name: string; category_id?: string } | null;
  } | null;
};

function formatSlot(iso: string, duration: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + duration * 60_000);
  const day = start.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time(start)} → ${time(end)}`;
}

function formatLabel(format: string) {
  return format === "online" ? "En ligne" : "À domicile";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ name, url }: { name: string; url?: string | null | undefined }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="size-14 shrink-0 rounded-2xl object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft font-display text-lg font-bold text-primary-soft-foreground">
      {initials(name) || "?"}
    </span>
  );
}

const CTA =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90";
const CTA2 =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary";
const CARD = "rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6";
const ASSIGNMENT_STATUS_LABEL: Record<string, string> = { sent: "Envoyé", seen: "Vu", done: "Fait" };

function HomeScreen() {
  const { user } = Route.useRouteContext();

  const rolesQuery = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as string);
    },
  });

  const profileQuery = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const roles = rolesQuery.data ?? [];

  if (rolesQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  const firstName = (profileQuery.data?.display_name ?? "").split(" ")[0] ?? "";

  if (roles.includes("admin")) return <AdminHome userId={user.id} />;
  if (roles.includes("teacher")) return <TeacherHome userId={user.id} firstName={firstName} />;

  if (roles.includes("parent")) return <ParentHome userId={user.id} firstName={firstName} />;
  return <AdultHome userId={user.id} firstName={firstName} />;

}

/* ---------------- Données communes Parent / Adulte ---------------- */

type PackRow = {
  id: string;
  child_id: string | null;
  status: string;
  sessions_total: number;
  sessions_used: number;
  teacher_offers: { subjects: { name: string } | null } | null;
};

function useLearnerHomeData(userId: string, withChildren: boolean) {
  return useQuery({
    queryKey: ["home-learner", userId, withChildren],
    queryFn: async () => {
      const [children, bookings, packs, assignments] = await Promise.all([
        withChildren
          ? supabase
              .from("children")
              .select("id, first_name, school_level")
              .eq("parent_id", userId)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("bookings")
          .select(
            "id, scheduled_at, duration_minutes, format, status, created_at, teacher_id, child_id, children(first_name), teacher_offers(title, subjects(name))",
          )
          .eq("requester_id", userId)
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("packs")
          .select("id, child_id, status, sessions_total, sessions_used, teacher_offers(subjects(name))")
          .eq("buyer_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("assignments")
          .select("id, title, status, due_date")
          .neq("status", "done")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      for (const result of [children, bookings, packs, assignments]) {
        if (result.error) throw result.error;
      }

      const rows = (bookings.data ?? []) as unknown as BookingRow[];
      const teacherIds = Array.from(new Set(rows.map((b) => b.teacher_id))).slice(0, 20);
      const teacherNames = new Map<string, string>();
      if (teacherIds.length > 0) {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", teacherIds);
        if (error) throw error;
        for (const p of profiles ?? []) teacherNames.set(p.user_id, p.display_name);
      }

      return {
        children: (children.data ?? []) as { id: string; first_name: string; school_level: string | null }[],
        bookings: rows,
        packs: (packs.data ?? []) as unknown as PackRow[],
        assignments: assignments.data ?? [],
        teacherNames,
      };
    },
  });
}

function sessionsLeftOf(packs: PackRow[]) {
  return packs.reduce((sum, p) => sum + Math.max(p.sessions_total - p.sessions_used, 0), 0);
}

function dayTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })} · ${d.toLocaleTimeString(
    "fr-FR",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

function hourOf(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function relDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  return d.toLocaleDateString("fr-FR", { weekday: "long" });
}

function childLevel(children: { id: string; school_level: string | null }[], childId: string | null | undefined) {
  if (!childId) return null;
  return children.find((c) => c.id === childId)?.school_level ?? null;
}

const SOFT_CARD = "rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]";


function Greeting({ firstName, subtitle }: { firstName: string; subtitle: string }) {
  return (
    <header>
      <h1 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
        {firstName ? `Bonjour ${firstName} 👋` : "Bonjour 👋"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </header>
  );
}

function NotificationsLink() {
  return (
    <div className="mt-6">
      <Link
        to="/notifications"
        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
      >
        <span className="inline-flex items-center gap-2">
          <Bell className="size-4 text-primary" aria-hidden /> Mes notifications
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
    </div>
  );
}

/* ---------------- Accueil Parent ---------------- */

function ParentHome({ userId, firstName }: { userId: string; firstName: string }) {
  const dataQuery = useLearnerHomeData(userId, true);
  if (dataQuery.isLoading) return <LoadingScreen />;

  const data = dataQuery.data;
  const children = data?.children ?? [];
  const bookings = data?.bookings ?? [];
  const packs = data?.packs ?? [];
  const assignments = data?.assignments ?? [];
  const now = Date.now();

  const upcoming = bookings
    .filter((b) => new Date(b.scheduled_at).getTime() > now && (b.status === "accepted" || b.status === "pending"))
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  const activePacks = packs.filter((p) => p.status === "active");
  const packsToSchedule = activePacks.filter(
    (p) => p.sessions_total - p.sessions_used > 0 && !upcoming.some((b) => b.child_id === p.child_id),
  );
  const todo = [
    ...packsToSchedule.slice(0, 2).map((p) => ({
      key: `pack-${p.id}`,
      label: `Programmer une séance${
        p.child_id ? ` pour ${children.find((c) => c.id === p.child_id)?.first_name ?? "votre enfant"}` : ""
      }`,
      to: "/compte/programmer/$packId" as const,
      params: { packId: p.id },
    })),
  ];

  if (children.length === 0) {
    return (
      <main className="container-page py-6 sm:py-12">
        <Greeting firstName={firstName} subtitle="Ajoutez le profil de votre enfant pour commencer." />
        <div className={`mt-5 ${SOFT_CARD}`}>
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <UserPlus className="size-5" aria-hidden />
          </span>
          <p className="mt-3 font-display text-lg font-bold text-foreground">Ajouter un enfant</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Le profil de votre enfant permet de choisir un intervenant et une formule adaptés.
          </p>
          <Link to="/compte/enfants" className={`mt-4 ${CTA}`}>
            Ajouter un enfant
          </Link>
        </div>
        <NotificationsLink />
      </main>
    );
  }

  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
  const weekCount = upcoming.filter((b) => new Date(b.scheduled_at).getTime() <= weekEnd).length;

  return (
    <main className="container-page py-6 sm:py-12">
      <Greeting firstName={firstName} subtitle="Voici ce qui se passe pour votre famille cette semaine." />

      <section className="mt-4" aria-label="Cette semaine">
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile icon={Baby} value={children.length} label={children.length > 1 ? "enfants suivis" : "enfant suivi"} />
          <StatTile icon={CalendarClock} value={weekCount} label={weekCount > 1 ? "cours cette semaine" : "cours cette semaine"} />
          <StatTile icon={Inbox} value={todo.length} label={todo.length > 1 ? "actions à faire" : "action à faire"} />
        </div>
      </section>

      <section className="mt-6" aria-label="Prochains cours">
        <SectionHeading title="Prochains cours" />
        {upcoming.length > 0 ? (
          <>
            <ul className="mt-3 space-y-2.5">
              {upcoming.slice(0, 3).map((b) => (
                <li key={b.id}>
                  <Link to="/compte/reservations" className="block">
                    <RowCard className="transition-colors hover:bg-secondary">
                      <span className="w-[72px] shrink-0">
                        <span className="block text-[11px] font-semibold text-muted-foreground">{relDay(b.scheduled_at)}</span>
                        <span className="block font-display text-base font-bold leading-tight text-foreground">
                          {hourOf(b.scheduled_at)}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 border-l border-border pl-3">
                        <span className="block truncate text-sm font-bold text-foreground">
                          {b.teacher_offers?.subjects?.name ?? "Cours particulier"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[b.children?.first_name, childLevel(children, b.child_id)].filter(Boolean).join(" · ") ||
                            formatLabel(b.format)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </RowCard>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/compte/calendrier" className={`mt-3 w-full ${CTA}`}>
              Voir le calendrier
            </Link>
          </>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
            Aucune séance programmée.
          </p>
        )}
      </section>

      {todo.length > 0 && (
        <section className="mt-6" aria-label="À faire">
          <SectionHeading title="À faire" />
          <ul className="mt-3 space-y-2.5">
            {todo.map((item) => (
              <li key={item.key}>
                <Link to={item.to} params={item.params} className="block">
                  <RowCard className="border-primary/40 bg-primary-soft/30 transition-colors hover:bg-primary-soft/50">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{item.label}</span>
                    <span className="shrink-0 text-xs font-bold text-primary">Programmer</span>
                  </RowCard>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6" aria-label="Mes enfants">
        <SectionHeading
          title="Mes enfants"
          action={
            <Link to="/compte/enfants" className="text-xs font-semibold text-primary hover:underline">
              Gérer
            </Link>
          }
        />
        <ul className="mt-3 space-y-2.5 sm:grid sm:grid-cols-2 sm:gap-2.5 sm:space-y-0">
          {children.map((child) => {
            const childPacks = activePacks.filter((p) => p.child_id === child.id);
            const left = sessionsLeftOf(childPacks);
            const nextChild = upcoming.find((b) => b.child_id === child.id);
            return (
              <li key={child.id}>
                <Link to="/compte/enfants/$childId" params={{ childId: child.id }} className="block">
                  <RowCard className="transition-colors hover:bg-secondary">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft font-display font-bold text-primary-soft-foreground">
                      {child.first_name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-bold text-foreground">
                        {child.first_name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {child.school_level || "Niveau à préciser"}
                      </span>
                      <span className="mt-1 block truncate text-xs font-semibold text-foreground">
                        {left > 0 ? `${left} séance${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""}` : "Aucune formule active"}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {nextChild ? `Prochain cours : ${dayTime(nextChild.scheduled_at)}` : "Aucun cours programmé"}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </RowCard>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>


      {assignments.length > 0 && (
        <section className="mt-6" aria-label="Travail à faire">
          <SectionHeading title="Travail à faire" />
          <Link to="/devoirs" className="mt-3 block">
            <RowCard className="transition-colors hover:bg-secondary">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {assignments.length} devoir{assignments.length > 1 ? "s" : ""} en attente
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </RowCard>
          </Link>
        </section>
      )}

      <NotificationsLink />
    </main>
  );
}

/* ---------------- Accueil Adulte apprenant ---------------- */

function AdultHome({ userId, firstName }: { userId: string; firstName: string }) {
  const dataQuery = useLearnerHomeData(userId, false);

  const journeyQuery = useQuery({
    queryKey: ["home-adult-journey", userId],
    queryFn: async () => {
      const [prefs, report] = await Promise.all([
        supabase
          .from("learning_preferences")
          .select("objective, subject_slugs, level_slugs, budget_range, preferred_communes")
          .eq("user_id", userId)
          .eq("role_context", "learner")
          .maybeSingle(),
        supabase
          .from("session_reports")
          .select("id, content_note, next_steps, created_at")
          .eq("learner_id", userId)
          .is("child_id", null)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      if (prefs.error) throw prefs.error;
      if (report.error) throw report.error;
      return { prefs: prefs.data, report: report.data?.[0] ?? null };
    },
  });

  if (dataQuery.isLoading) return <LoadingScreen />;

  const data = dataQuery.data;
  const bookings = data?.bookings ?? [];
  const packs = (data?.packs ?? []).filter((p) => !p.child_id);
  const assignments = data?.assignments ?? [];
  const now = Date.now();

  const upcoming = bookings
    .filter(
      (b) =>
        !b.child_id &&
        new Date(b.scheduled_at).getTime() > now &&
        (b.status === "accepted" || b.status === "pending"),
    )
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  const next = upcoming[0];
  const activePacks = packs.filter((p) => p.status === "active");
  const left = sessionsLeftOf(activePacks);
  const objective = journeyQuery.data?.prefs?.objective;
  const objectiveLabels: Record<string, string> = {
    exam: "Réussir un examen",
    catchup: "Combler mes lacunes",
    advance: "Aller plus loin",
    confidence: "Reprendre confiance",
  };
  const prefs = journeyQuery.data?.prefs;
  const report = journeyQuery.data?.report;

  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
  const weekCount = upcoming.filter((b) => new Date(b.scheduled_at).getTime() <= weekEnd).length;

  return (
    <main className="container-page py-6 sm:py-12">
      <Greeting firstName={firstName} subtitle="Voici où vous en êtes dans votre apprentissage." />

      <section className="mt-4" aria-label="Cette semaine">
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile
            icon={BookOpen}
            value={activePacks.length}
            label={activePacks.length > 1 ? "matières suivies" : "matière suivie"}
          />
          <StatTile icon={CalendarClock} value={weekCount} label="cours cette semaine" />
          <StatTile
            icon={ClipboardList}
            value={assignments.length}
            label={assignments.length > 1 ? "travaux à faire" : "travail à faire"}
          />
        </div>
      </section>

      <section className="mt-6" aria-label="Ma prochaine séance">
        <SectionHeading title="Ma prochaine séance" />
        {next ? (
          <>
            <Link to="/compte/reservations" className="mt-3 block">
              <RowCard className="transition-colors hover:bg-secondary">
                <span className="w-[72px] shrink-0">
                  <span className="block text-[11px] font-semibold text-muted-foreground">
                    {relDay(next.scheduled_at)}
                  </span>
                  <span className="block font-display text-base font-bold leading-tight text-foreground">
                    {hourOf(next.scheduled_at)}
                  </span>
                </span>
                <span className="min-w-0 flex-1 border-l border-border pl-3">
                  <span className="block truncate text-sm font-bold text-foreground">
                    {next.teacher_offers?.subjects?.name ?? "Cours particulier"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {data?.teacherNames.get(next.teacher_id) ?? "Votre intervenant"} · {formatLabel(next.format)}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </RowCard>
            </Link>
            <Link to="/compte/calendrier" className={`mt-3 w-full ${CTA}`}>
              Voir le calendrier
            </Link>
          </>
        ) : (
          <div className={`mt-3 ${SOFT_CARD}`}>
            <p className="text-sm text-muted-foreground">Aucune séance programmée.</p>
            <Link
              to="/professeurs"
              search={{
                matiere: prefs?.subject_slugs?.[0],
                niveau: prefs?.level_slugs?.[0],
                commune: prefs?.preferred_communes?.[0],
                ...budgetRangeToPriceArgs((prefs?.budget_range as BudgetRange | null) ?? null),
              }}
              className={`mt-3 ${CTA}`}
            >
              Trouver un intervenant
            </Link>
          </div>
        )}
      </section>

      <section className="mt-6" aria-label="Mes matières">
        <SectionHeading
          title="Mes matières"
          action={
            <Link to="/parcours" className="text-xs font-semibold text-primary hover:underline">
              Mon parcours
            </Link>
          }
        />
        {activePacks.length > 0 ? (
          <ul className="mt-3 space-y-2.5">
            {activePacks.slice(0, 3).map((p) => {
              const packLeft = Math.max(p.sessions_total - p.sessions_used, 0);
              return (
                <li key={p.id}>
                  <Link to="/matiere/$packId" params={{ packId: p.id }} className="block">
                    <RowCard className="transition-colors hover:bg-secondary">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                        <BookOpen className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-foreground">
                          {p.teacher_offers?.subjects?.name ?? "Matière"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {packLeft} séance{packLeft > 1 ? "s" : ""} restante{packLeft > 1 ? "s" : ""} sur{" "}
                          {p.sessions_total}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </RowCard>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
            Aucune formule active. Choisissez un intervenant pour démarrer.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {left > 0 ? `${left} séance${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""} au total · ` : ""}
          Objectif : {objective ? objectiveLabels[objective] ?? objective : "à préciser dans Mon parcours"}
        </p>

      </section>


      {assignments.length > 0 && (
        <section className="mt-6" aria-label="À faire">
          <SectionHeading title="À faire" />
          <Link to="/devoirs" className="mt-3 block">
            <RowCard className="border-primary/40 bg-primary-soft/30 transition-colors hover:bg-primary-soft/50">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{assignments[0]!.title}</span>
                <span className="block text-xs text-muted-foreground">Devoir à rendre</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </RowCard>
          </Link>
        </section>
      )}

      {report && (
        <section className="mt-6" aria-label="Dernière séance">
          <SectionHeading title="Dernière séance" />
          <div className={`mt-3 ${SOFT_CARD}`}>
            <p className="text-sm text-foreground">{report.content_note}</p>
            {report.next_steps && (
              <p className="mt-1 text-xs text-muted-foreground">Prochaine étape : {report.next_steps}</p>
            )}
            <Link to="/parcours" className="mt-3 inline-flex text-xs font-bold text-primary hover:underline">
              Voir mes comptes-rendus
            </Link>
          </div>
        </section>
      )}

      <NotificationsLink />
    </main>
  );
}


/* ---------------- Professeur ---------------- */

function countdown24h(createdAt: string) {
  const deadline = new Date(createdAt).getTime() + 24 * 3600_000;
  const diff = deadline - Date.now();
  if (diff <= 0) return "délai dépassé";
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  return h > 0 ? `${h} h ${m} min restantes` : `${m} min restantes`;
}

function TeacherHome({ userId, firstName }: { userId: string; firstName: string }) {
  const bookingsQuery = useQuery({
    queryKey: ["home-teacher-bookings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, format, status, created_at, teacher_id, children(first_name), teacher_offers(title, subjects(name))",
        )
        .eq("teacher_id", userId)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BookingRow[];
    },
  });

  const completenessQuery = useQuery({
    queryKey: ["home-teacher-completeness", userId],
    queryFn: async () => {
      const [profile, photos, experiences, availabilities] = await Promise.all([
        supabase
          .from("teacher_profiles")
          .select("headline, bio")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("teacher_photos")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", userId),
        supabase
          .from("teacher_experiences")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", userId),
        supabase
          .from("availabilities")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", userId),
      ]);
      for (const r of [profile, photos, experiences, availabilities]) {
        if (r.error) throw r.error;
      }
      return {
        hasCv: Boolean(profile.data?.headline && profile.data?.bio),
        photos: photos.count ?? 0,
        experiences: experiences.count ?? 0,
        availabilities: availabilities.count ?? 0,
      };
    },
  });

  const walletQuery = useQuery({
    queryKey: ["wallet", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("balance_fcfa")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.balance_fcfa ?? 0;
    },
  });

  const offersQuery = useQuery({
    queryKey: ["home-teacher-offers", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_offers")
        .select("id, status, price_fcfa")
        .eq("teacher_id", userId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const studentConversationsQuery = useConversations(userId, "teacher");
  const studentConversations = studentConversationsQuery.data ?? [];
  const { openConversation } = useMessagingPanel();

  const recentAssignmentsQuery = useQuery({
    queryKey: ["teacher-recent-assignments-home", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("teacher_recent_assignments", { p_limit: 8 });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        title: string;
        status: string;
        created_at: string;
        due_date: string | null;
        conversation_id: string;
        learner_name: string | null;
      }[];
    },
  });
  const recentAssignments = recentAssignmentsQuery.data ?? [];

  const bookings = bookingsQuery.data ?? [];
  const now = Date.now();
  const pending = bookings.filter((b) => b.status === "pending");
  const next = bookings.find(
    (b) => b.status === "accepted" && new Date(b.scheduled_at).getTime() > now,
  );
  const teacherOffers = offersQuery.data ?? [];
  const publishedOffers = teacherOffers.filter((o) => o.status === "published");

  const c = completenessQuery.data;
  const missing = c
    ? [
        !c.hasCv && "votre présentation",
        c.photos === 0 && "vos photos",
        c.experiences === 0 && "vos expériences",
        c.availabilities === 0 && "vos disponibilités",
      ].filter(Boolean)
    : [];

  if (bookingsQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  let title: string;
  if (pending.length > 0) {
    title = `Vous avez ${pending.length} nouvelle${pending.length > 1 ? "s" : ""} demande${
      pending.length > 1 ? "s" : ""
    } de cours`;
  } else if (next) {
    title = `Votre prochain cours : ${next.teacher_offers?.subjects?.name ?? "cours"} avec ${
      next.children?.first_name ?? "votre élève"
    }`;
  } else if (missing.length > 0) {
    title = "Complétez votre profil pour être plus visible";
  } else {
    title = "Aucun cours prévu — vérifiez vos disponibilités";
  }

  return (
    <div className="container-page py-8 sm:py-12">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {firstName ? `Bonjour ${firstName}` : "Espace professeur"}
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>

      <div className={`mt-6 ${CARD}`}>
        {pending.length > 0 ? (
          <>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-warning-soft text-warning">
              <Inbox className="size-5" aria-hidden />
            </span>
            <ul className="mt-4 space-y-3">
              {pending.slice(0, 4).map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {b.teacher_offers?.subjects?.name ?? "Cours"}
                      {b.children?.first_name ? ` · ${b.children.first_name}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatSlot(b.scheduled_at, b.duration_minutes)} ·{" "}
                      {formatLabel(b.format)}
                    </p>
                  </div>
                  <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-bold text-warning">
                    {countdown24h(b.created_at)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Sans réponse dans les 24 h, la demande est annulée automatiquement.
            </p>
            <div className="mt-5">
              <Link to="/pro/demandes" className={CTA}>
                Traiter les demandes
              </Link>
            </div>
          </>
        ) : next ? (
          <>
            <div className="flex items-start gap-4">
              <Avatar name={next.children?.first_name ?? "Élève"} />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">Prochaine séance</p>
                <p className="mt-0.5 font-display text-lg font-bold text-foreground">
                  {next.teacher_offers?.title ?? "Cours particulier"}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-4" aria-hidden />
                    {formatSlot(next.scheduled_at, next.duration_minutes)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {next.format === "online" ? (
                      <Laptop className="size-4" aria-hidden />
                    ) : (
                      <Home className="size-4" aria-hidden />
                    )}
                    {formatLabel(next.format)}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-5">
              <Link to="/pro/demandes" className={CTA}>
                Voir le planning
              </Link>
            </div>
          </>
        ) : missing.length > 0 ? (
          <>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
              <BadgeCheck className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">
              Il manque encore {missing.join(", ")} : les profils complets reçoivent nettement plus
              de demandes.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link to="/pro/profil" className={CTA}>
                Compléter mon profil
              </Link>
              <Link to="/pro/disponibilites" className={CTA2}>
                Mes disponibilités
              </Link>
            </div>
          </>
        ) : (
          <>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
              <CalendarClock className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">
              Vérifiez que vos créneaux hebdomadaires reflètent bien vos disponibilités réelles.
            </p>
            <div className="mt-5">
              <Link to="/pro/disponibilites" className={CTA}>
                Vérifier mes disponibilités
              </Link>
            </div>
          </>
        )}
      </div>

      <section className="mt-6 flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <Wallet className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">Solde de mon portefeuille</p>
            <p className="mt-0.5 font-display text-2xl font-bold text-foreground">
              {walletQuery.isLoading
                ? "…"
                : `${(walletQuery.data ?? 0).toLocaleString("fr-FR")} FCFA`}
            </p>
          </div>
        </div>
        <Link
          to="/compte/portefeuille"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Voir mon portefeuille
        </Link>
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-foreground">Tableau de bord</h2>
          <Link
            to="/pro"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Ouvrir l&apos;espace professeur
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">Offres créées</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">{teacherOffers.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">Offres publiées</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">
              {publishedOffers.length}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">Tarif le plus bas</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">
              {teacherOffers.length > 0
                ? `${Math.min(...teacherOffers.map((o) => o.price_fcfa)).toLocaleString("fr-FR")} F`
                : "—"}
            </p>
          </div>
        </div>
      </section>

      <HomeShortcutTabs
        tabs={[
          {
            key: "sessions",
            label: "Mes séances",
            to: "/pro/demandes",
            preview:
              pending.length > 0 || next ? (
                <ul className="space-y-1.5 text-sm text-foreground">
                  {pending.length > 0 && (
                    <li>
                      {pending.length} demande{pending.length > 1 ? "s" : ""} en attente de réponse.
                    </li>
                  )}
                  {next && (
                    <li className="truncate">
                      Prochaine séance : {next.teacher_offers?.subjects?.name ?? "Cours"} —{" "}
                      {new Date(next.scheduled_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune séance en cours.</p>
              ),
          },
          {
            key: "agenda",
            label: "Agenda",
            to: "/pro/disponibilites",
            preview:
              (c?.availabilities ?? 0) > 0 ? (
                <p className="text-sm text-foreground">
                  {c!.availabilities} créneau{c!.availabilities > 1 ? "x" : ""} hebdomadaire
                  {c!.availabilities > 1 ? "s" : ""} configuré{c!.availabilities > 1 ? "s" : ""}.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune disponibilité renseignée pour l'instant.
                </p>
              ),
          },
          {
            key: "students",
            label: "Mes élèves",
            to: "/pro/messages",
            preview: (
              <div className="space-y-4">
                {studentConversations.length > 0 ? (
                  <ul className="space-y-1.5 text-sm text-foreground">
                    {studentConversations.slice(0, 3).map((sc) => (
                      <li key={sc.id} className="truncate">
                        {sc.otherName}
                        {sc.children?.first_name ? ` · ${sc.children.first_name}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun élève contacté pour l'instant.</p>
                )}

                <div className={studentConversations.length > 0 ? "border-t border-border/60 pt-3" : ""}>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Devoirs récents
                  </p>
                  {recentAssignments.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {recentAssignments.slice(0, 4).map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => openConversation(a.conversation_id, "resources")}
                            className="flex w-full items-center justify-between gap-2 rounded-lg py-0.5 text-left text-sm text-foreground hover:text-primary"
                          >
                            <span className="min-w-0 truncate">
                              {a.title}
                              <span className="text-muted-foreground"> · {a.learner_name ?? "Élève"}</span>
                            </span>
                            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                              {ASSIGNMENT_STATUS_LABEL[a.status] ?? a.status}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Aucun devoir envoyé pour l'instant.
                    </p>
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />

      <div className="mt-8">
        <NotificationsFeed userId={userId} />
      </div>

      <TeacherTasksSection
        userId={userId}
        missingProfileItems={missing as string[]}
        hideProfileCard={pending.length === 0 && !next}
      />
    </div>
  );
}

/* ---------------- Admin ---------------- */

function AdminHome({ userId }: { userId: string }) {
  const statsQuery = useQuery({
    queryKey: ["admin-home-stats"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay.getTime() + 24 * 3600_000);

      const [pendingTeachers, disputes, todayBookings] = await Promise.all([
        supabase
          .from("teacher_profiles")
          .select("id", { count: "exact", head: true })
          .eq("verification_status", "pending"),
        supabase
          .from("disputes")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "investigating"]),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .gte("scheduled_at", startOfDay.toISOString())
          .lt("scheduled_at", endOfDay.toISOString()),
      ]);
      for (const r of [pendingTeachers, disputes, todayBookings]) {
        if (r.error) throw r.error;
      }
      return {
        pendingTeachers: pendingTeachers.count ?? 0,
        disputes: disputes.count ?? 0,
        todayBookings: todayBookings.count ?? 0,
      };
    },
  });

  const s = statsQuery.data;
  const cards = [
    {
      label: "Professeurs en attente de vérification",
      value: s?.pendingTeachers,
      to: "/admin/professeurs" as const,
      action: "Vérifier",
    },
    {
      label: "Litiges ouverts",
      value: s?.disputes,
      to: "/admin/litiges" as const,
      action: "Traiter",
    },
    {
      label: "Réservations du jour",
      value: s?.todayBookings,
      to: "/admin" as const,
      action: "Vue d'ensemble",
    },
  ];

  return (
    <div className="container-page py-8 sm:py-12">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Administration
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">
        Tableau de bord
      </h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className={CARD}>
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-1 font-display text-3xl font-bold text-foreground">
              {statsQuery.isLoading ? "…" : (c.value ?? 0).toLocaleString("fr-FR")}
            </p>
            <Link
              to={c.to}
              className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              {c.action}
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link to="/admin/professeurs" className={`${CARD} font-display font-bold text-foreground`}>
          Professeurs & vérifications
        </Link>
        <Link to="/admin/offres" className={`${CARD} font-display font-bold text-foreground`}>
          Modération des offres
        </Link>
      </div>

      <div className="mt-8">
        <NotificationsFeed userId={userId} />
      </div>

      <AdminAlertsSection />
    </div>
  );
}
