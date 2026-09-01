import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarDays,
  GraduationCap,
  Home,
  Laptop,
  MapPin,
  Search,
  Star,
  Users,
} from "lucide-react";

import { getCatalog, searchFiltersSchema, searchTeachers, type TeacherCard } from "@/lib/catalog.functions";
import { COMMUNES_ABIDJAN } from "@/lib/geo";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/professeurs/")({
  validateSearch: (search) => searchFiltersSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [catalog, teachers] = await Promise.all([
      getCatalog(),
      searchTeachers({ data: deps }),
    ]);
    return { catalog, teachers };
  },
  head: () => ({
    meta: [
      { title: "Trouver un professeur particulier à Abidjan — BARA" },
      {
        name: "description",
        content:
          "Parcourez les professeurs particuliers vérifiés de BARA : filtrez par matière, niveau, commune, format et budget, à Abidjan et partout en Côte d'Ivoire.",
      },
      { property: "og:title", content: "Trouver un professeur particulier — BARA" },
      {
        property: "og:description",
        content: "Professeurs particuliers vérifiés, à domicile ou en ligne, en Côte d'Ivoire.",
      },
    ],
  }),
  component: TeachersPage,
  errorComponent: ({ error }) => {
    console.error(error);
    return (
      <div className="container-page py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">
          La recherche n'a pas pu se charger
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Réessayez dans un instant. En développement local, consultez la console : cette page
          échoue le plus souvent faute de variables d'environnement Supabase (SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY) — voir le fichier .env.example à la racine du projet.
        </p>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="container-page py-16 text-center text-muted-foreground">Page introuvable.</div>
  ),
});

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const PRICE_SLIDER_MAX = 50000;
const PRICE_SLIDER_STEP = 500;

const selectClass =
  "h-11 w-full min-w-[10rem] rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary";
const fieldLabelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function TeachersPage() {
  const { catalog, teachers } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const activeSubjectName = search.matiere
    ? catalog.subjects.find((s) => s.slug === search.matiere)?.name
    : undefined;

  const [priceRange, setPriceRange] = useState<[number, number]>([
    search.prixMin ?? 0,
    search.prixMax ?? PRICE_SLIDER_MAX,
  ]);

  // Garde le curseur synchronisé quand les filtres changent sans passer par
  // lui (ex. lien "Réinitialiser", navigation précédente/suivante).
  useEffect(() => {
    setPriceRange([search.prixMin ?? 0, search.prixMax ?? PRICE_SLIDER_MAX]);
  }, [search.prixMin, search.prixMax]);

  const update = (patch: Record<string, string | number | undefined>) => {
    navigate({
      search: (prev) => {
        const next: Record<string, unknown> = { ...prev, ...patch };
        for (const key of Object.keys(next)) {
          if (next[key] === "" || next[key] === undefined) delete next[key];
        }
        return next as never;
      },
    });
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Trouver un professeur
        </h1>
        <p className="mt-3 text-muted-foreground">
          Filtrez par matière, tarif, commune et disponibilités. Les tarifs sont indiqués par
          séance.
        </p>
      </header>

      <div className="mt-8 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]">
        {/* Filtres principaux : une seule ligne cohérente */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="min-w-0">
            <span className={fieldLabelClass}>Ce que je veux apprendre</span>
            <select
              className={selectClass}
              value={search.matiere ?? ""}
              onChange={(event) => update({ matiere: event.target.value })}
            >
              <option value="">Toutes les matières</option>
              {catalog.categories.map((category) => (
                <optgroup key={category.id} label={category.name}>
                  {catalog.subjects
                    .filter((subject) => subject.category_id === category.id)
                    .map((subject) => (
                      <option key={subject.id} value={subject.slug}>
                        {subject.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="min-w-0">
            <span className={fieldLabelClass}>Tarif par séance (FCFA)</span>
            <div className="flex h-11 items-center rounded-xl border border-input bg-card px-3">
              <Slider
                min={0}
                max={PRICE_SLIDER_MAX}
                step={PRICE_SLIDER_STEP}
                value={priceRange}
                onValueChange={(value) => setPriceRange([value[0]!, value[1]!])}
                onValueCommit={(value) =>
                  update({
                    prixMin: value[0]! > 0 ? value[0] : undefined,
                    prixMax: value[1]! < PRICE_SLIDER_MAX ? value[1] : undefined,
                  })
                }
              />
            </div>
            <p className="mt-1 text-center text-xs font-semibold text-foreground">
              {priceRange[0].toLocaleString("fr-FR")} –{" "}
              {priceRange[1] >= PRICE_SLIDER_MAX
                ? `${PRICE_SLIDER_MAX.toLocaleString("fr-FR")}+`
                : priceRange[1].toLocaleString("fr-FR")}{" "}
              FCFA
            </p>
          </div>

          <label className="min-w-0">
            <span className={fieldLabelClass}>Commune</span>
            <select
              className={selectClass}
              value={search.commune ?? ""}
              onChange={(event) => update({ commune: event.target.value })}
            >
              <option value="">Toutes les communes</option>
              {COMMUNES_ABIDJAN.map((commune) => (
                <option key={commune} value={commune}>
                  {commune}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0">
            <span className={fieldLabelClass}>Disponibilités</span>
            <select
              className={selectClass}
              value={search.jour ?? ""}
              onChange={(event) => update({ jour: event.target.value })}
            >
              <option value="">Tous les jours</option>
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0">
            <span className={fieldLabelClass}>Recherche</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                className={`${selectClass} pl-9`}
                placeholder="Nom, matière, mot-clé…"
                defaultValue={search.q ?? ""}
                onBlur={(event) => update({ q: event.target.value.trim() })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    update({ q: (event.target as HTMLInputElement).value.trim() });
                  }
                }}
              />
            </div>
          </label>
        </div>

        {/* Ligne 2 : filtres secondaires */}
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border/60 pt-3">
          <label className="min-w-[10rem] flex-1 sm:flex-none">
            <span className={fieldLabelClass}>Niveau</span>
            <select
              className={selectClass}
              value={search.niveau ?? ""}
              onChange={(event) => update({ niveau: event.target.value })}
            >
              <option value="">Tous les niveaux</option>
              {catalog.levels.map((level) => (
                <option key={level.id} value={level.slug}>
                  {level.name}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[10rem] flex-1 sm:flex-none">
            <span className={fieldLabelClass}>Format</span>
            <select
              className={selectClass}
              value={search.format ?? ""}
              onChange={(event) => update({ format: event.target.value })}
            >
              <option value="">À domicile ou en ligne</option>
              <option value="home">À domicile</option>
              <option value="online">En ligne</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-foreground">
          {teachers.length} professeur{teachers.length > 1 ? "s" : ""} trouvé
          {teachers.length > 1 ? "s" : ""}
        </p>
        <Link
          to="/professeurs"
          search={{}}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Réinitialiser
        </Link>
      </div>

      {teachers.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-secondary/40 p-10 text-center">
          <Users className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-bold text-foreground">
            Aucun professeur ne correspond encore
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Les professeurs sont en cours d'inscription sur BARA. Élargissez vos filtres, ou
            créez votre profil professeur pour être parmi les premiers.
          </p>
          <a
            href="/auth"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Devenir professeur
          </a>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {teachers.map((teacher) => (
            <TeacherRow
              key={teacher.teacher_id}
              teacher={teacher}
              {...(activeSubjectName ? { activeSubjectName } : {})}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TeacherRow({
  teacher,
  activeSubjectName,
}: {
  teacher: TeacherCard;
  activeSubjectName?: string;
}) {
  const subjectLabel = activeSubjectName ?? teacher.subjects[0];

  return (
    <li className="rounded-2xl border border-border/70 bg-card p-4 transition-shadow hover:shadow-[var(--shadow-card)]">
      <div className="flex gap-3">
        <Link
          to="/professeurs/$id"
          params={{ id: teacher.teacher_id }}
          className="shrink-0"
        >
          {teacher.avatar_url ? (
            <img
              src={teacher.avatar_url}
              alt={`Photo de ${teacher.display_name}`}
              loading="lazy"
              className="size-20 rounded-xl object-cover"
            />
          ) : (
            <span className="flex size-20 items-center justify-center rounded-xl bg-primary-soft font-display text-xl font-bold text-primary-soft-foreground">
              {initials(teacher.display_name) || "?"}
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              to="/professeurs/$id"
              params={{ id: teacher.teacher_id }}
              className="truncate font-display text-base font-bold text-foreground hover:underline"
            >
              {teacher.display_name}
            </Link>
            {teacher.identity_verified ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">
                <BadgeCheck className="size-3" aria-hidden />
                Vérifié
              </span>
            ) : null}
          </div>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {teacher.commune ? `${teacher.commune}, ` : ""}
              {teacher.city ?? "Côte d'Ivoire"}
            </span>
            {teacher.years_experience ? (
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="size-3.5" aria-hidden />
                {teacher.years_experience} an{teacher.years_experience > 1 ? "s" : ""}
              </span>
            ) : null}
            {teacher.offers_home ? (
              <span className="inline-flex items-center gap-1">
                <Home className="size-3.5" aria-hidden />
                Domicile
              </span>
            ) : null}
            {teacher.offers_online ? (
              <span className="inline-flex items-center gap-1">
                <Laptop className="size-3.5" aria-hidden />
                En ligne
              </span>
            ) : null}
          </p>

          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {subjectLabel ? (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                {subjectLabel}
              </span>
            ) : null}
            {teacher.teaching_method ? (
              <span className="rounded-full bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground">
                {teacher.teaching_method}
              </span>
            ) : null}
          </div>

          {teacher.bio ? (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {teacher.bio}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {teacher.rating_count > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Star className="size-3.5 fill-primary text-primary" aria-hidden />
              {Number(teacher.rating_avg).toFixed(1)} ({teacher.rating_count})
            </span>
          ) : (
            <span>Nouveau</span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            {teacher.students_count}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden />
            {teacher.lessons_count}
          </span>
        </div>

        <p className="text-right">
          <span className="font-display text-base font-bold text-foreground">
            {teacher.min_price_fcfa.toLocaleString("fr-FR")} FCFA
          </span>
          <span className="text-[11px] text-muted-foreground"> / séance</span>
        </p>
      </div>

      <div className="mt-2 flex gap-2">
        <Link
          to="/professeurs/$id"
          params={{ id: teacher.teacher_id }}
          className="flex-1 inline-flex items-center justify-center rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:text-sm"
        >
          Voir le profil
        </Link>
        {teacher.sample_offer_id ? (
          <Link
            to="/reserver/$offerId"
            params={{ offerId: teacher.sample_offer_id }}
            className="flex-1 inline-flex items-center justify-center rounded-full border border-border px-2 py-2 text-center text-xs font-semibold leading-tight text-foreground transition-colors hover:bg-secondary sm:text-sm"
          >
            Réserver un cours d'essai
          </Link>
        ) : null}
      </div>
    </li>
  );
}
