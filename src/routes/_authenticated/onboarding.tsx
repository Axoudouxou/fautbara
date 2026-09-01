import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getCatalog } from "@/lib/catalog.functions";
import { COMMUNES_ABIDJAN } from "@/lib/geo";
import { useSessionRoles } from "@/hooks/use-session-roles";
import {
  AVAILABILITY_PERIODS,
  BUDGET_RANGES,
  IVORIAN_ALL_SERIES,
  IVORIAN_MAIN_SERIES,
  LEARNING_OBJECTIVES,
  LEARNING_STYLES,
  ONBOARDING_WEEKDAYS,
  PREFERRED_FORMATS,
  SCHOOL_SYSTEMS,
  type BudgetRange,
  type LearningObjective,
  type LearningStyle,
  type PreferredFormat,
  type SchoolSystem,
} from "@/lib/education";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Bienvenue sur BARA" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

/* ---------------- Composants partagés ---------------- */

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Étape {step + 1} sur {total}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function StepShell({
  title,
  subtitle,
  children,
  onSkip,
  onNext,
  nextLabel = "Continuer",
  nextDisabled = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onSkip: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-8 space-y-6 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>

      {children}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Passer
        </button>
        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {nextDisabled && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

function toggleInArray<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/* ---------------- Page ---------------- */

function OnboardingPage() {
  const { user } = Route.useRouteContext();
  const { roles, rolesLoading } = useSessionRoles();

  if (rolesLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  if (roles.includes("teacher")) {
    return <TeacherOnboarding userId={user.id} />;
  }

  return <LearnerOnboarding userId={user.id} isParent={roles.includes("parent")} />;
}

/* ---------------- Parcours parent / étudiant ---------------- */

type LearnerData = {
  forWhom: "self" | "child" | null;
  childName: string;
  subjectSlugs: string[];
  budgetRange: BudgetRange | null;
  schoolSystem: SchoolSystem | null;
  schoolSystemOther: string;
  levelSlug: string;
  levelOther: string;
  filiere: string;
  showAllSeries: boolean;
  learningStyle: LearningStyle | null;
  objective: LearningObjective | null;
  preferredFormat: PreferredFormat | null;
  commune: string;
  availabilityDays: number[];
  availabilityPeriods: string[];
};

const EMPTY_LEARNER_DATA: LearnerData = {
  forWhom: null,
  childName: "",
  subjectSlugs: [],
  budgetRange: null,
  schoolSystem: null,
  schoolSystemOther: "",
  levelSlug: "",
  levelOther: "",
  filiere: "",
  showAllSeries: false,
  learningStyle: null,
  objective: null,
  preferredFormat: null,
  commune: "",
  availabilityDays: [],
  availabilityPeriods: [],
};

const LEARNER_STEPS = 5;

function LearnerOnboarding({ userId, isParent }: { userId: string; isParent: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<LearnerData>(EMPTY_LEARNER_DATA);
  const [childNamePrefilled, setChildNamePrefilled] = useState(false);

  const catalogQuery = useQuery({ queryKey: ["onboarding-catalog"], queryFn: () => getCatalog() });

  const childrenQuery = useQuery({
    queryKey: ["onboarding-children", userId],
    enabled: isParent,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("children")
        .select("id, first_name, school_level")
        .eq("parent_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return rows;
    },
  });

  const existingChild = childrenQuery.data?.[0] ?? null;

  useEffect(() => {
    if (!childNamePrefilled && existingChild?.first_name) {
      setData((d) => ({ ...d, childName: existingChild.first_name }));
      setChildNamePrefilled(true);
    }
  }, [childNamePrefilled, existingChild]);

  const finishMutation = useMutation({
    mutationFn: async (data: LearnerData) => {
      const preferredCommunes = data.commune ? [data.commune] : [];
      const levelSlugs = data.schoolSystem !== "autre" && data.levelSlug ? [data.levelSlug] : [];

      const { error: prefsError } = await supabase.from("learning_preferences").upsert(
        {
          user_id: userId,
          role_context: "learner",
          for_whom: data.forWhom,
          child_name: data.forWhom === "child" ? data.childName.trim() || null : null,
          subject_slugs: data.subjectSlugs,
          budget_range: data.budgetRange,
          school_systems: data.schoolSystem ? [data.schoolSystem] : [],
          school_system_other: data.schoolSystem === "autre" ? data.schoolSystemOther.trim() || null : null,
          level_slugs: levelSlugs,
          level_other: data.schoolSystem === "autre" ? data.levelOther.trim() || null : null,
          filiere: data.filiere.trim() || null,
          learning_style: data.learningStyle,
          objective: data.objective,
          preferred_format: data.preferredFormat,
          preferred_communes: preferredCommunes,
          availability_days: data.availabilityDays,
          availability_periods: data.availabilityPeriods,
        },
        { onConflict: "user_id" },
      );
      if (prefsError) throw prefsError;

      const trimmedName = data.childName.trim();
      if (isParent && data.forWhom === "child" && trimmedName) {
        const match = childrenQuery.data?.find(
          (c) => c.first_name.toLowerCase() === trimmedName.toLowerCase(),
        );
        const schoolLevel = data.levelSlug || data.levelOther.trim() || null;
        if (match) {
          if (schoolLevel && schoolLevel !== match.school_level) {
            await supabase.from("children").update({ school_level: schoolLevel }).eq("id", match.id);
          }
        } else {
          const { error: childError } = await supabase.from("children").insert({
            parent_id: userId,
            first_name: trimmedName,
            school_level: schoolLevel,
          });
          if (childError) throw childError;
        }
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children", userId] });
      navigate({ to: "/accueil" });
    },
    onError: (err) => {
      toast.error("Une erreur est survenue", {
        description: err instanceof Error ? err.message : "Veuillez réessayer.",
      });
    },
  });

  const catalog = catalogQuery.data;
  const isLast = step === LEARNER_STEPS - 1;

  function next() {
    if (isLast) {
      finishMutation.mutate(data);
      return;
    }
    setStep((s) => s + 1);
  }

  function skip(reset: Partial<LearnerData>) {
    const merged = { ...data, ...reset };
    setData(merged);
    if (isLast) {
      finishMutation.mutate(merged);
      return;
    }
    setStep((s) => s + 1);
  }

  return (
    <div className="container-page max-w-2xl py-10 sm:py-14">
      <ProgressBar step={step} total={LEARNER_STEPS} />

      {step === 0 && (
        <StepShell
          title="Pour qui cherchez-vous un professeur ?"
          onSkip={() => skip({ forWhom: null, childName: "" })}
          onNext={next}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { value: "child" as const, label: "Mon enfant" },
                { value: "self" as const, label: "Moi-même" },
              ]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={data.forWhom === opt.value}
                onClick={() => setData((d) => ({ ...d, forWhom: opt.value }))}
                className={`rounded-2xl border p-5 text-left text-sm font-semibold transition-colors ${
                  data.forWhom === opt.value
                    ? "border-primary bg-primary-soft/60 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {data.forWhom === "child" && (
            <div>
              <label htmlFor="child-first-name" className="text-sm font-semibold text-foreground">
                Prénom de l'enfant
              </label>
              <input
                id="child-first-name"
                type="text"
                value={data.childName}
                onChange={(e) => setData((d) => ({ ...d, childName: e.target.value }))}
                placeholder="Ex. Kévin"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
              />
            </div>
          )}
        </StepShell>
      )}

      {step === 1 && (
        <StepShell
          title="Quelle matière et quel budget ?"
          subtitle="Sélectionnez une ou plusieurs matières."
          onSkip={() => skip({ subjectSlugs: [], budgetRange: null })}
          onNext={next}
        >
          <div className="space-y-4">
            {catalogQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement des matières…</p>
            ) : (
              catalog?.categories.map((category) => {
                const subjects = catalog.subjects.filter((s) => s.category_id === category.id);
                if (subjects.length === 0) return null;
                return (
                  <div key={category.id}>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {category.name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {subjects.map((s) => (
                        <Chip
                          key={s.id}
                          active={data.subjectSlugs.includes(s.slug)}
                          onClick={() =>
                            setData((d) => ({ ...d, subjectSlugs: toggleInArray(d.subjectSlugs, s.slug) }))
                          }
                        >
                          {s.name}
                        </Chip>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-foreground">Budget par séance</p>
            <div className="flex flex-wrap gap-2">
              {BUDGET_RANGES.map((b) => (
                <Chip
                  key={b.value}
                  active={data.budgetRange === b.value}
                  onClick={() => setData((d) => ({ ...d, budgetRange: b.value }))}
                >
                  {b.label}
                </Chip>
              ))}
            </div>
          </div>
        </StepShell>
      )}

      {step === 2 && (
        <StepShell
          title="Quel système scolaire ?"
          onSkip={() =>
            skip({
              schoolSystem: null,
              schoolSystemOther: "",
              levelSlug: "",
              levelOther: "",
              filiere: "",
              showAllSeries: false,
            })
          }
          onNext={next}
        >
          <div className="flex flex-wrap gap-2">
            {SCHOOL_SYSTEMS.map((sys) => (
              <Chip
                key={sys.value}
                active={data.schoolSystem === sys.value}
                onClick={() =>
                  setData((d) => ({
                    ...d,
                    schoolSystem: sys.value,
                    levelSlug: "",
                    levelOther: "",
                    filiere: "",
                    showAllSeries: false,
                  }))
                }
              >
                {sys.label}
                <span className="ml-1.5 font-normal opacity-80">({sys.hint})</span>
              </Chip>
            ))}
          </div>

          {data.schoolSystem === "autre" && (
            <div>
              <label htmlFor="school-system-other" className="text-sm font-semibold text-foreground">
                Précisez le système
              </label>
              <input
                id="school-system-other"
                type="text"
                value={data.schoolSystemOther}
                onChange={(e) => setData((d) => ({ ...d, schoolSystemOther: e.target.value }))}
                placeholder="Ex. Système britannique"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
              />
            </div>
          )}

          {(data.schoolSystem === "ivoirien" || data.schoolSystem === "francais") && (
            <div>
              <label htmlFor="level-select" className="text-sm font-semibold text-foreground">
                Niveau
              </label>
              <select
                id="level-select"
                value={data.levelSlug}
                onChange={(e) => setData((d) => ({ ...d, levelSlug: e.target.value }))}
                className="mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary"
              >
                <option value="">Sélectionner…</option>
                {catalog?.levels.map((l) => (
                  <option key={l.id} value={l.slug}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {data.schoolSystem === "autre" && (
            <div>
              <label htmlFor="level-other" className="text-sm font-semibold text-foreground">
                Niveau
              </label>
              <input
                id="level-other"
                type="text"
                value={data.levelOther}
                onChange={(e) => setData((d) => ({ ...d, levelOther: e.target.value }))}
                placeholder="Ex. Year 10"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
              />
            </div>
          )}

          {data.schoolSystem === "ivoirien" && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-foreground">Filière / série</p>
              <div className="flex flex-wrap gap-2">
                {IVORIAN_MAIN_SERIES.map((serie) => (
                  <Chip
                    key={serie}
                    active={data.filiere === serie}
                    onClick={() => setData((d) => ({ ...d, filiere: serie, showAllSeries: false }))}
                  >
                    {serie}
                  </Chip>
                ))}
                <Chip
                  active={data.showAllSeries}
                  onClick={() => setData((d) => ({ ...d, showAllSeries: true }))}
                >
                  Autre série
                </Chip>
              </div>
              {data.showAllSeries && (
                <select
                  value={data.filiere}
                  onChange={(e) => setData((d) => ({ ...d, filiere: e.target.value }))}
                  className="mt-3 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary"
                >
                  <option value="">Sélectionner une série…</option>
                  {IVORIAN_ALL_SERIES.map((serie) => (
                    <option key={serie} value={serie}>
                      Série {serie}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {(data.schoolSystem === "francais" || data.schoolSystem === "autre") && (
            <div>
              <label htmlFor="filiere-other" className="text-sm font-semibold text-foreground">
                Filière / spécialité (facultatif)
              </label>
              <input
                id="filiere-other"
                type="text"
                value={data.filiere}
                onChange={(e) => setData((d) => ({ ...d, filiere: e.target.value }))}
                placeholder="Ex. Spécialité mathématiques"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
              />
            </div>
          )}
        </StepShell>
      )}

      {step === 3 && (
        <StepShell
          title="Vos préférences d'apprentissage"
          onSkip={() => skip({ learningStyle: null, objective: null })}
          onNext={next}
        >
          <div>
            <p className="mb-1.5 text-sm font-semibold text-foreground">Style d'apprentissage</p>
            <div className="flex flex-wrap gap-2">
              {LEARNING_STYLES.map((s) => (
                <Chip
                  key={s.value}
                  active={data.learningStyle === s.value}
                  onClick={() => setData((d) => ({ ...d, learningStyle: s.value }))}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-foreground">Objectif principal</p>
            <div className="flex flex-wrap gap-2">
              {LEARNING_OBJECTIVES.map((o) => (
                <Chip
                  key={o.value}
                  active={data.objective === o.value}
                  onClick={() => setData((d) => ({ ...d, objective: o.value }))}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>
        </StepShell>
      )}

      {step === 4 && (
        <StepShell
          title="Format et disponibilités"
          onSkip={() =>
            skip({
              preferredFormat: null,
              commune: "",
              availabilityDays: [],
              availabilityPeriods: [],
            })
          }
          onNext={next}
          nextLabel="Terminer"
          nextDisabled={finishMutation.isPending}
        >
          <div>
            <p className="mb-1.5 text-sm font-semibold text-foreground">Format préféré</p>
            <div className="flex flex-wrap gap-2">
              {PREFERRED_FORMATS.map((f) => (
                <Chip
                  key={f.value}
                  active={data.preferredFormat === f.value}
                  onClick={() => setData((d) => ({ ...d, preferredFormat: f.value }))}
                >
                  {f.label}
                </Chip>
              ))}
            </div>
          </div>

          {(data.preferredFormat === "home" || data.preferredFormat === "both") && (
            <div>
              <label htmlFor="commune-select" className="text-sm font-semibold text-foreground">
                Commune
              </label>
              <select
                id="commune-select"
                value={data.commune}
                onChange={(e) => setData((d) => ({ ...d, commune: e.target.value }))}
                className="mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary"
              >
                <option value="">Sélectionner…</option>
                {COMMUNES_ABIDJAN.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-semibold text-foreground">Jours disponibles</p>
            <div className="flex flex-wrap gap-2">
              {ONBOARDING_WEEKDAYS.map((day, index) => (
                <Chip
                  key={day}
                  active={data.availabilityDays.includes(index)}
                  onClick={() =>
                    setData((d) => ({ ...d, availabilityDays: toggleInArray(d.availabilityDays, index) }))
                  }
                >
                  {day}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-foreground">Créneaux préférés</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY_PERIODS.map((p) => (
                <Chip
                  key={p.value}
                  active={data.availabilityPeriods.includes(p.value)}
                  onClick={() =>
                    setData((d) => ({
                      ...d,
                      availabilityPeriods: toggleInArray(d.availabilityPeriods, p.value),
                    }))
                  }
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>
        </StepShell>
      )}
    </div>
  );
}

/* ---------------- Parcours professeur ---------------- */

type TeacherData = {
  subjectSlugs: string[];
  schoolSystems: SchoolSystem[];
  schoolSystemOther: string;
  levelSlugs: string[];
  communes: string[];
  offersHome: boolean;
  offersOnline: boolean;
};

const EMPTY_TEACHER_DATA: TeacherData = {
  subjectSlugs: [],
  schoolSystems: [],
  schoolSystemOther: "",
  levelSlugs: [],
  communes: [],
  offersHome: false,
  offersOnline: false,
};

const TEACHER_STEPS = 3;

function TeacherOnboarding({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<TeacherData>(EMPTY_TEACHER_DATA);

  const catalogQuery = useQuery({ queryKey: ["onboarding-catalog"], queryFn: () => getCatalog() });
  const catalog = catalogQuery.data;

  const finishMutation = useMutation({
    mutationFn: async (data: TeacherData) => {
      const preferredFormat: PreferredFormat | null =
        data.offersHome && data.offersOnline
          ? "both"
          : data.offersHome
            ? "home"
            : data.offersOnline
              ? "online"
              : null;

      const { error: prefsError } = await supabase.from("learning_preferences").upsert(
        {
          user_id: userId,
          role_context: "teacher",
          subject_slugs: data.subjectSlugs,
          school_systems: data.schoolSystems,
          school_system_other: data.schoolSystems.includes("autre")
            ? data.schoolSystemOther.trim() || null
            : null,
          level_slugs: data.levelSlugs,
          preferred_format: preferredFormat,
          preferred_communes: data.communes,
        },
        { onConflict: "user_id" },
      );
      if (prefsError) throw prefsError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      navigate({ to: "/pro/offres", search: { onboarding: true } });
    },
    onError: (err) => {
      toast.error("Une erreur est survenue", {
        description: err instanceof Error ? err.message : "Veuillez réessayer.",
      });
    },
  });

  const isLast = step === TEACHER_STEPS - 1;

  function next() {
    if (isLast) {
      finishMutation.mutate(data);
      return;
    }
    setStep((s) => s + 1);
  }

  function skip(reset: Partial<TeacherData>) {
    const merged = { ...data, ...reset };
    setData(merged);
    if (isLast) {
      finishMutation.mutate(merged);
      return;
    }
    setStep((s) => s + 1);
  }

  return (
    <div className="container-page max-w-2xl py-10 sm:py-14">
      <ProgressBar step={step} total={TEACHER_STEPS} />

      {step === 0 && (
        <StepShell
          title="Quelles matières enseignez-vous ?"
          subtitle="Sélectionnez une ou plusieurs matières."
          onSkip={() => skip({ subjectSlugs: [] })}
          onNext={next}
        >
          <div className="space-y-4">
            {catalogQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement des matières…</p>
            ) : (
              catalog?.categories.map((category) => {
                const subjects = catalog.subjects.filter((s) => s.category_id === category.id);
                if (subjects.length === 0) return null;
                return (
                  <div key={category.id}>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {category.name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {subjects.map((s) => (
                        <Chip
                          key={s.id}
                          active={data.subjectSlugs.includes(s.slug)}
                          onClick={() =>
                            setData((d) => ({ ...d, subjectSlugs: toggleInArray(d.subjectSlugs, s.slug) }))
                          }
                        >
                          {s.name}
                        </Chip>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </StepShell>
      )}

      {step === 1 && (
        <StepShell
          title="Système(s) scolaire(s) et niveaux enseignés"
          onSkip={() => skip({ schoolSystems: [], schoolSystemOther: "", levelSlugs: [] })}
          onNext={next}
        >
          <div>
            <p className="mb-1.5 text-sm font-semibold text-foreground">Systèmes maîtrisés</p>
            <div className="flex flex-wrap gap-2">
              {SCHOOL_SYSTEMS.map((sys) => (
                <Chip
                  key={sys.value}
                  active={data.schoolSystems.includes(sys.value)}
                  onClick={() =>
                    setData((d) => ({ ...d, schoolSystems: toggleInArray(d.schoolSystems, sys.value) }))
                  }
                >
                  {sys.label}
                </Chip>
              ))}
            </div>
          </div>

          {data.schoolSystems.includes("autre") && (
            <div>
              <label htmlFor="teacher-system-other" className="text-sm font-semibold text-foreground">
                Précisez le(s) système(s)
              </label>
              <input
                id="teacher-system-other"
                type="text"
                value={data.schoolSystemOther}
                onChange={(e) => setData((d) => ({ ...d, schoolSystemOther: e.target.value }))}
                placeholder="Ex. Système britannique"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
              />
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-semibold text-foreground">Niveaux enseignés</p>
            <div className="flex flex-wrap gap-2">
              {catalog?.levels.map((l) => (
                <Chip
                  key={l.id}
                  active={data.levelSlugs.includes(l.slug)}
                  onClick={() =>
                    setData((d) => ({ ...d, levelSlugs: toggleInArray(d.levelSlugs, l.slug) }))
                  }
                >
                  {l.name}
                </Chip>
              ))}
            </div>
          </div>
        </StepShell>
      )}

      {step === 2 && (
        <StepShell
          title="Zone d'intervention"
          onSkip={() => skip({ communes: [], offersHome: false, offersOnline: false })}
          onNext={next}
          nextLabel="Terminer"
          nextDisabled={finishMutation.isPending}
        >
          <div>
            <p className="mb-1.5 text-sm font-semibold text-foreground">Format proposé</p>
            <div className="flex flex-wrap gap-2">
              <Chip
                active={data.offersHome}
                onClick={() => setData((d) => ({ ...d, offersHome: !d.offersHome }))}
              >
                À domicile
              </Chip>
              <Chip
                active={data.offersOnline}
                onClick={() => setData((d) => ({ ...d, offersOnline: !d.offersOnline }))}
              >
                En ligne
              </Chip>
            </div>
          </div>

          {data.offersHome && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-foreground">Communes desservies</p>
              <div className="flex flex-wrap gap-2">
                {COMMUNES_ABIDJAN.map((c) => (
                  <Chip
                    key={c}
                    active={data.communes.includes(c)}
                    onClick={() => setData((d) => ({ ...d, communes: toggleInArray(d.communes, c) }))}
                  >
                    {c}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </StepShell>
      )}
    </div>
  );
}
