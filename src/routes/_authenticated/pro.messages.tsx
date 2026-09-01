import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ConversationPanel } from "@/components/conversation-panel";
import { ensureConversation, initials, useConversations } from "@/lib/messaging";

export const Route = createFileRoute("/_authenticated/pro/messages")({
  head: () => ({
    meta: [
      { title: "Messagerie professeur — BARA" },
      {
        name: "description",
        content:
          "Échangez avec vos élèves BARA, envoyez des devoirs et suivez leur avancement élève par élève.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherMessages,
});

type Pair = {
  learnerId: string;
  childId: string | null;
  childName: string | null;
  learnerName: string;
  subjects: string[];
};

function TeacherMessages() {
  const { user } = Route.useRouteContext();
  const [activeId, setActiveId] = useState<string | null>(null);

  const conversationsQuery = useConversations(user.id, "teacher");
  const conversations = conversationsQuery.data ?? [];

  const pairsQuery = useQuery({
    queryKey: ["teacher-pairs", user.id],
    queryFn: async (): Promise<Pair[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("requester_id, child_id, children(first_name), teacher_offers(subjects(name))")
        .eq("teacher_id", user.id)
        .in("status", ["accepted", "completed"]);
      if (error) throw error;
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.requester_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
      const map = new Map<string, Pair>();
      for (const r of rows) {
        const key = `${r.requester_id}:${r.child_id ?? ""}`;
        const subject =
          (r.teacher_offers as { subjects: { name: string } | null } | null)?.subjects?.name ?? null;
        const existing = map.get(key);
        if (existing) {
          if (subject && !existing.subjects.includes(subject)) existing.subjects.push(subject);
          continue;
        }
        map.set(key, {
          learnerId: r.requester_id,
          childId: r.child_id,
          childName: (r.children as { first_name: string } | null)?.first_name ?? null,
          learnerName: nameById.get(r.requester_id) ?? "Élève sans nom renseigné",
          subjects: subject ? [subject] : [],
        });
      }
      return Array.from(map.values());
    },
  });

  const openPair = useMutation({
    mutationFn: async (p: Pair) =>
      ensureConversation({ teacherId: user.id, learnerId: p.learnerId, childId: p.childId }),
    onSuccess: async (conv) => {
      await conversationsQuery.refetch();
      setActiveId(conv?.id ?? null);
    },
    onError: (e: Error) => toast.error(e.message || "Impossible d'ouvrir la conversation"),
  });

  const subjectsFor = (learnerId: string, childId: string | null) =>
    pairsQuery.data?.find((p) => p.learnerId === learnerId && (p.childId ?? "") === (childId ?? ""))
      ?.subjects ?? [];

  const missingPairs = useMemo(() => {
    const existing = new Set(conversations.map((c) => `${c.learner_id}:${c.child_id ?? ""}`));
    return (pairsQuery.data ?? []).filter(
      (p) => !existing.has(`${p.learnerId}:${p.childId ?? ""}`),
    );
  }, [conversations, pairsQuery.data]);

  useEffect(() => {
    if (!activeId && conversations.length > 0) setActiveId(conversations[0]!.id);
  }, [activeId, conversations]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="container-page py-8 sm:py-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          Messagerie &amp; devoirs
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Une conversation par élève. Convenez de la logistique et envoyez des devoirs structurés.
        </p>
      </div>

      {(conversationsQuery.isLoading || pairsQuery.isLoading) && (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </p>
      )}

      {!conversationsQuery.isLoading &&
        !pairsQuery.isLoading &&
        (conversationsQuery.isError || pairsQuery.isError) && (
          <div className="mt-8 rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <AlertTriangle className="mx-auto size-6 text-destructive" aria-hidden />
            <p className="mt-3 font-display text-lg font-bold text-foreground">
              Impossible de charger la messagerie
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Une erreur réseau ou de connexion a empêché le chargement de vos élèves. Vérifiez
              votre connexion et réessayez.
            </p>
            <button
              onClick={() => {
                if (conversationsQuery.isError) conversationsQuery.refetch();
                if (pairsQuery.isError) pairsQuery.refetch();
              }}
              className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Réessayer
            </button>
          </div>
        )}

      {!conversationsQuery.isLoading &&
        !pairsQuery.isLoading &&
        !conversationsQuery.isError &&
        !pairsQuery.isError &&
        conversations.length === 0 &&
        missingPairs.length === 0 && (
          <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <MessageSquare className="mx-auto size-6 text-primary" aria-hidden />
            <p className="mt-3 font-display text-lg font-bold text-foreground">
              Aucune conversation pour l&apos;instant
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              La messagerie s&apos;ouvre dès que vous acceptez une demande de cours.
            </p>
            <Link
              to="/pro/demandes"
              className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Voir mes demandes
            </Link>
          </div>
        )}

      {!conversationsQuery.isError && !pairsQuery.isError && (conversations.length > 0 || missingPairs.length > 0) && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-3">
            {conversations.map((c) => {
              const subjects = subjectsFor(c.learner_id, c.child_id);
              const label = c.children?.first_name ?? c.otherName;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                    activeId === c.id
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                    {initials(label)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{label}</span>
                      {c.unread > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {c.unread}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {subjects.length > 0 ? subjects.join(", ") : "Cours particuliers"}
                    </span>
                    {c.children?.first_name && (
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        Famille {c.otherName}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}

            {missingPairs.map((p) => (
              <button
                key={`${p.learnerId}:${p.childId ?? ""}`}
                onClick={() => openPair.mutate(p)}
                disabled={openPair.isPending}
                className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-border p-3.5 text-left text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
              >
                <Plus className="size-4 text-primary" aria-hidden />
                <span className="min-w-0 truncate">
                  Démarrer avec {p.childName ?? p.learnerName}
                </span>
              </button>
            ))}
          </aside>

          {active ? (
            <ConversationPanel
              key={active.id}
              conversationId={active.id}
              role="teacher"
              userId={user.id}
              teacherId={active.teacher_id}
              learnerId={active.learner_id}
              childId={active.child_id}
              title={active.children?.first_name ?? active.otherName}
              subtitle={
                subjectsFor(active.learner_id, active.child_id).join(", ") ||
                `Responsable : ${active.otherName}`
              }
              learnerLabel={active.children?.first_name ?? active.otherName}
              childAuthUserId={active.children?.auth_user_id ?? null}
            />
          ) : (
            <div className="rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground">
              Sélectionnez un élève.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
