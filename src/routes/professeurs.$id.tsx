import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, Clock, Home, Laptop, MapPin, Star } from "lucide-react";

import { getTeacherPublicProfile } from "@/lib/catalog.functions";

export const Route = createFileRoute("/professeurs/$id")({
  loader: async ({ params }) => {
    const result = await getTeacherPublicProfile({ data: { id: params.id } });
    if (!result.profile) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Profil indisponible — FAUT BARA" }, { name: "robots", content: "noindex" }],
      };
    }
    const { profile } = loaderData;
    const title = `${profile.display_name} — professeur particulier | FAUT BARA`;
    const description =
      profile.headline ??
      `Découvrez le profil de ${profile.display_name} sur FAUT BARA et ses offres de cours particuliers.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
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

function TeacherPublicPage() {
  const { profile, offers } = Route.useLoaderData();

  return (
    <div className="container-page py-10 sm:py-14">
      <Link
        to="/professeurs"
        search={{}}
        className="text-sm font-semibold text-primary hover:underline"
      >
        ← Tous les professeurs
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-2xl font-bold text-primary-soft-foreground">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={`Photo de ${profile.display_name}`}
                  className="size-full object-cover"
                />
              ) : (
                profile.display_name.slice(0, 1).toUpperCase()
              )}
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {profile.display_name}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" aria-hidden />
                {profile.commune ? `${profile.commune}, ` : ""}
                {profile.city ?? "Côte d'Ivoire"}
                {profile.years_experience
                  ? ` • ${profile.years_experience} an${profile.years_experience > 1 ? "s" : ""} d'expérience`
                  : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                {profile.identity_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-success">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    Identité vérifiée
                  </span>
                ) : null}
                {profile.qualifications_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-success">
                    <Star className="size-3.5" aria-hidden />
                    Diplômes vérifiés
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {profile.headline ? (
            <p className="mt-6 font-display text-lg font-semibold text-foreground">
              {profile.headline}
            </p>
          ) : null}
          {profile.bio ? (
            <p className="mt-3 whitespace-pre-line text-muted-foreground">{profile.bio}</p>
          ) : null}

          <h2 className="mt-10 font-display text-xl font-bold text-foreground">Offres de cours</h2>
          <ul className="mt-4 space-y-4">
            {offers.map((offer) => {
              const levels = (offer.offer_levels ?? [])
                .map((entry) => entry.levels?.name)
                .filter(Boolean) as string[];
              return (
                <li
                  key={offer.id}
                  className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">
                        {offer.subjects?.name}
                      </p>
                      <h3 className="mt-1 font-display text-lg font-bold text-foreground">
                        {offer.title}
                      </h3>
                    </div>
                    <p className="font-display text-lg font-bold text-foreground">
                      {offer.price_fcfa.toLocaleString("fr-FR")} FCFA
                      <span className="text-sm font-medium text-muted-foreground"> / séance</span>
                    </p>
                  </div>
                  {offer.description ? (
                    <p className="mt-3 text-sm text-muted-foreground">{offer.description}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden />
                      {offer.duration_minutes} min
                    </span>
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
                    {levels.length > 0 ? <span>Niveaux : {levels.join(", ")}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="h-fit rounded-2xl border border-border/70 bg-secondary/40 p-5 lg:sticky lg:top-24">
          <p className="font-display font-bold text-foreground">Intéressé par ce professeur ?</p>
          <p className="mt-2 text-sm text-muted-foreground">
            La réservation de créneaux arrive prochainement sur FAUT BARA. Créez votre compte dès
            maintenant pour préparer vos demandes de cours.
          </p>
          <a
            href="/auth"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Créer un compte
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            Les coordonnées privées des professeurs ne sont jamais affichées publiquement.
          </p>
        </aside>
      </div>
    </div>
  );
}
