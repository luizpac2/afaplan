import { createContext, useContext } from "react";
import type { OnlinePresenceEntry } from "../hooks/useOnlineUsers";

interface PresenceContextValue {
  onlineCount: number;
  presenceState: Record<string, OnlinePresenceEntry[]>;
}

export const PresenceContext = createContext<PresenceContextValue>({
  onlineCount: 0,
  presenceState: {},
});

export const usePresence = () => useContext(PresenceContext);
