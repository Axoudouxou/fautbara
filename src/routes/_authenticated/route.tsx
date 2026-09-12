import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { needsOnboarding } from "@/lib/onboarding";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const profile = await supabase
      .from("profiles")
      .select("deleted_at")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (profile.data?.deleted_at) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }

    if (location.pathname !== "/onboarding" && (await needsOnboarding(data.user.id))) {
      throw redirect({ to: "/onboarding" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
