import { create } from "zustand";
import { supabase } from "../config/supabase";
import type { AuditLogEntry, AuditLogState } from "../types/auditLog";

const PAGE_SIZE = 50;

interface ExtendedAuditLogState extends AuditLogState {
  page: number;
  loading: boolean;
  hasMore: boolean;
  fetchLogs: () => Promise<void>;
  loadMoreLogs: () => Promise<void>;
}

export const useAuditStore = create<ExtendedAuditLogState>((set, get) => ({
  logs: [],
  page: 0,
  loading: false,
  hasMore: true,

  addLog: () => {
    // Optimistic update handled by SupabaseSync for small collections
  },

  setLogs: (logs: AuditLogEntry[]) => set({ logs }),

  clearLogs: () => set({ logs: [], page: 0, hasMore: true }),

  fetchLogs: async () => {
    const { logs } = get();
    if (logs.length > 0) return;

    set({ loading: true, logs: [] });
    try {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("timestamp", { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (error) throw error;
      const logs = (data ?? []) as AuditLogEntry[];
      set({ logs, page: 1, hasMore: logs.length === PAGE_SIZE, loading: false });
    } catch (error) {
      console.error("Error fetching logs:", error);
      set({ loading: false });
    }
  },

  loadMoreLogs: async () => {
    const { page, logs, hasMore, loading } = get();
    if (!hasMore || loading) return;

    set({ loading: true });
    try {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("timestamp", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      const newLogs = (data ?? []) as AuditLogEntry[];
      set({
        logs: [...logs, ...newLogs],
        page: page + 1,
        hasMore: newLogs.length === PAGE_SIZE,
        loading: false,
      });
    } catch (error) {
      console.error("Error loading more logs:", error);
      set({ loading: false });
    }
  },

  exportLogs: () => {
    const state = get();
    const dataStr = JSON.stringify(state.logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },
}));
