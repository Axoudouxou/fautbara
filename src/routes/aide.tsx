import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, LifeBuoy, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { openSupportConversation, sortCategories, usePublishedFaq } from "@/lib/support";

export const Route = createFileRoute("/aide")({
  head: () => ({
    meta: [
      { title: "Centre d'aide BARA — questions fréquentes et support" },
      {
        name: "description",
        content:
          "Formules et validité, frais BARA, report d'une séance, grades et rémunération : toutes les réponses, et un contact direct avec l'équipe BARA.",
      },
      { property: "og:title", content: "Centre d'aide BARA" },
      {
        property: "og:description",
        content:
          "Questions fréquentes sur les formules, le paiement, les reports et les comptes BARA, et contact direct avec l'équipe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HelpCenterPage,
});

function HelpCenterPage() {
  const faqQuery = usePublishedFaq();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  const contactMutation = useMutation({
    mutationFn: async () => {
      const conversationId = await openSupportConversation({
        subject: subject.trim() || "Demande via le centre d'aide",
        message: message.trim(),
        source: "formulaire",
      });
      return conversationId;
    },
    onSuccess: (conversationId) => {
      setSubject("");
      setMessage("");
      toast.success("Message envoyé au Support BARA");
      void navigate({ to: "/messages", search: { conversation: conversationId } });
    },
    onError: (err) =>
      toast.error("Envoi impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const entries = faqQuery.data ?? [];
  const categories = sortCategories(Array.from(new Set(entries.map((e) => e.category))));

  return (
    <div className="container-page max-w-3xl py-10 sm:py-16">
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
        <LifeBuoy className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold text-foreground sm:text-3xl">
        Centre d'aide
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Les réponses aux questions les plus fréquentes sur BARA. Si vous ne trouvez pas, écrivez-nous
        : l'équipe répond directement dans votre messagerie.
      </p>

      {faqQuery.isLoading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </div>
      )}

      <div className="mt-8 space-y-8">
        {categories.map((category) => (
          <section key={category}>
            <h2 className="font-display text-lg font-bold text-foreground">{category}</h2>
            <ul className="mt-3 space-y-2">
              {entries
                .filter((e) => e.category === category)
                .map((e) => {
                  const open = openId === e.id;
                  return (
                    <li
                      key={e.id}
                      className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : e.id)}
                        aria-expanded={open}
                        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-semibold text-foreground hover:bg-secondary/60"
                      >
                        {e.question}
                        <ChevronDown
                          className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      </button>
                      {open && (
                        <p className="whitespace-pre-line border-t border-border/60 px-5 py-4 text-sm text-muted-foreground">
                          {e.answer}
                        </p>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-12 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
          <MessageSquare className="size-5" aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-lg font-bold text-foreground">Écrire au Support BARA</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Votre message ouvre une conversation avec l'équipe BARA dans votre messagerie. C'est là que
          vous recevrez la réponse.
        </p>

        {signedIn === false ? (
          <a
            href="/auth"
            className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Se connecter pour écrire à l'équipe
          </a>
        ) : (
          <form
            className="mt-5 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!message.trim()) {
                toast.error("Écrivez votre message");
                return;
              }
              contactMutation.mutate();
            }}
          >
            <div>
              <label htmlFor="support-subject" className="text-xs font-bold text-foreground">
                Sujet
              </label>
              <input
                id="support-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                placeholder="Ex. Problème de paiement d'une formule"
                className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground"
              />
            </div>
            <div>
              <label htmlFor="support-message" className="text-xs font-bold text-foreground">
                Message
              </label>
              <textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Décrivez votre situation en quelques lignes."
                className="mt-1 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={contactMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {contactMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              Envoyer au support
            </button>
          </form>
        )}
      </section>

      <p className="mt-8 text-sm text-muted-foreground">
        Vous cherchez le détail du paiement ?{" "}
        <Link to="/comment-fonctionne-le-paiement" search={{}} className="font-semibold text-primary">
          Comment fonctionne le paiement
        </Link>
      </p>
    </div>
  );
}
