import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const closeAccountSchema = z.object({ confirmation: z.literal("SUPPRIMER") });

export const closeMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => closeAccountSchema.parse(input))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const closedAt = new Date().toISOString();
    const anonymousEmail = `closed-${context.userId}@deleted.invalid`;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        display_name: "Compte supprimé",
        phone: null,
        commune: null,
        avatar_url: null,
        deleted_at: closedAt,
        updated_at: closedAt,
      })
      .eq("user_id", context.userId);
    if (profileError) throw profileError;

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      email: anonymousEmail,
      phone: undefined,
      user_metadata: {},
      ban_duration: "876000h",
    });
    if (authError) throw authError;

    return { closed: true };
  });