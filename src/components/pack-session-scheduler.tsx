import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AvailabilitySlotGrid, abidjanSlotDate, formatAbidjan } from "@/components/teacher-availability-calendar";

type Props = {
  packId: string;
  teacherId: string;
  teacherName?: string | undefined;
  durationMinutes: number;
  sessionsLeft: number;
  invalidateKeys: unknown[][];
};

/**
 * Programmation d'une séance déjà payée dans une formule : aucun paiement
 * supplémentaire. Le serveur (schedule_pack_session) vérifie le solde de la
 * formule, sa validité et la disponibilité réelle de l'intervenant.
 */
export function PackSessionScheduler({
  packId,
  teacherId,
  teacherName,
  durationMinutes,
  sessionsLeft,
  invalidateKeys,
}: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<{ date: string; time: string } | null>(null);
  const [message, setMessage] = useState("");

  const schedule = useMutation({
    mutationFn: async () => {
      if (!slot) throw new Error("Choisissez un créneau");
      const { error } = await supabase.rpc("schedule_pack_session", {
        p_pack_id: packId,
        p_scheduled_at: abidjanSlotDate(slot.date, slot.time).toISOString(),
        ...(message.trim() ? { p_message: message.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Séance programmée", {
        description: "Elle apparaît dans vos cours et dans l'agenda de l'intervenant.",
      });
      setOpen(false);
      setSlot(null);
      setMessage("");
      for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error("Programmation impossible", { description: e.message }),
  });

  if (sessionsLeft <= 0) {
    return (
      <p className="mt-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
        Toutes les séances de cette formule ont été utilisées.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <CalendarPlus className="size-3.5" aria-hidden /> Programmer une séance
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-background p-4">
      <p className="text-sm font-semibold text-foreground">
        Choisissez un créneau dans l&apos;agenda de {teacherName ?? "l'intervenant"}
      </p>
      <AvailabilitySlotGrid
        teacherId={teacherId}
        durationMinutes={durationMinutes}
        selected={slot}
        onSelectSlot={(date, time) => setSlot({ date, time })}
      />
      {slot && (
        <p className="rounded-xl bg-primary-soft/50 px-3 py-2 text-xs font-semibold text-foreground">
          Séance du {formatAbidjan(slot.date, slot.time, { weekday: "long", day: "numeric", month: "long" })}
          {" "}
          à {slot.time} (heure d&apos;Abidjan)
        </p>
      )}
      <textarea
        rows={2}
        maxLength={500}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Précisions pour cette séance (optionnel)"
        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => schedule.mutate()}
          disabled={schedule.isPending || !slot}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {schedule.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          Confirmer la séance
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
