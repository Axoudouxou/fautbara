import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Baby, Loader2, Plus, Search } from "lucide-react";

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

  return (
    <main className="container-page py-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase text-muted-foreground">Nouvel accompagnement</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-foreground">Pour quel enfant recherchez-vous ?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Le choix est conservé jusqu’à la formule et à la programmation des séances.
        </p>

        {childrenQuery.isLoading ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement…</p>
        ) : childrenQuery.data?.length ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {childrenQuery.data.map((child) => (
              <li key={child.id}>
                <Link
                  to="/professeurs"
                  search={{ enfant: child.id }}
                  className="group flex h-full flex-col rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition hover:border-primary/40"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar name={child.first_name} className="size-12" />
                    <div className="min-w-0">
                      <h2 className="truncate font-display font-bold text-foreground">{child.first_name}</h2>
                      <p className="text-xs text-muted-foreground">{child.school_level || "Niveau à préciser"}</p>
                    </div>
                  </div>
                  <span className="mt-6 inline-flex items-center justify-between text-sm font-semibold text-primary">
                    Rechercher un intervenant <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8">
            <EmptyState
              icon={Baby}
              title="Ajoutez d’abord un enfant"
              description="Un profil enfant est nécessaire pour rechercher et réserver son accompagnement."
              action={<Button asChild><Link to="/compte/enfants"><Plus className="size-4" /> Ajouter un enfant</Link></Button>}
            />
          </div>
        )}

        <div className="mt-8 border-t border-border pt-6">
          <Button asChild variant="outline"><Link to="/professeurs" search={{}}><Search className="size-4" /> Parcourir sans choisir</Link></Button>
        </div>
      </div>
    </main>
  );
}