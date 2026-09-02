import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Home, Laptop, Loader2, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABELS, formatSlot, formatTimeRange } from "./compte.reservations";

export const Route = createFileRoute("/_authenticated/pro/cours")({
  head: () => ({
    meta: [
      { title: "Mes cours — espace intervenant BARA" },
      {
        name: "description",
        content: "Séances à venir, semaine en cours et élèves suivis dans votre espace intervenant BARA.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherCoursesPage,
});

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

type View = "sessions" | "week" | "students";

const VIEWS: { key: View; label: string }[] = [
  { key: "sessions", label: "Séances" },
  { key: "week", label: "Semaine" },
  { key: "students", label: "Élèves" },
];

function TeacherCoursesPage() {
  const { user } = Route.useRouteContext();
  const [view, setView] = useState<View>("sessions");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const rolesQuery = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as string);
    },
  });
  const isTeacher = rolesQuery.data?.includes("teacher") ?? false;

  const sessionsQuery = useQuery({
    queryKey: ["teacher-courses", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, price_fcfa, format, commune, status, requester_id, child_id, children(first_name, school_level), teacher_offers(title, subjects(name))",
        )
        .eq("teacher_id", user.id)
        .in("status", ["accepted", "completed", "no_show_parent", "no_show_teacher"])
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const sessions = sessionsQuery.data ?? [];
  const requesterIds = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.requester_id))),
    [sessions],
  );

  const namesQuery = useQuery({
    queryKey: ["teacher-courses-names", user.id, requesterIds.join(",")],
    enabled: isTeacher && requesterIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", requesterIds);
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.user_id, p.display_name]));
    },
  });
  const names = namesQuery.data ?? new Map<string, string>();

  if (rolesQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  if (!isTeacher) {
    return (
      <div className="container-page py-14">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <h1 className="font-display text-xl font-bold text-foreground">Espace intervenant</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cet espace est réservé aux comptes intervenants.
          </p>
          <Link
            to="/compte"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Retour à mon compte
          </Link>
        </div>
      </div>
    );
  }

  const now = Date.now();
  const upcoming = sessions.filter((s) => new Date(s.scheduled_at).getTime() >= now);
  const past = sessions
    .filter((s) => new Date(s.scheduled_at).getTime() < now)
    .sort((a, b) => (a.scheduled_at < b.scheduled_at ? 1 : -1));

  const weekEnd = addDays(weekStart, 7);
  const weekSessions = sessions.filter((s) => {
    const d = new Date(s.scheduled_at);
    return d >= weekStart && d < weekEnd;
  });

  const learnerLabel = (s: (typeof sessions)[number]) =>
    s.children?.first_name ?? names.get(s.requester_id) ?? "Élève";

  const students = new Map<
    string,
    { key: string; label: string; level: string | null; total: number; next: string | null }
  >();
  for (const s of sessions) {
    const key = s.child_id ?? s.requester_id;
    const existing = students.get(key);
    const isFuture = new Date(s.scheduled_at).getTime() >= now;
    if (existing) {
      existing.total += 1;
      if (isFuture && (!existing.next || s.scheduled_at < existing.next)) existing.next = s.scheduled_at;
    } else {
      students.set(key, {
        key,
        label: learnerLabel(s),
        level: s.children?.school_level ?? null,
        total: 1,
        next: isFuture ? s.scheduled_at : null,
      });
    }
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Mes cours</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Vos séances confirmées, votre semaine en cours et les élèves que vous accompagnez.
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Vue des cours">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
              view === v.key
                ? "border-primary bg-primary-soft/50 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {sessionsQuery.isLoading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </div>
      )}

      {!sessionsQuery.isLoading && sessions.length === 0 && (
        <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <p className="font-display text-lg font-bold text-foreground">Aucune séance confirmée</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Les séances apparaissent ici dès que vous acceptez une demande.
          </p>
          <Link
            to="/pro/demandes"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Voir les demandes
          </Link>
        </div>
      )}

      {!sessionsQuery.isLoading && sessions.length > 0 && view === "sessions" && (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">À venir</h2>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Aucune séance à venir.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {upcoming.map((s) => (
                  <SessionCard key={s.id} session={s} learner={learnerLabel(s)} />
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Historique</h2>
            {past.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Aucune séance passée.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {past.map((s) => (
                  <SessionCard key={s.id} session={s} learner={learnerLabel(s)} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {!sessionsQuery.isLoading && sessions.length > 0 && view === "week" && (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              Semaine précédente
            </button>
            <p className="text-sm font-semibold text-foreground">
              {weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} –{" "}
              {addDays(weekStart, 6).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
            </p>
            <button
              type="button"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              Semaine suivante
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-7">
            {WEEKDAYS.map((label, index) => {
              const day = addDays(weekStart, index);
              const daySessions = weekSessions.filter((s) => {
                const d = new Date(s.scheduled_at);
                return d.toDateString() === day.toDateString();
              });
              return (
                <div key={label} className="rounded-2xl border border-border bg-card p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {label} {day.getDate()}
                  </p>
                  {daySessions.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">—</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {daySessions.map((s) => (
                        <li key={s.id} className="rounded-xl bg-primary-soft/40 p-2">
                          <p className="text-xs font-bold text-primary">
                            {formatTimeRange(s.scheduled_at, s.duration_minutes)}
                          </p>
                          <p className="mt-0.5 text-xs text-foreground">{learnerLabel(s)}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.teacher_offers?.subjects?.name ?? s.teacher_offers?.title ?? ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!sessionsQuery.isLoading && sessions.length > 0 && view === "students" && (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {Array.from(students.values()).map((s) => (
            <li
              key={s.key}
              className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <Users className="size-4" aria-hidden />
              </span>
              <p className="mt-3 font-display font-bold text-foreground">{s.label}</p>
              {s.level && <p className="text-xs text-muted-foreground">{s.level}</p>}
              <p className="mt-2 text-sm text-muted-foreground">
                {s.total} séance{s.total > 1 ? "s" : ""} au total
                {s.next ? ` · prochaine le ${formatSlot(s.next)}` : ""}
              </p>
              <Link
                to="/pro/messages"
                className="mt-4 inline-flex rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                Ouvrir la conversation
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SessionCard({
  session,
  learner,
}: {
  session: {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    price_fcfa: number;
    format: string;
    commune: string | null;
    status: string;
    teacher_offers: { title: string; subjects: { name: string } | null } | null;
  };
  learner: string;
}) {
  const status = STATUS_LABELS[session.status] ?? {
    label: session.status,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <li className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            {session.teacher_offers?.subjects?.name ?? "Cours"}
          </p>
          <p className="mt-1 font-display text-lg font-bold text-foreground">
            {session.teacher_offers?.title ?? "Séance"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{learner}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
          {status.label}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4" aria-hidden /> {formatSlot(session.scheduled_at)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {session.format === "online" ? (
            <Laptop className="size-4" aria-hidden />
          ) : (
            <Home className="size-4" aria-hidden />
          )}
          {session.format === "online" ? "En ligne" : (session.commune ?? "À domicile")}
        </span>
        <span>{session.price_fcfa.toLocaleString("fr-FR")} FCFA</span>
      </div>
    </li>
  );
}
