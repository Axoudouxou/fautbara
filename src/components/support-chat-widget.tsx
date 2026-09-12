import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, HeadphonesIcon, Loader2, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  openSupportConversation,
  sortCategories,
  trackFaqClick,
  usePublishedFaq,
  type FaqEntry,
} from "@/lib/support";

/**
 * Chatbot BARA à réponses prédéfinies : arbre de décision catégorie → question →
 * réponse, sans champ de saisie libre et sans aucune IA. Si aucune réponse ne
 * convient, l'utilisateur est escaladé vers la messagerie interne avec le
 * compte « Support BARA ».
 */
export function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [entry, setEntry] = useState<FaqEntry | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const navigate = useNavigate();
  const faqQuery = usePublishedFaq();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session)));
    return () => subscription.unsubscribe();
  }, []);

  const escalate = useMutation({
    mutationFn: () =>
      openSupportConversation({
        subject: entry ? `À propos de : ${entry.question}` : (category ?? "Demande d'aide"),
        message:
          "Bonjour, je n'ai pas trouvé de réponse dans le centre d'aide et je souhaite parler à un conseiller BARA.",
        source: "chatbot",
      }),
    onSuccess: (conversationId) => {
      setOpen(false);
      toast.success("Un conseiller BARA a été alerté");
      void navigate({ to: "/messages", search: { conversation: conversationId } });
    },
    onError: (err) =>
      toast.error("Impossible de contacter un conseiller", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const entries = faqQuery.data ?? [];
  const categories = sortCategories(Array.from(new Set(entries.map((e) => e.category))));

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Aide BARA"
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-card)] md:bottom-6 md:right-6 md:size-14"
        >
          <MessageCircle className="size-6" aria-hidden />
        </button>
      )}

      {open && (
        <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-3 z-[60] flex max-h-[calc(100dvh-7rem-env(safe-area-inset-bottom))] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] md:bottom-6 md:right-6 md:max-h-[min(70vh,32rem)]">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-secondary/50 px-4 py-3">
            <div className="flex items-center gap-2">
              {(category || entry) && (
                <button
                  type="button"
                  aria-label="Retour"
                  onClick={() => (entry ? setEntry(null) : setCategory(null))}
                  className="flex size-8 items-center justify-center rounded-full text-foreground hover:bg-background"
                >
                  <ArrowLeft className="size-4" aria-hidden />
                </button>
              )}
              <p className="font-display text-sm font-bold text-foreground">Aide BARA</p>
            </div>
            <button
              type="button"
              aria-label="Fermer l'aide"
              onClick={() => setOpen(false)}
              className="flex size-8 items-center justify-center rounded-full text-foreground hover:bg-background"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {faqQuery.isLoading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
              </p>
            )}

            {entry ? (
              <>
                <p className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
                  {entry.question}
                </p>
                <p className="whitespace-pre-line rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-foreground">
                  {entry.answer}
                </p>
              </>
            ) : category ? (
              <>
                <p className="text-sm text-muted-foreground">{category} — choisissez une question :</p>
                {entries
                  .filter((e) => e.category === category)
                  .map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setEntry(e);
                        void trackFaqClick(e.id);
                      }}
                      className="w-full rounded-2xl border border-border px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-secondary"
                    >
                      {e.question}
                    </button>
                  ))}
              </>
            ) : (
              <>
                <p className="rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-foreground">
                  Bonjour 👋 De quoi souhaitez-vous parler ?
                </p>
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className="w-full rounded-2xl border border-border px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-secondary"
                  >
                    {c}
                  </button>
                ))}
              </>
            )}
          </div>

          <div className="space-y-2 border-t border-border/60 p-4">
            {signedIn ? (
              <button
                type="button"
                onClick={() => escalate.mutate()}
                disabled={escalate.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {escalate.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <HeadphonesIcon className="size-4" aria-hidden />
                )}
                Parler à un conseiller BARA
              </button>
            ) : (
              <a
                href="/auth"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <HeadphonesIcon className="size-4" aria-hidden /> Se connecter pour joindre un conseiller
              </a>
            )}
            <Link
              to="/aide"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-semibold text-primary"
            >
              Ouvrir le centre d'aide
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
