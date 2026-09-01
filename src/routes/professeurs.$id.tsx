import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  ChevronDown,
  GraduationCap,
  Home,
  Languages,
  Laptop,
  PlayCircle,
  Star,
} from "lucide-react";

import { useSessionRoles } from "@/hooks/use-session-roles";
import { getTeacherPublicProfile, searchTeachers } from "@/lib/catalog.functions";
import { getTeacherFullProfile } from "@/lib/teacher-profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { TeacherAvailabilityCalendar } from "@/components/teacher-availability-calendar";

export const Route = createFileRoute("/professeurs/$id")({
  loader: async ({ params }) => {
    const [{ offers }, full] = await Promise.all([
      getTeacherPublicProfile({ data: { id: params.id } }),
      getTeacherFullProfile({ data: { id: params.id } }),
    ]);
    if (!full.profile) throw notFound();
    return { ...full, offers };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.profile) {
      return {
        meta: [{ title: "Profil indisponible — BARA" }, { name: "robots", content: "noindex" }],
      };
    }
    const { profile } = loaderData;
    const title = `${profile.display_name} — professeur particulier | BARA`;
    const description =
      profile.headline ??
      `Découvrez le CV, les diplômes, les expériences et les avis de ${profile.display_name} sur BARA.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: TeacherPublicPage,
  errorComponent: () => (
    <div className="container-page py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-foreground">Profil indisponible</h1>
      <p className="mt-2 text-sm text-muted-foreground">Réessayez dans un instant.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="container-page py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-foreground">Professeur introuvable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ce profil n'existe pas ou n'est pas encore publié.
      </p>
      <Link
        to="/professeurs"
        search={{}}
        className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Voir les professeurs
      </Link>
    </div>
  ),
});

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((v) => (
        <Star
          key={v}
          className={`size-4 ${v <= Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground"}`}
          aria-hidden
        />
      ))}
    </span>
  );
}

