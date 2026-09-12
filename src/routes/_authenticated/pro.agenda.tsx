import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Home, Laptop, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { EmptyState, SectionHeading, StatTile } from "@/components/product-ui";
import { TeacherGate } from "@/components/teacher-gate";
import { SESSION_STATUS_LABELS } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/pro/agenda")({
  head: () => ({
    meta: [
      { title: "Mon agenda — espace intervenant BARA" },
      {
        name: "description",
        content: "Votre semaine de cours particuliers sur BARA : séances, élèves, lieux et horaires.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherAgendaPage,
});

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function timeRange(iso: string, minutes: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + minutes * 60_000);
  const fmt = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} → ${fmt(end)}`;
}

function TeacherAgendaPage() {
  const { user } = Route.useRouteContext();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const weekEnd = addDays(weekStart, 7);

  const sessionsQuery = useQuery({
    queryKey: ["teacher-agenda", user.id, weekStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, status, format, commune, requester_id, children(first_name), teacher_offers(subjects(name))",
        )
        .eq("teacher_id", user.id)
        .in("status", ["accepted", "completed", "no_show_parent", "no_show_teacher"])
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString())
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
    queryKey: ["teacher-agenda-names", user.id, requesterIds.join(",")],
    enabled: requesterIds.length > 0,
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

  const days = WEEKDAYS.map((label, index) => {
    const date = addDays(weekStart, index);
    return {
      label,
      date,
      items: sessions.filter(
        (s) => new Date(s.scheduled_at).toDateString() === date.toDateString(),
      ),
    };
  });

  const minutes = sessions.reduce((sum, s) => sum + s.duration_minutes, 0);
  const rangeLabel = `${weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} – ${addDays(
    weekStart,
    6,
  ).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;

  return (
    <TeacherGate userId={user.id}>
      <div className="container-page py-6 sm:py-10">
        <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">Mon agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">Vos séances confirmées, semaine par semaine.</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile icon={CalendarDays} value={sessions.length} label="Séances cette semaine" />
          <StatTile icon={CalendarDays} value={`${Math.round(minutes / 60)} h`} label="Heures de cours" />
          <StatTile
            icon={CalendarDays}
            value={sessions.filter((s) => s.status === "completed").length}
            label="Déjà réalisées"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-2 py-2">
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Semaine précédente"
            className="flex size-9 items-center justify-center rounded-full border border-border text-foreground hover:bg-secondary"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="font-display text-sm font-bold text-foreground"
          >
            {rangeLabel}
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Semaine suivante"
            className="flex size-9 items-center justify-center rounded-full border border-border text-foreground hover:bg-secondary"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>

        {sessionsQuery.isLoading && (
          <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
          </p>
        )}

        {!sessionsQuery.isLoading && sessions.length === 0 && (
          <div className="mt-5">
            <EmptyState
              icon={CalendarDays}
              title="Aucune séance cette semaine"
              description="Renseignez vos disponibilités pour que les familles programment leurs séances."
              action={
                <Link
                  to="/pro/disponibilites"
                  className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Mes disponibilités
                </Link>
              }
            />
          </div>
        )}

        {sessions.length > 0 && (
          <div className="mt-5 space-y-4">
            {days
              .filter((d) => d.items.length > 0)
              .map((day) => (
                <section key={day.label}>
                  <SectionHeading title={`${day.label} ${day.date.getDate()}`} />
                  <ul className="mt-2 space-y-2">
                    {day.items.map((s) => {
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
                              <p className="font-display text-sm font-bold text-foreground">
                                {timeRange(s.scheduled_at, s.duration_minutes)}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {s.teacher_offers?.subjects?.name ?? "Cours"} ·{" "}
                                {s.children?.first_name ?? names.get(s.requester_id) ?? "Élève"}
                              </p>
                              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                                {s.format === "online" ? (
                                  <>
                                    <Laptop className="size-3.5" aria-hidden /> En ligne
                                  </>
                                ) : (
                                  <>
                                    <Home className="size-3.5" aria-hidden /> {s.commune ?? "À domicile"}
                                  </>
                                )}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </div>
    </TeacherGate>
  );
}
