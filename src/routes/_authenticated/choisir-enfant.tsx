import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Baby, Check, Loader2, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, UserAvatar } from "@/components/product-ui";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/choisir-enfant")({
  head: () => ({
    meta: [
      { title: "Choisir un enfant — BARA" },
      { name: "description", content: "Choisissez l’enfant pour lequel vous recherchez un intervenant." },
      { property: "og:title", content: "Choisir un enfant — BARA" },
      { property: "og:description", content: "Choisissez l’enfant pour lequel vous recherchez un intervenant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChooseChildPage,
});

function ChooseChildPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  const childrenQuery = useQuery({
    queryKey: ["children", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id, first_name, school_level, birth_year")
        .eq("parent_id", user.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const children = childrenQuery.data ?? [];

  return (
    <main className="container-page py-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Pour quel enfant ?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Le choix est conservé jusqu’à la formule et à la programmation des séances.
        </p>

        {childrenQuery.isLoading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Chargement…
          </p>
        ) : children.length ? (
          <>
            <ul className="mt-5 space-y-2.5">
              {children.map((child) => {
                const isActive = selected === child.id;
                return (
                  <li key={child.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(child.id)}
                      aria-pressed={isActive}
                      className={`flex w-full items-center gap-3 rounded-2xl border bg-card px-3.5 py-3 text-left shadow-[var(--shadow-card)] transition ${
                        isActive ? "border-primary" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <UserAvatar name={child.first_name} className="size-10" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display font-bold text-foreground">{child.first_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {child.school_level || "Niveau à préciser"}
                        </span>
                      </span>
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                          isActive ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent"
                        }`}
                        aria-hidden
                      >
                        <Check className="size-3.5" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <Button
              type="button"
              disabled={!selected}
              className="mt-5 w-full rounded-xl"
              onClick={() => {
                if (selected) navigate({ to: "/professeurs", search: { enfant: selected } });
              }}
            >
              Continuer
            </Button>

            <div className="mt-4 text-center">
              <Link to="/professeurs" search={{}} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
                <Search className="size-4" aria-hidden /> Parcourir sans choisir
              </Link>
            </div>
          </>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={Baby}
              title="Ajoutez d’abord un enfant"
              description="Un profil enfant est nécessaire pour rechercher et réserver son accompagnement."
              action={
                <Button asChild>
                  <Link to="/compte/enfants">
                    <Plus className="size-4" /> Ajouter un enfant
                  </Link>
                </Button>
              }
            />
          </div>
        )}
      </div>
    </main>
  );
}
