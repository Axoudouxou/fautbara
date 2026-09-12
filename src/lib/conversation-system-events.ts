import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { engagementScore, type Attendance, type EngagementLevel, type ProgressLevel } from "@/lib/session-reports";

export type ConversationTimelineEvent =
  | {
      kind: "booking_confirmed";
      id: string;
      sortAt: string;
      scheduledAt: string;
      isFreeSession: boolean;
      sessionIndex: number | null;
    }
  | {
      kind: "session_report";
      id: string;
      sortAt: string;
      attendance: Attendance;
      contentNote: string;
      progressLevel: ProgressLevel;
      homeworkDone: string | null;
      engagementLevel: EngagementLevel;
      engagementRating: number;
      nextSteps: string | null;
    };

export type ConversationSystemContext = {
  reminder: { scheduledAt: string } | null;
  timeline: ConversationTimelineEvent[];
};

const REMINDER_WINDOW_HOURS = 48;

/**
 * Corrèle une conversation (apprenant, intervenant, enfant) aux séances
 * réelles de ce binôme pour en tirer les cartes système du fil : rappel de
 * séance proche, séances programmées et comptes-rendus. Aucune nouvelle
 * table : bookings et session_reports sont déjà lisibles par les deux
 * parties via leurs policies RLS habituelles.
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
        .select("id, status, scheduled_at, created_at, is_free_session, session_index")
        .eq("teacher_id", teacherId)
        .eq("requester_id", learnerId)
        .in("status", ["accepted", "completed"]);
      q = childId ? q.eq("child_id", childId) : q.is("child_id", null);
      const { data: bookings, error } = await q.order("created_at", { ascending: true });
      if (error) throw error;

      const rows = bookings ?? [];
      const ids = rows.map((b) => b.id);
      const reportsRes =
        ids.length > 0
          ? await supabase
              .from("session_reports")
              .select(
                "id, created_at, attendance, content_note, progress_level, homework_done, engagement_level, next_steps",
              )
              .in("booking_id", ids)
              .order("created_at", { ascending: true })
          : { data: [], error: null };
      if (reportsRes.error) throw reportsRes.error;

      const now = Date.now();
      const reminder =
        rows
          .map((b) => b.scheduled_at)
          .filter((at) => {
            const diffH = (new Date(at).getTime() - now) / 3_600_000;
            return diffH > 0 && diffH < REMINDER_WINDOW_HOURS;
          })
          .sort()[0] ?? null;

      const timeline: ConversationTimelineEvent[] = [
        ...rows.map((b): ConversationTimelineEvent => ({
          kind: "booking_confirmed",
          id: `booking-${b.id}`,
          sortAt: b.created_at,
          scheduledAt: b.scheduled_at,
          isFreeSession: b.is_free_session,
          sessionIndex: b.session_index,
        })),
        ...(reportsRes.data ?? []).map((r) => ({
          kind: "session_report" as const,
          id: `session-report-${r.id}`,
          sortAt: r.created_at,
          attendance: r.attendance as Attendance,
          contentNote: r.content_note,
          progressLevel: r.progress_level as ProgressLevel,
          homeworkDone: r.homework_done,
          engagementLevel: r.engagement_level as EngagementLevel,
          engagementRating: engagementScore(r.engagement_level as EngagementLevel),
          nextSteps: r.next_steps,
        })),
      ].sort((a, b) => a.sortAt.localeCompare(b.sortAt));

      return { reminder: reminder ? { scheduledAt: reminder } : null, timeline };
    },
  });
}
