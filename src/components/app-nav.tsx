import { Link, linkOptions } from "@tanstack/react-router";
import {
  Baby,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Gavel,
  Home,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Route as RouteIcon,
  Search,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSessionRoles, type AppRole } from "@/hooks/use-session-roles";

type Tab = {
  label: string;
  short: string;
  icon: LucideIcon;
  // linkOptions() valide la cible à la définition ; le spread reste générique.
  link: Record<string, unknown>;
};

const searchTab: Tab = {
  label: "Rechercher",
  short: "Rechercher",
  icon: Search,
  link: linkOptions({ to: "/professeurs", search: {} }),
};

const accountTab: Tab = {
  label: "Mon compte",
  short: "Compte",
  icon: UserCog,
  link: linkOptions({ to: "/compte" }),
};

const homeTab: Tab = {
  label: "Accueil",
  short: "Accueil",
  icon: Home,
  link: linkOptions({ to: "/accueil" }),
};

/** Parent : Accueil · Mes enfants · Mes cours · Rechercher · Mon compte */
const parentTabs: Tab[] = [
  homeTab,
  { label: "Mes enfants", short: "Enfants", icon: Baby, link: linkOptions({ to: "/compte/enfants" }) },
  {
    label: "Mes cours",
    short: "Mes cours",
    icon: CalendarDays,
    link: linkOptions({ to: "/compte/reservations" }),
  },
  searchTab,
  accountTab,
];

/** Étudiant / adulte : Accueil · Mon parcours · Mes cours · Rechercher · Mon compte */
const studentTabs: Tab[] = [
  homeTab,
  { label: "Mon parcours", short: "Parcours", icon: RouteIcon, link: linkOptions({ to: "/parcours" }) },
  {
    label: "Mes cours",
    short: "Mes cours",
    icon: CalendarDays,
    link: linkOptions({ to: "/compte/reservations" }),
  },
  searchTab,
  accountTab,
];

/** Enfant : consultation seulement, aucun accès financier. */
const childTabs: Tab[] = [
  homeTab,
  {
    label: "Mes cours",
    short: "Mes cours",
    icon: CalendarDays,
    link: linkOptions({ to: "/compte/calendrier" }),
  },
  { label: "Devoirs", short: "Devoirs", icon: ClipboardList, link: linkOptions({ to: "/devoirs" }) },
  { label: "Messages", short: "Messages", icon: MessageSquare, link: linkOptions({ to: "/messages" }) },
];

/** Intervenant : Accueil · Mes élèves · Agenda · Demandes · Mon compte */
const teacherTabs: Tab[] = [
  homeTab,
  { label: "Mes élèves", short: "Élèves", icon: Users, link: linkOptions({ to: "/pro/eleves" }) },
  { label: "Agenda", short: "Agenda", icon: CalendarDays, link: linkOptions({ to: "/pro/agenda" }) },
  { label: "Demandes", short: "Demandes", icon: Inbox, link: linkOptions({ to: "/pro/demandes" }) },
  accountTab,
];

const adminTabs: Tab[] = [
  {
    label: "Dashboard",
    short: "Bord",
    icon: LayoutDashboard,
    link: linkOptions({ to: "/admin" }),
  },
  {
    label: "Utilisateurs",
    short: "Users",
    icon: Users,
    link: linkOptions({ to: "/admin/professeurs" }),
  },
  { label: "Modération", short: "Modér.", icon: Gavel, link: linkOptions({ to: "/admin/litiges" }) },
  { label: "Catalogue", short: "Offres", icon: BookOpen, link: linkOptions({ to: "/admin/offres" }) },
  { label: "Finances", short: "Finances", icon: Wallet, link: linkOptions({ to: "/admin/retraits" }) },
];

export function tabsForRole(role: AppRole | null, isChild = false): Tab[] {
  if (role === "admin") return adminTabs;
  if (role === "teacher") return teacherTabs;
  if (role === "parent") return parentTabs;
  if (isChild) return childTabs;
  return studentTabs;
}

/** Onglets applicatifs affichés dans le header (tablette et desktop). */
export function AppTabsBar({ role, isChild = false }: { role: AppRole | null; isChild?: boolean }) {
  const tabs = tabsForRole(role, isChild);
  return (
    <nav
      className="hidden items-center gap-1 md:flex"
      aria-label="Navigation de l'application"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          {...(tab.link as { to: string })}
          activeOptions={{ exact: true }}
          className="group relative rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-primary"
        >
          <span className="relative">
            {tab.label}
            <span className="pointer-events-none absolute -bottom-2 left-0 hidden h-[3px] w-full rounded-full bg-primary group-data-[status=active]:block" />
          </span>
        </Link>
      ))}
    </nav>
  );
}

/** Barre de navigation basse, mobile-first. */
export function AppTabsMobileBar({ role, isChild = false }: { role: AppRole | null; isChild?: boolean }) {
  const tabs = tabsForRole(role, isChild);
  const hasPrimaryAction = role !== "admin" && !isChild;

  const renderTab = (tab: Tab) => {
    const Icon = tab.icon;
    return (
      <li key={tab.label} className="min-w-0">
        <Link
          {...(tab.link as { to: string })}
          activeOptions={{ exact: true }}
          className="group flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-semibold text-muted-foreground transition-colors data-[status=active]:text-primary"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors group-data-[status=active]:bg-primary/10">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="block w-full truncate text-center">{tab.short}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Navigation de l'application"
    >
      <ul className="relative grid grid-cols-5 items-end">
        {tabs.map(renderTab)}
        {hasPrimaryAction && <li className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"><MobilePrimaryAction role={role} /></li>}
      </ul>
    </nav>
  );
}

function MobilePrimaryAction({ role }: { role: AppRole | null }) {
  if (role === "teacher") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            className="pointer-events-auto absolute bottom-8 size-12 rounded-full border-4 border-background shadow-[var(--shadow-raised)]"
            aria-label="Ajouter ou gérer mon activité"
          >
            <Plus className="size-5" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="center" className="w-64 rounded-2xl p-2">
          <Link to="/pro/disponibilites" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-foreground hover:bg-secondary">
            <CalendarDays className="size-4 text-primary" aria-hidden /> Gérer mes disponibilités
          </Link>
          <Link to="/pro/offres" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-foreground hover:bg-secondary">
            <BookOpen className="size-4 text-primary" aria-hidden /> Créer une offre
          </Link>
        </PopoverContent>
      </Popover>
    );
  }

  if (role === "parent") {
    return (
      <Button asChild size="icon" className="pointer-events-auto absolute bottom-8 size-12 rounded-full border-4 border-background shadow-[var(--shadow-raised)]">
        <Link to="/choisir-enfant" aria-label="Rechercher un intervenant pour un enfant">
          <Plus className="size-5" aria-hidden />
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild size="icon" className="pointer-events-auto absolute bottom-8 size-12 rounded-full border-4 border-background shadow-[var(--shadow-raised)]">
      <Link to="/professeurs" search={{}} aria-label="Rechercher un intervenant pour moi">
        <Plus className="size-5" aria-hidden />
      </Link>
    </Button>
  );
}

/** Header + bottom bar applicatifs, ou null si l'utilisateur n'est pas connecté. */
export function useAppNav() {
  const { ready, signedIn, primaryRole, isChild, rolesLoading } = useSessionRoles();
  return { ready, signedIn, primaryRole, isChild, rolesLoading };
}
