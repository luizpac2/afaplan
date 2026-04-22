import { useEffect, useRef, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../contexts/AuthContext";

export type OnlinePresenceEntry = { user_id: string; ts: number };

export const useOnlineUsers = () => {
  const { user } = useAuth();
  const [presenceState, setPresenceState] = useState<Record<string, OnlinePresenceEntry[]>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel("presence:online", {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    const sync = () => {
      setPresenceState({ ...channel.presenceState<OnlinePresenceEntry>() });
    };

    channel.on("presence", { event: "sync" }, sync);
    channel.on("presence", { event: "join" }, sync);
    channel.on("presence", { event: "leave" }, sync);

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: user.id, ts: Date.now() });
        sync();
      }
    });

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id]);

  return {
    onlineCount: Object.keys(presenceState).length,
    presenceState,
  };
};
