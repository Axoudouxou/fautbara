import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BookOpen, CalendarClock, ChevronRight, Home, Laptop, Loader2 } from "lucide-react";

import { EmptyState, SectionHeading } from "@/components/product-ui";
import { TeacherGate } from "@/components/teacher-gate";
import { supabase } from "@/integrations/supabase/client";
import { SESSION_STATUS_LABELS } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/pro/seances/")({
  head: () => ({
    meta: [
      { title: "Séances à mettre à jour — BARA" },
      {
        name: "description",
        content: "Vos séances passées sans statut renseigné, à mettre à jour avant le compte-rendu.",
      },
      { property: "og:title", content: "Séances à mettre à jour — BARA" },
      {
        property: "og:description",
        content: "Vos séances passées sans statut renseigné, à mettre à jour avant le compte-rendu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherSessionsPage,
});

const CARD = "rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]";

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function timeRange(iso: string, minutes: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + minutes * 60_000);
  const fmt = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} - ${fmt(end)}`;
}

function TeacherSessionsPage() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<"todo" | "upcoming" | "past">("todo");

  const sessionsQuery = useQuery({
    queryKey: ["teacher-sessions-status", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, status, format, commune, requester_id, child_id, children(first_name), teacher_offers(title, subjects(name))",
        )
        .eq("teacher_id", user.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;

      const learnerIds = Array.from(new Set((data ?? []).map((b) => b.requester_id)));
      const names = new Map<string, string>();
      if (learnerIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", learnerIds);
        for (const p of profiles ?? []) names.set(p.user_id, p.display_name);
      }
      return (data ?? []).map((b) => ({
        ...b,
        learnerName: b.children?.first_name ?? names.get(b.requester_id) ?? "Apprenant",
      }));
    },
  });

  const sessions = sessionsQuery.data ?? [];
  const now = Date.now();
  // « À mettre à jour » = séance passée dont le statut n'a pas encore été renseigné.
  const todo = sessions.filter((s) => s.status === "accepted" && new Date(s.scheduled_at).getTime() < now);
  const upcoming = sessions
    .filter((s) => s.status === "accepted" && new Date(s.scheduled_at).getTime() >= now)
    .reverse();
  const past = sessions.filter((s) => s.status !== "accepted" && s.status !== "pending");

  const lists = { todo, upcoming, past } as const;
  const current = lists[tab];

  return (
    <TeacherGate userId={user.id}>
      <main className="container-page py-5 pb-24 sm:py-10">
        <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">
          Séances à mettre à jour
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {todo.length > 0
            ? `${todo.length} séance${todo.length > 1 ? "s" : ""} ${todo.length > 1 ? "sont" : "est"} passée${todo.length > 1 ? "s" : ""} et ${todo.length > 1 ? "attendent" : "attend"} votre mise à jour.`
            : "Toutes vos séances passées ont un statut renseigné."}
        </p>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
          {(
            [
              { id: "todo", label: `À mettre à jour (${todo.length})` },
              { id: "upcoming", label: "À venir" },
              { id: "past", label: "Passées" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === item.id
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "todo" && todo.length > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <p className="text-sm text-foreground">
              Ces séances sont passées et n’ont pas encore leur statut renseigné. Mettez le statut à
              jour pour pouvoir rédiger le compte-rendu.
            </p>
          </div>
        )}

        {sessionsQuery.isLoading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
          </p>
        ) : current.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={CalendarClock}
              title={
                tab === "todo"
                  ? "Rien à mettre à jour"
                  : tab === "upcoming"
                    ? "Aucune séance à venir"
                    : "Aucune séance passée"
              }
              description="Vos séances programmées par les familles apparaissent ici."
              action={
                <Link
                  to="/pro/agenda"
                  className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                >
                  Voir mon agenda
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className="mt-5">
              <SectionHeading title={`${current.length} séance${current.length > 1 ? "s" : ""}`} />
            </div>
            <ul className="mt-2 space-y-2.5">
              {current.map((s) => {
                const status = SESSION_STATUS_LABELS[s.status];
                return (
                  <li key={s.id} className={CARD}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
                          <BookOpen className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-display text-sm font-bold text-foreground">
                            {s.teacher_offers?.subjects?.name ?? s.teacher_offers?.title ?? "Cours"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{s.learnerName}</p>
                        </div>
                      </div>
                      {status && tab !== "todo" && (
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      )}
                    </div>

                    <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                        <span>{dayLabel(s.scheduled_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3.5" aria-hidden />
                        <span>{timeRange(s.scheduled_at, s.duration_minutes)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.format === "online" ? (
                          <Laptop className="size-3.5 shrink-0" aria-hidden />
                        ) : (
                          <Home className="size-3.5 shrink-0" aria-hidden />
                        )}
                        <span>
                          {s.format === "online" ? "En ligne" : `À domicile${s.commune ? ` · ${s.commune}` : ""}`}
                        </span>
                      </div>
                    </dl>

                    <Link
                      to="/pro/seances/$bookingId"
                      params={{ bookingId: s.id }}
                      className="mt-3 flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {tab === "todo" ? "Mettre à jour le statut" : "Ouvrir la séance"}
                      <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </TeacherGate>
  );
}
