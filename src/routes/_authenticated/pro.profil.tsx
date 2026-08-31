import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Loader2, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pro/profil")({
  head: () => ({
    meta: [
      { title: "Profil professeur — FAUT BARA" },
      { name: "description", content: "Complétez votre profil professionnel de professeur particulier sur FAUT BARA." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherProfilePage,
});

const VERIFICATION_LABELS: Record<string, string> = {
  none: "Aucune demande de vérification",
  pending: "Vérification en cours d'examen",
  approved: "Profil vérifié",
  rejected: "Vérification refusée",
};

function TeacherProfilePage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as string);
    },
  });

  const teacherQuery = useQuery({
    queryKey: ["teacher-profile", user.id],
    enabled: rolesQuery.data?.includes("teacher") ?? false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [years, setYears] = useState("");
  const [home, setHome] = useState(false);
  const [online, setOnline] = useState(false);
  const [zones, setZones] = useState("");

  useEffect(() => {
    const t = teacherQuery.data;
    if (t) {
      setHeadline(t.headline ?? "");
      setBio(t.bio ?? "");
      setYears(t.years_experience != null ? String(t.years_experience) : "");
      setHome(t.offers_home);
      setOnline(t.offers_online);
      setZones((t.zones ?? []).join(", "));
    }
  }, [teacherQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: user.id,
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        years_experience: years ? Number(years) : null,
        offers_home: home,
        offers_online: online,
        zones: zones
          .split(",")
          .map((z) => z.trim())
          .filter(Boolean),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("teacher_profiles")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil professeur enregistré");
      queryClient.invalidateQueries({ queryKey: ["teacher-profile", user.id] });
    },
    onError: (err) =>
      toast.error("Enregistrement impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  if (rolesQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  if (!rolesQuery.data?.includes("teacher")) {
    return (
      <div className="container-page py-14">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <h1 className="font-display text-xl font-bold text-foreground">Espace professeur</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cet espace est réservé aux comptes professeurs. Créez un compte en choisissant le rôle
            « Professeur ».
          </p>
          <Link
            to="/compte"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Retour à mon compte
          </Link>
        </div>
      </div>
    );
  }

  const status = teacherQuery.data?.verification_status ?? "none";

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
        Mon profil professeur
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Ces informations apparaîtront sur votre profil public. Votre téléphone et votre adresse
        exacte ne sont jamais affichés.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden />
          {VERIFICATION_LABELS[status]}
        </span>
        {teacherQuery.data?.identity_verified && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
            <BadgeCheck className="size-3.5" aria-hidden /> Identité vérifiée
          </span>
        )}
        {teacherQuery.data?.qualifications_verified && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
            <BadgeCheck className="size-3.5" aria-hidden /> Qualifications vérifiées
          </span>
        )}
      </div>

      <form
        className="mt-8 max-w-2xl space-y-5 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <div>
          <label htmlFor="tp-headline" className="text-sm font-semibold text-foreground">
            Titre du profil
          </label>
          <input
            id="tp-headline"
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Ex. Professeur de mathématiques, 8 ans d'expérience"
            className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div>
          <label htmlFor="tp-bio" className="text-sm font-semibold text-foreground">
            Présentation
          </label>
          <textarea
            id="tp-bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Parlez de votre parcours, votre méthode, vos résultats…"
            className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div>
          <label htmlFor="tp-years" className="text-sm font-semibold text-foreground">
            Années d'expérience
          </label>
          <input
            id="tp-years"
            type="number"
            min={0}
            max={60}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40 sm:w-40"
          />
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-foreground">Formats proposés</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { label: "À domicile", value: home, set: setHome },
              { label: "En ligne", value: online, set: setOnline },
            ].map((f) => (
              <button
                key={f.label}
                type="button"
                aria-pressed={f.value}
                onClick={() => f.set(!f.value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  f.value
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="tp-zones" className="text-sm font-semibold text-foreground">
            Zones d'intervention
          </label>
          <input
            id="tp-zones"
            type="text"
            value={zones}
            onChange={(e) => setZones(e.target.value)}
            placeholder="Ex. Cocody, Plateau, Yopougon"
            className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
          <p className="mt-1 text-xs text-muted-foreground">Séparez les communes par des virgules.</p>
        </div>

        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {saveMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Enregistrer mon profil
        </button>
      </form>
    </div>
  );
}
