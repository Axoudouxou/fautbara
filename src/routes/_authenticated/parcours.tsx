import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  Laptop,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Pencil,
  Target,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState, UserAvatar } from "@/components/product-ui";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LEARNING_OBJECTIVES, learningObjectiveLabel, type LearningObjective } from "@/lib/education";
import { ensureConversation } from "@/lib/messaging";

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

type Filter = "active" | "completed" | "all";

function formatCourseDay(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatCourseTime(iso: string, duration: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + duration * 60_000);
  const format = (date: Date) => date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${format(start)} – ${format(end)}`;
}

function LearningJourneyPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("active");
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [goalDraft, setGoalDraft] = useState<LearningObjective | null>(null);

  const dataQuery = useQuery({
    queryKey: ["adult-learning-journey", user.id],
    queryFn: async () => {
      const [roles, prefs, packs, bookings] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase
          .from("learning_preferences")
          .select("id, objective")
          .eq("user_id", user.id)
          .eq("role_context", "learner")
          .maybeSingle(),
        supabase
          .from("packs")
          .select(
            "id, status, pack_slug, sessions_total, sessions_used, expires_at, teacher_id, format, commune, pack_types(name), teacher_offers(title, subjects(name))",
          )
          .eq("buyer_id", user.id)
          .is("child_id", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select("id, scheduled_at, duration_minutes, status, pack_id, format, commune")
          .eq("requester_id", user.id)
          .is("child_id", null)
          .order("scheduled_at", { ascending: true }),
      ]);
      for (const result of [roles, prefs, packs, bookings]) if (result.error) throw result.error;

      const teacherIds = [...new Set((packs.data ?? []).map((pack) => pack.teacher_id))];
      const teachers = new Map<string, { display_name: string; avatar_url: string | null }>();
      if (teacherIds.length) {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", teacherIds);
        if (error) throw error;
        const paths = (data ?? []).map((teacher) => teacher.avatar_url).filter((path): path is string => Boolean(path));
        const signedByPath = new Map<string, string>();
        if (paths.length) {
          const { data: signed } = await supabase.storage.from("teacher-photos").createSignedUrls(paths, 3600);
          for (const [index, entry] of (signed ?? []).entries()) {
            const path = paths[index];
            if (path && entry.signedUrl) signedByPath.set(path, entry.signedUrl);
          }
        }
        for (const teacher of data ?? []) {
          teachers.set(teacher.user_id, {
            display_name: teacher.display_name,
            avatar_url: teacher.avatar_url ? signedByPath.get(teacher.avatar_url) ?? null : null,
          });
        }
      }

      return {
        roles: roles.data ?? [],
        prefs: prefs.data,
        packs: packs.data ?? [],
        bookings: bookings.data ?? [],
        teachers,
      };
    },
  });

  const saveGoal = useMutation({
    mutationFn: async (objective: LearningObjective) => {
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
      setShowGoalEditor(false);
      toast.success("Objectif enregistré");
      await queryClient.invalidateQueries({ queryKey: ["adult-learning-journey", user.id] });
    },
    onError: () => toast.error("Impossible d’enregistrer votre objectif"),
  });

  const contactTeacher = useMutation({
    mutationFn: (teacherId: string) => ensureConversation({ teacherId }),
    onSuccess: (conversation) => navigate({ to: "/messages", search: { conversation: conversation.id } }),
    onError: () => toast.error("Impossible d’ouvrir la conversation"),
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
            <Button asChild className="h-11 rounded-xl px-5">
              <Link to="/accueil">Retour à l’accueil</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const activePacks = data.packs.filter((pack) => pack.status === "active");
  const completedPacks = data.packs.filter((pack) => ["completed", "expired"].includes(pack.status));
  const journeyPacks = data.packs.filter((pack) => ["active", "completed", "expired"].includes(pack.status));
  const visiblePacks = filter === "active" ? activePacks : filter === "completed" ? completedPacks : journeyPacks;
  const objective = data.prefs?.objective ?? null;
  const selectedGoal = goalDraft ?? (objective as LearningObjective | null);
  const now = new Date();

  return (
    <main className="container-page max-w-6xl py-5 pb-28 sm:py-10">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Mon parcours</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Mes objectifs. Mes cours. Ma progression.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Modifier mon objectif"
            aria-label="Modifier mon objectif"
            className="size-10 rounded-xl"
            onClick={() => setShowGoalEditor((open) => !open)}
          >
            <Pencil aria-hidden />
          </Button>
          <Button asChild variant="secondary" className="h-10 rounded-xl px-3 text-xs sm:h-11 sm:px-4 sm:text-sm">
            <Link to="/professeurs">Ajouter un parcours</Link>
          </Button>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-3 gap-2" role="group" aria-label="Filtrer les parcours">
        {([
          ["active", `En cours (${activePacks.length})`],
          ["completed", `Terminés (${completedPacks.length})`],
          ["all", `Tous (${journeyPacks.length})`],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={filter === value ? "default" : "secondary"}
            onClick={() => setFilter(value)}
            className="h-10 min-w-0 rounded-xl px-2 text-xs sm:text-sm"
          >
            <span className="truncate">{label}</span>
          </Button>
        ))}
      </div>

      {showGoalEditor && (
        <section className="mt-4 rounded-2xl border border-border bg-card px-4 py-4 shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-bold text-foreground">Mon objectif</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Choisissez votre priorité actuelle.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowGoalEditor(false)}>Fermer</Button>
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {LEARNING_OBJECTIVES.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  variant={selectedGoal === item.value ? "secondary" : "outline"}
                  aria-pressed={selectedGoal === item.value}
                  onClick={() => setGoalDraft(item.value)}
                  className="h-auto min-h-10 justify-start whitespace-normal rounded-xl px-3 py-2 text-left text-xs"
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              disabled={saveGoal.isPending || !goalDraft || goalDraft === objective}
              onClick={() => goalDraft && saveGoal.mutate(goalDraft)}
              className="mt-3 h-10 rounded-xl px-5"
            >
              {saveGoal.isPending && <Loader2 className="animate-spin" />} Enregistrer
            </Button>
          </div>
        </section>
      )}

      {visiblePacks.length ? (
        <section className="mt-4 space-y-3" aria-label="Liste des parcours">
          {visiblePacks.map((pack) => {
            const teacher = data.teachers.get(pack.teacher_id);
            const left = Math.max(pack.sessions_total - pack.sessions_used, 0);
            const next = data.bookings.find(
              (booking) => booking.pack_id === pack.id && booking.status === "accepted" && new Date(booking.scheduled_at) > now,
            );
            const subject = pack.teacher_offers?.subjects?.name ?? "Matière";
            const title = pack.teacher_offers?.title ?? subject;
            const progress = Math.min(pack.sessions_used, pack.sessions_total);

            return (
              <article key={pack.id} className="overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
                <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_15rem] lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
                        <BookOpen className="size-6" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-display text-base font-bold text-foreground sm:text-lg">{title}</h2>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                          {learningObjectiveLabel(objective) || "Objectif à préciser"}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-4 space-y-2 text-xs sm:text-sm">
                      <div className="flex items-start gap-2">
                        <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <dt className="font-semibold text-foreground">Matière :</dt>
                        <dd className="min-w-0 text-muted-foreground">{subject}</dd>
                      </div>
                      <div className="flex items-start gap-2">
                        <Target className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <dt className="font-semibold text-foreground">Objectif :</dt>
                        <dd className="min-w-0 text-muted-foreground">{learningObjectiveLabel(objective) || "À préciser"}</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserRound className="size-4 shrink-0 text-primary" aria-hidden />
                        <dt className="font-semibold text-foreground">Intervenant :</dt>
                        <dd className="min-w-0 truncate text-muted-foreground">{teacher?.display_name ?? "Intervenant"}</dd>
                        <UserAvatar name={teacher?.display_name ?? "Intervenant"} src={teacher?.avatar_url} className="size-7 shrink-0 rounded-full" />
                      </div>
                      <div className="flex items-start gap-2">
                        <Package className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <dt className="font-semibold text-foreground">Formule :</dt>
                        <dd className="min-w-0 text-muted-foreground">
                          {pack.pack_types?.name ?? pack.pack_slug} · {pack.sessions_total} séances
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 rounded-xl bg-secondary px-3 py-3">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-foreground">
                          {left} séance{left > 1 ? "s" : ""} restante{left > 1 ? "s" : ""} sur {pack.sessions_total}
                        </span>
                        <span className="shrink-0 text-muted-foreground">{Math.round((progress / Math.max(pack.sessions_total, 1)) * 100)} %</span>
                      </div>
                      <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(pack.sessions_total, 1)}, minmax(0, 1fr))` }}>
                        {Array.from({ length: Math.max(pack.sessions_total, 1) }).map((_, index) => (
                          <span key={index} className={`h-1.5 rounded-full ${index < progress ? "bg-primary" : "bg-border"}`} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="rounded-2xl bg-secondary p-4">
                      <div className="flex gap-3">
                        <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Prochain cours</p>
                          {next ? (
                            <>
                              <p className="mt-0.5 text-sm font-bold capitalize text-foreground">{formatCourseDay(next.scheduled_at)}</p>
                              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock3 className="size-3.5" aria-hidden /> {formatCourseTime(next.scheduled_at, next.duration_minutes)}
                              </p>
                              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                {next.format === "online" ? <Laptop className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
                                {next.format === "online" ? "En ligne" : `À domicile${next.commune ? ` · ${next.commune}` : ""}`}
                              </p>
                            </>
                          ) : (
                            <p className="mt-1 text-sm font-semibold text-foreground">Aucune séance programmée</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button asChild className="h-10 w-full rounded-xl">
                      <Link to="/matiere/$packId" params={{ packId: pack.id }}>
                        Voir le parcours <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={contactTeacher.isPending}
                      onClick={() => contactTeacher.mutate(pack.teacher_id)}
                      className="h-10 w-full rounded-xl"
                    >
                      <MessageCircle aria-hidden /> Contacter l’intervenant
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="mt-4">
          <EmptyState
            icon={BookOpen}
            title={filter === "active" ? "Aucun parcours en cours" : filter === "completed" ? "Aucun parcours terminé" : "Aucun parcours"}
            description={filter === "completed" ? "Vos parcours terminés apparaîtront ici." : "Choisissez un intervenant et une formule pour démarrer votre parcours."}
            action={filter !== "completed" ? (
              <Button asChild className="h-11 rounded-xl px-5">
                <Link to="/professeurs">Rechercher un intervenant</Link>
              </Button>
            ) : undefined}
          />
        </div>
      )}
    </main>
  );
}