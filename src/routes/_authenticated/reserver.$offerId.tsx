import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Check, Home, Laptop, Loader2 } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { COMMUNES_ABIDJAN } from "@/lib/geo";
import { useSessionRoles } from "@/hooks/use-session-roles";
import { formatFcfa, gradeLabel, type PackQuote } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/reserver/$offerId")({
  validateSearch: (search) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        enfant: z.string().uuid().optional(),
      })
      .parse(search),
  head: () => ({
    meta: [
      { title: "Choisir une formule de cours — BARA" },
      {
        name: "description",
        content:
          "Choisissez une formule de séances ou une séance seule : rémunération de l'intervenant et frais BARA affichés clairement en francs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingPage,
});

const PACK_ORDER = ["decouverte", "suivi", "renfort", "intensif", "examen", "seance"];

function BookingPage() {
  const { user } = Route.useRouteContext();
  const { offerId } = Route.useParams();
  const { enfant: selectedChildId } = Route.useSearch();
  const navigate = useNavigate();
  const { roles, rolesLoading } = useSessionRoles();
  const canBook = roles.includes("parent") || roles.includes("student");
  const isParent = roles.includes("parent");

  const [childId, setChildId] = useState(selectedChildId ?? "");
  const [packSlug, setPackSlug] = useState<string | null>(null);
  const [format, setFormat] = useState<"home" | "online">("home");
  const [commune, setCommune] = useState("");
  const [address, setAddress] = useState("");

  const offerQuery = useQuery({
    queryKey: ["booking-offer", offerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_offers")
        .select(
          "id, teacher_id, title, description, price_fcfa, duration_minutes, offers_home, offers_online, communes, city, status, subjects(name)",
        )
        .eq("id", offerId)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const offer = offerQuery.data;

  const gradeQuery = useQuery({
    queryKey: ["teacher-grade", offer?.teacher_id],
    enabled: Boolean(offer?.teacher_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_grades")
        .select("grade")
        .eq("teacher_id", offer!.teacher_id)
        .maybeSingle();
      if (error) throw error;
      return data?.grade ?? "verified";
    },
  });

  const quotesQuery = useQuery({
    queryKey: ["pack-quotes", offerId],
    enabled: Boolean(offer?.id),
    queryFn: async () => {
      const { data: types, error: typesError } = await supabase
        .from("pack_types")
        .select("slug, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      if (typesError) throw typesError;

      const quotes: PackQuote[] = [];
      for (const t of types ?? []) {
        const { data, error } = await supabase.rpc("quote_pack", {
          p_offer_id: offerId,
          p_pack_slug: t.slug,
        });
        if (error) throw error;
        quotes.push(data as unknown as PackQuote);
      }
      return quotes.sort(
        (a, b) => PACK_ORDER.indexOf(a.slug) - PACK_ORDER.indexOf(b.slug),
      );
    },
  });

  const childrenQuery = useQuery({
    queryKey: ["children", user.id],
    enabled: isParent,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id, first_name, school_level")
        .eq("parent_id", user.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const quotes = quotesQuery.data ?? [];
  const children = childrenQuery.data ?? [];
  const selectedQuote = quotes.find((q) => q.slug === packSlug) ?? null;

  const purchase = useMutation({
    mutationFn: async () => {
      if (!offer || !packSlug) throw new Error("Choisissez une formule");
      if (isParent && !children.some((child) => child.id === childId)) {
        throw new Error("Choisissez l’enfant concerné par cette formule");
      }
      const { data, error } = await supabase.rpc("purchase_pack", {
        p_offer_id: offer.id,
        p_pack_slug: packSlug,
        ...(childId ? { p_child_id: childId } : {}),
        p_format: format,
        ...(format === "home" && commune ? { p_commune: commune } : {}),
        ...(format === "home" && address.trim() ? { p_address: address.trim() } : {}),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (pack) => {
      toast.success("Formule réservée pour 15 minutes", {
        description: "Réglez le montant pour l'activer et programmer vos séances.",
      });
      navigate({ to: "/paiement/$packId", params: { packId: pack.id } });
    },
    onError: (err) =>
      toast.error("Achat impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  if (!rolesLoading && !canBook) {
    return (
      <div className="container-page py-14">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h1 className="font-display text-xl font-bold text-foreground">
            Réservation réservée aux familles et apprenants
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre compte intervenant ne permet pas d&apos;acheter une formule auprès d&apos;un autre
            intervenant.
          </p>
          <Link
            to="/accueil"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Retour à mon espace
          </Link>
        </div>
      </div>
    );
  }

  if (offerQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement de l&apos;offre…
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="container-page py-14">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <h1 className="font-display text-xl font-bold text-foreground">Offre indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette offre n&apos;existe plus ou n&apos;est pas publiée.
          </p>
          <Link
            to="/professeurs"
            search={{}}
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Voir les intervenants
          </Link>
        </div>
      </div>
    );
  }

  const isOwnOffer = offer.teacher_id === user.id;
  const inputClass =
    "mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40";
  const communeOptions =
    offer.communes && offer.communes.length > 0 ? offer.communes : COMMUNES_ABIDJAN;

  function submit() {
    if (!packSlug) {
      toast.error("Choisissez une formule ou une séance seule");
      return;
    }
    if (isParent && !children.some((child) => child.id === childId)) {
      toast.error("Choisissez l’enfant concerné");
      return;
    }
    if (format === "home" && !commune) {
      toast.error("Indiquez la commune des cours");
      return;
    }
    purchase.mutate();
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <Link
        to="/professeurs/$id"
        params={{ id: offer.teacher_id }}
        className="text-sm font-semibold text-primary hover:underline"
      >
        ← Retour au profil de l&apos;intervenant
      </Link>

      <h1 className="mt-4 font-display text-2xl font-bold text-foreground sm:text-3xl">
        Choisir une formule
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Vous réglez une seule fois, puis vous programmez vos séances progressivement dans l&apos;agenda
        de l&apos;intervenant, pendant toute la durée de validité.
      </p>
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">
        <BadgeCheck className="size-3.5 text-primary" aria-hidden /> Grade{" "}
        {gradeLabel(gradeQuery.data)} · {offer.subjects?.name}
      </p>

      {isOwnOffer && (
        <p className="mt-6 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
          Il s&apos;agit de votre propre offre : vous ne pouvez pas l&apos;acheter.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-display font-bold text-foreground">Formules disponibles</h2>
            {quotesQuery.isLoading && (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Calcul des prix…
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {quotes.map((q) => {
                const selected = q.slug === packSlug;
                return (
                  <li key={q.slug}>
                    <button
                      type="button"
                      disabled={!q.available}
                      onClick={() => setPackSlug(q.slug)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-primary bg-primary-soft/40"
                          : "border-border hover:bg-secondary/60"
                      } ${q.available ? "" : "opacity-50"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-display font-bold text-foreground">
                            {q.name}
                            {selected && <Check className="ml-2 inline size-4 text-primary" aria-hidden />}
                          </p>
                          <p className="text-xs text-muted-foreground">{q.tagline}</p>
                        </div>
                        <p className="font-display text-lg font-bold text-foreground">
                          {formatFcfa(q.total_fcfa)}
                        </p>
                      </div>
                      <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <div className="flex justify-between gap-2 sm:col-span-2">
                          <dt>
                            {q.sessions_total} séance{q.sessions_total > 1 ? "s" : ""} de{" "}
                            {q.duration_minutes} min
                            {q.free_sessions > 0 ? ` dont ${q.free_sessions} offerte par BARA` : ""}
                          </dt>
                          <dd>Validité {q.validity_days} jours</dd>
                        </div>
                      </dl>
                      {!q.available && q.unavailable_reason && (
                        <p className="mt-2 text-xs font-semibold text-warning">{q.unavailable_reason}</p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            {isParent && (
              <div>
                <label htmlFor="bk-child" className="text-sm font-semibold text-foreground">
                  Pour qui ?
                </label>
                <select
                  id="bk-child"
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Choisir un enfant…</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name}
                      {c.school_level ? ` — ${c.school_level}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Besoin d&apos;ajouter un enfant ?{" "}
                  <Link to="/compte/enfants" className="font-semibold text-primary hover:underline">
                    Gérer les profils enfants
                  </Link>
                </p>
              </div>
            )}

            <fieldset>
              <legend className="text-sm font-semibold text-foreground">Format des séances</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {offer.offers_home && (
                  <button
                    type="button"
                    onClick={() => setFormat("home")}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                      format === "home"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Home className="size-4" aria-hidden /> À domicile
                  </button>
                )}
                {offer.offers_online && (
                  <button
                    type="button"
                    onClick={() => setFormat("online")}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                      format === "online"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Laptop className="size-4" aria-hidden /> En ligne
                  </button>
                )}
              </div>
            </fieldset>

            {format === "home" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="bk-commune" className="text-sm font-semibold text-foreground">
                    Commune
                  </label>
                  <select
                    id="bk-commune"
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Sélectionner…</option>
                    {communeOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="bk-address" className="text-sm font-semibold text-foreground">
                    Adresse <span className="font-normal text-muted-foreground">(privée)</span>
                  </label>
                  <input
                    id="bk-address"
                    type="text"
                    maxLength={200}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Quartier, repère…"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={purchase.isPending || isOwnOffer || !packSlug}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {purchase.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Continuer vers le paiement
            </button>
          </section>
        </form>

        <aside className="h-fit rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-display font-bold text-foreground">Récapitulatif</h2>
          {selectedQuote ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Formule</dt>
                <dd className="font-semibold text-foreground">{selectedQuote.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Séances</dt>
                <dd className="text-foreground">
                  {selectedQuote.sessions_total}
                  {selectedQuote.free_sessions > 0 ? ` (dont ${selectedQuote.free_sessions} offerte)` : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Tarif par séance</dt>
                <dd className="text-foreground">{formatFcfa(selectedQuote.teacher_rate_fcfa)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Rémunération intervenant</dt>
                <dd className="text-foreground">{formatFcfa(selectedQuote.teacher_amount_fcfa)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Frais BARA</dt>
                <dd className="text-foreground">{formatFcfa(selectedQuote.platform_fee_fcfa)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-2">
                <dt className="font-semibold text-foreground">Total à payer</dt>
                <dd className="font-display text-lg font-bold text-foreground">
                  {formatFcfa(selectedQuote.total_fcfa)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Sélectionnez une formule pour voir le détail du prix.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            L&apos;intervenant perçoit l&apos;intégralité de son tarif : les frais BARA sont
            entièrement séparés et ne sont jamais déduits de sa rémunération.
          </p>
        </aside>
      </div>
    </div>
  );
}
