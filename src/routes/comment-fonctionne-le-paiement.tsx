import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, ShieldCheck, Wallet } from "lucide-react";

export const Route = createFileRoute("/comment-fonctionne-le-paiement")({
  head: () => ({
    meta: [
      { title: "Comment fonctionne le paiement — BARA" },
      {
        name: "description",
        content:
          "Comment le paiement, la sécurité des fonds et la commission de BARA fonctionnent pour les professeurs et les familles.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentExplainedPage,
});

function PaymentExplainedPage() {
  return (
    <div className="container-page max-w-2xl py-14 sm:py-20">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
        Comment fonctionne le paiement sur BARA
      </h1>

      <div className="mt-8 space-y-8">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 font-display font-bold text-foreground">Paiement sécurisé</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Lorsqu'une famille réserve un cours, le paiement est effectué sur BARA et conservé en
            garantie jusqu'à la séance. Ni le professeur ni la famille n'ont à se soucier d'un
            paiement en retard ou d'un rendez-vous manqué.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <Clock className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 font-display font-bold text-foreground">Versement au professeur</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Une fois la séance terminée, les fonds sont automatiquement libérés au professeur
            quelques jours après, le temps de permettre le signalement d'un éventuel litige.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <Wallet className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 font-display font-bold text-foreground">Commission de la plateforme</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            BARA prélève une commission de 15 % sur le montant de chaque séance payée. Elle couvre
            la sécurisation des paiements, la vérification des profils et la gestion des litiges.
            Le professeur reçoit le reste du montant, versé directement sur son compte.
          </p>
        </section>
      </div>

      <Link
        to="/devenir-professeur"
        className="mt-8 inline-flex text-sm font-semibold text-primary hover:underline"
      >
        ← Retour à « Devenir professeur »
      </Link>
    </div>
  );
}
