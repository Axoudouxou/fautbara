import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { EmptyState, SectionHeading, StatTile, UserAvatar } from "@/components/product-ui";
import { TeacherGate } from "@/components/teacher-gate";

export const Route = createFileRoute("/_authenticated/pro/eleves/")({
  head: () => ({
    meta: [
      { title: "Mes élèves — espace intervenant BARA" },
      {
        name: "description",
        content:
          "Retrouvez les élèves que vous accompagnez sur BARA, leurs séances et leur suivi pédagogique.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherStudentsPage,
});

type Filter = "all" | "active";

function TeacherStudentsPage() {
  const { user } = Route.useRouteContext();
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const sessionsQuery = useQuery({
    queryKey: ["teacher-students", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, status, requester_id, child_id, children(first_name, school_level), teacher_offers(subjects(name))",
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
    queryKey: ["teacher-students-names", user.id, requesterIds.join(",")],
    enabled: requesterIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", requesterIds);
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.user_id, p]));
    },
  });
  const profiles = namesQuery.data ?? new Map();

  const now = Date.now();
  const students = useMemo(() => {
    const map = new Map<
      string,
      {
        learnerId: string;
        childId: string | null;
        name: string;
        avatar: string | null;
        level: string | null;
        subjects: Set<string>;
        done: number;
        next: string | null;
      }
    >();
    for (const s of sessions) {
      const key = `${s.requester_id}:${s.child_id ?? ""}`;
      const profile = profiles.get(s.requester_id);
      const entry =
        map.get(key) ??
        {
          learnerId: s.requester_id,
          childId: s.child_id,
          name: s.children?.first_name ?? profile?.display_name ?? "Élève",
          avatar: s.child_id ? null : (profile?.avatar_url ?? null),
          level: s.children?.school_level ?? null,
          subjects: new Set<string>(),
          done: 0,
          next: null as string | null,
        };
      const subject = s.teacher_offers?.subjects?.name;
      if (subject) entry.subjects.add(subject);
      if (s.status === "completed") entry.done += 1;
      const time = new Date(s.scheduled_at).getTime();
      if (s.status === "accepted" && time >= now && (!entry.next || s.scheduled_at < entry.next)) {
        entry.next = s.scheduled_at;
      }
      map.set(key, entry);
    }
    return Array.from(map.values());
  }, [sessions, profiles, now]);

  const visible = students
    .filter((s) => (filter === "active" ? Boolean(s.next) : true))
    .filter((s) => s.name.toLowerCase().includes(term.trim().toLowerCase()));

  if (sessionsQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  return (
    <TeacherGate userId={user.id}>
      <div className="container-page py-6 sm:py-10">
        <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">Mes élèves</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les apprenants que vous accompagnez, avec leur suivi et leur prochaine séance.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile icon={Users} value={students.length} label="Élèves suivis" />
          <StatTile
            icon={Users}
            value={students.filter((s) => s.next).length}
            label="Séance à venir"
          />
          <StatTile
            icon={Users}
            value={students.reduce((sum, s) => sum + s.done, 0)}
            label="Séances réalisées"
          />
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Rechercher un élève"
            aria-label="Rechercher un élève"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-3 flex gap-2">
          {([
            { key: "all", label: "Tous" },
            { key: "active", label: "Séance à venir" },
          ] as { key: Filter; label: string }[]).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.key
                  ? "border-primary bg-primary-soft/50 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <SectionHeading title={`${visible.length} élève${visible.length > 1 ? "s" : ""}`} />
          {visible.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon={Users}
                title="Aucun élève pour le moment"
                description="Vos élèves apparaissent ici dès qu'une séance est programmée avec vous."
                action={
                  <Link
                    to="/pro/demandes"
                    className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Voir mes demandes
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {visible.map((s) => (
                <li key={`${s.learnerId}:${s.childId ?? ""}`}>
                  <Link
                    to="/pro/eleves/$learnerId"
                    params={{ learnerId: s.learnerId }}
                    search={s.childId ? { enfant: s.childId } : {}}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/40"
                  >
                    <UserAvatar name={s.name} src={s.avatar} className="size-10 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-bold text-foreground">
                        {s.name}
                        {s.level ? <span className="font-sans text-xs font-semibold text-muted-foreground"> · {s.level}</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {Array.from(s.subjects).join(", ") || "Cours"} · {s.done} séance
                        {s.done > 1 ? "s" : ""} réalisée{s.done > 1 ? "s" : ""}
                      </p>
                      {s.next && (
                        <p className="truncate text-xs font-semibold text-primary">
                          Prochaine :{" "}
                          {new Date(s.next).toLocaleString("fr-FR", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </TeacherGate>
  );
}
