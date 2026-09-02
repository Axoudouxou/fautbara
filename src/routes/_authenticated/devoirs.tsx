import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ClipboardList, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/devoirs")({
  head: () => ({
    meta: [
      { title: "Mes devoirs — BARA" },
      {
        name: "description",
        content: "Retrouvez les devoirs donnés par vos intervenants et leur échéance.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomeworkPage,
});

const STATUS: Record<string, { label: string; className: string }> = {
  sent: { label: "À faire", className: "bg-warning-soft text-warning" },
  seen: { label: "Vu", className: "bg-primary-soft text-primary-soft-foreground" },
  done: { label: "Rendu", className: "bg-success-soft text-success" },
};

function HomeworkPage() {
  const { user } = Route.useRouteContext();

  const homeworkQuery = useQuery({
    queryKey: ["my-homework", user.id],
    queryFn: async () => {
      // Les politiques d'accès limitent déjà les conversations visibles.
      const { data: convs, error: convErr } = await supabase
        .from("conversations")
        .select("id, teacher_id");
      if (convErr) throw convErr;
      const convIds = (convs ?? []).map((c) => c.id);
      if (convIds.length === 0) return [];

      const { data, error } = await supabase
        .from("assignments")
        .select("id, title, description, due_date, status, created_at, conversation_id, teacher_id")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const teacherIds = Array.from(new Set((data ?? []).map((a) => a.teacher_id)));
      const names = new Map<string, string>();
      if (teacherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", teacherIds);
        for (const p of profiles ?? []) names.set(p.user_id, p.display_name);
      }

      return (data ?? []).map((a) => ({
        ...a,
        teacherName: names.get(a.teacher_id) ?? "Votre intervenant",
      }));
    },
  });

  const homework = homeworkQuery.data ?? [];
  const todo = homework.filter((h) => h.status !== "done");
  const done = homework.filter((h) => h.status === "done");

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Mes devoirs</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Les devoirs envoyés par vos intervenants dans la messagerie, avec leur échéance.
      </p>

      {homeworkQuery.isLoading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </div>
      )}

      {!homeworkQuery.isLoading && homework.length === 0 && (
        <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <p className="font-display text-lg font-bold text-foreground">Aucun devoir pour le moment</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Les devoirs apparaîtront ici dès qu&apos;un intervenant vous en enverra un.
          </p>
          <Link
            to="/messages"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Ouvrir mes messages
          </Link>
        </div>
      )}

      {[
        { title: "À faire", items: todo },
        { title: "Rendus", items: done },
      ].map((group) =>
        group.items.length === 0 ? null : (
          <section key={group.title} className="mt-8">
            <h2 className="font-display text-lg font-bold text-foreground">{group.title}</h2>
            <ul className="mt-4 space-y-4">
              {group.items.map((h) => {
                const status = STATUS[h.status] ?? {
                  label: h.status,
                  className: "bg-muted text-muted-foreground",
                };
                return (
                  <li
                    key={h.id}
                    className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                          <ClipboardList className="size-4" aria-hidden />
                        </span>
                        <p className="mt-3 font-display text-lg font-bold text-foreground">{h.title}</p>
                        <p className="text-xs text-muted-foreground">{h.teacherName}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    {h.description && (
                      <p className="mt-3 whitespace-pre-line text-sm text-foreground">{h.description}</p>
                    )}
                    {h.due_date && (
                      <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarClock className="size-4" aria-hidden /> À rendre le{" "}
                        {new Date(`${h.due_date}T00:00:00`).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                        })}
                      </p>
                    )}
                    <Link
                      to="/messages"
                      className="mt-4 inline-flex rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                    >
                      Ouvrir la conversation
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}
