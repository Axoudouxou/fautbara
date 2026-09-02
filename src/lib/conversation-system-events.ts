import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Attendance, HomeworkDone, ProgressLevel } from "@/lib/session-reports";

export type PendingRescheduleBooking = {
  id: string;
  status: string;
  scheduled_at: string;
  reschedule_count: number;
  reschedule_proposed_at: string | null;
  reschedule_proposed_by: string | null;
  reschedule_proposed_fee_rate: number | null;
  reschedule_previous_at: string | null;
};

export type ConversationTimelineEvent =
  | {
      kind: "trial_confirmed" | "booking_confirmed";
      id: string;
      sortAt: string;
      scheduledAt: string;
    }
  | {
      kind: "reschedule_done";
      id: string;
      sortAt: string;
      previousAt: string;
      newAt: string;
      forceMajeure: boolean;
      reason: string | null;
      feeRate: number;
    }
  | {
      kind: "session_report";
      id: string;
      sortAt: string;
      attendance: Attendance;
      contentNote: string;
      progressLevel: ProgressLevel;
      homeworkDone: HomeworkDone | null;
      engagementRating: number;
      nextSteps: string | null;
    };

export type ConversationSystemContext = {
  pending: PendingRescheduleBooking | null;
  reminder: { scheduledAt: string } | null;
  timeline: ConversationTimelineEvent[];
};

const REMINDER_WINDOW_HOURS = 48;

/**
 * Corrèle une conversation (apprenant, professeur, enfant) aux réservations
 * réelles de ce binôme pour en tirer les cartes système du fil : report en
 * attente, rappel de séance proche, et l'historique (confirmation, essai,
 * reports effectués). Aucune nouvelle table : bookings/reschedule_ledger
 * existent déjà et sont lisibles par les deux parties via leurs policies
 * RLS habituelles.
 */
export function useConversationSystemContext(
  teacherId: string,
  learnerId: string,
  childId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ["conversation-system-context", teacherId, learnerId, childId],
    enabled,
    queryFn: async (): Promise<ConversationSystemContext> => {
      let q = supabase
        .from("bookings")
        .select(
          "id, status, scheduled_at, created_at, reschedule_count, reschedule_proposed_at, reschedule_proposed_by, reschedule_proposed_fee_rate, reschedule_previous_at",
        )
        .eq("teacher_id", teacherId)
        .eq("requester_id", learnerId)
        .in("status", ["accepted", "completed"]);
      q = childId ? q.eq("child_id", childId) : q.is("child_id", null);
      const { data: bookings, error } = await q.order("created_at", { ascending: true });
      if (error) throw error;

      const rows = bookings ?? [];
      const ids = rows.map((b) => b.id);
      const [ledgerRes, reportsRes] = await Promise.all([
        ids.length > 0
          ? supabase
              .from("reschedule_ledger")
              .select("id, booking_id, created_at, previous_scheduled_at, new_scheduled_at, is_force_majeure, force_majeure_reason, fee_rate")
              .in("booking_id", ids)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        ids.length > 0
          ? supabase
              .from("session_reports")
              .select(
                "id, created_at, attendance, content_note, progress_level, homework_done, engagement_rating, next_steps",
              )
              .in("booking_id", ids)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (ledgerRes.error) throw ledgerRes.error;
      if (reportsRes.error) throw reportsRes.error;

      const pending = rows.find((b) => b.reschedule_proposed_at) ?? null;

      const now = Date.now();
      const reminder =
        rows
          .filter((b) => !b.reschedule_proposed_at)
          .map((b) => b.scheduled_at)
          .filter((at) => {
            const diffH = (new Date(at).getTime() - now) / 3_600_000;
            return diffH > 0 && diffH < REMINDER_WINDOW_HOURS;
          })
          .sort()[0] ?? null;

      const firstBookingId = rows[0]?.id ?? null;
      const timeline: ConversationTimelineEvent[] = [
        ...rows.map((b): ConversationTimelineEvent => ({
          kind: b.id === firstBookingId ? "trial_confirmed" : "booking_confirmed",
          id: `booking-${b.id}`,
          sortAt: b.created_at,
          scheduledAt: b.scheduled_at,
        })),
        ...(ledgerRes.data ?? []).map((l) => ({
          kind: "reschedule_done" as const,
          id: `reschedule-${l.id}`,
          sortAt: l.created_at,
          previousAt: l.previous_scheduled_at,
          newAt: l.new_scheduled_at,
          forceMajeure: l.is_force_majeure,
          reason: l.force_majeure_reason,
          feeRate: Number(l.fee_rate),
        })),
        ...(reportsRes.data ?? []).map((r) => ({
          kind: "session_report" as const,
          id: `session-report-${r.id}`,
          sortAt: r.created_at,
          attendance: r.attendance as Attendance,
          contentNote: r.content_note,
          progressLevel: r.progress_level as ProgressLevel,
          homeworkDone: r.homework_done as HomeworkDone | null,
          engagementRating: r.engagement_rating,
          nextSteps: r.next_steps,
        })),
      ].sort((a, b) => a.sortAt.localeCompare(b.sortAt));

      return {
        pending: pending
          ? {
              id: pending.id,
              status: pending.status,
              scheduled_at: pending.scheduled_at,
              reschedule_count: pending.reschedule_count,
              reschedule_proposed_at: pending.reschedule_proposed_at,
              reschedule_proposed_by: pending.reschedule_proposed_by,
              reschedule_proposed_fee_rate: pending.reschedule_proposed_fee_rate,
              reschedule_previous_at: pending.reschedule_previous_at,
            }
          : null,
        reminder: reminder ? { scheduledAt: reminder } : null,
        timeline,
      };
    },
  });
}
