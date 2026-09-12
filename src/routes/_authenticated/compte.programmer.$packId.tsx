import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarPlus, Loader2 } from "lucide-react";

import { EmptyState, UserAvatar } from "@/components/product-ui";
import { PackSessionScheduler } from "@/components/pack-session-scheduler";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/compte/programmer/$packId")({
  head: () => ({
    meta: [
      { title: "Programmer une séance — BARA" },
      { name: "description", content: "Choisissez un créneau réel pour une formule active." },
      { property: "og:title", content: "Programmer une séance — BARA" },
      { property: "og:description", content: "Choisissez un créneau réel pour une formule active." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScheduleSessionPage,
});

function ScheduleSessionPage() {
  const { packId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const packQuery = useQuery({
    queryKey: ["schedule-pack", user.id, packId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packs")
        .select("id, teacher_id, duration_minutes, sessions_total, sessions_used, status, expires_at, children(first_name, school_level), pack_types(name), teacher_offers(title, subjects(name))")
        .eq("id", packId)
        .eq("buyer_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: teacher, error: teacherError } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", data.teacher_id)
        .maybeSingle();
      if (teacherError) throw teacherError;
      return { pack: data, teacher };
    },
  });

  if (packQuery.isLoading) return <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement…</div>;
  if (!packQuery.data) return <div className="container-page py-12"><EmptyState icon={CalendarPlus} title="Formule introuvable" description="Cette formule n’est pas accessible depuis votre compte." /></div>;

  const { pack, teacher } = packQuery.data;
  const sessionsLeft = Math.max(pack.sessions_total - pack.sessions_used, 0);
  const expired = Boolean(pack.expires_at && new Date(pack.expires_at) <= new Date());
  const canSchedule = pack.status === "active" && !expired && sessionsLeft > 0;

  return (
    <main className="container-page py-6 sm:py-12">
      <Link to="/compte/reservations" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Mes cours</Link>
      <div className="mx-auto mt-4 max-w-3xl">
        <p className="text-xs font-bold uppercase text-muted-foreground">Formule {pack.pack_types?.name}</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">Programmer une séance</h1>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)]">
          <UserAvatar name={teacher?.display_name ?? "Intervenant"} className="size-10" src={teacher?.avatar_url} />
          <div className="min-w-0"><p className="truncate font-display text-sm font-bold text-foreground">{pack.teacher_offers?.subjects?.name ?? pack.teacher_offers?.title}</p><p className="truncate text-xs text-muted-foreground">{pack.children?.first_name ? `Pour ${pack.children.first_name}` : "Pour moi"} · avec {teacher?.display_name ?? "l’intervenant"}</p></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <p className="rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)]"><span className="text-xs text-muted-foreground">Séances restantes</span><strong className="mt-0.5 block font-display text-lg text-foreground">{sessionsLeft}</strong></p>
          <p className="rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)]"><span className="text-xs text-muted-foreground">Validité</span><strong className="mt-0.5 block text-sm text-foreground">Jusqu’au {formatDate(pack.expires_at)}</strong></p>
        </div>

        {canSchedule ? (
          <PackSessionScheduler packId={pack.id} teacherId={pack.teacher_id} teacherName={teacher?.display_name} durationMinutes={pack.duration_minutes} sessionsLeft={sessionsLeft} defaultOpen invalidateKeys={[["schedule-pack", user.id, packId], ["my-packs", user.id], ["my-bookings", user.id], ["child-journey"]]} />
        ) : (
          <div className="mt-5"><EmptyState icon={CalendarPlus} title="Programmation indisponible" description={expired ? "La validité de cette formule est écoulée." : sessionsLeft <= 0 ? "Toutes les séances de cette formule ont été utilisées." : "Cette formule doit être active avant de programmer une séance."} /></div>
        )}
      </div>
    </main>
  );
}