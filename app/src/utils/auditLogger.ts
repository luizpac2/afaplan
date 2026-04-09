import { supabase } from "../config/supabase";
import type {
  AuditAction,
  AuditEntity,
  AuditLogEntry,
} from "../types/auditLog";

interface LogActionParams {
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  entityName?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  user?: string;
}

export const logAction = ({
  action,
  entity,
  entityId,
  entityName,
  before,
  after,
  user,
}: LogActionParams): void => {
  const entry: Omit<AuditLogEntry, "id"> = {
    timestamp: new Date().toISOString(),
    action,
    entity,
    entityId,
    entityName,
    changes: (action === "UPDATE" && (before || after)) ? { before, after } : undefined,
    user: user ?? "Sistema",
  };

  // Fire-and-forget: grava via edge function (service role, sem RLS)
  supabase.functions
    .invoke("admin-manage-content", { body: { action: "log_action", entry } })
    .then(({ error }) => {
      if (error) console.warn("[audit] falha ao gravar log:", error.message);
    });
};

export const getEntityName = (
  entity: Record<string, unknown>,
  entityType: AuditEntity,
): string => {
  switch (entityType) {
    case "DISCIPLINE":
      return (entity?.name as string) || (entity?.code as string) || "Disciplina";
    case "EVENT":
      return `${(entity?.classId as string) || "Event"} - ${(entity?.date as string) || ""}`;
    case "CLASS":
      return (entity?.name as string) || "Turma";
    case "COHORT":
      return (entity?.name as string) || "Coorte";
    case "NOTICE":
      return (entity?.title as string) || "Aviso";
    case "CSV":
      return (entity?.fileName as string) || "Arquivo CSV";
    default:
      return "Unknown";
  }
};

export const formatChanges = (
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
): string => {
  if (!before || !after) return "";

  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  const formatValue = (val: unknown) => {
    if (val === undefined || val === null) return "null";
    if (typeof val === "object") return JSON.stringify(val);
    return `"${val}"`;
  };

  allKeys.forEach((key) => {
    const valBefore = before[key];
    const valAfter = after[key];
    if (valBefore === valAfter) return;
    if (
      typeof valBefore === "object" && valBefore !== null &&
      typeof valAfter === "object" && valAfter !== null &&
      JSON.stringify(valBefore) === JSON.stringify(valAfter)
    ) return;
    changes.push(`${key}: ${formatValue(valBefore)} → ${formatValue(valAfter)}`);
  });

  return changes.join(", ");
};

export const exportToCSV = (logs: AuditLogEntry[]) => {
  const headers = ["Timestamp", "User", "Action", "Entity", "Entity Name", "Changes"];
  const rows = logs.map((log) => [
    new Date(log.timestamp).toLocaleString("pt-BR"),
    log.user || "Sistema",
    log.action,
    log.entity,
    log.entityName || "",
    log.changes?.before && log.changes?.after
      ? formatChanges(log.changes.before, log.changes.after)
      : "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
