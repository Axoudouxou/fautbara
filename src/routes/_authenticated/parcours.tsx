import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarClock, ClipboardList, Loader2, Target } from "lucide-react";

import { EmptyState, ProgressBar, StatTile } from "@/components/product-ui";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/parcours")({
  head: () => ({
    meta: [
      { title: "Mon parcours — BARA" },
      { name: "description", content: "Suivez vos objectifs, vos formules et votre progression avec BARA." },
      { property: "og:title", content: "Mon parcours — BARA" },
      { property: "og:description", content: "Suivez vos objectifs, vos formules et votre progression avec BARA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LearningJourneyPage,
});

function LearningJourneyPage() {
  const { user } = Route.useRouteContext();
  const dataQuery = useQuery({
    queryKey: ["adult-learning-journey", user.id],
    queryFn: async () => {
      const [roles, prefs, packs, bookings, reports, assignments] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("learning_preferences").select("objective, subject_slugs, level_slugs").eq("user_id", user.id).eq("role_context", "learner").maybeSingle(),
        supabase.from("packs").select("id, status, sessions_total, sessions_used, expires_at, pack_types(name), teacher_offers(title, subjects(name))").eq("buyer_id", user.id).is("child_id", null).order("created_at", { ascending: false }),
        supabase.from("bookings").select("id, scheduled_at, status, teacher_offers(title, subjects(name))").eq("requester_id", user.id).is("child_id", null).order("scheduled_at", { ascending: false }),
        supabase.from("session_reports").select("id, booking_id, content_note, progress_level, next_steps, created_at").eq("learner_id", user.id).is("child_id", null).order("created_at", { ascending: false }).limit(3),
        supabase.from("assignments").select("id, title, status, due_date, created_at").order("created_at", { ascending: false }).limit(6),
      ]);
      for (const result of [roles, prefs, packs, bookings, reports, assignments]) if (result.error) throw result.error;
      return { roles: roles.data ?? [], prefs: prefs.data, packs: packs.data ?? [], bookings: bookings.data ?? [], reports: reports.data ?? [], assignments: assignments.data ?? [] };
    },
  });

  if (dataQuery.isLoading) return <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement…</div>;
  const data = dataQuery.data;
  if (!data?.roles.some((item) => item.role === "student")) {
    return <div className="container-page py-14"><EmptyState icon={Target} title="Parcours réservé aux adultes apprenants" description="Les parents retrouvent le suivi de chaque enfant dans l’espace Mes enfants." action={<Link to="/accueil" className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Retour à l’accueil</Link>} /></div>;
  }

  const activePack = data.packs.find((pack) => pack.status === "active");
  const nextBooking = [...data.bookings].filter((booking) => booking.status === "accepted" && new Date(booking.scheduled_at) > new Date()).sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0];
  const sessionsLeft = activePack ? Math.max(activePack.sessions_total - activePack.sessions_used, 0) : 0;
  const objectiveLabels: Record<string, string> = { exam: "Réussir un examen", catchup: "Combler mes lacunes", advance: "Aller plus loin", confidence: "Reprendre confiance" };

  const pendingAssignments = data.assignments.filter((item) => item.status !== "done").length;

  return (
    <main className="container-page py-6 sm:py-12">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Votre apprentissage</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">Mon parcours</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Vos objectifs, vos cours et les retours de vos intervenants au même endroit.</p>

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <StatTile icon={BookOpen} value={sessionsLeft} label={sessionsLeft > 1 ? "séances restantes" : "séance restante"} />
        <StatTile icon={CalendarClock} value={nextBooking ? new Date(nextBooking.scheduled_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—"} label="prochaine séance" />
        <StatTile icon={ClipboardList} value={pendingAssignments} label={pendingAssignments > 1 ? "travaux à faire" : "travail à faire"} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">

        <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Formule active</p><h2 className="mt-1 font-display text-xl font-bold text-foreground">{activePack?.teacher_offers?.subjects?.name ?? "Aucune formule active"}</h2></div>
            <BookOpen className="size-5 text-primary" aria-hidden />
          </div>
          {activePack ? <div className="mt-5"><ProgressBar value={(activePack.sessions_used / activePack.sessions_total) * 100} label={`${sessionsLeft} séance${sessionsLeft > 1 ? "s" : ""} restante${sessionsLeft > 1 ? "s" : ""}`} /><p className="mt-3 text-xs text-muted-foreground">Votre formule est valable jusqu’au {formatDate(activePack.expires_at)}.</p><Link to="/compte/reservations" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Gérer mes séances</Link></div> : <p className="mt-4 text-sm text-muted-foreground">Choisissez un intervenant et une formule adaptés à votre objectif.</p>}
        </section>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <Target className="size-5 text-primary" aria-hidden /><h2 className="mt-3 font-display text-lg font-bold text-foreground">Mon objectif</h2>
          <p className="mt-2 text-sm text-foreground">{data.prefs?.objective ? objectiveLabels[data.prefs.objective] ?? data.prefs.objective : "Objectif à préciser"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{data.prefs?.subject_slugs?.join(" · ") || "Ajoutez vos matières et vos préférences."}</p>
          <Link to="/onboarding" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">Mettre à jour mes objectifs</Link>
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground"><CalendarClock className="size-5 text-primary" /> Prochaine séance</h2>
        {nextBooking ? <div className="mt-4"><p className="font-semibold text-foreground">{nextBooking.teacher_offers?.subjects?.name ?? nextBooking.teacher_offers?.title ?? "Cours"}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(nextBooking.scheduled_at).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p></div> : <p className="mt-3 text-sm text-muted-foreground">Aucune séance programmée.</p>}
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"><h2 className="font-display text-lg font-bold text-foreground">Derniers comptes-rendus</h2>{data.reports.length ? <ul className="mt-4 space-y-3">{data.reports.map((report) => <li key={report.id} className="rounded-2xl bg-secondary/50 p-4"><p className="text-sm font-semibold text-foreground">{report.content_note}</p>{report.next_steps && <p className="mt-1 text-xs text-muted-foreground">Prochaine étape : {report.next_steps}</p>}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Les retours de vos intervenants apparaîtront ici.</p>}</section>
        <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"><h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground"><ClipboardList className="size-5 text-primary" /> Travail à faire</h2>{data.assignments.some((item) => item.status !== "done") ? <ul className="mt-4 space-y-3">{data.assignments.filter((item) => item.status !== "done").slice(0, 3).map((item) => <li key={item.id} className="flex justify-between gap-3 text-sm"><span className="font-semibold text-foreground">{item.title}</span><span className="text-muted-foreground">{item.due_date ? formatDate(item.due_date) : "Sans échéance"}</span></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Aucun travail en attente.</p>}<Link to="/devoirs" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">Voir mes devoirs</Link></section>
      </div>
    </main>
  );
}