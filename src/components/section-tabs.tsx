import { Link } from "@tanstack/react-router";

export type SectionTab = {
  label: string;
  to: string;
  search?: Record<string, unknown>;
};

/**
 * Sous-navigation d'un espace regroupé (ex. « Mes cours » = séances + calendrier).
 * Garde l'identité BARA : pilules arrondies, beige/brun nude.
 */
export function SectionTabs({ items }: { items: SectionTab[] }) {
  return (
    <nav className="mt-5 flex flex-wrap gap-2" aria-label="Sections de l'espace">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to as never}
          {...(item.search ? ({ search: item.search } as never) : {})}
          activeOptions={{ exact: true }}
          className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary data-[status=active]:border-primary data-[status=active]:bg-primary-soft/50 data-[status=active]:text-primary"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** « Mes cours » côté parent / étudiant : réservations, calendrier, litiges. */
export const learnerCoursesTabs: SectionTab[] = [
  { label: "Séances", to: "/compte/reservations" },
  { label: "Calendrier", to: "/compte/calendrier" },
  { label: "Litiges", to: "/compte/litiges" },
];

/** « Mes cours » côté intervenant : séances, semaine, élèves (une seule page). */
/** « Mes offres » côté intervenant : offres + disponibilités. */
export const teacherOffersTabs: SectionTab[] = [
  { label: "Mes offres", to: "/pro/offres" },
  { label: "Disponibilités", to: "/pro/disponibilites" },
];

/** « Mon compte » : profil, paiements/revenus, paramètres avancés. */
export function accountTabs(isTeacher: boolean): SectionTab[] {
  const tabs: SectionTab[] = [{ label: "Profil et paramètres", to: "/compte" }];
  if (isTeacher) {
    tabs.push({ label: "Profil public", to: "/pro/profil" });
    tabs.push({ label: "Vérification", to: "/pro/verification" });
    tabs.push({ label: "Revenus", to: "/compte/portefeuille" });
  } else {
    tabs.push({ label: "Paiements", to: "/compte/portefeuille" });
  }
  return tabs;
}
