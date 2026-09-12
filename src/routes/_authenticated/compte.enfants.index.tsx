import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/product-ui";
import { supabase } from "@/integrations/supabase/client";
import { useSessionRoles } from "@/hooks/use-session-roles";

export const Route = createFileRoute("/_authenticated/compte/enfants/")({
  head: () => ({
    meta: [
      { title: "Mes enfants — BARA" },
      { name: "description", content: "Créez et gérez les profils de vos enfants pour réserver leurs cours particuliers." },
      { property: "og:title", content: "Mes enfants — BARA" },
      { property: "og:description", content: "Créez et gérez les profils de vos enfants pour réserver leurs cours particuliers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChildrenPage,
});

const CURRENT_YEAR = new Date().getFullYear();

function ChildrenPage() {
  const { user } = Route.useRouteContext();
  const { roles, rolesLoading } = useSessionRoles();
  const isParent = roles.includes("parent");
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [schoolLevel, setSchoolLevel] = useState("");

  const childrenQuery = useQuery({
    queryKey: ["children", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const overviewQuery = useQuery({
    queryKey: ["children-overview", user.id],
    enabled: Boolean(childrenQuery.data?.length),
    queryFn: async () => {
      const [packs, bookings] = await Promise.all([
        supabase.from("packs").select("child_id, status, sessions_total, sessions_used").eq("buyer_id", user.id),
        supabase.from("bookings").select("child_id, status, scheduled_at").eq("requester_id", user.id).gte("scheduled_at", new Date().toISOString()),
      ]);
      if (packs.error) throw packs.error;
      if (bookings.error) throw bookings.error;
      return { packs: packs.data ?? [], bookings: bookings.data ?? [] };
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const year = birthYear ? Number(birthYear) : null;
      if (year !== null && (year < 2000 || year > CURRENT_YEAR)) {
        throw new Error("Année de naissance invalide.");
      }
      const { error } = await supabase.from("children").insert({
        parent_id: user.id,
        first_name: firstName.trim(),
        birth_year: year,
        school_level: schoolLevel.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil enfant créé");
      setFirstName("");
      setBirthYear("");
      setSchoolLevel("");
      queryClient.invalidateQueries({ queryKey: ["children", user.id] });
    },
    onError: (err) =>
      toast.error("Création impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("children").delete().eq("id", id).eq("parent_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil supprimé");
      queryClient.invalidateQueries({ queryKey: ["children", user.id] });
    },
    onError: () => toast.error("Suppression impossible"),
  });

  const children = childrenQuery.data ?? [];

  if (!rolesLoading && !isParent) {
    return (
      <div className="container-page py-14">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h1 className="font-display text-xl font-bold text-foreground">Espace réservé aux parents</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Les profils enfants servent aux parents qui réservent des cours. Votre compte n&apos;a
            pas accès à cette section.
          </p>
        </div>
      </div>
    );
  }

  return (

    <div className="container-page py-10 sm:py-14">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Mes enfants</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Chaque enfant dispose d'un profil rattaché à votre compte. C'est pour eux que vous
        réservez les cours — ils n'ont pas besoin de compte.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
        <section
          aria-label="Liste des enfants"
          className="grid content-start gap-3 sm:grid-cols-2"
        >
          {childrenQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
            </div>
          ) : children.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
              <p className="font-display font-bold text-foreground">Aucun enfant pour le moment</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajoutez un premier profil avec le formulaire ci-contre.
              </p>
            </div>
          ) : (
            children.map((child) => {
              const activePacks = (overviewQuery.data?.packs ?? []).filter((pack) => pack.child_id === child.id && pack.status === "active");
              const sessionsLeft = activePacks.reduce((sum, pack) => sum + Math.max(pack.sessions_total - pack.sessions_used, 0), 0);
              const sessionsTotal = activePacks.reduce((sum, pack) => sum + pack.sessions_total, 0);
              const sessionsUsed = activePacks.reduce((sum, pack) => sum + pack.sessions_used, 0);
              const nextBooking = (overviewQuery.data?.bookings ?? []).filter((booking) => booking.child_id === child.id && booking.status === "accepted").sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0];
              return (
              <article
                key={child.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft font-display font-bold text-primary-soft-foreground">
                    {child.first_name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-bold text-foreground">{child.first_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[
                        child.school_level,
                        child.birth_year ? `né(e) en ${child.birth_year}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Profil enfant"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Supprimer le profil de ${child.first_name}`}
                    onClick={() => deleteMutation.mutate(child.id)}
                    className="shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>

                {sessionsTotal > 0 && (
                  <div className="mt-3">
                    <ProgressBar
                      value={(sessionsUsed / sessionsTotal) * 100}
                      label={`${sessionsUsed} séance${sessionsUsed > 1 ? "s" : ""} effectuée${sessionsUsed > 1 ? "s" : ""} sur ${sessionsTotal}`}
                    />
                  </div>
                )}

                <p className="mt-3 text-xs text-muted-foreground">
                  {sessionsLeft > 0
                    ? `${sessionsLeft} séance${sessionsLeft > 1 ? "s" : ""} restante${sessionsLeft > 1 ? "s" : ""} · ${activePacks.length} formule${activePacks.length > 1 ? "s" : ""} active${activePacks.length > 1 ? "s" : ""}`
                    : "Aucune formule active"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {nextBooking
                    ? `Prochain cours ${new Date(nextBooking.scheduled_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })} à ${new Date(nextBooking.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                    : "Aucun cours programmé"}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                  <Link
                    to="/compte/enfants/$childId"
                    params={{ childId: child.id }}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    Voir son parcours <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <Link
                    to="/professeurs"
                    search={{ enfant: child.id }}
                    className="inline-flex text-sm font-semibold text-foreground hover:underline"
                  >
                    Trouver un intervenant
                  </Link>
                </div>
              </article>
              );
            })
          )}
        </section>

        <section className="h-fit rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-lg font-bold text-foreground">Ajouter un enfant</h2>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate();
            }}
          >
            <div>
              <label htmlFor="child-name" className="text-sm font-semibold text-foreground">
                Prénom
              </label>
              <input
                id="child-name"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex. Kévin"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="child-year" className="text-sm font-semibold text-foreground">
                  Année de naissance
                </label>
                <input
                  id="child-year"
                  type="number"
                  min={2000}
                  max={CURRENT_YEAR}
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  placeholder="Ex. 2012"
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div>
                <label htmlFor="child-level" className="text-sm font-semibold text-foreground">
                  Niveau scolaire
                </label>
                <input
                  id="child-level"
                  type="text"
                  value={schoolLevel}
                  onChange={(e) => setSchoolLevel(e.target.value)}
                  placeholder="Ex. 4e"
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={addMutation.isPending}
              className="rounded-xl"
            >
              {addMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              Ajouter
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
