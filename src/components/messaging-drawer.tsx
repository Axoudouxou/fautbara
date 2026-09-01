import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, Expand, Loader2, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";

import { useMessagingPanel } from "@/lib/messaging-panel-context";
import { useMessagingSide } from "@/hooks/use-messaging-side";
import {
  initials,
  setConversationArchived,
  useConversations,
  type ConversationListItem,
} from "@/lib/messaging";
import { ConversationPanel } from "@/components/conversation-panel";

type Tab = "all" | "unread" | "archived";

export function MessagingDrawer() {
  const { isOpen, close } = useMessagingPanel();
  const { side, loading, signedIn, userId } = useMessagingSide();
  const [tab, setTab] = useState<Tab>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const conversationsQuery = useConversations(userId ?? "", side);
  const conversations = conversationsQuery.data ?? [];

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const visible =
    tab === "unread"
      ? conversations.filter((c) => !c.archived && c.unread > 0)
      : tab === "archived"
        ? conversations.filter((c) => c.archived)
        : conversations.filter((c) => !c.archived);
  const unreadCount = conversations.filter((c) => !c.archived && c.unread > 0).length;

  function openConversation(id: string) {
    setActiveId(id);
  }

  function handleClose() {
    close();
    setActiveId(null);
  }

  async function toggleArchive(conversation: ConversationListItem) {
    try {
      await setConversationArchived(conversation.id, !conversation.archived);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (activeId === conversation.id) setActiveId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible");
    }
  }

  if (!isOpen || !signedIn) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Fermer la messagerie"
        onClick={handleClose}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[1px]"
      />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-full flex-col bg-background shadow-[var(--shadow-raised)] sm:w-[420px]">
        {active ? (
          <>
            <div className="flex items-center gap-2 border-b border-border px-3 py-3">
              <button
                type="button"
                onClick={() => setActiveId(null)}
                aria-label="Retour à la liste"
                className="flex size-9 items-center justify-center rounded-full text-foreground hover:bg-secondary"
              >
                <ArrowLeft className="size-4" aria-hidden />
              </button>
              <p className="flex-1 truncate font-display text-sm font-bold text-foreground">
                {active.otherName}
              </p>
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  navigate({ to: side === "teacher" ? "/pro/messages" : "/messages" });
                }}
                aria-label="Ouvrir en pleine page"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Expand className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Fermer"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden [&>div]:h-full [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
              <ConversationPanel
                key={active.id}
                conversationId={active.id}
                role={side}
                userId={userId!}
                teacherId={active.teacher_id}
                learnerId={active.learner_id}
                childId={active.child_id}
                title={active.otherName}
                subtitle={active.children?.first_name ? `Suivi de ${active.children.first_name}` : null}
                learnerLabel={active.children?.first_name ?? active.otherName}
                childAuthUserId={active.children?.auth_user_id ?? null}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-4 py-4">
              <p className="flex-1 font-display text-lg font-bold text-foreground">Messagerie</p>
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  navigate({ to: side === "teacher" ? "/pro/messages" : "/messages" });
                }}
                aria-label="Ouvrir en pleine page"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Expand className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Fermer"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="flex gap-1 border-b border-border px-3 py-2" role="tablist">
              {(
                [
                  { key: "all" as const, label: "Tous" },
                  { key: "unread" as const, label: `Non lus${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
                  { key: "archived" as const, label: "Archivés" },
                ]
              ).map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    tab === t.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading || conversationsQuery.isLoading ? (
                <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
                </div>
              ) : visible.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="mx-auto size-6 text-muted-foreground" aria-hidden />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {tab === "archived"
                      ? "Aucune conversation archivée."
                      : tab === "unread"
                        ? "Aucun message non lu."
                        : "Aucune conversation pour l'instant."}
                  </p>
                </div>
              ) : (
                <ul>
                  {visible.map((c) => (
                    <li key={c.id} className="group relative border-b border-border/60">
                      <button
                        type="button"
                        onClick={() => openConversation(c.id)}
                        className="flex w-full items-start gap-3 px-4 py-3 pr-12 text-left transition-colors hover:bg-secondary"
                      >
                        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                          {c.otherAvatar ? (
                            <img src={c.otherAvatar} alt="" className="size-full object-cover" />
                          ) : (
                            initials(c.otherName)
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">
                              {c.otherName}
                            </span>
                            {c.unread > 0 && (
                              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                                {c.unread}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {c.children?.first_name ? `${c.children.first_name} · ` : ""}
                            {c.lastBody ?? "Nouvelle conversation"}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleArchive(c)}
                        aria-label={c.archived ? "Désarchiver" : "Archiver"}
                        title={c.archived ? "Désarchiver" : "Archiver"}
                        className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100"
                      >
                        <Archive className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
