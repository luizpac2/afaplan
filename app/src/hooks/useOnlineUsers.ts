import { useEffect, useRef, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../contexts/AuthContext";

export const useOnlineUsers = () => {
  const { user } = useAuth();
  const [onlineCount, setOnlineCount] = useState(0);
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

    const updateCount = () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      console.log("[presence] updateCount:", count, JSON.stringify(state));
      setOnlineCount(count);
    };

    channel.on("presence", { event: "sync" }, () => {
      console.log("[presence] event: sync");
      updateCount();
    });
    channel.on("presence", { event: "join" }, () => {
      console.log("[presence] event: join");
      updateCount();
    });
    channel.on("presence", { event: "leave" }, () => {
      console.log("[presence] event: leave");
      updateCount();
    });

    channel.subscribe(async (status, err) => {
      console.log("[presence] subscribe status:", status, err ?? "");
      if (status === "SUBSCRIBED") {
        const trackResult = await channel.track({ user_id: user.id, ts: Date.now() });
        console.log("[presence] track result:", trackResult);
        updateCount();
      }
    });

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id]);

  return onlineCount;
};
