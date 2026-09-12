import { supabase } from "@/integrations/supabase/client";

export type Attendance = "present" | "absent" | "absent_excused";
export type ProgressLevel = "to_reinforce" | "acquiring" | "acquired";
export type EngagementLevel = "very_good" | "good" | "to_improve";

export const ATTENDANCE_OPTIONS: { value: Attendance; label: string }[] = [
  { value: "present", label: "Présent" },
  { value: "absent", label: "Absent" },
  { value: "absent_excused", label: "Absent excusé" },
];

export const PROGRESS_LEVELS: { value: ProgressLevel; label: string }[] = [
  { value: "to_reinforce", label: "À renforcer" },
  { value: "acquiring", label: "En cours d’acquisition" },
  { value: "acquired", label: "Acquis" },
];

export const ENGAGEMENT_LEVELS: { value: EngagementLevel; label: string }[] = [
  { value: "very_good", label: "Très bon" },
  { value: "good", label: "Bon" },
  { value: "to_improve", label: "À améliorer" },
];

/** Repère visuel interne (courbe d'engagement) : aucun pourcentage affiché à l'apprenant. */
export function engagementScore(level: EngagementLevel | null | undefined) {
  return level === "very_good" ? 5 : level === "good" ? 4 : 2;
}

export type SessionReport = {
  id: string;
  booking_id: string;
  teacher_id: string;
  learner_id: string;
  child_id: string | null;
  attendance: Attendance;
  content_note: string;
  progress_level: ProgressLevel;
  /** Travail réalisé depuis la dernière séance — texte libre. */
  homework_done: string | null;
  engagement_level: EngagementLevel;
  next_steps: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionReportDocument = {
  id: string;
  report_id: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
};

export type ReportAssignmentInput = {
  title: string;
  description: string;
  dueDate: string;
  file: File | null;
};

export const REPORT_FILES_BUCKET = "message-files";
export const MAX_REPORT_FILE_BYTES = 10 * 1024 * 1024;

export function labelFor<T extends string>(list: { value: T; label: string }[], value: T | null | undefined) {
  if (!value) return null;
  return list.find((item) => item.value === value)?.label ?? value;
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

async function uploadToConversation(conversationId: string, file: File) {
  if (file.size > MAX_REPORT_FILE_BYTES) throw new Error(`${file.name} dépasse 10 Mo`);
  const path = `${conversationId}/${crypto.randomUUID()}-${sanitize(file.name)}`;
  const { error } = await supabase.storage.from(REPORT_FILES_BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}

/**
 * Crée ou corrige le compte-rendu d'UNE séance précise, puis enregistre ses
 * devoirs (vraies tâches) et ses documents. Les informations de la séance ne
 * sont jamais ressaisies : elles restent portées par la réservation.
 */
export async function submitSessionReport(input: {
  bookingId: string;
  teacherId: string;
  learnerId: string;
  childId: string | null;
  attendance: Attendance;
  contentNote: string;
  progressLevel: ProgressLevel;
  homeworkDone: string | null;
  engagementLevel: EngagementLevel;
  nextSteps: string | null;
  assignments?: ReportAssignmentInput[];
  documents?: File[];
}) {
  const { data: report, error } = await supabase
    .from("session_reports")
    .upsert(
      {
        booking_id: input.bookingId,
        teacher_id: input.teacherId,
        learner_id: input.learnerId,
        child_id: input.childId,
        attendance: input.attendance,
        content_note: input.contentNote.trim(),
        progress_level: input.progressLevel,
        homework_done: input.homeworkDone?.trim() || null,
        engagement_level: input.engagementLevel,
        next_steps: input.nextSteps?.trim() || null,
      },
      { onConflict: "booking_id" },
    )
    .select("id")
    .single();
  if (error) throw error;

  const newAssignments = (input.assignments ?? []).filter((a) => a.title.trim());
  const documents = input.documents ?? [];
  if (!newAssignments.length && !documents.length) return report.id;

  // La conversation existante du binôme sert de support d'accès aux fichiers.
  const { data: conversation, error: convError } = await supabase.rpc("ensure_conversation", {
    p_teacher_id: input.teacherId,
    p_learner_id: input.learnerId,
    p_child_id: input.childId ?? undefined,
  });
  if (convError) throw convError;
  const conversationId = (conversation as { id: string } | null)?.id;
  if (!conversationId) throw new Error("Conversation indisponible pour joindre les fichiers");

  for (const assignment of newAssignments) {
    const path = assignment.file ? await uploadToConversation(conversationId, assignment.file) : null;
    const { error: assignmentError } = await supabase.from("assignments").insert({
      conversation_id: conversationId,
      teacher_id: input.teacherId,
      session_report_id: report.id,
      title: assignment.title.trim(),
      description: assignment.description.trim() || null,
      due_date: assignment.dueDate || null,
      storage_path: path,
      file_name: assignment.file?.name ?? null,
      file_size: assignment.file?.size ?? null,
    });
    if (assignmentError) throw assignmentError;
  }

  for (const file of documents) {
    const path = await uploadToConversation(conversationId, file);
    const { error: docError } = await supabase.from("session_report_documents").insert({
      report_id: report.id,
      teacher_id: input.teacherId,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
    });
    if (docError) throw docError;
  }

  return report.id;
}

/** URL signée temporaire pour consulter un fichier joint à un compte-rendu. */
export async function signReportFile(path: string) {
  const { data, error } = await supabase.storage.from(REPORT_FILES_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

/** Format lisible déduit du fichier — jamais demandé à l'intervenant. */
export function fileFormatLabel(fileName: string, mimeType: string | null, size: number | null) {
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toUpperCase() : (mimeType?.split("/")[1] ?? "Fichier").toUpperCase();
  if (!size) return ext;
  const mo = size / (1024 * 1024);
  return `${ext} · ${mo >= 1 ? `${mo.toFixed(1)} Mo` : `${Math.max(Math.round(size / 1024), 1)} Ko`}`;
}
