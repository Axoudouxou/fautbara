import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Eye,
  Globe,
  GraduationCap,
  Laptop,
  Languages,
  Palette,
  SlidersHorizontal,
  Star,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";
import logoBaraAsset from "../assets/logo-bara.jpg.asset.json";

const SITE_NAME = "BARA";

export const Route = createFileRoute("/devenir-professeur")({
  head: () => ({
    meta: [
      { title: `Devenir professeur — ${SITE_NAME}` },
      {
        name: "description",
        content:
          "Proposez votre savoir sur BARA : matières scolaires, langues, compétences ou passions. Vous choisissez votre tarif, vos disponibilités et votre rythme.",
      },
      { property: "og:title", content: `Devenir professeur — ${SITE_NAME}` },
      {
        property: "og:description",
        content: "Transmettez votre savoir, à votre façon.",
      },
    ],
  }),
  component: DevenirProfesseur,
});

const CATEGORIES = [
  {
    icon: GraduationCap,
    label: "Soutien scolaire",
    detail: "Mathématiques, français, physique, SVT…",
  },
  {
    icon: BadgeCheck,
    label: "Préparation aux examens",
    detail: "BEPC, BAC, TOEFL…",
  },
  {
    icon: Languages,
    label: "Langues",
    detail: "Anglais, espagnol, allemand…",
  },
  {
    icon: Globe,
    label: "Langues ivoiriennes",
    detail: "Baoulé, Dioula, Ébrié, Agni…",
  },
  {
    icon: Laptop,
    label: "Compétences",
    detail: "Informatique, programmation, bureautique…",
  },
  {
    icon: Palette,
    label: "Arts & passions",
    detail: "Musique, dessin, photographie…",
  },
];

const REASONS = [
  {
    icon: Eye,
    title: "Faites-vous découvrir",
    text: "Votre profil permet à de nouvelles personnes de découvrir ce que vous savez faire. Vous n'êtes plus limité à votre entourage ou au bouche-à-oreille.",
  },
  {
    icon: TrendingUp,
    title: "Développez votre activité",
    text: "Transformez votre savoir-faire en opportunités. Que vous cherchiez quelques élèves à côté de vos études ou souhaitiez développer une véritable activité, vous choisissez votre rythme.",
  },
  {
    icon: SlidersHorizontal,
    title: "Vous gardez le contrôle",
    text: "Vous choisissez ce que vous proposez et comment vous l'enseignez.",
    list: ["Vos compétences", "Vos niveaux", "Votre tarif", "Vos disponibilités", "En ligne ou à domicile"],
  },
  {
    icon: Star,
    title: "Construisez votre réputation",
    text: "Votre profil évolue avec votre expérience. Les avis issus de véritables cours permettent progressivement de construire votre réputation sur la plateforme.",
  },
];

const STEPS = [
  {
    icon: UserPlus,
    title: "Inscrivez-vous",
    text: "Créez votre profil en quelques minutes.",
  },
  {
    icon: BadgeCheck,
    title: "Faites vérifier votre profil",
    text: "Un dossier généralement traité sous 48 h.",
  },
  {
    icon: GraduationCap,
    title: "Commencez à enseigner",
    text: "Recevez vos premières demandes de cours.",
  },
];

