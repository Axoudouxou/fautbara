import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CalendarClock, ClipboardList, Loader2, UserRound } from "lucide-react";

import { EmptyState, ProgressBar, UserAvatar } from "@/components/product-ui";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/compte/enfants/$childId")({
  head: () => ({ meta: [
    { title: "Parcours enfant — BARA" },
    { name: "description", content: "Suivez les cours, formules et comptes-rendus de votre enfant." },
    { property: "og:title", content: "Parcours enfant — BARA" },
    { property: "og:description", content: "Suivez les cours, formules et comptes-rendus de votre enfant." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ChildJourneyPage,
});

function ChildJourneyPage() {
  const { childId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const journeyQuery = useQuery({
    queryKey: ["child-journey", user.id, childId],
    queryFn: async () => {
      const child = await supabase.from("children").select("id, first_name, birth_year, school_level").eq("id", childId).eq("parent_id", user.id).maybeSingle();
      if (child.error) throw child.error;
      if (!child.data) return null;
      const [packs, bookings, reports, conversations] = await Promise.all([
        supabase.from("packs").select("id, status, sessions_total, sessions_used, expires_at, teacher_id, pack_types(name), teacher_offers(title, subjects(name))").eq("buyer_id", user.id).eq("child_id", childId).order("created_at", { ascending: false }),
        supabase.from("bookings").select("id, scheduled_at, status, teacher_id, teacher_offers(title, subjects(name))").eq("requester_id", user.id).eq("child_id", childId).order("scheduled_at", { ascending: false }),
        supabase.from("session_reports").select("id, booking_id, teacher_id, content_note, progress_level, next_steps, created_at").eq("learner_id", user.id).eq("child_id", childId).order("created_at", { ascending: false }).limit(4),
        supabase.from("conversations").select("id").eq("learner_id", user.id).eq("child_id", childId),
      ]);
      for (const result of [packs, bookings, reports, conversations]) if (result.error) throw result.error;
      const teacherIds = Array.from(new Set([...(packs.data ?? []).map((item) => item.teacher_id), ...(bookings.data ?? []).map((item) => item.teacher_id)]));
      const profiles = teacherIds.length ? await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", teacherIds) : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const conversationIds = (conversations.data ?? []).map((item) => item.id);
      const assignments = conversationIds.length ? await supabase.from("assignments").select("id, title, status, due_date").in("conversation_id", conversationIds).order("created_at", { ascending: false }) : { data: [], error: null };
      if (assignments.error) throw assignments.error;
      return { child: child.data, packs: packs.data ?? [], bookings: bookings.data ?? [], reports: reports.data ?? [], profiles: profiles.data ?? [], assignments: assignments.data ?? [] };
    },
  });

  if (journeyQuery.isLoading) return <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement…</div>;
  const data = journeyQuery.data;
  if (!data) return <div className="container-page py-14"><EmptyState icon={UserRound} title="Profil introuvable" description="Ce profil enfant n’est pas accessible depuis votre compte." action={<Link to="/compte/enfants" className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Retour à mes enfants</Link>} /></div>;

  const activePacks = data.packs.filter((pack) => pack.status === "active");
  const nextBooking = [...data.bookings].filter((item) => item.status === "accepted" && new Date(item.scheduled_at) > new Date()).sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0];
  const profileMap = new Map(data.profiles.map((profile) => [profile.user_id, profile]));

  return (
    <main className="container-page py-8 sm:py-12">
      <Link to="/compte/enfants" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Mes enfants</Link>
      <div className="mt-5 flex items-center gap-4"><UserAvatar name={data.child.first_name} className="size-16" /><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Parcours enfant</p><h1 className="font-display text-3xl font-bold text-foreground">{data.child.first_name}</h1><p className="text-sm text-muted-foreground">{data.child.school_level || "Niveau à préciser"}</p></div></div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"><h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground"><CalendarClock className="size-5 text-primary" /> Prochaine séance</h2>{nextBooking ? <div className="mt-4"><p className="font-semibold text-foreground">{nextBooking.teacher_offers?.subjects?.name ?? nextBooking.teacher_offers?.title ?? "Cours"}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(nextBooking.scheduled_at).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p><p className="mt-1 text-sm text-muted-foreground">avec {profileMap.get(nextBooking.teacher_id)?.display_name ?? "son intervenant"}</p></div> : <p className="mt-3 text-sm text-muted-foreground">Aucune séance programmée.</p>}</section>
        <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"><h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground"><ClipboardList className="size-5 text-primary" /> Travail à faire</h2><p className="mt-3 font-display text-3xl font-bold text-foreground">{data.assignments.filter((item) => item.status !== "done").length}</p><p className="text-sm text-muted-foreground">devoir{data.assignments.filter((item) => item.status !== "done").length > 1 ? "s" : ""} en attente</p><Link to="/devoirs" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">Voir les devoirs</Link></section>
      </div>

      <section className="mt-6"><div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl font-bold text-foreground">Formules actives</h2><Link to="/compte/reservations" className="text-sm font-semibold text-primary hover:underline">Gérer les cours</Link></div>{activePacks.length ? <ul className="mt-4 grid gap-4 md:grid-cols-2">{activePacks.map((pack) => { const left = Math.max(pack.sessions_total - pack.sessions_used, 0); const teacher = profileMap.get(pack.teacher_id); return <li key={pack.id} className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"><p className="text-xs font-bold uppercase tracking-wide text-primary">{pack.teacher_offers?.subjects?.name}</p><h3 className="mt-1 font-display text-lg font-bold text-foreground">Formule {pack.pack_types?.name}</h3><div className="mt-3 flex items-center gap-3"><UserAvatar name={teacher?.display_name ?? "Intervenant"} src={teacher?.avatar_url} className="size-10" /><span className="text-sm font-semibold text-foreground">{teacher?.display_name ?? "Intervenant"}</span></div><div className="mt-5"><ProgressBar value={(pack.sessions_used / pack.sessions_total) * 100} label={`${left} séance${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""}`} /></div><p className="mt-3 text-xs text-muted-foreground">Cette formule est valable jusqu’au {formatDate(pack.expires_at)}.</p></li>; })}</ul> : <div className="mt-4"><EmptyState icon={BookOpen} title="Aucune formule active" description={`Les formules de ${data.child.first_name} apparaîtront ici après leur achat.`} /></div>}</section>

      <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"><h2 className="font-display text-xl font-bold text-foreground">Derniers comptes-rendus</h2>{data.reports.length ? <ul className="mt-4 space-y-3">{data.reports.map((report) => <li key={report.id} className="rounded-2xl bg-secondary/50 p-4"><p className="text-sm font-semibold text-foreground">{report.content_note}</p>{report.next_steps && <p className="mt-1 text-xs text-muted-foreground">Prochaine étape : {report.next_steps}</p>}<p className="mt-2 text-[11px] text-muted-foreground">{formatDate(report.created_at)}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Les retours des intervenants apparaîtront après les séances réalisées.</p>}</section>
    </main>
  );
}