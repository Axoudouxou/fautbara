import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Coins, ShieldCheck, Wallet } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/comment-fonctionne-le-paiement")({
  validateSearch: (search) =>
    z
      .object({
        retour: z.enum(["paiement"]).optional(),
        packId: z.string().uuid().optional(),
      })
      .parse(search),
  head: () => ({
    meta: [
      { title: "Comment fonctionne le paiement — BARA" },
      {
        name: "description",
        content:
          "Formules de séances, frais BARA payés par la famille et rémunération intégrale de l'intervenant : le fonctionnement du paiement sur BARA.",
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
            <Coins className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 font-display font-bold text-foreground">
            La famille achète une formule de séances
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            La famille choisit une formule (Découverte, Suivi, Renfort, Intensif, Examen) ou une
            séance seule. Le prix affiché sépare toujours clairement, en francs, la rémunération de
            l&apos;intervenant et les frais BARA. Les frais sont payés une seule fois, à
            l&apos;achat : il n&apos;y a aucun abonnement, et ils diminuent quand la formule est
            plus grande.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <CalendarCheck className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 font-display font-bold text-foreground">
            Les séances se programment ensuite, une par une
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Une fois la formule payée, la famille programme ses séances dans l&apos;agenda réel de
            l&apos;intervenant, à son rythme et sans paiement supplémentaire, pendant toute la durée
            de validité de la formule. Chaque séance peut être reportée une fois si le changement est
            annoncé plus de 24 h à l&apos;avance.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 font-display font-bold text-foreground">
            L&apos;intervenant perçoit 100 % de son tarif
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Aucune commission n&apos;est retenue sur le tarif de l&apos;intervenant : les frais BARA
            sont facturés à la famille, séparément. La rémunération d&apos;une séance est validée dès
            que la séance est réalisée et que son compte-rendu est rempli.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <Wallet className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 font-display font-bold text-foreground">Versement des revenus</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Les rémunérations validées s&apos;accumulent dans l&apos;espace revenus de
            l&apos;intervenant. Un versement groupé est proposé chaque mois sans frais ; tout retrait
            supplémentaire demandé en dehors de ce versement reste possible, avec des frais à la
            charge de l&apos;intervenant.
          </p>
        </section>
      </div>

      <Link
        to="/devenir-professeur"
        className="mt-8 inline-flex text-sm font-semibold text-primary hover:underline"
      >
        ← Retour à « Devenir intervenant »
      </Link>
    </div>
  );
}
