import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Check, ChevronRight, CircleAlert, Info, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { notificationTarget } from "@/lib/notification-links";

export function useNotifications(userId: string) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, entity_type, entity_id, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function NotificationsFeed({ userId }: { userId: string }) {
  const query = useNotifications(userId);
  const queryClient = useQueryClient();

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  const items = query.data ?? [];
  if (items.length === 0) return null;

  const groups = [
    { key: "action", label: "À faire", icon: CircleAlert, items: items.filter((item) => notificationCategory(item.kind) === "action") },
    { key: "new", label: "Nouveau", icon: Sparkles, items: items.filter((item) => notificationCategory(item.kind) === "new") },
    { key: "information", label: "Information", icon: Info, items: items.filter((item) => notificationCategory(item.kind) === "information") },
  ].filter((group) => group.items.length > 0);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
        <Bell className="size-4 text-primary" aria-hidden /> Notifications
      </h2>
      <div className="mt-4 space-y-5">
        {groups.map((group) => {
          const CategoryIcon = group.icon;
          return (
          <section key={group.key} aria-labelledby={`notifications-${group.key}`}>
            <h3 id={`notifications-${group.key}`} className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
              <CategoryIcon className="size-3.5" aria-hidden /> {group.label}
            </h3>
            <ul className="space-y-2">
        {group.items.map((n) => {
          const target = notificationTarget(n);
          const body = (
            <>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                {!target && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ce contenu n&apos;est plus consultable.
                  </p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("fr-FR")}
                </p>
              </div>
              {target ? (
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                !n.read_at && (
                  <button
                    type="button"
                    onClick={() => markRead.mutate(n.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-secondary"
                  >
                    <Check className="size-3" aria-hidden /> Lu
                  </button>
                )
              )}
            </>
          );

          const shell = `block rounded-2xl border px-4 py-3 text-sm transition-colors ${
            n.read_at ? "border-border bg-background" : "border-primary/30 bg-secondary/60"
          }`;

          return (
            <li key={n.id}>
              {target ? (
                <Link
                  {...target}
                  onClick={() => {
                    if (!n.read_at) markRead.mutate(n.id);
                  }}
                  className={`${shell} hover:bg-secondary`}
                >
                  <span className="flex items-start justify-between gap-3">{body}</span>
                </Link>
              ) : (
                <div className={shell}>
                  <div className="flex items-start justify-between gap-3">{body}</div>
                </div>
              )}
            </li>
          );
        })}
            </ul>
          </section>
          );
        })}
      </div>
    </section>
  );
}

type NotificationCategory = "action" | "new" | "information";

function notificationCategory(kind: string): NotificationCategory {
  if (["booking_payment_expired", "reschedule_proposed", "withdrawal_error", "verification_document"].includes(kind)) {
    return "action";
  }
  if (["new_message", "session_report", "booking_confirmed", "session_scheduled", "pack_activated", "grade_upgraded", "wallet_credited", "withdrawal_approved"].includes(kind)) {
    return "new";
  }
  return "information";
}
