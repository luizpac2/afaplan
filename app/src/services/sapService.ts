import { supabase } from "../config/supabase";
import type { ScheduleEvent } from "../types";

export type SAPChangeAction = "MOVE" | "DELETE" | "ADD" | "MODIFY";

export interface SAPSimulationChange {
  id: string;
  sapId: string;
  action: SAPChangeAction;
  eventId?: string;
  originalData?: Partial<ScheduleEvent>;
  newData?: Partial<ScheduleEvent>;
  reverted: boolean;
  createdBy?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Fetch simulation changes for a SAP
// ---------------------------------------------------------------------------
export async function fetchSAPChanges(sapId: string): Promise<SAPSimulationChange[]> {
  const { data, error } = await supabase
    .from("sap_simulations")
    .select("*")
    .eq("sap_id", sapId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    sapId: r.sap_id,
    action: r.action as SAPChangeAction,
    eventId: r.event_id ?? undefined,
    originalData: r.original_data ?? undefined,
    newData: r.new_data ?? undefined,
    reverted: r.reverted ?? false,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Create a simulation change record
// ---------------------------------------------------------------------------
export async function createSAPChange(
  sapId: string,
  action: SAPChangeAction,
  eventId: string | undefined,
  originalData: Partial<ScheduleEvent> | undefined,
  newData: Partial<ScheduleEvent> | undefined,
  userId?: string,
): Promise<SAPSimulationChange> {
  const { data, error } = await supabase
    .from("sap_simulations")
    .insert({
      sap_id: sapId,
      action,
      event_id: eventId ?? null,
      original_data: originalData ?? null,
      new_data: newData ?? null,
      reverted: false,
      created_by: userId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    sapId: data.sap_id,
    action: data.action,
    eventId: data.event_id ?? undefined,
    originalData: data.original_data ?? undefined,
    newData: data.new_data ?? undefined,
    reverted: false,
    createdBy: data.created_by ?? undefined,
    createdAt: data.created_at,
  };
}

// ---------------------------------------------------------------------------
// Toggle reverted state
// ---------------------------------------------------------------------------
export async function revertSAPChange(changeId: string, reverted: boolean): Promise<void> {
  const { error } = await supabase
    .from("sap_simulations")
    .update({ reverted })
    .eq("id", changeId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Delete a single change record
// ---------------------------------------------------------------------------
export async function deleteSAPChange(changeId: string): Promise<void> {
  const { error } = await supabase
    .from("sap_simulations")
    .delete()
    .eq("id", changeId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Clear all changes for a SAP (reset simulation)
// ---------------------------------------------------------------------------
export async function clearSAPChanges(sapId: string): Promise<void> {
  const { error } = await supabase
    .from("sap_simulations")
    .delete()
    .eq("sap_id", sapId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Apply simulation to production
// ---------------------------------------------------------------------------
export async function applySAPToProduction(
  sapId: string,
  changes: SAPSimulationChange[],
): Promise<{ applied: number; errors: string[] }> {
  const active = changes.filter((c) => !c.reverted);
  const errors: string[] = [];
  let applied = 0;

  for (const change of active) {
    try {
      if (change.action === "DELETE" && change.eventId) {
        const { error } = await supabase
          .from("programacao_aulas")
          .delete()
          .eq("id", change.eventId);
        if (error) throw error;
        applied++;

      } else if (change.action === "MOVE" && change.eventId && change.newData) {
        const { error } = await supabase
          .from("programacao_aulas")
          .update({
            date: change.newData.date,
            startTime: change.newData.startTime,
            endTime: change.newData.endTime,
            classId: change.newData.classId,
            changeRequestId: sapId,
          })
          .eq("id", change.eventId);
        if (error) throw error;
        applied++;

      } else if (change.action === "MODIFY" && change.eventId && change.newData) {
        const update: Record<string, unknown> = { changeRequestId: sapId };
        const nd = change.newData;
        if (nd.date)           update.date = nd.date;
        if (nd.startTime)      update.startTime = nd.startTime;
        if (nd.endTime)        update.endTime = nd.endTime;
        if (nd.location)       update.location = nd.location;
        if (nd.instructorTrigram !== undefined) update.instructorId = nd.instructorTrigram;
        const { error } = await supabase
          .from("programacao_aulas")
          .update(update)
          .eq("id", change.eventId);
        if (error) throw error;
        applied++;

      } else if (change.action === "ADD" && change.newData) {
        const nd = change.newData;
        const { error } = await supabase
          .from("programacao_aulas")
          .insert({
            id:             nd.id,
            date:           nd.date,
            startTime:      nd.startTime,
            endTime:        nd.endTime,
            disciplineId:   nd.disciplineId,
            classId:        nd.classId,
            type:           nd.type ?? "CLASS",
            location:       nd.location ?? null,
            color:          nd.color ?? null,
            targetSquadron: nd.targetSquadron != null ? String(nd.targetSquadron) : null,
            targetCourse:   nd.targetCourse ?? null,
            instructorId:   nd.instructorTrigram ?? null,
            changeRequestId: sapId,
          });
        if (error) throw error;
        applied++;
      }
    } catch (err: unknown) {
      errors.push(`${change.action} [${change.eventId ?? "novo"}]: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { applied, errors };
}

// ---------------------------------------------------------------------------
// Mark SAP as EXECUTADA in schedule_change_requests
// ---------------------------------------------------------------------------
export async function markSAPAsExecuted(sapId: string): Promise<void> {
  const { error } = await supabase
    .from("schedule_change_requests")
    .update({ status: "EXECUTADA" })
    .eq("id", sapId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Apply simulation changes on top of production events (pure function)
// Returns the resulting event array and metadata about what changed
// ---------------------------------------------------------------------------
export function applyChangesToEvents(
  productionEvents: ScheduleEvent[],
  changes: SAPSimulationChange[],
): {
  events: ScheduleEvent[];
  movedIds: Set<string>;
  deletedIds: Set<string>;
  addedIds: Set<string>;
} {
  const active = changes.filter((c) => !c.reverted);

  const deletedIds = new Set<string>();
  const movedIds   = new Set<string>();
  const addedIds   = new Set<string>();

  let result = [...productionEvents];

  for (const change of active) {
    if (change.action === "DELETE" && change.eventId) {
      result = result.filter((e) => e.id !== change.eventId);
      deletedIds.add(change.eventId);

    } else if ((change.action === "MOVE" || change.action === "MODIFY") && change.eventId && change.newData) {
      result = result.map((e) =>
        e.id === change.eventId ? { ...e, ...change.newData } : e,
      );
      movedIds.add(change.eventId);

    } else if (change.action === "ADD" && change.newData) {
      const newEv = change.newData as ScheduleEvent;
      if (!result.find((e) => e.id === newEv.id)) {
        result.push(newEv);
        if (newEv.id) addedIds.add(newEv.id);
      }
    }
  }

  return { events: result, movedIds, deletedIds, addedIds };
}
