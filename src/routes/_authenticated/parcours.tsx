import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarClock, ChevronRight, ClipboardList, Loader2, Plus, Target } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ProgressBar, SectionHeading, StatTile } from "@/components/product-ui";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/parcours")({
  head: () => ({
    meta: [
      { title: "Mon parcours — BARA" },
      { name: "description", content: "Suivez vos matières, vos objectifs et vos séances avec BARA." },
      { property: "og:title", content: "Mon parcours — BARA" },
      { property: "og:description", content: "Suivez vos matières, vos objectifs et vos séances avec BARA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LearningJourneyPage,
});

const CARD = "rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]";

function LearningJourneyPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"subjects" | "goals">("subjects");
  const [goalDraft, setGoalDraft] = useState<string | null>(null);

  const dataQuery = useQuery({
    queryKey: ["adult-learning-journey", user.id],
    queryFn: async () => {
      const [roles, prefs, packs, bookings, assignments] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase
          .from("learning_preferences")
          .select("id, objective, subject_slugs, level_slugs")
          .eq("user_id", user.id)
          .eq("role_context", "learner")
          .maybeSingle(),
        supabase
          .from("packs")
          .select(
            "id, status, pack_slug, sessions_total, sessions_used, expires_at, teacher_id, pack_types(name), teacher_offers(title, subjects(name))",
          )
          .eq("buyer_id", user.id)
          .is("child_id", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select("id, scheduled_at, status, pack_id, teacher_offers(title, subjects(name))")
          .eq("requester_id", user.id)
          .is("child_id", null)
          .order("scheduled_at", { ascending: true }),
        supabase.from("assignments").select("id, title, status, due_date").neq("status", "done").limit(6),
      ]);
      for (const result of [roles, prefs, packs, bookings, assignments]) if (result.error) throw result.error;
      const teacherIds = [...new Set((packs.data ?? []).map((pack) => pack.teacher_id))].slice(0, 20);
      const names = new Map<string, string>();
      if (teacherIds.length) {
        const { data } = await supabase.from("profiles").select("user_id, display_name").in("user_id", teacherIds);
        for (const row of data ?? []) names.set(row.user_id, row.display_name);
      }
      return {
        roles: roles.data ?? [],
        prefs: prefs.data,
        packs: packs.data ?? [],
        bookings: bookings.data ?? [],
        assignments: assignments.data ?? [],
        teacherNames: names,
      };
    },
  });

  const saveGoal = useMutation({
    mutationFn: async (objective: string) => {
      const prefs = dataQuery.data?.prefs;
      if (prefs?.id) {
        const { error } = await supabase.from("learning_preferences").update({ objective }).eq("id", prefs.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("learning_preferences")
        .insert({ user_id: user.id, role_context: "learner", objective });
      if (error) throw error;
    },
    onSuccess: async () => {
      setGoalDraft(null);
      toast.success("Objectif enregistré");
      await queryClient.invalidateQueries({ queryKey: ["adult-learning-journey", user.id] });
    },
    onError: () => toast.error("Impossible d’enregistrer votre objectif"),
  });

  if (dataQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Chargement…
      </div>
    );
  }

  const data = dataQuery.data;
  if (!data?.roles.some((item) => item.role === "student")) {
    return (
      <div className="container-page py-14">
        <EmptyState
          icon={Target}
          title="Parcours réservé aux adultes apprenants"
          description="Les parents retrouvent le suivi de chaque enfant dans l’espace Mes enfants."
          action={
            <Link to="/accueil" className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
              Retour à l’accueil
            </Link>
          }
        />
      </div>
    );
  }

  const activePacks = data.packs.filter((pack) => pack.status === "active");
  const now = new Date();
  const upcoming = data.bookings.filter((booking) => booking.status === "accepted" && new Date(booking.scheduled_at) > now);
  const nextByPack = new Map<string, string>();
  for (const booking of upcoming) if (booking.pack_id && !nextByPack.has(booking.pack_id)) nextByPack.set(booking.pack_id, booking.scheduled_at);

  const objective = data.prefs?.objective ?? "";

  return (
    <main className="container-page py-5 pb-24 sm:py-10">
      <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">Mon parcours</h1>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <StatTile icon={BookOpen} value={activePacks.length} label={activePacks.length > 1 ? "matières suivies" : "matière suivie"} />
        <StatTile
          icon={CalendarClock}
          value={upcoming.length}
          label={upcoming.length > 1 ? "séances à venir" : "séance à venir"}
        />
        <StatTile icon={ClipboardList} value={data.assignments.length} label={data.assignments.length > 1 ? "travaux à faire" : "travail à faire"} />
      </div>

      <div className="mt-4 flex gap-2 rounded-2xl border border-border bg-card p-1">
        {(["subjects", "goals"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {value === "subjects" ? "Mes matières" : "Mes objectifs"}
          </button>
        ))}
      </div>

      {tab === "subjects" ? (
        <section className="mt-4 space-y-3">
          {activePacks.length ? (
            activePacks.map((pack) => {
              const left = Math.max(pack.sessions_total - pack.sessions_used, 0);
              const next = nextByPack.get(pack.id);
              return (
                <Link
                  key={pack.id}
                  to="/matiere/$packId"
                  params={{ packId: pack.id }}
                  className={`${CARD} block transition hover:border-primary/40`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                      <BookOpen className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-base font-bold text-foreground">
                        {pack.teacher_offers?.subjects?.name ?? pack.teacher_offers?.title ?? "Matière"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        Formule {pack.pack_types?.name ?? pack.pack_slug} · {data.teacherNames.get(pack.teacher_id) ?? "Intervenant"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-foreground">
                        {left} séance{left > 1 ? "s" : ""} restante{left > 1 ? "s" : ""}
                      </p>
                      {next && <p className="mt-0.5 text-xs text-muted-foreground">Prochain cours : {formatDate(next)}</p>}
                      <div className="mt-2.5">
                        <ProgressBar
                          value={(pack.sessions_used / Math.max(pack.sessions_total, 1)) * 100}
                          label={`Sur ${pack.sessions_total} séances`}
                        />
                      </div>
                    </div>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                </Link>
              );
            })
          ) : (
            <EmptyState
              icon={BookOpen}
              title="Aucune matière en cours"
              description="Choisissez un intervenant et une formule pour démarrer votre parcours."
              action={
                <Link to="/professeurs" className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
                  Rechercher un intervenant
                </Link>
              }
            />
          )}
          <Link
            to="/professeurs"
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" aria-hidden /> Ajouter une matière
          </Link>
        </section>
      ) : (
        <section className={`mt-4 ${CARD}`}>
          <SectionHeading title="Mon objectif" />
          <p className="mt-1 text-xs text-muted-foreground">Décrivez librement ce que vous voulez atteindre.</p>
          <textarea
            value={goalDraft ?? objective}
            onChange={(event) => setGoalDraft(event.target.value)}
            rows={4}
            placeholder="Ex. Améliorer mon anglais professionnel et gagner en fluidité à l’oral."
            className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={saveGoal.isPending || (goalDraft ?? objective).trim() === objective.trim()}
            onClick={() => saveGoal.mutate((goalDraft ?? objective).trim())}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saveGoal.isPending && <Loader2 className="size-4 animate-spin" />} Enregistrer
          </button>
        </section>
      )}
    </main>
  );
}
