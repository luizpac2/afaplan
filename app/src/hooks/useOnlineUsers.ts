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

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      console.log("[presence] sync — online:", count, state);
      setOnlineCount(count);
    });

    channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      console.log("[presence] join —", key, newPresences);
    });

    channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      console.log("[presence] leave —", key, leftPresences);
    });

    channel.subscribe((status, err) => {
      console.log("[presence] subscribe status:", status, err ?? "");
      if (status === "SUBSCRIBED") {
        void channel.track({ user_id: user.id, ts: Date.now() }).then((r) => {
          console.log("[presence] track result:", r);
        });
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[presence] channel failed:", status);
      }
    });

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id]);

  return onlineCount;
};
