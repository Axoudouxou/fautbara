import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Loader2, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell, useIsAdmin } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/professeurs")({
  head: () => ({
    meta: [
      { title: "Professeurs & vérifications — Administration FAUT BARA" },
      {
        name: "description",
        content:
          "Gestion des professeurs FAUT BARA : vérification d'identité, validation des diplômes et suivi des offres.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTeachers,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  approved: "Vérifié",
  rejected: "Refusé",
};

function AdminTeachers() {
  const { user } = Route.useRouteContext();
  const adminQuery = useIsAdmin(user.id);
  const isAdmin = adminQuery.data ?? false;
  const queryClient = useQueryClient();

  const teachersQuery = useQuery({
    queryKey: ["admin-teachers"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_teachers");
      if (error) throw error;
      return data ?? [];
    },
  });

  const verify = useMutation({
    mutationFn: async (input: {
      teacherId: string;
      identity: boolean;
      qualifications: boolean;
      status: string;
    }) => {
      const { error } = await supabase.rpc("admin_set_teacher_verification", {
        p_teacher_id: input.teacherId,
        p_identity_verified: input.identity,
        p_qualifications_verified: input.qualifications,
        p_verification_status: input.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vérification mise à jour");
      queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const teachers = teachersQuery.data ?? [];

  return (
    <AdminShell
      userId={user.id}
      title="Professeurs & vérifications"
      description="Validez l'identité et les diplômes des professeurs. Les professeurs ne peuvent pas modifier eux-mêmes leur état de vérification."
    >
      {teachersQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </p>
      ) : teachers.length === 0 ? (
        <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Aucun professeur inscrit pour le moment.
        </p>
      ) : (
        <ul className="space-y-4">
          {teachers.map((t) => (
            <li
              key={t.teacher_id}
              className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display font-bold text-foreground">{t.display_name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t.headline || "Aucun titre renseigné"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[t.city, t.commune].filter(Boolean).join(" · ")}
                    {t.phone ? ` · ${t.phone}` : ""}
                    {t.years_experience ? ` · ${t.years_experience} an(s) d'expérience` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Number(t.offers_published)} offre(s) publiée(s) sur {Number(t.offers_total)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                    {STATUS_LABEL[t.verification_status ?? "pending"] ?? t.verification_status}
                  </span>
                  {t.identity_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
                      <BadgeCheck className="size-3.5" aria-hidden /> Identité
                    </span>
                  )}
                  {t.qualifications_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
                      <BadgeCheck className="size-3.5" aria-hidden /> Diplômes
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={verify.isPending}
                  onClick={() =>
                    verify.mutate({
                      teacherId: t.teacher_id,
                      identity: true,
                      qualifications: true,
                      status: "approved",
                    })
                  }
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Tout valider
                </button>
                <button
                  type="button"
                  disabled={verify.isPending}
                  onClick={() =>
                    verify.mutate({
                      teacherId: t.teacher_id,
                      identity: true,
                      qualifications: t.qualifications_verified ?? false,
                      status: "approved",
                    })
                  }
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  Valider l'identité
                </button>
                <button
                  type="button"
                  disabled={verify.isPending}
                  onClick={() =>
                    verify.mutate({
                      teacherId: t.teacher_id,
                      identity: t.identity_verified ?? false,
                      qualifications: true,
                      status: "approved",
                    })
                  }
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  Valider les diplômes
                </button>
                <button
                  type="button"
                  disabled={verify.isPending}
                  onClick={() =>
                    verify.mutate({
                      teacherId: t.teacher_id,
                      identity: false,
                      qualifications: false,
                      status: "rejected",
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <ShieldX className="size-3.5" aria-hidden /> Refuser
                </button>
                <button
                  type="button"
                  disabled={verify.isPending}
                  onClick={() =>
                    verify.mutate({
                      teacherId: t.teacher_id,
                      identity: t.identity_verified ?? false,
                      qualifications: t.qualifications_verified ?? false,
                      status: "pending",
                    })
                  }
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-50"
                >
                  Remettre en attente
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
