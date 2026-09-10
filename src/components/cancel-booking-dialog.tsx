import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type Props = {
  bookingId: string;
  scheduledAt: string;
  rescheduleUsed?: boolean;
  role?: "learner" | "teacher";
  onClose: () => void;
  onCancelled?: () => void;
  invalidateKeys?: unknown[][];
};

/**
 * Annulation d'une séance programmée. Règle unique du nouveau modèle :
 * à plus de 24h et sans report déjà utilisé, la séance revient dans la
 * formule ; sinon elle est consommée. Le serveur (cancel_session) tranche,
 * ce dialogue ne fait qu'annoncer la conséquence.
 */
export function CancelBookingDialog({
  bookingId,
  scheduledAt,
  rescheduleUsed = false,
  role = "learner",
  onClose,
  onCancelled,
  invalidateKeys = [],
}: Props) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const hoursBefore = (new Date(scheduledAt).getTime() - Date.now()) / 3_600_000;
  const keepsSession = role === "teacher" || (hoursBefore > 24 && !rescheduleUsed);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const trimmed = reason.trim();
      const { error } = await supabase.rpc("cancel_session", {
        p_booking_id: bookingId,
        ...(trimmed ? { p_reason: trimmed } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Séance annulée", {
        description: keepsSession
          ? "La séance reste disponible dans la formule : vous pouvez la reprogrammer."
          : "Annulation tardive : cette séance est considérée comme consommée.",
      });
      for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: key });
      onCancelled?.();
      onClose();
    },
    onError: (err) =>
      toast.error("Annulation impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-foreground">Annuler cette séance</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div
          className={`mt-4 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${
            keepsSession ? "bg-secondary/50 text-muted-foreground" : "bg-destructive-soft text-destructive"
          }`}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {keepsSession
              ? "Annulation à plus de 24 h : la séance revient dans la formule et pourra être reprogrammée."
              : rescheduleUsed
                ? "Cette séance a déjà été reportée une fois : l'annuler la fait perdre définitivement."
                : "Annulation à moins de 24 h : la séance est considérée comme consommée, sans remboursement."}
          </span>
        </div>

        <label className="mt-4 block text-sm font-semibold text-foreground" htmlFor="cancel-reason">
          Motif (optionnel)
        </label>
        <textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
          placeholder="Empêchement, changement d'organisation…"
        />

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-destructive px-5 py-3 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
          >
            {cancelMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Confirmer l&apos;annulation
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Garder la séance
          </button>
        </div>
      </div>
    </div>
  );
}