function DevenirProfesseur() {
  return (
    <div>
      {/* Hero */}
      <section className="container-page grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl">
            Transmettez votre savoir, à votre façon.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Vous avez une compétence, une passion ou une expertise à partager ? Proposez-la sur
            BARA et rencontrez des personnes qui souhaitent apprendre.
          </p>
          <Link
            to="/auth"
            search={{ role: "teacher" }}
            className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Proposer mes compétences
          </Link>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Étudiant, enseignant, professionnel, passionné ou autodidacte : votre savoir a sa
            place ici.
          </p>
        </div>

        <div className="flex justify-center">
          <img
            src={logoBaraAsset.url}
            alt="Logo BARA — Seul le bara paie"
            className="size-56 rounded-3xl object-cover shadow-sm sm:size-72"
          />
        </div>
      </section>

      {/* Pas besoin d'être professeur */}
      <section className="border-y border-border/60 bg-secondary/40 py-14 sm:py-20">
        <div className="container-page max-w-2xl">
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Pas besoin d'être professeur pour transmettre.
          </h2>
          <ul className="mt-6 space-y-2 text-base leading-relaxed text-muted-foreground">
            <li>Vous êtes étudiant et excellent en maths ?</li>
            <li>Vous parlez couramment anglais ?</li>
            <li>Vous maîtrisez une langue ivoirienne ?</li>
            <li>Vous êtes développeur, musicien, designer ou entrepreneur ?</li>
            <li>Vous avez simplement une compétence que vous maîtrisez et que vous aimez partager ?</li>
          </ul>
          <p className="mt-4 font-display text-lg font-semibold text-foreground">
            Vous pouvez proposer votre savoir sur BARA.
          </p>
        </div>
      </section>

      {/* Ce que vous pouvez transmettre */}
      <section className="container-page py-14 sm:py-20">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          Ce que vous pouvez transmettre
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <div
              key={c.label}
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <c.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-display font-bold text-foreground">{c.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
            </div>
          ))}
          <div className="flex flex-col justify-center rounded-2xl border border-dashed border-border bg-secondary/30 p-5">
            <p className="font-display font-bold text-foreground">
              Votre compétence n'est pas dans la liste ?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nous continuons d'élargir BARA.
            </p>
          </div>
        </div>
      </section>

      {/* Pourquoi rejoindre BARA */}
      <section className="border-y border-border/60 bg-secondary/40 py-14 sm:py-20">
        <div className="container-page">
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Pourquoi rejoindre BARA ?
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {REASONS.map((r) => (
              <article
                key={r.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                  <r.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-display font-bold text-foreground">{r.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
                {r.list ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {r.list.map((item) => (
                      <li
                        key={item}
                        className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Fixez votre tarif, gardez le contrôle */}
      <section className="container-page py-14 sm:py-20">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          Fixez votre tarif, gardez le contrôle
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <Wallet className="size-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-display font-bold text-foreground">Vous choisissez votre prix</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Vous définissez votre tarif par séance, et vous pouvez le modifier à tout moment. Un
              tarif plus accessible au démarrage vous aide à attirer vos premiers élèves plus
              rapidement.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h3 className="font-display font-bold text-foreground">
              Pourquoi BARA plutôt que le seul bouche-à-oreille
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Le bouche-à-oreille limite votre visibilité à votre entourage. Sur BARA, votre profil
              est visible par des parents et élèves que vous n'auriez jamais rencontrés autrement,
              votre paiement est sécurisé — fini les rendez-vous manqués ou les paiements en
              retard — et chaque avis reçu construit votre réputation sur la durée.
            </p>
          </div>
        </div>
        <Link
          to="/comment-fonctionne-le-paiement"
          className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Comment fonctionne le paiement sur BARA ?
        </Link>
      </section>

      {/* Processus en 3 étapes */}
      <section className="border-y border-border/60 bg-secondary/40 py-14 sm:py-20">
        <div className="container-page">
          <h2 className="text-center font-display text-2xl font-bold text-foreground sm:text-3xl">
            Comment ça marche
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <article key={s.title} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-display text-sm font-bold text-muted-foreground">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-display font-bold text-foreground">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="container-page py-16 sm:py-24">
        <div className="rounded-3xl bg-primary px-6 py-12 text-center shadow-[var(--shadow-raised)] sm:px-12">
          <h2 className="font-display text-2xl font-bold text-primary-foreground sm:text-3xl">
            Prêt à transmettre votre savoir ?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/85">
            Créez votre profil et rejoignez la communauté des professeurs BARA.
          </p>
          <Link
            to="/auth"
            search={{ role: "teacher" }}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-card px-6 py-3 text-sm font-bold text-primary transition-colors hover:bg-secondary"
          >
            Créer mon profil
          </Link>
        </div>
      </section>
    </div>
  );
}
