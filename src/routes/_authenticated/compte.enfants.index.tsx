import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Camera, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/product-ui";
import { supabase } from "@/integrations/supabase/client";
import { useSessionRoles } from "@/hooks/use-session-roles";
import { getCatalog } from "@/lib/catalog.functions";

export const Route = createFileRoute("/_authenticated/compte/enfants/")({
  head: () => ({
    meta: [
      { title: "Mes enfants — BARA" },
      { name: "description", content: "Créez et gérez les profils de vos enfants pour réserver leurs cours particuliers." },
      { property: "og:title", content: "Mes enfants — BARA" },
      { property: "og:description", content: "Créez et gérez les profils de vos enfants pour réserver leurs cours particuliers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChildrenPage,
});

const CURRENT_YEAR = new Date().getFullYear();
const childSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est obligatoire.").max(80, "Le prénom est trop long."),
  birthYear: z.union([z.literal(""), z.coerce.number().int().min(2000).max(CURRENT_YEAR)]),
  schoolLevel: z.string().trim().max(80),
  notes: z.string().trim().max(1000, "Les informations sont limitées à 1 000 caractères."),
});

type ChildDraft = { firstName: string; birthYear: string; schoolLevel: string; notes: string; photo: File | null };

function ChildrenPage() {
  const { user } = Route.useRouteContext();
  const { roles, rolesLoading } = useSessionRoles();
  const isParent = roles.includes("parent");
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [schoolLevel, setSchoolLevel] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ChildDraft | null>(null);

  const childrenQuery = useQuery({
    queryKey: ["children", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const paths = data.map((child) => child.avatar_path).filter((path): path is string => Boolean(path));
      const signed = paths.length
        ? await supabase.storage.from("child-photos").createSignedUrls(paths, 3600)
        : { data: [], error: null };
      if (signed.error) throw signed.error;
      const urls = new Map(paths.map((path, index) => [path, signed.data?.[index]?.signedUrl ?? null]));
      return data.map((child) => ({ ...child, avatarUrl: child.avatar_path ? urls.get(child.avatar_path) ?? null : null }));
    },
  });

  const catalogQuery = useQuery({ queryKey: ["children-levels"], queryFn: () => getCatalog() });

  const overviewQuery = useQuery({
    queryKey: ["children-overview", user.id],
    enabled: Boolean(childrenQuery.data?.length),
    queryFn: async () => {
      const [packs, bookings] = await Promise.all([
        supabase.from("packs").select("child_id, status, sessions_total, sessions_used").eq("buyer_id", user.id),
        supabase.from("bookings").select("child_id, status, scheduled_at").eq("requester_id", user.id).gte("scheduled_at", new Date().toISOString()),
      ]);
      if (packs.error) throw packs.error;
      if (bookings.error) throw bookings.error;
      return { packs: packs.data ?? [], bookings: bookings.data ?? [] };
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const values = childSchema.parse({ firstName, birthYear, schoolLevel, notes: "" });
      const { error } = await supabase.from("children").insert({
        parent_id: user.id,
        first_name: values.firstName,
        birth_year: values.birthYear === "" ? null : values.birthYear,
        school_level: values.schoolLevel || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil enfant créé");
      setFirstName("");
      setBirthYear("");
      setSchoolLevel("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["children", user.id] });
    },
    onError: (err) =>
      toast.error("Création impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingId || !editDraft) throw new Error("Profil introuvable.");
      const values = childSchema.parse(editDraft);
      const child = children.find((item) => item.id === editingId);
      if (!child) throw new Error("Profil introuvable.");
      let avatarPath = child.avatar_path;
      if (editDraft.photo) {
        if (!editDraft.photo.type.match(/^image\/(jpeg|png|webp)$/)) throw new Error("Utilisez une image JPG, PNG ou WebP.");
        if (editDraft.photo.size > 5 * 1024 * 1024) throw new Error("La photo est limitée à 5 Mo.");
        const extension = editDraft.photo.type.split("/")[1] === "jpeg" ? "jpg" : editDraft.photo.type.split("/")[1];
        avatarPath = `${user.id}/${editingId}/profile-${crypto.randomUUID()}.${extension}`;
        const upload = await supabase.storage.from("child-photos").upload(avatarPath, editDraft.photo);
        if (upload.error) throw upload.error;
      }
      const { error } = await supabase
        .from("children")
        .update({
          first_name: values.firstName,
          birth_year: values.birthYear === "" ? null : values.birthYear,
          school_level: values.schoolLevel || null,
          notes: values.notes || null,
          avatar_path: avatarPath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId)
        .eq("parent_id", user.id);
      if (error) {
        if (avatarPath && avatarPath !== child.avatar_path) await supabase.storage.from("child-photos").remove([avatarPath]);
        throw error;
      }
      if (child.avatar_path && avatarPath !== child.avatar_path) {
        await supabase.storage.from("child-photos").remove([child.avatar_path]);
      }
    },
    onSuccess: async () => {
      setEditingId(null);
      setEditDraft(null);
      toast.success("Profil enfant mis à jour");
      await queryClient.invalidateQueries({ queryKey: ["children", user.id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Modification impossible"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const child = children.find((item) => item.id === id);
      if (child?.avatar_path) {
        const removal = await supabase.storage.from("child-photos").remove([child.avatar_path]);
        if (removal.error) throw removal.error;
      }
      const { error } = await supabase.from("children").delete().eq("id", id).eq("parent_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil supprimé");
      queryClient.invalidateQueries({ queryKey: ["children", user.id] });
    },
    onError: () => toast.error("Suppression impossible"),
  });

  const children = childrenQuery.data ?? [];

  if (!rolesLoading && !isParent) {
    return (
      <div className="container-page py-14">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h1 className="font-display text-xl font-bold text-foreground">Espace réservé aux parents</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Les profils enfants servent aux parents qui réservent des cours. Votre compte n&apos;a
            pas accès à cette section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-6 sm:py-12">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Mes enfants</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Suivez les cours et la progression de chacun.
      </p>

      <div className="mt-4">
        <Button type="button" className="w-full rounded-xl sm:w-auto" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4" aria-hidden />
          Ajouter un enfant
        </Button>
      </div>

      {showForm && (
        <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-base font-bold text-foreground">Nouveau profil enfant</h2>
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate();
            }}
          >
            <div>
              <label htmlFor="child-name" className="text-sm font-semibold text-foreground">
                Prénom
              </label>
              <input
                id="child-name"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex. Kévin"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="child-year" className="text-sm font-semibold text-foreground">
                  Année de naissance
                </label>
                <input
                  id="child-year"
                  type="number"
                  min={2000}
                  max={CURRENT_YEAR}
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  placeholder="Ex. 2012"
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div>
                <label htmlFor="child-level" className="text-sm font-semibold text-foreground">
                  Niveau scolaire
                </label>
                <select
                  id="child-level"
                  value={schoolLevel}
                  onChange={(e) => setSchoolLevel(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                >
                  <option value="">Sélectionner…</option>
                  {(catalogQuery.data?.levels ?? []).map((level) => <option key={level.id} value={level.slug}>{level.name}</option>)}
                </select>
              </div>
            </div>
            <Button type="submit" disabled={addMutation.isPending} className="w-full rounded-xl sm:w-auto">
              {addMutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              Ajouter
            </Button>
          </form>
        </section>
      )}

      <section aria-label="Liste des enfants" className="mt-5 space-y-3 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
        {childrenQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
          </div>
        ) : children.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
            <p className="font-display font-bold text-foreground">Aucun enfant pour le moment</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajoutez un premier profil avec le bouton « Ajouter un enfant ».
            </p>
          </div>
        ) : (
          children.map((child) => {
            const activePacks = (overviewQuery.data?.packs ?? []).filter(
              (pack) => pack.child_id === child.id && pack.status === "active",
            );
            const sessionsLeft = activePacks.reduce((sum, pack) => sum + Math.max(pack.sessions_total - pack.sessions_used, 0), 0);
            const sessionsTotal = activePacks.reduce((sum, pack) => sum + pack.sessions_total, 0);
            const sessionsUsed = activePacks.reduce((sum, pack) => sum + pack.sessions_used, 0);
            const nextBooking = (overviewQuery.data?.bookings ?? [])
              .filter((booking) => booking.child_id === child.id && booking.status === "accepted")
              .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0];
            return (
              <article key={child.id} className="rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft font-display font-bold text-primary-soft-foreground">
                    {child.avatarUrl ? <img src={child.avatarUrl} alt={`Photo de ${child.first_name}`} className="size-full object-cover" /> : child.first_name.charAt(0).toUpperCase()}
                  </span>
                  <Link
                    to="/compte/enfants/$childId"
                    params={{ childId: child.id }}
                    className="min-w-0 flex-1"
                  >
                    <span className="block truncate font-display font-bold text-foreground">{child.first_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[child.school_level, child.birth_year ? `né(e) en ${child.birth_year}` : null]
                        .filter(Boolean)
                        .join(" · ") || "Profil enfant"}
                    </span>
                  </Link>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Modifier le profil de ${child.first_name}`}
                    onClick={() => {
                      setEditingId(child.id);
                      setEditDraft({ firstName: child.first_name, birthYear: child.birth_year?.toString() ?? "", schoolLevel: child.school_level ?? "", notes: child.notes ?? "", photo: null });
                    }}
                    className="shrink-0 rounded-full text-muted-foreground"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                </div>

                {editingId === child.id && editDraft && (
                  <form className="mt-3 space-y-3 border-t border-border pt-3" onSubmit={(event) => { event.preventDefault(); editMutation.mutate(); }}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-foreground">Prénom
                        <input value={editDraft.firstName} maxLength={80} onChange={(event) => setEditDraft({ ...editDraft, firstName: event.target.value })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
                      </label>
                      <label className="text-xs font-semibold text-foreground">Année de naissance
                        <input type="number" min={2000} max={CURRENT_YEAR} value={editDraft.birthYear} onChange={(event) => setEditDraft({ ...editDraft, birthYear: event.target.value })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
                      </label>
                    </div>
                    <label className="block text-xs font-semibold text-foreground">Niveau scolaire
                      <select value={editDraft.schoolLevel} onChange={(event) => setEditDraft({ ...editDraft, schoolLevel: event.target.value })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm">
                        <option value="">Sélectionner…</option>
                        {(catalogQuery.data?.levels ?? []).map((level) => <option key={level.id} value={level.slug}>{level.name}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-foreground">Informations utiles au parcours
                      <textarea rows={3} maxLength={1000} value={editDraft.notes} onChange={(event) => setEditDraft({ ...editDraft, notes: event.target.value })} placeholder="Besoins, points d’attention ou préférences utiles aux cours" className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs font-semibold text-foreground">
                      <Camera className="size-4 text-primary" aria-hidden />
                      {editDraft.photo?.name ?? "Choisir une photo (JPG, PNG ou WebP)"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setEditDraft({ ...editDraft, photo: event.target.files?.[0] ?? null })} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" size="sm" disabled={editMutation.isPending}>{editMutation.isPending && <Loader2 className="size-4 animate-spin" />}Enregistrer</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => { setEditingId(null); setEditDraft(null); }}><X className="size-4" />Annuler</Button>
                      <Button type="button" size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => { if (window.confirm(`Supprimer le profil de ${child.first_name} ?`)) deleteMutation.mutate(child.id); }}><Trash2 className="size-4" />Supprimer</Button>
                    </div>
                  </form>
                )}

                <p className="mt-3 text-sm font-semibold text-foreground">
                  {sessionsLeft > 0
                    ? `${sessionsLeft} séance${sessionsLeft > 1 ? "s" : ""} restante${sessionsLeft > 1 ? "s" : ""}`
                    : "Aucune formule active"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {nextBooking
                    ? `Prochain cours : ${new Date(nextBooking.scheduled_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })} à ${new Date(nextBooking.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                    : "Aucun cours programmé"}
                </p>

                {sessionsTotal > 0 && (
                  <div className="mt-3">
                    <ProgressBar
                      value={(sessionsUsed / sessionsTotal) * 100}
                      label={`${sessionsUsed} séance${sessionsUsed > 1 ? "s" : ""} effectuée${sessionsUsed > 1 ? "s" : ""} sur ${sessionsTotal}`}
                    />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                  <Link
                    to="/compte/enfants/$childId"
                    params={{ childId: child.id }}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    Voir son parcours <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <Link
                    to="/professeurs"
                    search={{ enfant: child.id }}
                    className="inline-flex text-sm font-semibold text-foreground hover:underline"
                  >
                    Trouver un intervenant
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

