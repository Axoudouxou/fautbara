import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Baby, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSessionRoles } from "@/hooks/use-session-roles";

export function useSelectedChild(childId?: string) {
  const { userId, roles } = useSessionRoles();
  return useQuery({
    queryKey: ["selected-child", userId, childId],
    enabled: Boolean(userId && childId && roles.includes("parent")),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id, first_name, school_level")
        .eq("id", childId ?? "")
        .eq("parent_id", userId ?? "")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function ParentChildContext({ childId }: { childId?: string | undefined }) {
  const childQuery = useSelectedChild(childId);
  const child = childQuery.data;
  if (!child) return null;

  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary-soft/40 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
          <Baby className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">Recherche pour</p>
          <p className="truncate font-display text-sm font-bold text-foreground">
            {child.first_name}{child.school_level ? ` · ${child.school_level}` : ""}
          </p>
        </div>
      </div>
      <Link
        to="/choisir-enfant"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
        aria-label="Changer d’enfant"
      >
        <X className="size-4" aria-hidden />
      </Link>
    </div>
  );
}