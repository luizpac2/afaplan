import { useEffect, useRef, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../contexts/AuthContext";

export const useOnlineUsers = () => {
  const { user } = useAuth();
  const [onlineCount, setOnlineCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Remove canal anterior se existir
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel("presence:online", {
      config: { presence: { key: user.id } },
    });

    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setOnlineCount(Object.keys(state).length);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ user_id: user.id, ts: Date.now() });
      }
    });

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id]);

  return onlineCount;
};
