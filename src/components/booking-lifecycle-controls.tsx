import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type Role = "learner" | "teacher";

type BookingLifecycleData = {
  id: string;
  status: string;
  scheduled_at: string;
  reschedule_used: boolean;
};

/**
 * Report d'une séance programmée (une seule fois, à plus de 24h) et
 * signalement d'absence. Toutes les règles (report unique, séance perdue,
 * rémunération) sont appliquées côté serveur : ce composant informe et
 * déclenche les actions.
 */
export function BookingLifecycleControls({
  booking,
  role,
  invalidateKeys,
}: {
  booking: BookingLifecycleData;
  role: Role;
  invalidateKeys: unknown[][];
}) {
  const queryClient = useQueryClient();
  const [proposing, setProposing] = useState(false);
  const [newDate, setNewDate] = useState("");

  const invalidate = () => {
    for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: key });
  };

  const reschedule = useMutation({
    mutationFn: async () => {
      if (!newDate) throw new Error("Choisissez une date");
      const { error } = await supabase.rpc("reschedule_session", {
        p_booking_id: booking.id,
        p_new_scheduled_at: new Date(newDate).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Séance reportée", {
        description: "Ce report était le seul possible pour cette séance.",
      });
      setProposing(false);
      setNewDate("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Report impossible"),
  });

  const reportNoShow = useMutation({
    mutationFn: async () => {
      const rpc = role === "learner" ? "report_teacher_no_show" : "report_parent_no_show";
      const { error } = await supabase.rpc(rpc, { p_booking_id: booking.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Absence signalée", {
        description:
          role === "learner"
            ? "La séance est rendue à votre formule."
            : "La séance est marquée absente côté famille et reste consommée.",
      });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Signalement impossible"),
  });

  if (booking.status !== "accepted") return null;

  const sessionStarted = new Date(booking.scheduled_at).getTime() <= Date.now();
  const hoursBefore = (new Date(booking.scheduled_at).getTime() - Date.now()) / 3_600_000;

  if (sessionStarted) {
    return (
      <button
        type="button"
        onClick={() => {
          const confirmed = window.confirm(
            role === "learner"
              ? "Confirmer : l'intervenant ne s'est pas présenté ? La séance sera rendue à votre formule."
              : "Confirmer : la famille ne s'est pas présentée ? La séance restera consommée.",
          );
          if (confirmed) reportNoShow.mutate();
        }}
        disabled={reportNoShow.isPending}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
      >
        <AlertTriangle className="size-3.5" aria-hidden />
        {role === "learner" ? "Signaler l'absence de l'intervenant" : "Signaler l'absence de la famille"}
      </button>
    );
  }

  if (booking.reschedule_used) {
    return (
      <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Cette séance a déjà été reportée une fois : elle ne peut plus être reportée. Une annulation
        la ferait perdre.
      </p>
    );
  }

  if (hoursBefore <= 24) {
    return (
      <p className="mt-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">
        Report possible seulement à plus de 24 h de la séance. À moins de 24 h, une annulation fait
        perdre la séance.
      </p>
    );
  }

  if (proposing) {
    return (
      <div className="mt-2 space-y-2 rounded-xl border border-border bg-card p-3">
        <input
          type="datetime-local"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground"
        />
        <p className="text-[11px] text-muted-foreground">
          Le nouveau créneau doit appartenir aux disponibilités de l&apos;intervenant et être à plus
          de 24 h. Ce report est le seul possible pour cette séance.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => reschedule.mutate()}
            disabled={reschedule.isPending || !newDate}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Reporter la séance
          </button>
          <button
            type="button"
            onClick={() => {
              setProposing(false);
              setNewDate("");
            }}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setProposing(true)}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
    >
      <CalendarClock className="size-3.5" aria-hidden /> Reporter (une seule fois)
    </button>
  );
}
