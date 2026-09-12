import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, FileText, Loader2, Paperclip } from "lucide-react";

import { SessionReportForm } from "@/components/session-report-form";
import { TeacherGate } from "@/components/teacher-gate";
import { supabase } from "@/integrations/supabase/client";
import type { SessionReport } from "@/lib/session-reports";

export const Route = createFileRoute("/_authenticated/pro/compte-rendu/$bookingId")({
  head: () => ({
    meta: [
      { title: "Compte-rendu de séance — espace intervenant BARA" },
      {
        name: "description",
        content:
          "Rédigez et publiez le compte-rendu d’une séance BARA : présence, contenu, avancement, devoirs et documents.",
      },
      { property: "og:title", content: "Compte-rendu de séance — BARA" },
      {
        property: "og:description",
        content:
          "Rédigez et publiez le compte-rendu d’une séance BARA : présence, contenu, avancement, devoirs et documents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherReportPage,
});

const CARD = "rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]";

function TeacherReportPage() {
  const { user } = Route.useRouteContext();
  const { bookingId } = Route.useParams();
  const [published, setPublished] = useState<{ assignments: number; documents: number } | null>(null);

  const bookingQuery = useQuery({
    queryKey: ["teacher-report-booking", user.id, bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, status, requester_id, child_id, children(first_name)")
        .eq("id", bookingId)
        .eq("teacher_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", data.requester_id)
        .maybeSingle();
      const { data: report } = await supabase
        .from("session_reports")
        .select("*")
        .eq("booking_id", bookingId)
        .maybeSingle();
      return {
        ...data,
        learnerName: data.children?.first_name ?? profile?.display_name ?? "l’apprenant",
        report: (report as SessionReport | null) ?? null,
      };
    },
  });

  const booking = bookingQuery.data;

  return (
    <TeacherGate userId={user.id}>
      <main className="container-page py-5 pb-24 sm:py-10">
        <Link
          to="/pro/seances/$bookingId"
          params={{ bookingId }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden /> La séance
        </Link>

        {bookingQuery.isLoading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
          </p>
        ) : !booking ? (
          <div className={`mt-6 ${CARD}`}>
            <p className="font-display text-base font-bold text-foreground">Séance introuvable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cette séance n’existe pas ou ne fait pas partie de vos cours.
            </p>
          </div>
        ) : published ? (
          <section className={`mt-6 ${CARD}`}>
            <p className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <CheckCircle2 className="size-5 text-primary" aria-hidden /> Compte-rendu publié
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {booking.learnerName} et sa famille ont été notifiés et peuvent consulter le
              compte-rendu dans leur parcours.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-foreground">
              <li className="flex items-center gap-2">
                <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                {published.assignments > 0
                  ? `${published.assignments} devoir${published.assignments > 1 ? "s" : ""} envoyé${published.assignments > 1 ? "s" : ""}`
                  : "Aucun devoir envoyé"}
              </li>
              <li className="flex items-center gap-2">
                <Paperclip className="size-4 shrink-0 text-primary" aria-hidden />
                {published.documents > 0
                  ? `${published.documents} document${published.documents > 1 ? "s" : ""} partagé${published.documents > 1 ? "s" : ""}`
                  : "Aucun document partagé"}
              </li>
            </ul>
            <div className="mt-5 space-y-2">
              <Link
                to="/pro/seances"
                className="flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Retour à mes séances
              </Link>
              <Link
                to="/compte-rendu/$bookingId"
                params={{ bookingId }}
                className="flex w-full items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                Voir le compte-rendu publié
              </Link>
            </div>
          </section>
        ) : (
          <div className="mt-4">
            <SessionReportForm
              variant="page"
              bookingId={booking.id}
              teacherId={user.id}
              learnerId={booking.requester_id}
              childId={booking.child_id}
              recipientLabel={booking.learnerName}
              existing={booking.report}
              onClose={() => history.back()}
              invalidateKeys={[
                ["teacher-session-reports", user.id],
                ["teacher-report-booking", user.id, bookingId],
                ["teacher-session-detail", user.id, bookingId],
                ["teacher-sessions-status", user.id],
              ]}
              onPublished={(summary) => setPublished(summary)}
            />
          </div>
        )}
      </main>
    </TeacherGate>
  );
}
