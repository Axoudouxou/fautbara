/**
 * Modèle économique BARA : la famille achète une formule (ou une séance
 * seule) puis programme ses séances depuis l'agenda réel de l'intervenant.
 * Les frais BARA sont facturés à la famille et l'intervenant perçoit 100 %
 * de son tarif. Tous les montants affichés ici viennent du serveur
 * (quote_pack) : aucun calcul de prix n'est fait dans le navigateur.
 */
export type PackQuote = {
  slug: string;
  name: string;
  tagline: string | null;
  is_pack: boolean;
  sessions_total: number;
  free_sessions: number;
  paid_sessions: number;
  validity_days: number;
  teacher_rate_fcfa: number;
  rate_cap_fcfa: number;
  rate_capped: boolean;
  teacher_amount_fcfa: number;
  platform_fee_fcfa: number;
  total_fcfa: number;
  duration_minutes: number;
  available: boolean;
  unavailable_reason: string | null;
};

export type TeacherGrade = "verified" | "confirmed" | "referent" | "coordinator";

export const GRADE_LABELS: Record<TeacherGrade, string> = {
  verified: "Vérifié",
  confirmed: "Confirmé",
  referent: "Référent",
  coordinator: "Coordinateur",
};

export function gradeLabel(grade: string | null | undefined) {
  return GRADE_LABELS[(grade ?? "verified") as TeacherGrade] ?? "Vérifié";
}

export function formatFcfa(value: number | null | undefined) {
  return `${(value ?? 0).toLocaleString("fr-FR")} FCFA`;
}

export const SESSION_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  accepted: { label: "Programmée", className: "bg-success-soft text-success" },
  completed: { label: "Réalisée", className: "bg-primary-soft text-primary-soft-foreground" },
  cancelled: { label: "Annulée", className: "bg-muted text-muted-foreground" },
  lost: { label: "Séance perdue", className: "bg-destructive/10 text-destructive" },
  no_show_teacher: { label: "Intervenant absent", className: "bg-destructive/10 text-destructive" },
  no_show_parent: { label: "Famille absente", className: "bg-destructive/10 text-destructive" },
};

export const PACK_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending_payment: { label: "En attente de paiement", className: "bg-warning-soft text-warning" },
  active: { label: "Active", className: "bg-success-soft text-success" },
  completed: { label: "Terminée", className: "bg-primary-soft text-primary-soft-foreground" },
  expired: { label: "Expirée", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Annulée", className: "bg-muted text-muted-foreground" },
};

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
