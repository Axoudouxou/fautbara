import { supabase } from "@/integrations/supabase/client";

export type Attendance = "done" | "cancelled" | "absent";
export type ProgressLevel = "discovering" | "in_progress" | "mastered";
export type HomeworkDone = "yes" | "partial" | "no";

export const ATTENDANCE_OPTIONS: { value: Attendance; label: string }[] = [
  { value: "done", label: "Fait" },
  { value: "cancelled", label: "Annulé" },
  { value: "absent", label: "Absent" },
];

export const PROGRESS_LEVELS: { value: ProgressLevel; label: string }[] = [
  { value: "discovering", label: "À découvrir" },
  { value: "in_progress", label: "En progression" },
  { value: "mastered", label: "Maîtrisé" },
];

export const HOMEWORK_DONE_OPTIONS: { value: HomeworkDone; label: string }[] = [
  { value: "yes", label: "Oui" },
  { value: "partial", label: "En partie" },
  { value: "no", label: "Non" },
];

export type SessionReport = {
  id: string;
  booking_id: string;
  teacher_id: string;
  learner_id: string;
  child_id: string | null;
  attendance: Attendance;
  content_note: string;
  progress_level: ProgressLevel;
  homework_done: HomeworkDone | null;
  engagement_rating: number;
  next_steps: string | null;
  created_at: string;
  updated_at: string;
};

export function labelFor<T extends string>(list: { value: T; label: string }[], value: T) {
  return list.find((item) => item.value === value)?.label ?? value;
}

/** Crée ou corrige (même professeur, même réservation) le compte-rendu d'une séance terminée. */
export async function submitSessionReport(input: {
  bookingId: string;
  teacherId: string;
  learnerId: string;
  childId: string | null;
  attendance: Attendance;
  contentNote: string;
  progressLevel: ProgressLevel;
  homeworkDone: HomeworkDone | null;
  engagementRating: number;
  nextSteps: string | null;
}) {
  const { error } = await supabase.from("session_reports").upsert(
    {
      booking_id: input.bookingId,
      teacher_id: input.teacherId,
      learner_id: input.learnerId,
      child_id: input.childId,
      attendance: input.attendance,
      content_note: input.contentNote.trim(),
      progress_level: input.progressLevel,
      homework_done: input.homeworkDone,
      engagement_rating: input.engagementRating,
      next_steps: input.nextSteps?.trim() || null,
    },
    { onConflict: "booking_id" },
  );
  if (error) throw error;
}
