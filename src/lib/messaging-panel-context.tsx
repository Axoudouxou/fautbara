import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type MessagingPanelTab = "chat" | "resources";

export type MessagingOpenRequest = {
  conversationId: string;
  tab: MessagingPanelTab;
  nonce: number;
};

type MessagingPanelContextValue = {
  isOpen: boolean;
  /** Non nul quand une ouverture cible une conversation précise (ex. depuis un devoir sur l'accueil). */
  openRequest: MessagingOpenRequest | null;
  open: () => void;
  /** Ouvre le panneau directement sur une conversation, sur l'onglet indiqué. */
  openConversation: (conversationId: string, tab?: MessagingPanelTab) => void;
  close: () => void;
};

const MessagingPanelContext = createContext<MessagingPanelContextValue | null>(null);

export function MessagingPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openRequest, setOpenRequest] = useState<MessagingOpenRequest | null>(null);

  const value = useMemo<MessagingPanelContextValue>(
    () => ({
      isOpen,
      openRequest,
      open: () => setIsOpen(true),
      openConversation: (conversationId, tab = "chat") => {
        setOpenRequest({ conversationId, tab, nonce: Date.now() });
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }),
    [isOpen, openRequest],
  );
  return <MessagingPanelContext.Provider value={value}>{children}</MessagingPanelContext.Provider>;
}

export function useMessagingPanel() {
  const ctx = useContext(MessagingPanelContext);
  if (!ctx) throw new Error("useMessagingPanel must be used within a MessagingPanelProvider");
  return ctx;
}
