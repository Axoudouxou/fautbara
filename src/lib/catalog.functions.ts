import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const searchFiltersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  matiere: z.string().trim().max(80).optional(),
  niveau: z.string().trim().max(80).optional(),
  format: z.enum(["home", "online"]).optional(),
  ville: z.string().trim().max(80).optional(),
  commune: z.string().trim().max(80).optional(),
  prixMax: z.coerce.number().int().positive().max(1000000).optional(),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export type TeacherCard = {
  teacher_id: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  commune: string | null;
  headline: string | null;
  years_experience: number | null;
  identity_verified: boolean;
  qualifications_verified: boolean;
  offers_home: boolean;
  offers_online: boolean;
  min_price_fcfa: number;
  subjects: string[];
};

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const [categories, subjects, levels] = await Promise.all([
    supabase.from("categories").select("id,slug,name,description,icon,sort_order").order("sort_order"),
    supabase.from("subjects").select("id,slug,name,category_id,sort_order").order("sort_order"),
    supabase.from("levels").select("id,slug,name,stage,sort_order").order("sort_order"),
  ]);
  if (categories.error) throw categories.error;
  if (subjects.error) throw subjects.error;
  if (levels.error) throw levels.error;
  return {
    categories: categories.data ?? [],
    subjects: subjects.data ?? [],
    levels: levels.data ?? [],
  };
});

export const searchTeachers = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => searchFiltersSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<TeacherCard[]> => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase.rpc("search_teachers", {
      p_query: data.q ?? null,
      p_subject_slug: data.matiere ?? null,
      p_level_slug: data.niveau ?? null,
      p_format: data.format ?? null,
      p_city: data.ville ?? null,
      p_commune: data.commune ?? null,
      p_max_price: data.prixMax ?? null,
      p_limit: 24,
      p_offset: 0,
    });
    if (error) throw error;
    return (rows ?? []) as TeacherCard[];
  });

export const getTeacherPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const [profileRes, offersRes] = await Promise.all([
      supabase.rpc("get_teacher_public", { p_teacher_id: data.id }),
      supabase
        .from("teacher_offers")
        .select(
          "id,title,description,price_fcfa,duration_minutes,offers_home,offers_online,communes,city,subject_id,subjects(name,slug),offer_levels(levels(name,slug,sort_order))",
        )
        .eq("teacher_id", data.id)
        .eq("status", "published")
        .order("price_fcfa"),
    ]);
    if (profileRes.error) throw profileRes.error;
    if (offersRes.error) throw offersRes.error;
    const profile = (profileRes.data ?? [])[0] ?? null;
    return { profile, offers: offersRes.data ?? [] };
  });
