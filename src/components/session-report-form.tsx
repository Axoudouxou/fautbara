import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  ATTENDANCE_OPTIONS,
  ENGAGEMENT_LEVELS,
  MAX_REPORT_FILE_BYTES,
  PROGRESS_LEVELS,
  submitSessionReport,
  type Attendance,
  type EngagementLevel,
  type ProgressLevel,
  type ReportAssignmentInput,
  type SessionReport,
} from "@/lib/session-reports";

const SELECT_CLASS =
  "mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40";
const TEXTAREA_CLASS =
  "mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40";

function emptyAssignment(): ReportAssignmentInput {
  return { title: "", description: "", dueDate: "", file: null };
}

/**
 * Compte-rendu rattaché à UNE séance précise. Les informations de la séance
 * (apprenant, intervenant, matière, date, heure, numéro, formule, format)
 * sont reprises automatiquement : l'intervenant ne saisit que son retour.
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
  variant = "modal",
  onPublished,
}: {
  bookingId: string;
  teacherId: string;
  learnerId: string;
  childId: string | null;
  recipientLabel: string;
  existing?: SessionReport | null;
  onClose: () => void;
  invalidateKeys?: unknown[][];
  /** "page" affiche le formulaire en pleine page (parcours post-séance de l'intervenant). */
  variant?: "modal" | "page";
  onPublished?: (summary: { assignments: number; documents: number }) => void;
}) {
  const queryClient = useQueryClient();
  const [attendance, setAttendance] = useState<Attendance>(existing?.attendance ?? "present");
  const [contentNote, setContentNote] = useState(existing?.content_note ?? "");
  const [progressLevel, setProgressLevel] = useState<ProgressLevel | "">(existing?.progress_level ?? "");
  const [homeworkDone, setHomeworkDone] = useState(existing?.homework_done ?? "");
  const [engagementLevel, setEngagementLevel] = useState<EngagementLevel | "">(existing?.engagement_level ?? "");
  const [nextSteps, setNextSteps] = useState(existing?.next_steps ?? "");
  const [assignments, setAssignments] = useState<ReportAssignmentInput[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);

  const sessionQuery = useQuery({
    queryKey: ["report-session-context", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "scheduled_at, duration_minutes, format, session_index, commune, city, children(first_name), teacher_offers(title, subjects(name)), packs(pack_slug, pack_types(name))",
        )
        .eq("id", bookingId)
        .maybeSingle();
      if (error) throw error;
      const learner = await supabase.from("profiles").select("display_name").eq("user_id", learnerId).maybeSingle();
      return { booking: data, learnerName: learner.data?.display_name ?? recipientLabel };
    },
  });

  const booking = sessionQuery.data?.booking;
  const start = booking ? new Date(booking.scheduled_at) : null;
  const end = booking && start ? new Date(start.getTime() + booking.duration_minutes * 60_000) : null;
  const timeFmt = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const autoRows: { label: string; value: string }[] = booking
    ? [
        { label: "Apprenant", value: booking.children?.first_name ?? sessionQuery.data?.learnerName ?? recipientLabel },
        { label: "Matière", value: booking.teacher_offers?.subjects?.name ?? booking.teacher_offers?.title ?? "Cours" },
        {
          label: "Date",
          value: start!.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
        },
        { label: "Heure", value: `${timeFmt(start!)} – ${timeFmt(end!)}` },
        { label: "Séance", value: booking.session_index ? `N° ${booking.session_index}` : "—" },
        { label: "Formule", value: booking.packs?.pack_types?.name ?? booking.packs?.pack_slug ?? "—" },
        {
          label: "Format",
          value:
            booking.format === "online"
              ? "En ligne"
              : `À domicile${booking.commune ? ` · ${booking.commune}` : ""}`,
        },
      ]
    : [];

  const save = useMutation({
    mutationFn: async () => {
      if (!contentNote.trim()) throw new Error("Décrivez le contenu travaillé");
      if (!progressLevel) throw new Error("Indiquez le niveau d’avancement");
      if (!engagementLevel) throw new Error("Indiquez l’engagement");
      await submitSessionReport({
        bookingId,
        teacherId,
        learnerId,
        childId,
        attendance,
        contentNote,
        progressLevel,
        homeworkDone: homeworkDone || null,
        engagementLevel,
        nextSteps: nextSteps || null,
        assignments,
        documents,
      });
    },
    onSuccess: () => {
      toast.success(existing ? "Compte-rendu mis à jour" : "Compte-rendu envoyé");
      for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6"
      >
        <h2 className="font-display text-lg font-bold text-foreground">Compte-rendu de séance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pour {recipientLabel} — les informations de la séance sont déjà reprises ci-dessous.
        </p>

        <div className="mt-4 rounded-2xl bg-secondary/50 p-4">
          {sessionQuery.isLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Chargement de la séance…
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              {autoRows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{row.label}</dt>
                  <dd className="truncate text-sm font-semibold text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <label htmlFor="report-attendance" className="text-sm font-semibold text-foreground">
              Présence
            </label>
            <select
              id="report-attendance"
              value={attendance}
              onChange={(e) => setAttendance(e.target.value as Attendance)}
              className={SELECT_CLASS}
            >
              {ATTENDANCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-content" className="text-sm font-semibold text-foreground">
              Contenu travaillé
            </label>
            <textarea
              id="report-content"
              rows={4}
              value={contentNote}
              onChange={(e) => setContentNote(e.target.value)}
              placeholder="Ce qui a réellement été travaillé pendant la séance…"
              className={TEXTAREA_CLASS}
            />
          </div>

          <div>
            <label htmlFor="report-progress" className="text-sm font-semibold text-foreground">
              Niveau d’avancement
            </label>
            <select
              id="report-progress"
              value={progressLevel}
              onChange={(e) => setProgressLevel(e.target.value as ProgressLevel)}
              className={SELECT_CLASS}
            >
              <option value="">Choisir…</option>
              {PROGRESS_LEVELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-homework" className="text-sm font-semibold text-foreground">
              Travail depuis la dernière séance
            </label>
            <textarea
              id="report-homework"
              rows={3}
              value={homeworkDone}
              onChange={(e) => setHomeworkDone(e.target.value)}
              placeholder="Ce que l’apprenant a réalisé depuis le cours précédent…"
              className={TEXTAREA_CLASS}
            />
          </div>

          <div>
            <label htmlFor="report-engagement" className="text-sm font-semibold text-foreground">
              Engagement
            </label>
            <select
              id="report-engagement"
              value={engagementLevel}
              onChange={(e) => setEngagementLevel(e.target.value as EngagementLevel)}
              className={SELECT_CLASS}
            >
              <option value="">Choisir…</option>
              {ENGAGEMENT_LEVELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-next" className="text-sm font-semibold text-foreground">
              À travailler pour la prochaine séance
            </label>
            <textarea
              id="report-next"
              rows={3}
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              placeholder="Ce que l’apprenant doit travailler, revoir ou préparer…"
              className={TEXTAREA_CLASS}
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">
              Devoirs <span className="font-normal text-muted-foreground">(si nécessaire)</span>
            </p>
            <div className="mt-2 space-y-3">
              {assignments.map((assignment, index) => (
                <div key={index} className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-3">
                  <div className="flex items-start gap-2">
                    <input
                      value={assignment.title}
                      onChange={(e) =>
                        setAssignments((list) =>
                          list.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)),
                        )
                      }
                      placeholder="Titre du devoir"
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                    />
                    <button
                      type="button"
                      aria-label="Retirer ce devoir"
                      onClick={() => setAssignments((list) => list.filter((_, i) => i !== index))}
                      className="mt-1 text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={assignment.description}
                    onChange={(e) =>
                      setAssignments((list) =>
                        list.map((item, i) => (i === index ? { ...item, description: e.target.value } : item)),
                      )
                    }
                    placeholder="Consigne"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs font-semibold text-foreground">
                      Date limite
                      <input
                        type="date"
                        value={assignment.dueDate}
                        onChange={(e) =>
                          setAssignments((list) =>
                            list.map((item, i) => (i === index ? { ...item, dueDate: e.target.value } : item)),
                          )
                        }
                        className="ml-2 rounded-xl border border-input bg-background px-2 py-1.5 text-xs"
                      />
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                      <Paperclip className="size-3.5" aria-hidden />
                      {assignment.file ? assignment.file.name : "Pièce jointe (facultatif)"}
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (file && file.size > MAX_REPORT_FILE_BYTES) {
                            toast.error("Fichier trop volumineux (10 Mo maximum)");
                            return;
                          }
                          setAssignments((list) =>
                            list.map((item, i) => (i === index ? { ...item, file } : item)),
                          );
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAssignments((list) => [...list, emptyAssignment()])}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                <Plus className="size-3.5" aria-hidden /> Ajouter un devoir
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">
              Documents <span className="font-normal text-muted-foreground">(facultatif)</span>
            </p>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary">
              <Paperclip className="size-3.5" aria-hidden /> Joindre des fichiers (10 Mo max)
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  const tooBig = files.find((f) => f.size > MAX_REPORT_FILE_BYTES);
                  if (tooBig) {
                    toast.error("Fichier trop volumineux (10 Mo maximum)");
                    return;
                  }
                  setDocuments((list) => [...list, ...files]);
                }}
              />
            </label>
            {documents.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {documents.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-xs text-foreground">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label={`Retirer ${file.name}`}
                      onClick={() => setDocuments((list) => list.filter((_, i) => i !== index))}
                      className="text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
