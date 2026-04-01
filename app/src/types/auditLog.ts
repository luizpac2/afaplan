export type AuditAction = "ADD" | "UPDATE" | "DELETE" | "IMPORT";
export type AuditEntity =
  | "DISCIPLINE"
  | "EVENT"
  | "CLASS"
  | "COHORT"
  | "NOTICE"
  | "VISUAL_CONFIG"
  | "INSTRUCTOR"
  | "OCCURRENCE"
  | "SYSTEM_CONFIG"
  | "CSV"
  | "SQUADRON_EVENTS";

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO timestamp
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  entityName?: string; // Human-readable name of the entity
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  user: string; // User who performed the action
}

export interface AuditLogState {
  logs: AuditLogEntry[];
  addLog: (log: Omit<AuditLogEntry, "id" | "timestamp">) => void;
  setLogs: (logs: AuditLogEntry[]) => void;
  clearLogs: () => void;
  exportLogs: () => void;
}
