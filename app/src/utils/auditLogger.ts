import type {
  AuditAction,
  AuditEntity,
  AuditLogEntry,
} from "../types/auditLog";
// import { sendAuditEmail } from './emailService';
import { saveDocument } from "../services/supabaseService";

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
}: LogActionParams) => {
  const userName = user ?? "Sistema";

  const logEntry: AuditLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    entity,
    entityId,
    entityName,
    changes: action === "UPDATE" ? { before, after } : undefined,
    user: userName,
  };

  saveDocument("audit_log", logEntry.id, logEntry).catch((error) => {
    console.error("Failed to save audit log:", error);
  });

  // Trigger email notification (Simulated)
  // sendAuditEmail(logEntry).catch(console.error); // DISABLED BY USER REQUEST (Daily Digest will replace this)
};

export const getEntityName = (
  entity: Record<string, unknown>,
  entityType: AuditEntity,
): string => {
  switch (entityType) {
    case "DISCIPLINE":
      return (
        (entity?.name as string) || (entity?.code as string) || "Disciplina"
      );
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

    // Skip if values are strictly equal
    if (valBefore === valAfter) return;

    // Skip if both are objects and stringified versions are equal
    if (
      typeof valBefore === "object" &&
      valBefore !== null &&
      typeof valAfter === "object" &&
      valAfter !== null
    ) {
      if (JSON.stringify(valBefore) === JSON.stringify(valAfter)) return;
    }

    // Add change log
    changes.push(
      `${key}: ${formatValue(valBefore)} → ${formatValue(valAfter)}`,
    );
  });

  return changes.join(", ");
};

export const exportToCSV = (logs: AuditLogEntry[]) => {
  const headers = [
    "Timestamp",
    "User",
    "Action",
    "Entity",
    "Entity Name",
    "Changes",
  ];
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
