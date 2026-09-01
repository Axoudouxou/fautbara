import { supabase } from "@/integrations/supabase/client";

/**
 * Admins are exempt; everyone else needs onboarding until
 * profiles.onboarding_completed_at is set (pre-existing accounts were
 * backfilled when the column was introduced).
 */
export async function needsOnboarding(userId: string): Promise<boolean> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("onboarding_completed_at").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  return !isAdmin && Boolean(profile) && !profile?.onboarding_completed_at;
}