/** Découpe un texte libre en 2-3 courtes qualités affichables en badges. */
function qualityTags(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/[,•;]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function TeacherPublicPage() {
  const { profile, offers, educations, experiences, photos, reviews, rating_avg, rating_count } =
    Route.useLoaderData();

  if (!profile) return null;

  const sortedOffers = [...offers].sort((a, b) => a.price_fcfa - b.price_fcfa);
  const mainOffer = sortedOffers[0] ?? null;
  const mainSubjectName = mainOffer?.subjects?.name ?? null;
  const mainSubjectSlug = mainOffer?.subjects?.slug ?? null;

  const otherSubjects = Array.from(
    new Set(
      sortedOffers
        .map((o) => o.subjects?.name)
        .filter((name): name is string => Boolean(name) && name !== mainSubjectName),
    ),
  );
  const allLevels = Array.from(
    new Set(
      sortedOffers.flatMap((o) => (o.offer_levels ?? []).map((entry) => entry.levels?.name).filter(Boolean)),
    ),
  ) as string[];

  const minPrice = sortedOffers.length > 0 ? sortedOffers[0]!.price_fcfa : null;
  const maxPrice = sortedOffers.length > 0 ? sortedOffers[sortedOffers.length - 1]!.price_fcfa : null;

  const languages = (profile.languages ?? []).length > 0 ? profile.languages! : ["Français"];
  const qualities = qualityTags(profile.teaching_method);

  const timeline = useMemo(() => {
    const eduItems = educations.map((e) => ({
      kind: "education" as const,
      key: `edu-${e.id}`,
      title: e.degree,
      subtitle: [e.school, e.field].filter(Boolean).join(" • "),
      period: [e.start_year, e.end_year].filter(Boolean).join(" – "),
      description: e.honors,
      sortYear: e.end_year ?? e.start_year ?? 0,
    }));
    const expItems = experiences.map((x) => ({
      kind: "experience" as const,
      key: `exp-${x.id}`,
      title: x.role_title,
      subtitle: x.organization,
      period: `${x.start_year ?? ""}${x.start_year || x.end_year || x.is_current ? " – " : ""}${
        x.is_current ? "aujourd'hui" : (x.end_year ?? "")
      }`,
      description: x.description,
      sortYear: x.is_current ? 9999 : (x.end_year ?? x.start_year ?? 0),
    }));
    return [...eduItems, ...expItems].sort((a, b) => b.sortYear - a.sortYear);
  }, [educations, experiences]);

  return (
    <div className="container-page pt-10 pb-44 sm:pt-14 md:pb-24 lg:pb-14">
      <Link
        to="/professeurs"
        search={{}}
        className="text-sm font-semibold text-primary hover:underline"
      >
        ← Tous les professeurs
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          {/* En-tête */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-2xl font-bold text-primary-soft-foreground">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={`Photo de ${profile.display_name}`}
                  className="size-full object-cover"
                />
              ) : (
                initials(profile.display_name) || "?"
              )}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {profile.display_name}
                </h1>
                {profile.identity_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    Vérifié
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {mainSubjectName ? `Professeur de ${mainSubjectName}` : "Professeur particulier"}
                {" · "}
                {profile.commune ? `${profile.commune}, ` : ""}
                {profile.city ?? "Côte d'Ivoire"}
              </p>
              {rating_avg != null && rating_count > 0 ? (
                <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-soft-foreground">
                  <Stars value={Number(rating_avg)} />
                  {Number(rating_avg).toFixed(1)} ({rating_count})
                </span>
              ) : null}
            </div>
          </div>

          {/* Titre + accroche */}
          {profile.headline ? (
            <p className="mt-6 font-display text-lg font-semibold text-foreground">
              {profile.headline}
            </p>
          ) : null}
          {profile.teaching_method ? (
            <p className="mt-1 text-sm text-muted-foreground">{profile.teaching_method}</p>
          ) : null}

          {/* Qualités en badges */}
          {qualities.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {qualities.map((q) => (
                <span
                  key={q}
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
                >
                  {q}
                </span>
              ))}
            </div>
          ) : null}

          {/* Expérience */}
          {profile.years_experience ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <GraduationCap className="size-4 text-primary" aria-hidden />
              {profile.years_experience} an{profile.years_experience > 1 ? "s" : ""} d'expérience
            </p>
          ) : null}

          {profile.intro_video_url ? (
            <a
              href={profile.intro_video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              <PlayCircle className="size-4" aria-hidden />
              Vidéo de présentation
            </a>
          ) : null}

          {/* Matière et spécialités */}
          {(mainSubjectName || otherSubjects.length > 0 || allLevels.length > 0) && (
            <section className="mt-8">
              <h2 className="font-display text-lg font-bold text-foreground">
                Matière et spécialités
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {mainSubjectName ? (
                  mainSubjectSlug ? (
                    <Link
                      to="/professeurs"
                      search={{ matiere: mainSubjectSlug }}
                      className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {mainSubjectName}
                    </Link>
                  ) : (
                    <span className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
                      {mainSubjectName}
                    </span>
                  )
                ) : null}
                {otherSubjects.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground"
                  >
                    {name}
                  </span>
                ))}
              </div>
              {allLevels.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {allLevels.map((level) => (
                    <span
                      key={level}
                      className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {level}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          )}

          {/* À propos de moi */}
          {profile.bio ? (
            <section className="mt-8">
              <h2 className="font-display text-lg font-bold text-foreground">À propos de moi</h2>
              <p className="mt-3 whitespace-pre-line text-muted-foreground">{profile.bio}</p>
            </section>
          ) : null}

          {/* Langues parlées */}
          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-foreground">Langues parlées</h2>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Languages className="size-4" aria-hidden />
              {languages.join(" • ")}
            </p>
          </section>

          {photos.length > 0 ? (
            <section className="mt-8">
              <h2 className="font-display text-lg font-bold text-foreground">En images</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) =>
                  photo.url ? (
                    <figure
                      key={photo.id}
                      className="overflow-hidden rounded-2xl border border-border/70 bg-muted"
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption ?? `Photo de ${profile.display_name}`}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    </figure>
                  ) : null,
                )}
              </div>
            </section>
          ) : null}

          {/* Notes détaillées + avis */}
          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-foreground">Avis</h2>
            {rating_count > 0 ? (
              <div className="mt-3 flex items-center gap-3">
                <span className="font-display text-3xl font-bold text-foreground">
                  {Number(rating_avg).toFixed(1)}
                </span>
                <div>
                  <Stars value={Number(rating_avg)} />
                  <p className="text-xs text-muted-foreground">
                    {rating_count} avis{profile.lessons_count > 0 ? ` · ${profile.lessons_count} cours donnés` : ""}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Aucun avis pour le moment. Les avis sont publiés après une séance terminée.
              </p>
            )}
            <ReviewsList reviews={reviews} />
          </section>

          {/* Agenda / disponibilités */}
          {sortedOffers.length > 0 ? (
            <section className="mt-8">
              <h2 className="font-display text-lg font-bold text-foreground">Disponibilités</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choisissez un créneau : la réservation démarre directement avec cette date et cette
                heure.
              </p>
              <div className="mt-4">
                <TeacherAvailabilityCalendar teacherId={profile.teacher_id} offers={sortedOffers} />
              </div>
            </section>
          ) : null}

          {/* CV / Parcours */}
          {timeline.length > 0 ? (
            <section className="mt-8">
              <h2 className="font-display text-lg font-bold text-foreground">CV / Parcours</h2>
              <ol className="mt-4 space-y-5 border-l border-border pl-5">
                {timeline.map((item) => (
                  <li key={item.key} className="relative">
                    <span
                      className={`absolute -left-[1.45rem] top-1 flex size-4 items-center justify-center rounded-full ${
                        item.kind === "education" ? "bg-primary" : "bg-foreground/70"
                      }`}
                    >
                      {item.kind === "education" ? (
                        <GraduationCap className="size-2.5 text-primary-foreground" aria-hidden />
                      ) : (
                        <Briefcase className="size-2.5 text-background" aria-hidden />
                      )}
                    </span>
                    <p className="font-semibold text-foreground">{item.title}</p>
                    {item.subtitle ? (
                      <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                    ) : null}
                    {item.period ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.period}</p>
                    ) : null}
                    {item.description ? (
                      <p className="mt-1.5 text-sm text-muted-foreground">{item.description}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* Offres de cours */}
          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-foreground">Offres de cours</h2>
            <ul className="mt-4 space-y-3">
              {sortedOffers.map((offer) => (
                <li
                  key={offer.id}
                  className="rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">
                        {offer.subjects?.name}
                      </p>
                      <h3 className="mt-0.5 font-display font-bold text-foreground">{offer.title}</h3>
                    </div>
                    <p className="font-display font-bold text-foreground">
                      {offer.price_fcfa.toLocaleString("fr-FR")} FCFA
                      <span className="text-xs font-medium text-muted-foreground"> / séance</span>
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {offer.offers_home ? (
                      <span className="inline-flex items-center gap-1">
                        <Home className="size-3.5" aria-hidden />À domicile
                      </span>
                    ) : null}
                    {offer.offers_online ? (
                      <span className="inline-flex items-center gap-1">
                        <Laptop className="size-3.5" aria-hidden />
                        En ligne
                      </span>
                    ) : null}
                  </div>
                  <Link
                    to="/reserver/$offerId"
                    params={{ offerId: offer.id }}
                    className="mt-3 inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                  >
                    Réserver ce cours
                  </Link>
                </li>
              ))}
              {sortedOffers.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                  Ce professeur n'a pas encore publié d'offre.
                </li>
              ) : null}
            </ul>
          </section>

          <SuggestedTeachers
            excludeTeacherId={profile.teacher_id}
            subjectSlug={mainSubjectSlug}
          />
        </div>

        {/* Colonne latérale (desktop) */}
        <aside className="hidden h-fit rounded-2xl border border-border/70 bg-secondary/40 p-5 lg:sticky lg:top-24 lg:block">
          <SidebarContent
            minPrice={minPrice}
            maxPrice={maxPrice}
            ratingAvg={rating_avg}
            ratingCount={rating_count}
            lessonsCount={profile.lessons_count}
            teacherId={profile.teacher_id}
            firstOfferId={sortedOffers[0]?.id ?? null}
          />
        </aside>
      </div>

      {/* Barre fixe mobile */}
      <div className="fixed inset-x-0 bottom-24 z-40 border-t border-border bg-card p-3 shadow-[var(--shadow-card)] md:bottom-0 lg:hidden">
        <MobileBookingBar
          minPrice={minPrice}
          teacherId={profile.teacher_id}
          firstOfferId={sortedOffers[0]?.id ?? null}
        />
      </div>
    </div>
  );
}

function ReviewsList({
  reviews,
}: {
  reviews: { id: string; rating: number; comment: string | null; created_at: string; author_name: string | null }[];
}) {
  const [visible, setVisible] = useState(5);
  if (reviews.length === 0) return null;
  const shown = reviews.slice(0, visible);

  return (
    <>
      <ul className="mt-4 space-y-3">
        {shown.map((review) => (
          <li key={review.id} className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={review.rating} />
              <span className="text-sm font-semibold text-foreground">
                {review.author_name ?? "Famille BARA"}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(review.created_at).toLocaleDateString("fr-FR")}
              </span>
            </div>
            {review.comment ? (
              <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {visible < reviews.length ? (
        <button
          type="button"
          onClick={() => setVisible((v) => v + 5)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          Afficher plus d'avis
          <ChevronDown className="size-4" aria-hidden />
        </button>
      ) : null}
    </>
  );
}

function SuggestedTeachers({
  excludeTeacherId,
  subjectSlug,
}: {
  excludeTeacherId: string;
  subjectSlug: string | null;
}) {
  const suggestedQuery = useQuery({
    queryKey: ["suggested-teachers", excludeTeacherId, subjectSlug],
    enabled: Boolean(subjectSlug),
    queryFn: () => searchTeachers({ data: { matiere: subjectSlug ?? undefined } }),
  });

  const suggestions = (suggestedQuery.data ?? []).filter((t) => t.teacher_id !== excludeTeacherId).slice(0, 4);
  if (suggestions.length === 0) return null;

  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="font-display text-lg font-bold text-foreground">Professeurs suggérés</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {suggestions.map((t) => (
          <li key={t.teacher_id}>
            <Link
              to="/professeurs/$id"
              params={{ id: t.teacher_id }}
              className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 transition-colors hover:bg-secondary"
            >
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft font-display text-sm font-bold text-primary-soft-foreground">
                {t.avatar_url ? (
                  <img src={t.avatar_url} alt="" className="size-full object-cover" />
                ) : (
                  initials(t.display_name) || "?"
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {t.display_name}
                </span>
                <span className="block text-xs font-semibold text-primary">
                  {t.min_price_fcfa.toLocaleString("fr-FR")} FCFA / séance
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function useHasBookedBefore(teacherId: string) {
  const { ready, signedIn, primaryRole, userId, rolesLoading } = useSessionRoles();
  const rolesKnown = !signedIn || !rolesLoading;
  const canBook = primaryRole === "parent" || primaryRole === "student";

  const query = useQuery({
    queryKey: ["has-booked-before", userId, teacherId],
    enabled: ready && signedIn && rolesKnown && canBook && Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id")
        .eq("requester_id", userId!)
        .eq("teacher_id", teacherId)
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });

  return {
    ready: ready && rolesKnown && (!signedIn || !canBook || !query.isLoading),
    hasBooked: query.data ?? false,
  };
}

const ctaClass =
  "inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90";

function SidebarContent({
  minPrice,
  maxPrice,
  ratingAvg,
  ratingCount,
  lessonsCount,
  teacherId,
  firstOfferId,
}: {
  minPrice: number | null;
  maxPrice: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  lessonsCount: number;
  teacherId: string;
  firstOfferId: string | null;
}) {
  return (
    <>
      {minPrice != null ? (
        <p className="font-display text-2xl font-bold text-foreground">
          {minPrice === maxPrice ? "" : "à partir de "}
          {minPrice.toLocaleString("fr-FR")} FCFA
          <span className="text-sm font-medium text-muted-foreground"> / séance</span>
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {ratingCount > 0 ? (
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            <Star className="size-3.5 fill-primary text-primary" aria-hidden />
            {Number(ratingAvg).toFixed(1)} ({ratingCount} avis)
          </span>
        ) : (
          <span>Pas encore d'avis</span>
        )}
        {lessonsCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden />
            {lessonsCount} cours donné{lessonsCount > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <BookingCta teacherId={teacherId} firstOfferId={firstOfferId} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Les coordonnées privées des professeurs ne sont jamais affichées publiquement.
      </p>
    </>
  );
}

function MobileBookingBar({
  minPrice,
  teacherId,
  firstOfferId,
}: {
  minPrice: number | null;
  teacherId: string;
  firstOfferId: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      {minPrice != null ? (
        <p className="font-display text-base font-bold text-foreground">
          {minPrice.toLocaleString("fr-FR")} FCFA
          <span className="block text-[11px] font-normal text-muted-foreground">/ séance</span>
        </p>
      ) : (
        <span />
      )}
      <div className="max-w-[65%] flex-1">
        <BookingCta teacherId={teacherId} firstOfferId={firstOfferId} compact />
      </div>
    </div>
  );
}

function BookingCta({
  teacherId,
  firstOfferId,
  compact = false,
}: {
  teacherId: string;
  firstOfferId: string | null;
  compact?: boolean;
}) {
  const { ready, signedIn, primaryRole } = useSessionRoles();
  const { ready: trialReady, hasBooked } = useHasBookedBefore(teacherId);
  const cls = compact ? `${ctaClass} px-4 py-2 text-xs sm:text-sm` : ctaClass;

  if (!ready) {
    return <span className={`${cls} pointer-events-none opacity-60`}>Chargement…</span>;
  }

  if (!signedIn) {
    return (
      <a href="/auth" className={cls}>
        Créer un compte pour réserver
      </a>
    );
  }

  if (primaryRole === "teacher" || primaryRole === "admin") {
    if (compact) return null;
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
        Vous êtes connecté avec un compte {primaryRole === "admin" ? "administrateur" : "professeur"}
        . La réservation est réservée aux parents et aux apprenants.
      </p>
    );
  }

  if (!firstOfferId) {
    if (compact) return null;
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
        Ce professeur n'a pas encore d'offre réservable.
      </p>
    );
  }

  const label = !trialReady ? "…" : hasBooked ? "Réserver un cours" : "Réserver un cours d'essai";

  return (
    <div>
      <Link to="/reserver/$offerId" params={{ offerId: firstOfferId }} className={cls}>
        {label}
      </Link>
      {!compact && trialReady && !hasBooked ? (
        <p className="mt-2 text-center text-xs font-semibold text-primary">
          Cours d'essai disponible avec ce professeur
        </p>
      ) : null}
    </div>
  );
}
