import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSessionRoles } from "@/hooks/use-session-roles";
import type { MessagingSide } from "@/lib/messaging";

/**
 * Détermine le "côté" de messagerie de l'utilisateur courant : professeur,
 * apprenant (parent/étudiant), ou compte enfant (accès devoirs seul).
 * Centralise ce que messages.tsx et pro.messages.tsx calculaient chacun
 * séparément, pour le panneau global et les pages dédiées.
 */
export function useMessagingSide() {
  const { ready, signedIn, userId, roles, rolesLoading } = useSessionRoles();
  const isTeacher = roles.includes("teacher");

  const childAccountQuery = useQuery({
    queryKey: ["my-child-account", userId],
    enabled: Boolean(userId) && !isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id")
        .eq("auth_user_id", userId!);
      if (error) throw error;
      return data;
    },
  });

  const isChildAccount = (childAccountQuery.data?.length ?? 0) > 0;
  const side: MessagingSide = isTeacher ? "teacher" : isChildAccount ? "child" : "learner";
  const loading = !ready || (signedIn && (rolesLoading || (!isTeacher && childAccountQuery.isLoading)));

  return { side, loading, signedIn, userId };
}
