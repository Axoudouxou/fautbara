import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CalendarPlus,
  ClipboardList,
  Loader2,
  MessageCircle,
  Search,
  UserRound,
} from "lucide-react";

import { EmptyState, ProgressBar, RowCard, SectionHeading, UserAvatar } from "@/components/product-ui";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/packs";

export const Route = createFileRoute("/_authenticated/compte/enfants/$childId")({
  head: () => ({
    meta: [
      { title: "Parcours enfant — BARA" },
      { name: "description", content: "Suivez les cours, formules et comptes-rendus de votre enfant." },
      { property: "og:title", content: "Parcours enfant — BARA" },
      { property: "og:description", content: "Suivez les cours, formules et comptes-rendus de votre enfant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChildJourneyPage,
});

const CARD = "rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)]";
const TABS = ["Vue d'ensemble", "Cours", "Comptes-rendus"] as const;
type Tab = (typeof TABS)[number];

function slotLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `Aujourd'hui à ${time}`;
  if (diff === 1) return `Demain à ${time}`;
  return `${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })} à ${time}`;
}

function ChildJourneyPage() {
  const { childId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<Tab>("Vue d'ensemble");

  const journeyQuery = useQuery({
    queryKey: ["child-journey", user.id, childId],
    queryFn: async () => {
      const child = await supabase
        .from("children")
        .select("id, first_name, birth_year, school_level, notes, avatar_path")
        .eq("id", childId)
        .eq("parent_id", user.id)
        .maybeSingle();
      if (child.error) throw child.error;
      if (!child.data) return null;
      const [packs, bookings, reports, conversations] = await Promise.all([
        supabase
          .from("packs")
          .select(
            "id, status, sessions_total, sessions_used, expires_at, teacher_id, pack_types(name), teacher_offers(title, subjects(name))",
          )
          .eq("buyer_id", user.id)
          .eq("child_id", childId)
          .order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select("id, scheduled_at, status, teacher_id, teacher_offers(title, subjects(name))")
          .eq("requester_id", user.id)
          .eq("child_id", childId)
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("session_reports")
          .select(
            "id, booking_id, teacher_id, attendance, content_note, progress_level, homework_done, engagement_level, next_steps, created_at",
          )
          .eq("learner_id", user.id)
          .eq("child_id", childId)
          .order("created_at", { ascending: false })
          .limit(4),
        supabase.from("conversations").select("id").eq("learner_id", user.id).eq("child_id", childId),
      ]);
      for (const result of [packs, bookings, reports, conversations]) if (result.error) throw result.error;
      const teacherIds = Array.from(
        new Set([...(packs.data ?? []).map((item) => item.teacher_id), ...(bookings.data ?? []).map((item) => item.teacher_id)]),
      );
      const profiles = teacherIds.length
        ? await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", teacherIds)
        : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const conversationIds = (conversations.data ?? []).map((item) => item.id);
      const assignments = conversationIds.length
        ? await supabase
            .from("assignments")
            .select("id, title, status, due_date")
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: false })
        : { data: [], error: null };
      if (assignments.error) throw assignments.error;
      let childAvatarUrl: string | null = null;
      if (child.data.avatar_path) {
        const signed = await supabase.storage.from("child-photos").createSignedUrl(child.data.avatar_path, 3600);
        if (signed.error) throw signed.error;
        childAvatarUrl = signed.data.signedUrl;
      }
      const level = child.data.school_level
        ? await supabase.from("levels").select("name").eq("slug", child.data.school_level).maybeSingle()
        : { data: null, error: null };
      if (level.error) throw level.error;
      return {
        child: child.data,
        childAvatarUrl,
        childLevel: level.data?.name ?? child.data.school_level,
        packs: packs.data ?? [],
        bookings: bookings.data ?? [],
        reports: reports.data ?? [],
        profiles: profiles.data ?? [],
        assignments: assignments.data ?? [],
      };
    },
  });

  if (journeyQuery.isLoading)
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Chargement…
      </div>
    );
  const data = journeyQuery.data;
  if (!data)
    return (
      <div className="container-page py-14">
        <EmptyState
          icon={UserRound}
          title="Profil introuvable"
          description="Ce profil enfant n’est pas accessible depuis votre compte."
          action={
            <Link to="/compte/enfants" className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
              Retour à mes enfants
            </Link>
          }
        />
      </div>
    );

  const activePacks = data.packs.filter((pack) => pack.status === "active");
  const now = new Date();
  const upcoming = data.bookings
    .filter((item) => item.status === "accepted" && new Date(item.scheduled_at) > now)
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  const nextBooking = upcoming[0];
  const past = data.bookings.filter((item) => new Date(item.scheduled_at) <= now);
  const profileMap = new Map(data.profiles.map((profile) => [profile.user_id, profile]));
  const age = data.child.birth_year ? now.getFullYear() - data.child.birth_year : null;
  const pendingAssignments = data.assignments.filter((item) => item.status !== "done");

  return (
    <main className="container-page py-6 sm:py-12">
      <Link to="/compte/enfants" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Mes enfants
      </Link>

      <header className="mt-4 flex items-center gap-3">
        <UserAvatar name={data.child.first_name} src={data.childAvatarUrl} className="size-14" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-bold text-foreground sm:text-2xl">{data.child.first_name}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {[data.childLevel || "Niveau à préciser", age ? `${age} ans` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      <nav className="mt-4 flex gap-2" aria-label="Sections du parcours">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            aria-pressed={tab === item}
            className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
              tab === item
                ? "border-primary bg-primary-soft/50 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            {item}
          </button>
        ))}
      </nav>

      {tab === "Vue d'ensemble" && (
        <div className="mt-5 space-y-5">
          {data.child.notes && (
            <section className={CARD} aria-label="Informations utiles au parcours">
              <SectionHeading title="Informations utiles" />
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{data.child.notes}</p>
            </section>
          )}
          <section aria-label="Formules">
            <SectionHeading
              title="Formules"
              action={
                <Link to="/professeurs" search={{ enfant: childId }} className="text-xs font-semibold text-primary hover:underline">
                  Trouver un intervenant
                </Link>
              }
            />
            {activePacks.length ? (
              <ul className="mt-3 space-y-2.5 sm:grid sm:grid-cols-2 sm:gap-2.5 sm:space-y-0">
                {activePacks.map((pack) => {
                  const left = Math.max(pack.sessions_total - pack.sessions_used, 0);
                  const teacher = profileMap.get(pack.teacher_id);
                  return (
                    <li key={pack.id} className={CARD}>
                      <div className="flex items-center gap-3">
                        <UserAvatar name={teacher?.display_name ?? "Intervenant"} src={teacher?.avatar_url} className="size-10" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-sm font-bold text-foreground">
                            {pack.teacher_offers?.subjects?.name ?? "Cours particulier"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            Formule {pack.pack_types?.name} · avec {teacher?.display_name ?? "son intervenant"}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2.5 text-sm font-semibold text-foreground">
                        {left} séance{left > 1 ? "s" : ""} restante{left > 1 ? "s" : ""}
                      </p>
                      <div className="mt-2">
                        <ProgressBar
                          value={(pack.sessions_used / pack.sessions_total) * 100}
                          label={`${pack.sessions_used} séance${pack.sessions_used > 1 ? "s" : ""} effectuée${pack.sessions_used > 1 ? "s" : ""} sur ${pack.sessions_total}`}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">Valable jusqu’au {formatDate(pack.expires_at)}</p>
                      {left > 0 && (
                        <Link
                          to="/compte/programmer/$packId"
                          params={{ packId: pack.id }}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
                        >
                          <CalendarPlus className="size-3.5" /> Programmer une séance
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-3">
                <EmptyState
                  icon={BookOpen}
                  title="Aucune formule active"
                  description={`Les formules de ${data.child.first_name} apparaîtront ici après leur achat.`}
                  action={
                    <Link
                      to="/professeurs"
                      search={{ enfant: childId }}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                    >
                      <Search className="size-4" /> Trouver un intervenant
                    </Link>
                  }
                />
              </div>
            )}
          </section>

          <section aria-label="Prochain cours">
            <SectionHeading title="Prochain cours" />
            {nextBooking ? (
              <div className={`mt-3 ${CARD}`}>
                <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <CalendarClock className="size-4 text-primary" aria-hidden />
                  {slotLabel(nextBooking.scheduled_at)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {nextBooking.teacher_offers?.subjects?.name ?? nextBooking.teacher_offers?.title ?? "Cours"} · avec{" "}
                  {profileMap.get(nextBooking.teacher_id)?.display_name ?? "son intervenant"}
                </p>
                <div className="mt-3 flex gap-2">
                  <Link
                    to="/compte/reservations"
                    search={{ enfant: childId }}
                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Voir les détails
                  </Link>
                  <Link
                    to="/messages"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
                  >
                    <MessageCircle className="size-3.5" aria-hidden /> Contacter
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                Aucune séance programmée.
              </p>
            )}
          </section>

          {pendingAssignments.length > 0 && (
            <section aria-label="Travail à faire">
              <SectionHeading title="Travail à faire" />
              <Link to="/devoirs" className="mt-3 block">
                <RowCard className="transition-colors hover:bg-secondary">
                  <ClipboardList className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {pendingAssignments.length} devoir{pendingAssignments.length > 1 ? "s" : ""} en attente
                  </span>
                </RowCard>
              </Link>
            </section>
          )}
        </div>
      )}

      {tab === "Cours" && (
        <div className="mt-5 space-y-5">
          <section aria-label="Séances à venir">
            <SectionHeading title="À venir" />
            {upcoming.length ? (
              <ul className="mt-3 space-y-2.5">
                {upcoming.map((item) => (
                  <li key={item.id} className={CARD}>
                    <p className="text-sm font-bold text-foreground">{slotLabel(item.scheduled_at)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.teacher_offers?.subjects?.name ?? "Cours"} · avec{" "}
                      {profileMap.get(item.teacher_id)?.display_name ?? "son intervenant"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                Aucune séance programmée.
              </p>
            )}
          </section>

          <section aria-label="Séances passées">
            <SectionHeading title="Passées" />
            {past.length ? (
              <ul className="mt-3 space-y-2.5">
                {past.slice(0, 10).map((item) => (
                  <li key={item.id} className={CARD}>
                    <p className="text-sm font-semibold text-foreground">{slotLabel(item.scheduled_at)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.teacher_offers?.subjects?.name ?? "Cours"} · avec{" "}
                      {profileMap.get(item.teacher_id)?.display_name ?? "son intervenant"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                Aucune séance passée.
              </p>
            )}
          </section>
        </div>
      )}

      {tab === "Comptes-rendus" && (
        <section className="mt-5" aria-label="Comptes-rendus">
          {data.reports.length ? (
            <ul className="space-y-2.5">
              {data.reports.map((report) => (
                <li key={report.id} className={CARD}>
                  <p className="text-xs font-semibold text-muted-foreground">{formatDate(report.created_at)}</p>
                  <dl className="mt-2.5 grid gap-2.5 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Présence</dt>
                      <dd className="font-semibold text-foreground">
                        {labelFor(ATTENDANCE_OPTIONS, report.attendance)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Niveau d’avancement</dt>
                      <dd className="font-semibold text-foreground">
                        {labelFor(PROGRESS_LEVELS, report.progress_level)}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Contenu travaillé</dt>
                      <dd className="text-foreground">{report.content_note}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Travail depuis la dernière séance</dt>
                      <dd className="text-foreground">{report.homework_done || "Non renseigné"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Engagement</dt>
                      <dd className="text-foreground">{labelFor(ENGAGEMENT_LEVELS, report.engagement_level)}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">À travailler pour la prochaine séance</dt>
                      <dd className="text-foreground">{report.next_steps || "Non renseignée"}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
              Les retours des intervenants apparaîtront après les séances réalisées.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
