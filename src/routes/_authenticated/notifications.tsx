import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { EmptyState } from "@/components/product-ui";
import { NotificationsFeed, useNotifications } from "@/components/notifications-feed";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Mes notifications — BARA" },
      {
        name: "description",
        content: "Retrouvez toutes vos notifications BARA : séances, demandes et informations de suivi.",
      },
      { property: "og:title", content: "Mes notifications — BARA" },
      { property: "og:description", content: "Toutes vos notifications BARA au même endroit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = Route.useRouteContext();
  const query = useNotifications(user.id);
  const isEmpty = (query.data ?? []).length === 0;

  return (
    <main className="container-page py-6 sm:py-12">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Notifications</h1>
      <p className="mt-1 text-sm text-muted-foreground">Vos informations de suivi, les plus récentes d’abord.</p>
      <div className="mt-5">
        {isEmpty && !query.isLoading ? (
          <EmptyState icon={Bell} title="Aucune notification" description="Vous serez prévenu ici dès qu’une séance ou une demande évolue." />
        ) : (
          <NotificationsFeed userId={user.id} />
        )}
      </div>
    </main>
  );
}
