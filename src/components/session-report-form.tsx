import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";

import {
  ATTENDANCE_OPTIONS,
  HOMEWORK_DONE_OPTIONS,
  PROGRESS_LEVELS,
  submitSessionReport,
  type Attendance,
  type HomeworkDone,
  type ProgressLevel,
  type SessionReport,
} from "@/lib/session-reports";

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  optional,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Si vrai, cliquer sur l'option déjà sélectionnée la déselectionne (champ facultatif). */
  optional?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active && optional ? null : opt.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background text-foreground hover:bg-secondary"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compte-rendu rapide de séance (objectif : moins de 2 minutes), rempli par
 * le professeur une fois une réservation clôturée. Générique pour toute
 * matière — aucun vocabulaire scolaire (pas de "programme", "bulletin").
 */
export function SessionReportForm({
  bookingId,
  teacherId,
  learnerId,
  childId,
  recipientLabel,
  existing,
  onClose,
  invalidateKeys = [],
}: {
  bookingId: string;
  teacherId: string;
  learnerId: string;
  childId: string | null;
  /** Nom affiché au professeur pour identifier le destinataire (prénom de l'enfant, ou l'apprenant direct). */
  recipientLabel: string;
  existing?: SessionReport | null;
  onClose: () => void;
  invalidateKeys?: unknown[][];
}) {
  const queryClient = useQueryClient();
  const [attendance, setAttendance] = useState<Attendance>(existing?.attendance ?? "done");
  const [contentNote, setContentNote] = useState(existing?.content_note ?? "");
  const [progressLevel, setProgressLevel] = useState<ProgressLevel | null>(
    existing?.progress_level ?? null,
  );
  const [homeworkDone, setHomeworkDone] = useState<HomeworkDone | null>(
    existing?.homework_done ?? null,
  );
  const [engagementRating, setEngagementRating] = useState(existing?.engagement_rating ?? 5);
  const [nextSteps, setNextSteps] = useState(existing?.next_steps ?? "");

  const save = useMutation({
    mutationFn: async () => {
      if (!contentNote.trim()) throw new Error("Décrivez brièvement le contenu travaillé");
      if (!progressLevel) throw new Error("Indiquez le niveau d'avancement");
      await submitSessionReport({
        bookingId,
        teacherId,
        learnerId,
        childId,
        attendance,
        contentNote,
        progressLevel,
        homeworkDone,
        engagementRating,
        nextSteps: nextSteps || null,
      });
    },
    onSuccess: () => {
      toast.success(existing ? "Compte-rendu mis à jour" : "Compte-rendu envoyé");
      for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: key });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Envoi impossible"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compte-rendu de séance"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
      >
        <h2 className="font-display text-lg font-bold text-foreground">Compte-rendu de séance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pour {recipientLabel} — moins de 2 minutes, envoyé directement dans la conversation.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <p className="text-sm font-semibold text-foreground">Présence</p>
            <div className="mt-2">
              <ChipGroup options={ATTENDANCE_OPTIONS} value={attendance} onChange={(v) => v && setAttendance(v)} />
            </div>
          </div>

          <div>
            <label htmlFor="report-content" className="text-sm font-semibold text-foreground">
              Contenu travaillé
            </label>
            <input
              id="report-content"
              value={contentNote}
              onChange={(e) => setContentNote(e.target.value)}
              maxLength={200}
              placeholder="Ex. Fonctions dérivées, Gammes en do majeur, Boucles en Python…"
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Niveau d&apos;avancement</p>
            <div className="mt-2">
              <ChipGroup options={PROGRESS_LEVELS} value={progressLevel} onChange={setProgressLevel} />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">
              Travail fait depuis la dernière fois{" "}
              <span className="font-normal text-muted-foreground">(facultatif)</span>
            </p>
            <div className="mt-2">
              <ChipGroup
                options={HOMEWORK_DONE_OPTIONS}
                value={homeworkDone}
                onChange={setHomeworkDone}
                optional
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Engagement pendant la séance</p>
            <div className="mt-2 flex gap-1.5" role="group" aria-label="Engagement">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} étoile${value > 1 ? "s" : ""}`}
                  aria-pressed={engagementRating === value}
                  onClick={() => setEngagementRating(value)}
                  className="p-1"
                >
                  <Star
                    className={`size-6 ${
                      value <= engagementRating ? "fill-primary text-primary" : "text-muted-foreground"
                    }`}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="report-next-steps" className="text-sm font-semibold text-foreground">
              Pour la prochaine fois{" "}
              <span className="font-normal text-muted-foreground">(facultatif)</span>
            </label>
            <input
              id="report-next-steps"
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              maxLength={200}
              placeholder="Ex. Revoir les exercices 3 et 4"
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Plus tard
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Envoyer le compte-rendu
          </button>
        </div>
      </div>
    </div>
  );
}
