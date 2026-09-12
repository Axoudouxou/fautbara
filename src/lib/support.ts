import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type FaqEntry = {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
  click_count: number;
};

/** Ordre d'affichage des catégories du centre d'aide. */
export const FAQ_CATEGORIES = [
  "Réservation & Packs",
  "Paiement",
  "Annulation & Report",
  "Compte professeur",
  "Compte parent/étudiant",
  "Sécurité & Vérification",
] as const;

export function sortCategories(categories: string[]) {
  const rank = (c: string) => {
    const i = (FAQ_CATEGORIES as readonly string[]).indexOf(c);
    return i === -1 ? FAQ_CATEGORIES.length : i;
  };
  return [...categories].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** FAQ publiée, lisible sans être connecté. */
export function usePublishedFaq() {
  return useQuery({
    queryKey: ["faq", "published"],
    queryFn: async (): Promise<FaqEntry[]> => {
      const { data, error } = await supabase
        .from("faq_entries")
        .select("id, category, question, answer, sort_order, is_published, click_count")
        .eq("is_published", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FaqEntry[];
    },
  });
}

/** Comptabilise l'ouverture d'une question dans le chatbot (statistique admin). */
export async function trackFaqClick(faqId: string) {
  await supabase.rpc("track_faq_click", { p_faq_id: faqId });
}

/**
 * Ouvre (ou réutilise) la conversation « Support BARA » de l'utilisateur et y
 * dépose son premier message. Renvoie l'identifiant de la conversation.
 */
export async function openSupportConversation(params: {
  subject: string;
  message: string;
  source: "chatbot" | "formulaire";
}) {
  const { data, error } = await supabase.rpc("open_support_conversation", {
    p_subject: params.subject,
    p_message: params.message,
    p_source: params.source,
  });
  if (error) throw error;
  return data as unknown as string;
}
