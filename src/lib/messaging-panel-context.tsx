import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type MessagingPanelContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const MessagingPanelContext = createContext<MessagingPanelContextValue | null>(null);

export function MessagingPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo<MessagingPanelContextValue>(
    () => ({ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }),
    [isOpen],
  );
  return <MessagingPanelContext.Provider value={value}>{children}</MessagingPanelContext.Provider>;
}

export function useMessagingPanel() {
  const ctx = useContext(MessagingPanelContext);
  if (!ctx) throw new Error("useMessagingPanel must be used within a MessagingPanelProvider");
  return ctx;
}
