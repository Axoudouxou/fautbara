import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell, useIsAdmin } from "@/components/admin-shell";
import { FAQ_CATEGORIES, sortCategories, type FaqEntry } from "@/lib/support";

export const Route = createFileRoute("/_authenticated/admin/aide")({
  head: () => ({
    meta: [
      { title: "Centre d'aide — Administration BARA" },
      {
        name: "description",
        content: "Créez, modifiez et réordonnez les questions du centre d'aide et du chatbot BARA.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHelpPage,
});

function AdminHelpPage() {
  const { user } = Route.useRouteContext();
  const adminQuery = useIsAdmin(user.id);
  const isAdmin = adminQuery.data ?? false;
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<string>(FAQ_CATEGORIES[0]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const faqQuery = useQuery({
    queryKey: ["admin-faq"],
    enabled: isAdmin,
    queryFn: async (): Promise<FaqEntry[]> => {
      const { data, error } = await supabase
        .from("faq_entries")
        .select("id, category, question, answer, sort_order, is_published, click_count")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FaqEntry[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-faq"] });
    queryClient.invalidateQueries({ queryKey: ["faq", "published"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const existing = (faqQuery.data ?? []).filter((e) => e.category === category);
      const nextOrder = existing.reduce((max, e) => Math.max(max, e.sort_order), 0) + 1;
      const { error } = await supabase.from("faq_entries").insert({
        category,
        question: question.trim(),
        answer: answer.trim(),
        sort_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setQuestion("");
      setAnswer("");
      toast.success("Question ajoutée");
      invalidate();
    },
    onError: (err) =>
      toast.error("Ajout impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Partial<Pick<FaqEntry, "question" | "answer" | "is_published" | "sort_order">>;
    }) => {
      const { error } = await supabase.from("faq_entries").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (err) =>
      toast.error("Modification impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("faq_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Question supprimée");
      invalidate();
    },
    onError: (err) =>
      toast.error("Suppression impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const entries = faqQuery.data ?? [];
  const categories = sortCategories(
    Array.from(new Set([...FAQ_CATEGORIES, ...entries.map((e) => e.category)])),
  );
  const topClicked = [...entries].sort((a, b) => b.click_count - a.click_count).slice(0, 5);

  const move = (entry: FaqEntry, direction: -1 | 1) => {
    const siblings = entries
      .filter((e) => e.category === entry.category)
      .sort((a, b) => a.sort_order - b.sort_order);
    const index = siblings.findIndex((e) => e.id === entry.id);
    const target = siblings[index + direction];
    if (!target) return;
    updateMutation.mutate({ id: entry.id, values: { sort_order: target.sort_order } });
    updateMutation.mutate({ id: target.id, values: { sort_order: entry.sort_order } });
  };

  return (
    <AdminShell
      userId={user.id}
      title="Centre d'aide"
      description="Questions du centre d'aide public et du chatbot. Toute modification est visible immédiatement, sans republication."
    >
      <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg font-bold text-foreground">Ajouter une question</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!question.trim() || !answer.trim()) {
              toast.error("Question et réponse obligatoires");
              return;
            }
            createMutation.mutate();
          }}
        >
          <select
            aria-label="Catégorie"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground sm:max-w-xs"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            aria-label="Question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Question"
            className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground"
          />
          <textarea
            aria-label="Réponse"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            placeholder="Réponse"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            Ajouter
          </button>
        </form>
      </section>

      {topClicked.some((e) => e.click_count > 0) && (
        <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-lg font-bold text-foreground">
            Questions les plus consultées dans le chatbot
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {topClicked
              .filter((e) => e.click_count > 0)
              .map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3">
                  <span className="text-foreground">{e.question}</span>
                  <span className="font-semibold">{e.click_count}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {faqQuery.isLoading && (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </p>
      )}

      <div className="mt-8 space-y-8">
        {categories
          .filter((c) => entries.some((e) => e.category === c))
          .map((c) => (
            <section key={c}>
              <h2 className="font-display text-lg font-bold text-foreground">{c}</h2>
              <ul className="mt-3 space-y-3">
                {entries
                  .filter((e) => e.category === c)
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((e) => (
                    <li
                      key={e.id}
                      className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
                    >
                      <input
                        aria-label="Question"
                        defaultValue={e.question}
                        onBlur={(event) => {
                          const value = event.target.value.trim();
                          if (value && value !== e.question)
                            updateMutation.mutate({ id: e.id, values: { question: value } });
                        }}
                        className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-semibold text-foreground"
                      />
                      <textarea
                        aria-label="Réponse"
                        defaultValue={e.answer}
                        rows={3}
                        onBlur={(event) => {
                          const value = event.target.value.trim();
                          if (value && value !== e.answer)
                            updateMutation.mutate({ id: e.id, values: { answer: value } });
                        }}
                        className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-muted-foreground"
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => move(e, -1)}
                          aria-label="Monter"
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                        >
                          <ArrowUp className="size-3.5" aria-hidden /> Monter
                        </button>
                        <button
                          type="button"
                          onClick={() => move(e, 1)}
                          aria-label="Descendre"
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                        >
                          <ArrowDown className="size-3.5" aria-hidden /> Descendre
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              id: e.id,
                              values: { is_published: !e.is_published },
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                        >
                          {e.is_published ? (
                            <>
                              <EyeOff className="size-3.5" aria-hidden /> Masquer
                            </>
                          ) : (
                            <>
                              <Eye className="size-3.5" aria-hidden /> Publier
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(e.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" aria-hidden /> Supprimer
                        </button>
                        {!e.is_published && (
                          <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                            Masquée
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
      </div>
    </AdminShell>
  );
}
