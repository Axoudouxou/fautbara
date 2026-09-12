import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Baby,
  Briefcase,
  CalendarClock,
  ChevronRight,
  Gavel,
  KeyRound,
  Loader2,
  Mail,
  SlidersHorizontal,
  LogOut,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SectionTabs, accountTabs } from "@/components/section-tabs";

export const Route = createFileRoute("/_authenticated/compte/")({
  head: () => ({
    meta: [
      { title: "Mon compte — BARA" },
      { name: "description", content: "Gérez votre profil BARA, vos enfants et vos informations personnelles." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

const ROLE_LABELS: Record<string, string> = {
  parent: "Parent",
  student: "Étudiant / adulte",
  teacher: "Intervenant",
  admin: "Administrateur",
};

function AccountPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as string);
    },
  });

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [commune, setCommune] = useState("");

  useEffect(() => {
    if (profileQuery.data) {
      setDisplayName(profileQuery.data.display_name ?? "");
      setPhone(profileQuery.data.phone ?? "");
      setCommune(profileQuery.data.commune ?? "");
    }
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          phone: phone.trim() || null,
          commune: commune.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil mis à jour");
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    },
    onError: (err) =>
      toast.error("Enregistrement impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const roles = rolesQuery.data ?? [];

  return (
    <div className="container-page py-5 pb-24 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground sm:text-3xl">
            Mon compte
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          <SectionTabs items={accountTabs(roles.includes("teacher"))} />
        </div>
        <button
          type="button"
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <LogOut className="size-4" aria-hidden />
          Se déconnecter
        </button>
      </div>

      {roles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {roles.map((r) => (
            <span
              key={r}
              className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-soft-foreground"
            >
              {ROLE_LABELS[r] ?? r}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:rounded-3xl sm:p-6">
          <h2 className="font-display text-base font-bold text-foreground sm:text-lg">Profil</h2>

          {profileQuery.isLoading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
            </div>
          ) : profileQuery.isError ? (
            <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Impossible de charger votre profil. Réessayez plus tard.
            </p>
          ) : (
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
            >
              <div>
                <label htmlFor="acc-name" className="text-sm font-semibold text-foreground">
                  Nom complet
                </label>
                <input
                  id="acc-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="acc-phone" className="text-sm font-semibold text-foreground">
                    Téléphone <span className="font-normal text-muted-foreground">(privé)</span>
                  </label>
                  <input
                    id="acc-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+225 …"
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                  />
                </div>
                <div>
                  <label htmlFor="acc-commune" className="text-sm font-semibold text-foreground">
                    Commune
                  </label>
                  <input
                    id="acc-commune"
                    type="text"
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    placeholder="Ex. Cocody"
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {saveMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Enregistrer
              </button>
            </form>
          )}
        </section>

        <div className="space-y-5">
          <AccountGroup title="Mon activité">
            <AccountRow
              to="/compte/portefeuille"
              icon={Wallet}
              title="Mon portefeuille"
              description="Solde, remboursements et demandes de retrait."
            />
            <AccountRow
              to="/compte/calendrier"
              icon={CalendarClock}
              title="Mon calendrier de cours"
              description="Séances de la semaine, statuts et annulations."
            />
            {roles.includes("parent") && (
              <AccountRow
                to="/compte/enfants"
                icon={Baby}
                title="Mes enfants"
                description="Créez et gérez les profils pour lesquels vous réservez."
              />
            )}
            {roles.includes("student") && (
              <AccountRow
                to="/parcours"
                icon={SlidersHorizontal}
                title="Mon parcours"
                description="Objectifs, formules, comptes-rendus et devoirs."
              />
            )}
            <AccountRow
              to="/professeurs"
              search={{}}
              icon={Search}
              title="Chercher un intervenant"
              description="Par matière, niveau, commune et budget."
            />
          </AccountGroup>

          <AccountGroup title="Réglages">
            <AccountRow
              to="/onboarding"
              icon={SlidersHorizontal}
              title="Mes préférences"
              description="Matières, niveaux, budget, communes et disponibilités."
            />
            <AccountRow
              to="/compte/litiges"
              icon={Gavel}
              title="Mes litiges"
              description="Signalements sur vos séances et décisions de l'équipe."
            />
          </AccountGroup>

          {(roles.includes("teacher") || roles.includes("admin")) && (
            <AccountGroup title="Espaces professionnels">
              {roles.includes("teacher") && (
                <AccountRow
                  to="/pro"
                  icon={Briefcase}
                  title="Espace intervenant"
                  description="Profil, offres de cours et visibilité."
                />
              )}
              {roles.includes("admin") && (
                <AccountRow
                  to="/admin"
                  icon={ShieldCheck}
                  title="Administration"
                  description="Professeurs, vérifications, offres et litiges."
                />
              )}
            </AccountGroup>
          )}

          <AccountSecuritySection currentEmail={user.email ?? ""} />
        </div>

      </div>
    </div>
  );
}

/** Groupe de raccourcis du compte. */
function AccountGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-base font-bold text-foreground sm:text-lg">{title}</h2>
      <div className="mt-2.5 space-y-2">{children}</div>
    </section>
  );
}

/** Raccourci compact vers un écran du compte. */
function AccountRow({
  to,
  search,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  search?: Record<string, never>;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  const linkProps = { to, ...(search ? { search } : {}) } as unknown as { to: "/compte" };
  return (
    <Link
      {...linkProps}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50 sm:p-4"
    >

      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-sm font-bold text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}


/** Réglages de connexion : adresse e-mail et mot de passe. */
function AccountSecuritySection({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");

  const emailMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      if (error) throw error;
    },
    onSuccess: () =>
      toast.success("E-mail en cours de modification", {
        description: "Confirmez le changement depuis le lien envoyé à la nouvelle adresse.",
      }),
    onError: (err) =>
      toast.error("Modification impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      setPassword("");
      toast.success("Mot de passe mis à jour");
    },
    onError: (err) =>
      toast.error("Modification impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg font-bold text-foreground">Connexion et sécurité</h2>

      <form
        className="mt-5 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          emailMutation.mutate();
        }}
      >
        <label htmlFor="acc-email" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Mail className="size-4 text-primary" aria-hidden /> Adresse e-mail
        </label>
        <input
          id="acc-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
        />
        <button
          type="submit"
          disabled={emailMutation.isPending || email.trim() === currentEmail}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
        >
          {emailMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Changer d&apos;e-mail
        </button>
      </form>

      <form
        className="mt-6 space-y-2 border-t border-border pt-6"
        onSubmit={(e) => {
          e.preventDefault();
          passwordMutation.mutate();
        }}
      >
        <label htmlFor="acc-pwd" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <KeyRound className="size-4 text-primary" aria-hidden /> Nouveau mot de passe
        </label>
        <input
          id="acc-pwd"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8 caractères minimum"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
        />
        <button
          type="submit"
          disabled={passwordMutation.isPending || password.length < 8}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
        >
          {passwordMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Mettre à jour le mot de passe
        </button>
      </form>
    </section>
  );
}
