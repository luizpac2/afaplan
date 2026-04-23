import { create } from "zustand";
import type {
  Discipline,
  ScheduleEvent,
  CourseClass,
  Cohort,
  SchedulingCriteria,
  SystemNotice,
  VisualConfig,
  Instructor,
  InstructorOccurrence,
  SemesterConfig,
  ScheduleChangeRequest,
  InstructionLocation,
  LocationIssue,
  LocationReservation,
} from "../types";
import { logAction, getEntityName } from "../utils/auditLogger";
import {
  saveDocument,
  updateDocument,
  deleteDocument,
  batchSave,
  normalizeEvent,
  normalizeTime,
  invalidateCache,
} from "../services/supabaseService";
import { supabase } from "../config/supabase";

import { TIME_SLOTS } from "../utils/constants";

// ── Helper: chama admin-manage-content via edge function (service role) ───────
async function contentFn(action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("admin-manage-content", {
    body: { action, ...payload },
  });
  if (error) {
    const context = (error as any).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        console.error(`[contentFn:${action}] HTTP error body:`, JSON.stringify(body));
        throw new Error(body?.error ?? error.message);
      } catch (parseErr: any) {
        // Se o throw acima escapou, re-throw
        if (parseErr?.message && parseErr.message !== "body used already") throw parseErr;
      }
    }
    console.error(`[contentFn:${action}] error:`, error.message ?? error);
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  console.log(`[contentFn:${action}] result:`, data);
  return data ?? {};
}

interface CourseState {
  disciplines: Discipline[];
  events: ScheduleEvent[];
  classes: CourseClass[];
  cohorts: Cohort[];
  notices: SystemNotice[];
  visualConfigs: VisualConfig[];
  instructors: Instructor[];
  occurrences: InstructorOccurrence[];
  semesterConfigs: SemesterConfig[];
  changeRequests: ScheduleChangeRequest[];

  addDiscipline: (discipline: Discipline) => void;
  updateDiscipline: (id: string, updates: Partial<Discipline>) => void;
  updateBatchDisciplines: (
    updates: Record<string, Partial<Discipline>>,
  ) => Promise<void>;
  updateAllDisciplinesCriteria: (
    criteria: Partial<SchedulingCriteria>,
    fieldsToUpdate: (keyof SchedulingCriteria)[],
  ) => void;
  deleteDiscipline: (id: string) => void;
  deleteBatchDisciplines: (ids: string[]) => Promise<void>;
  unifyAllDisciplines: () => Promise<{ merged: number; errors: number }> ;
  clearDisciplines: () => void;
  addEvent: (event: ScheduleEvent) => void;
  addBatchEvents: (events: ScheduleEvent[]) => void;
  updateEvent: (id: string, updates: Partial<ScheduleEvent>) => void;
  swapEvents: (
    eventId: string,
    targetDate: string,
    targetTime: string,
    targetClassId: string,
  ) => void;
  deleteEvent: (id: string) => void;
  deleteBatchEvents: (ids: string[]) => void;
  clearEvents: () => void;

  addClass: (courseClass: CourseClass) => void;
  updateClass: (id: string, updates: Partial<CourseClass>) => void;
  updateBatchClasses: (updates: CourseClass[]) => Promise<void>;
  deleteClass: (id: string) => void;

  addCohort: (cohort: Cohort) => void;
  updateCohort: (id: string, updates: Partial<Cohort>) => void;
  deleteCohort: (id: string) => void;

  // Bulk setters for Sync
  setDisciplines: (disciplines: Discipline[]) => void;
  setEvents: (events: ScheduleEvent[]) => void;
  setClasses: (classes: CourseClass[]) => void;
  setCohorts: (cohorts: Cohort[]) => void;
  setNotices: (notices: SystemNotice[]) => void;

  // Notice actions
  addNotice: (notice: SystemNotice) => void;
  updateNotice: (id: string, updates: Partial<SystemNotice>) => void;
  deleteNotice: (id: string) => Promise<void>;

  // Visual config actions
  setVisualConfigs: (configs: VisualConfig[]) => void;
  updateVisualConfig: (id: string, updates: Partial<VisualConfig>) => void;

  // App configs (key/value genérico em app_configs)
  appConfigs: Record<string, unknown>;
  setAppConfig: (key: string, value: unknown) => Promise<void>;
  loadAppConfigs: (configs: Record<string, unknown>) => void;

  // Instructor actions
  setInstructors: (instructors: Instructor[]) => void;
  addInstructor: (instructor: Instructor) => void;
  updateInstructor: (trigram: string, updates: Partial<Instructor>) => void;
  deleteInstructor: (trigram: string) => void;

  // Occurrence actions
  setOccurrences: (occurrences: InstructorOccurrence[]) => void;
  addOccurrence: (occurrence: InstructorOccurrence) => void;
  deleteOccurrence: (id: string) => void;

  // Semester config actions
  setSemesterConfigs: (configs: SemesterConfig[]) => void;
  updateSemesterConfig: (id: string, updates: Partial<SemesterConfig>) => void;

  // Clear all state (for logout)
  clearStore: () => void;

  // Change Requests (SAP) actions
  setChangeRequests: (requests: ScheduleChangeRequest[]) => void;
  addChangeRequest: (
    request: ScheduleChangeRequest,
    userId?: string,
  ) => Promise<void>;
  updateChangeRequest: (
    id: string,
    updates: Partial<ScheduleChangeRequest>,
    userId?: string,
  ) => Promise<void>;
  deleteChangeRequest: (id: string) => Promise<void>;
  linkEventsToRequest: (requestId: string, eventIds: string[]) => Promise<void>;

  // Migration helper
  migrateDisciplinesLocation: () => void;

  // Yearly Events Cache Logic
  yearEventsCache: Record<number, ScheduleEvent[]>;
  weeklyEventsCache: Record<string, ScheduleEvent[]>; // key: "YYYY-MM-DD-SQUADRON"
  fetchYearlyEvents: (year: number) => Promise<ScheduleEvent[]>;
  fetchWeeklyEvents: (
    startDay: string,
    endDay: string,
    squadronId: number,
  ) => Promise<ScheduleEvent[]>;

  // Flag que sinaliza quando o getDocs inicial dos dados estáticos concluiu
  dataReady: boolean;
  setDataReady: (ready: boolean) => void;

  // ── Locais de Instrução ────────────────────────────────────────────────────
  locations: InstructionLocation[];
  locationIssues: LocationIssue[];
  locationReservations: LocationReservation[];
  setLocations: (locations: InstructionLocation[]) => void;
  setLocationIssues: (issues: LocationIssue[]) => void;
  setLocationReservations: (reservations: LocationReservation[]) => void;
  addLocation: (location: InstructionLocation) => Promise<string>;
  updateLocation: (id: string, updates: Partial<InstructionLocation>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
  addLocationIssue: (issue: Omit<LocationIssue, "id" | "createdAt" | "createdBy">) => Promise<void>;
  updateLocationIssue: (id: string, updates: Partial<LocationIssue>) => Promise<void>;
  deleteLocationIssue: (id: string) => Promise<void>;
  addLocationReservation: (reservation: Omit<LocationReservation, "id" | "createdAt" | "createdBy">) => Promise<void>;
  deleteLocationReservation: (id: string) => Promise<void>;
}

// Invalida o cache de eventos no localStorage ao escrever/deletar (chamado nos mutators)
const invalidateEventsLocalCache = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("afa_events_"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignora */
  }
};

// Invalida cache de coleções estáticas do fetchCollectionCached (ex: 'disciplines', 'instructors')
// Delega ao mapa canônico centralizado em supabaseService
const invalidateStaticCache = (writeTable: string) => invalidateCache(writeTable);

const ongoingYearlyRequests: Record<number, Promise<ScheduleEvent[]> | undefined> = {};
const ongoingWeeklyRequests: Record<string, Promise<ScheduleEvent[]> | undefined> = {};

export const useCourseStore = create<CourseState>((set) => ({
  disciplines: [],
  events: [],
  classes: [],
  cohorts: [],
  notices: [],
  visualConfigs: [],
  instructors: [],
  occurrences: [],
  semesterConfigs: [],
  changeRequests: [],
  yearEventsCache: {},
  weeklyEventsCache: {},
  dataReady: false,
  appConfigs: {},

  setDataReady: (ready) => set({ dataReady: ready }),

  clearStore: () =>
    set({
      disciplines: [],
      events: [],
      classes: [],
      cohorts: [],
      notices: [],
      visualConfigs: [],
      instructors: [],
      occurrences: [],
      semesterConfigs: [],
      changeRequests: [],
      locations: [],
      locationIssues: [],
      locationReservations: [],
      appConfigs: {},
      dataReady: false,
    }),

  addNotice: (notice) => {
    set((state) => ({ notices: [...state.notices, notice] }));
    logAction({ action: "ADD", entity: "NOTICE", entityId: notice.id, entityName: notice.title });
    contentFn("save_notice", { notice }).catch((e) => console.error("addNotice failed:", e));
  },

  updateNotice: (id, updates) => {
    const state = useCourseStore.getState();
    const before = state.notices.find((n) => n.id === id);
    set((state) => ({
      notices: state.notices.map((n) => n.id === id ? { ...n, ...updates } : n),
    }));
    const after = useCourseStore.getState().notices.find((n) => n.id === id);
    if (before && after) {
      logAction({
        action: "UPDATE", entity: "NOTICE", entityId: id, entityName: after.title,
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      });
    }
    contentFn("update_notice", { id, updates }).catch((e) => console.error("updateNotice failed:", e));
  },

  deleteNotice: async (id) => {
    const state = useCourseStore.getState();
    const notice = state.notices.find((n) => n.id === id);
    // Optimistic remove
    set((s) => ({ notices: s.notices.filter((n) => n.id !== id) }));
    try {
      await contentFn("delete_notice", { id });
      if (notice) logAction({ action: "DELETE", entity: "NOTICE", entityId: id, entityName: notice.title });
    } catch (e) {
      console.error("deleteNotice failed:", e);
      // Revert optimistic remove
      if (notice) set((s) => ({ notices: [...s.notices, notice] }));
    }
  },

  setNotices: (notices) => set({ notices }),

  // SAP — Solicitações de Alteração de Programação
  setChangeRequests: (requests) => set({ changeRequests: requests }),

  addChangeRequest: async (request, userId?) => {
    set((state) => ({ changeRequests: [...state.changeRequests, request] }));
    const effectiveUserId = userId || undefined;
    if (effectiveUserId) {
      await saveDocument("schedule_change_requests", request.id, request);
      invalidateStaticCache("schedule_change_requests");
    }
  },

  updateChangeRequest: async (id, updates, userId?) => {
    set((state) => ({
      changeRequests: state.changeRequests.map((r) =>
        r.id === id ? { ...r, ...updates } : r,
      ),
    }));
    const effectiveUserId = userId || undefined;
    if (effectiveUserId) {
      // Usar a nova função de atualização parcial para maior eficiência e evitar hangs
      await updateDocument("schedule_change_requests", id, updates);
      invalidateStaticCache("schedule_change_requests");
    }
  },

  deleteChangeRequest: async (id) => {
    set((state) => ({
      changeRequests: state.changeRequests.filter((r) => r.id !== id),
    }));
    if (true) {
      await deleteDocument("schedule_change_requests", id);
      invalidateStaticCache("schedule_change_requests");
    }
  },

  linkEventsToRequest: async (requestId, newEventIds) => {
    const state = useCourseStore.getState();
    const request = state.changeRequests.find((r) => r.id === requestId);
    if (!request) return;

    // Desvincula eventIds que pertenciam a outras SAPs primeiro
    const previousEventIds = request.eventIds || [];

    // Atualiza cada evento: adiciona/remove changeRequestId
    const allAffectedIds = [...new Set([...previousEventIds, ...newEventIds])];
    const updatePromises = allAffectedIds.map((evId) => {
      const shouldLink = newEventIds.includes(evId);
      return saveDocument(
        "programacao_aulas",
        evId,
        { changeRequestId: shouldLink ? requestId : null },
      );
    });
    await Promise.all(updatePromises);

    // Atualiza estado local dos eventos
    set((state) => ({
      events: state.events.map((ev) => {
        if (newEventIds.includes(ev.id))
          return { ...ev, changeRequestId: requestId };
        if (previousEventIds.includes(ev.id) && !newEventIds.includes(ev.id)) {
          const { changeRequestId: _, ...rest } = ev;
          return rest as typeof ev;
        }
        return ev;
      }),
    }));

    // Atualiza a SAP com os novos eventIds
    const updatedRequest = { ...request, eventIds: newEventIds };
    set((state) => ({
      changeRequests: state.changeRequests.map((r) =>
        r.id === requestId ? updatedRequest : r,
      ),
    }));
    await saveDocument("schedule_change_requests", requestId, updatedRequest);

    // Invalida cache de eventos e da coleção de SAPs
    invalidateEventsLocalCache();
    invalidateStaticCache("schedule_change_requests");
  },

  setSemesterConfigs: (configs) => set({ semesterConfigs: configs }),

  updateSemesterConfig: async (id, updates) => {
    const state = useCourseStore.getState();
    const before = state.semesterConfigs.find((c) => c.id === id);

    // If it doesn't exist, we might be creating it
    if (!before) {
      const newConfig = { id, ...updates } as SemesterConfig;
      set((state) => ({
        semesterConfigs: [...state.semesterConfigs, newConfig],
      }));
      await saveDocument("semester_configs", id, newConfig);
      return;
    }

    set((state) => ({
      semesterConfigs: state.semesterConfigs.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    }));

    const after = useCourseStore
      .getState()
      .semesterConfigs.find((c) => c.id === id);
    if (before && after) {
      logAction({
        action: "UPDATE",
        entity: "SYSTEM_CONFIG",
        entityId: id,
        entityName: `Configuração de Semestre ${after.year}`,
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      });
      if (true) {
        saveDocument("semester_configs", id, after);
        invalidateStaticCache("semester_configs");
      }
    }
  },

  addDiscipline: async (discipline) => {
    // Optimistic UI update
    set((state) => ({ disciplines: [...state.disciplines, discipline] }));
    
    logAction({
      action: "ADD",
      entity: "DISCIPLINE",
      entityId: discipline.id,
      entityName: discipline.name,
    });

    try {
      const dbDiscipline = {
        code: discipline.code,
        name: discipline.name,
        category: "GERAL",
        load_hours: discipline.load_hours || 0,
        data: {
          ...(discipline as any).data,
          trainingField: discipline.trainingField !== "GERAL" ? discipline.trainingField : undefined,
          instructor: discipline.instructor,
          instructorTrigram: discipline.instructorTrigram,
        },
      };
      await contentFn("upsert_discipline", { code: discipline.code, data: dbDiscipline });
      invalidateStaticCache("disciplines");
      console.log(`✅ Disciplina ${discipline.code} salva no DB`);
    } catch (err) {
      console.error("❌ Falha ao salvar disciplina no Supabase:", err);
      alert("Erro ao salvar disciplina no banco de dados.");
    }
  },

  updateDiscipline: async (id, updates) => {
    const state = useCourseStore.getState();
    const before = state.disciplines.find((d) => d.id === id);
    
    // id can be code or uuid here depending on caller
    const sigla = before?.code || id;

    // Optimistic
    set((state) => ({
      disciplines: state.disciplines.map((d) =>
        d.id === id || d.code === id ? { ...d, ...updates } : d,
      ),
    }));

    const after = useCourseStore
      .getState()
      .disciplines.find((d) => d.id === id || d.code === id);

    if (before && after) {
      logAction({
        action: "UPDATE",
        entity: "DISCIPLINE",
        entityId: sigla,
        entityName: after.name,
        before: before as any,
        after: after as any,
      });

      try {
        // Monta JSONB data com todos os campos extras (não colunas diretas)
        const existingData = (after as any).data && typeof (after as any).data === "object"
          ? (after as any).data : {};
        const dbUpdates: Record<string, unknown> = {
          name: after.name,
          load_hours: after.load_hours ?? 0,
          color: after.color ?? null,
          data: {
            ...existingData,
            trainingField: after.trainingField !== "GERAL" ? after.trainingField : undefined,
            instructor: after.instructor ?? null,
            instructorTrigram: after.instructorTrigram ?? null,
            noSpecificInstructor: after.noSpecificInstructor ?? null,
            location: after.location ?? null,
            color: after.color ?? null,
            enabledCourses: after.enabledCourses ?? null,
            enabledYears: after.enabledYears ?? null,
            ppcLoads: after.ppcLoads ?? null,
          },
        };
        await contentFn("update_discipline", { code: after.code, updates: dbUpdates });
        invalidateStaticCache("disciplines");
        // Remove duplicatas da store em memória (mesmo code, id diferente)
        set((state) => {
          const seen = new Set<string>();
          const deduped = state.disciplines.filter((d) => {
            const key = d.code || d.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          return { disciplines: deduped };
        });
        console.log(`✅ Disciplina ${after.code} atualizada no DB`);
      } catch (err: any) {
        console.error("❌ Falha ao atualizar disciplina:", err?.message ?? err);
        alert(`Erro ao atualizar disciplina no banco.\n${err?.message ?? ""}`);
      }
    }
  },

  updateBatchDisciplines: async (updates) => {
    const itemsToSave: Discipline[] = [];

    set((state) => {
      const newDisciplines = state.disciplines.map((d) => {
        const up = updates[d.id] || updates[d.code];
        if (up) {
          const updatedItem = { ...d, ...up };
          itemsToSave.push(updatedItem);
          return updatedItem;
        }
        return d;
      });
      return { disciplines: newDisciplines };
    });

    if (itemsToSave.length > 0) {
      logAction({
        action: "UPDATE",
        entity: "DISCIPLINE",
        entityId: "BATCH",
        entityName: `Atualização em massa (${itemsToSave.length} disciplinas)`,
      });

      try {
        for (const d of itemsToSave) {
          const existingData = (d as any).data && typeof (d as any).data === "object" ? (d as any).data : {};
          const dbUpdates = {
            name: d.name,
            load_hours: d.load_hours ?? 0,
            color: d.color ?? null,
            data: {
              ...existingData,
              trainingField: d.trainingField !== "GERAL" ? d.trainingField : undefined,
              instructor: d.instructor ?? null,
              instructorTrigram: d.instructorTrigram ?? null,
              noSpecificInstructor: d.noSpecificInstructor ?? null,
              location: d.location ?? null,
              color: d.color ?? null,
              enabledCourses: d.enabledCourses ?? null,
              enabledYears: d.enabledYears ?? null,
              ppcLoads: d.ppcLoads ?? null,
            },
          };
          await contentFn("update_discipline", { code: d.code, updates: dbUpdates });
        }
        invalidateStaticCache("disciplines");
      } catch (err) {
        console.error("❌ Falha no batch save de disciplinas:", err);
      }
    }
  },

  updateAllDisciplinesCriteria: (criteria, fieldsToUpdate) => {
    set((state) => {
      const updatedDisciplines = state.disciplines.map((d) => {
        const currentCriteria = d.scheduling_criteria || {
          frequency: 2,
          allowConsecutiveDays: false,
          preferredSlots: [],
          requiredRoom: "SALA_AULA",
          priority: 5,
          maxClassesPerDay: 2,
        };

        const newCriteria = { ...currentCriteria };
        fieldsToUpdate.forEach((field) => {
          if (criteria[field] !== undefined) {
            (newCriteria as any)[field] = criteria[field];
          }
        });

        return { ...d, scheduling_criteria: newCriteria };
      });

      // Sync with Supabase for each updated discipline
      if (true) {
        batchSave("disciplines", updatedDisciplines).catch(err => 
          console.error("Failed to batch save disciplines:", err)
        );
        invalidateStaticCache("disciplines");
      }

      return { disciplines: updatedDisciplines };
    });

    logAction({
      action: "UPDATE",
      entity: "DISCIPLINE",
      entityId: "ALL",
      entityName: "Todas as disciplinas (Critérios em Massa)",
      after: { criteria, fieldsToUpdate },
    });
  },


  clearDisciplines: () => set({ disciplines: [] }),

  addEvent: (event: ScheduleEvent) => {
    set((state: CourseState) => {
      const dateStr = String(event.date);
      const yearMatch = dateStr.match(/^\d{4}/);
      const year = yearMatch
        ? parseInt(yearMatch[0])
        : new Date().getFullYear();

      const newYearCache = { ...state.yearEventsCache };
      if (newYearCache[year]) {
        newYearCache[year] = [...newYearCache[year], event];
      }
      return {
        events: [...state.events, event],
        yearEventsCache: newYearCache,
        weeklyEventsCache: {},
      };
    });
    invalidateEventsLocalCache();

    logAction({
      action: "ADD",
      entity: "EVENT",
      entityId: event.id,
      entityName: getEntityName(
        event as unknown as Record<string, unknown>,
        "EVENT",
      ),
    });

    // Envia apenas colunas conhecidas da tabela programacao_aulas
    // NOTA: no banco a coluna chama-se instructorId (não instructorTrigram)
    const dbEvent = {
      id:             event.id,
      date:           event.date,
      startTime:      event.startTime ?? null,
      endTime:        event.endTime ?? null,
      disciplineId:   event.disciplineId,
      classId:        event.classId,
      type:           event.type ?? null,
      location:       event.location ?? null,
      color:          event.color ?? null,
      targetSquadron: event.targetSquadron != null ? String(event.targetSquadron) : null,
      targetCourse:   event.targetCourse ?? null,
      targetClass:    event.targetClass ?? null,
      description:    event.description ?? null,
      notes:          (event as any).notes ?? null,
      endDate:        (event as any).endDate ?? null,
      instructorId:   event.instructorTrigram || null,
    };
    contentFn("save_event", { event: dbEvent }).catch((err) => {
      console.error("Failed to save event:", err);
    });
  },

  addBatchEvents: (events) => {
    if (events.length === 0) return;
    set((state: CourseState) => {
      const newYearCache = { ...state.yearEventsCache };
      events.forEach((event) => {
        const year = new Date(event.date + "T12:00:00").getFullYear();
        if (newYearCache[year]) {
          newYearCache[year] = [...newYearCache[year], event];
        }
      });
      return {
        events: [...state.events, ...events],
        yearEventsCache: newYearCache,
        weeklyEventsCache: {},
      };
    });
    invalidateEventsLocalCache();

    // Fix 3: 1 log de resumo em vez de N logs individuais
    // (N writes individuais disparavam onSnapshot em todos os usuários ativos)
    logAction({
      action: "ADD",
      entity: "EVENT",
      entityId: "BATCH",
      entityName: `${events.length} eventos adicionados em lote`,
    });

    if (true) {
      batchSave("programacao_aulas", events).catch((err) => {
        console.error("Failed to batch save events:", err);
        alert("Erro ao salvar eventos em lote no banco de dados.");
      });
    }
  },

  updateEvent: (id, updates) => {
    set((state) => {
      const newEvents = state.events.map((e) =>
        e.id === id ? { ...e, ...updates } : e,
      );

      const newYearCache = { ...state.yearEventsCache };
      // Procura em todos os anos cacheados
      Object.keys(newYearCache).forEach((y) => {
        const year = Number(y);
        if (newYearCache[year]) {
          newYearCache[year] = newYearCache[year].map((e) =>
            e.id === id ? { ...e, ...updates } : e,
          );
        }
      });

      return {
        events: newEvents,
        yearEventsCache: newYearCache,
        weeklyEventsCache: {},
      };
    });
    invalidateEventsLocalCache();

    console.log("[updateEvent] id:", id, "updates:", JSON.stringify(updates));
    contentFn("update_event", { id, updates }).catch((err) => {
      console.error("Failed to update event:", err);
    });
  },

  deleteEvent: (id) => {
    set((state) => {
      const newYearCache = { ...state.yearEventsCache };
      // Remove de todos os anos cacheados para garantir consistência
      Object.keys(newYearCache).forEach((y) => {
        const year = Number(y);
        if (newYearCache[year]) {
          newYearCache[year] = newYearCache[year].filter((e) => e.id !== id);
        }
      });

      return {
        events: state.events.filter((e) => e.id !== id),
        yearEventsCache: newYearCache,
        weeklyEventsCache: {},
      };
    });
    invalidateEventsLocalCache();

    contentFn("delete_event", { id }).catch((err) => {
      console.error("Failed to delete event:", err);
    });
  },

  deleteBatchEvents: (ids) => {
    if (!ids || ids.length === 0) return;

    set((state: CourseState) => {
      const newYearCache = { ...state.yearEventsCache };

      // Limpa em TODOS os anos cacheados para garantir consistência
      Object.keys(newYearCache).forEach((yearStr) => {
        const y = parseInt(yearStr);
        if (newYearCache[y]) {
          newYearCache[y] = newYearCache[y].filter((e) => !ids.includes(e.id));
        }
      });

      return {
        events: state.events.filter((e) => !ids.includes(e.id)),
        yearEventsCache: newYearCache,
        weeklyEventsCache: {}, // Invalida cache semanal para forçar recarga na programação
      };
    });
    invalidateEventsLocalCache();

    // Log único de resumo
    logAction({
      action: "DELETE",
      entity: "EVENT",
      entityId: "BATCH",
      entityName: `${ids.length} eventos removidos`,
    });

    // Deleta via edge function (service role) para bypassar RLS
    Promise.all(ids.map((id) => contentFn("delete_event", { id }))).catch((err) => {
      console.error("❌ Falha ao deletar no Supabase:", err);
    });
  },

  swapEvents: (eventId, targetDate, targetTime, targetClassId) => {
    const state = useCourseStore.getState();
    const eventA = state.events.find((e) => e.id === eventId);

    if (!eventA) return;

    // Find Event B (target)
    // Match classId, date, and startTime
    const eventB = state.events.find(
      (e) =>
        e.classId === targetClassId &&
        e.date === targetDate &&
        e.startTime === targetTime,
    );

    const updates: ScheduleEvent[] = [];
    const logs: Parameters<typeof logAction>[0][] = [];

    if (eventB) {
      // Swap locations
      const slotA = TIME_SLOTS.find((s) => s.start === targetTime);
      const slotB = TIME_SLOTS.find((s) => s.start === eventA.startTime);

      const newA = {
        ...eventA,
        date: targetDate,
        startTime: targetTime,
        endTime: slotA ? slotA.end : eventA.endTime,
        classId: targetClassId,
      };
      const newB = {
        ...eventB,
        date: eventA.date,
        startTime: eventA.startTime,
        endTime: slotB ? slotB.end : eventB.endTime,
        classId: eventA.classId,
      };

      updates.push(newA, newB);

      // Logs
      logs.push({
        action: "UPDATE",
        entity: "EVENT",
        entityId: eventA.id,
        entityName: getEntityName(
          eventA as unknown as Record<string, unknown>,
          "EVENT",
        ),
        before: eventA as unknown as Record<string, unknown>,
        after: newA as unknown as Record<string, unknown>,
        user: "Administrador",
      });
      logs.push({
        action: "UPDATE",
        entity: "EVENT",
        entityId: eventB.id,
        entityName: getEntityName(
          eventB as unknown as Record<string, unknown>,
          "EVENT",
        ),
        before: eventB as unknown as Record<string, unknown>,
        after: newB as unknown as Record<string, unknown>,
        user: "Administrador",
      });
    } else {
      // Move Event A to empty slot
      const slotA = TIME_SLOTS.find((s) => s.start === targetTime);
      const newA = {
        ...eventA,
        date: targetDate,
        startTime: targetTime,
        endTime: slotA ? slotA.end : eventA.endTime,
        classId: targetClassId,
      };
      updates.push(newA);

      logs.push({
        action: "UPDATE",
        entity: "EVENT",
        entityId: eventA.id,
        entityName: getEntityName(
          eventA as unknown as Record<string, unknown>,
          "EVENT",
        ), // Use old name context or new?
        before: eventA as unknown as Record<string, unknown>,
        after: newA as unknown as Record<string, unknown>,
        user: "Administrador",
      });
    }

    // Apply updates
    set((state: CourseState) => {
      const newEvents = state.events.map((e) => {
        const update = updates.find((u) => u.id === e.id);
        return update ? update : e;
      });

      const newYearCache = { ...state.yearEventsCache };
      updates.forEach((update) => {
        const year = new Date(update.date + "T12:00:00").getFullYear();
        if (newYearCache[year]) {
          newYearCache[year] = newYearCache[year].map((e) =>
            e.id === update.id ? update : e,
          );
        }
      });

      return {
        events: newEvents,
        yearEventsCache: newYearCache,
        weeklyEventsCache: {},
      };
    });

    // Apply logs
    logs.forEach((log) => logAction(log));

    // Invalida cache local
    invalidateEventsLocalCache();

    // Sync with Supabase
    if (true) {
      updates.forEach((update) => {
        saveDocument("programacao_aulas", update.id, update).catch((err) => {
          console.error("Failed to swap events:", err);
          alert("Erro ao salvar troca de eventos. Tente recarregar a página.");
        });
      });
    }
  },

  clearEvents: () => set({ events: [] }),

  addClass: (courseClass: CourseClass) => {
    set((state) => ({ classes: [...state.classes, courseClass] }));
    logAction({
      action: "ADD",
      entity: "CLASS",
      entityId: courseClass.id,
      entityName: getEntityName(
        courseClass as unknown as Record<string, unknown>,
        "CLASS",
      ),
    });
    if (true) {
      saveDocument("classes", courseClass.id, courseClass);
      invalidateStaticCache("classes");
    }
  },

  updateClass: (id, updates) => {
    const state = useCourseStore.getState();
    const before = state.classes.find((c) => c.id === id);
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    }));
    const after = useCourseStore.getState().classes.find((c) => c.id === id);
    if (before && after) {
      logAction({
        action: "UPDATE",
        entity: "CLASS",
        entityId: id,
        entityName: getEntityName(
          after as unknown as Record<string, unknown>,
          "CLASS",
        ),
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      });
    }
    if (after) {
      saveDocument("classes", id, after);
      invalidateStaticCache("classes");
    }
  },

  updateBatchClasses: async (updates) => {
    set((state) => ({
      classes: state.classes.map((c) => {
        const update = updates.find((u) => u.id === c.id);
        return update ? { ...c, ...update } : c;
      }),
    }));

    if (true) {
      await batchSave("classes", updates);
      invalidateStaticCache("classes");
    }

    logAction({
      action: "UPDATE",
      entity: "CLASS",
      entityId: "BATCH",
      entityName: `Atualização em massa (${updates.length} turmas)`,
    });
  },

  deleteClass: (id) => {
    const state = useCourseStore.getState();
    const courseClass = state.classes.find((c) => c.id === id);
    set((state) => ({ classes: state.classes.filter((c) => c.id !== id) }));
    if (courseClass) {
      logAction({
        action: "DELETE",
        entity: "CLASS",
        entityId: id,
        entityName: getEntityName(
          courseClass as unknown as Record<string, unknown>,
          "CLASS",
        ),
      });
    }
    if (true) {
      deleteDocument("classes", id);
      invalidateStaticCache("classes");
    }
  },

  // Cohort actions
  addCohort: (cohort) => {
    set((state) => ({ cohorts: [...state.cohorts, cohort] }));
    logAction({
      action: "ADD",
      entity: "COHORT",
      entityId: cohort.id,
      entityName: getEntityName(
        cohort as unknown as Record<string, unknown>,
        "COHORT",
      ),
    });
    if (true) {
      saveDocument("cohorts", cohort.id, cohort);
      invalidateStaticCache("cohorts");
    }
  },

  updateCohort: (id, updates) => {
    const state = useCourseStore.getState();
    const before = state.cohorts.find((c) => c.id === id);
    set((state) => ({
      cohorts: state.cohorts.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    }));
    const after = useCourseStore.getState().cohorts.find((c) => c.id === id);
    if (before && after) {
      logAction({
        action: "UPDATE",
        entity: "COHORT",
        entityId: id,
        entityName: getEntityName(
          after as unknown as Record<string, unknown>,
          "COHORT",
        ),
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      });
    }
    if (after) {
      saveDocument("cohorts", id, after);
      invalidateStaticCache("cohorts");
    }
  },

  deleteCohort: (id) => {
    const state = useCourseStore.getState();
    const cohort = state.cohorts.find((c) => c.id === id);
    set((state) => ({ cohorts: state.cohorts.filter((c) => c.id !== id) }));
    if (cohort) {
      logAction({
        action: "DELETE",
        entity: "COHORT",
        entityId: id,
        entityName: getEntityName(
          cohort as unknown as Record<string, unknown>,
          "COHORT",
        ),
      });
    }
    if (true) {
      deleteDocument("cohorts", id);
      invalidateStaticCache("cohorts");
    }
  },

  // Setters for Sync
  setDisciplines: (disciplines: Discipline[]) => set({ disciplines }),
  setEvents: (events: ScheduleEvent[]) => set({ events }),
  setClasses: (classes: CourseClass[]) => set({ classes }),
  setCohorts: (cohorts: Cohort[]) => set({ cohorts }),
  setVisualConfigs: (visualConfigs: VisualConfig[]) => set({ visualConfigs }),

  updateVisualConfig: (id, updates) => {
    const state = useCourseStore.getState();
    const existing = state.visualConfigs.find((v) => v.id === id);

    if (existing) {
      set((state) => ({
        visualConfigs: state.visualConfigs.map((v) =>
          v.id === id ? { ...v, ...updates } : v,
        ),
      }));
      const updated = useCourseStore
        .getState()
        .visualConfigs.find((v) => v.id === id);
      if (updated) {
        logAction({
          action: "UPDATE",
          entity: "VISUAL_CONFIG",
          entityId: id,
          entityName: updated.name,
          before: existing as unknown as Record<string, unknown>,
          after: updated as unknown as Record<string, unknown>,
        });
        contentFn("save_visual_config", { config: updated }).catch((err) =>
          console.error("save_visual_config error:", err)
        );
        invalidateStaticCache("visual_configs");
      }
    } else {
      // Add new rule
      const newConfig = { ...updates, id } as VisualConfig;
      set((state) => ({
        visualConfigs: [...state.visualConfigs, newConfig],
      }));
      logAction({
        action: "ADD",
        entity: "VISUAL_CONFIG",
        entityId: id,
        entityName: newConfig.name,
      });
      contentFn("save_visual_config", { config: newConfig }).catch((err) =>
        console.error("save_visual_config error:", err)
      );
      invalidateStaticCache("visual_configs");
    }
  },

  // Instructor Implementations
  setInstructors: (instructors) => set({ instructors }),
  addInstructor: async (instructor) => {
    // Optimistic UI
    set((state) => ({ instructors: [...state.instructors, instructor] }));
    
    logAction({
      action: "ADD",
      entity: "INSTRUCTOR",
      entityId: instructor.trigram,
      entityName: instructor.warName,
    });

    try {
      const dbInstructor = {
        trigram: instructor.trigram,
        warName: instructor.warName,
        name: instructor.fullName,
        specialty: instructor.rank,
        data: {
          venture: instructor.venture,
          weeklyLoadLimit: instructor.weeklyLoadLimit,
          enabledDisciplines: instructor.enabledDisciplines,
          enabledClasses: instructor.enabledClasses,
        },
      };
      await contentFn("upsert_instructor", { trigram: instructor.trigram, data: dbInstructor });
      invalidateStaticCache("instructors");
      console.log(`✅ Docente ${instructor.trigram} salvo no DB`);
    } catch (err) {
      console.error("❌ Falha ao salvar docente no Supabase:", err);
      alert("Erro ao salvar docente no banco de dados. Verifique os campos.");
    }
  },
  updateInstructor: async (trigram, updates) => {
    const state = useCourseStore.getState();
    const before = state.instructors.find((i) => i.trigram === trigram);
    
    // Optimistic UI
    set((state) => ({
      instructors: state.instructors.map((i) =>
        i.trigram === trigram ? { ...i, ...updates } : i,
      ),
    }));

    const after = useCourseStore
      .getState()
      .instructors.find((i) => i.trigram === trigram);

    if (before && after) {
      logAction({
        action: "UPDATE",
        entity: "INSTRUCTOR",
        entityId: trigram,
        entityName: after.warName,
        before: before as any,
        after: after as any,
      });

      try {
        const updates = {
          warName: after.warName,
          name: after.fullName,
          specialty: after.rank,
          data: {
            venture: after.venture,
            weeklyLoadLimit: after.weeklyLoadLimit,
            enabledDisciplines: after.enabledDisciplines,
            enabledClasses: after.enabledClasses,
          },
        };
        await contentFn("update_instructor", { trigram, updates });
        invalidateStaticCache("instructors");
        console.log(`✅ Docente ${trigram} atualizado no DB`);

        // Sincroniza o campo `instructor` (warName desnormalizado) em todas as
        // disciplinas que referenciam este docente via instructorTrigram
        if (before.warName !== after.warName) {
          const { disciplines: currentDiscs } = useCourseStore.getState();
          const affectedDiscs = currentDiscs.filter(
            (d) => d.instructorTrigram === trigram
          );
          if (affectedDiscs.length > 0) {
            // Atualiza store imediatamente (optimistic)
            set((s) => ({
              disciplines: s.disciplines.map((d) =>
                d.instructorTrigram === trigram
                  ? { ...d, instructor: after.warName }
                  : d
              ),
            }));
            // Persiste cada disciplina afetada
            for (const d of affectedDiscs) {
              try {
                await contentFn("sync_discipline_instructor", {
                  code: d.code,
                  warName: after.warName,
                });
              } catch (e) {
                console.warn("Falha ao sincronizar instructor em disciplina:", d.code, e);
              }
            }
            invalidateStaticCache("disciplines");
            invalidateStaticCache("disciplines");
          }
        }
      } catch (err) {
        console.error("❌ Falha ao atualizar docente no Supabase:", err);
        alert("Erro ao atualizar docente. Verifique as restrições do banco.");
      }
    }
  },
  deleteDiscipline: async (id) => {
    const state = useCourseStore.getState();
    const discipline = state.disciplines.find((d) => d.id === id || d.code === id);
    const sigla = discipline?.code || id;

    set((state) => ({
      disciplines: state.disciplines.filter((d) => d.id !== id && d.code !== id),
    }));

    if (discipline) {
      logAction({
        action: "DELETE",
        entity: "DISCIPLINE",
        entityId: sigla,
        entityName: discipline.name,
      });
      try {
        await contentFn("delete_discipline", { code: sigla });
        invalidateStaticCache("disciplines");
      } catch (err) {
        console.error("❌ Falha ao deletar disciplina:", err);
      }
    }
  },

  deleteBatchDisciplines: async (ids) => {
    // ids are expected to be codes/siglas
    set((state) => ({
      disciplines: state.disciplines.filter((d) => !ids.includes(d.id) && !ids.includes(d.code)),
    }));

    logAction({
      action: "DELETE",
      entity: "DISCIPLINE",
      entityId: "BATCH",
      entityName: `Exclusão em massa (${ids.length} disciplinas)`,
    });

    try {
      for (const sigla of ids) {
        await contentFn("delete_discipline", { code: sigla });
      }
      invalidateStaticCache("disciplines");
    } catch (err) {
      console.error("❌ Falha no batch delete de disciplinas:", err);
    }
  },

  unifyAllDisciplines: async () => {
    try {
      const result = await contentFn("unify_all_disciplines", {});
      invalidateStaticCache("disciplines");
      const report = (result.report as any[]) ?? [];
      const merged = report.filter((r) => r.merged > 1 || r.eventsMigrated > 0).length;
      const errors = report.filter((r) => r.error).length;
      return { merged, errors };
    } catch (err: any) {
      console.error("❌ Falha ao unificar disciplinas:", err?.message ?? err);
      throw err;
    }
  },

  deleteInstructor: async (trigram) => {
    const state = useCourseStore.getState();
    const instructor = state.instructors.find((i) => i.trigram === trigram);
    
    set((state) => ({
      instructors: state.instructors.filter((i) => i.trigram !== trigram),
    }));

    if (instructor) {
      logAction({
        action: "DELETE",
        entity: "INSTRUCTOR",
        entityId: trigram,
        entityName: instructor.warName,
      });
      try {
        await contentFn("delete_instructor", { trigram });
        invalidateStaticCache("instructors");
      } catch (err) {
        console.error("❌ Falha ao deletar docente:", err);
      }
    }
  },

  // Occurrence Implementations
  setOccurrences: (occurrences) => set({ occurrences }),
  addOccurrence: async (occurrence) => {
    set((state) => ({ occurrences: [...state.occurrences, occurrence] }));
    logAction({
      action: "ADD",
      entity: "OCCURRENCE",
      entityId: occurrence.id,
      entityName: `Ocorrência - ${occurrence.instructorTrigram}`,
    });
    if (true) {
      try {
        await saveDocument("occurrences", occurrence.id, occurrence);
        invalidateStaticCache("occurrences");
        console.log(`✅ Ocorrência ${occurrence.id} salva no Supabase`);
      } catch (err) {
        console.error("❌ Falha ao salvar ocorrência no Supabase:", err);
        alert("Erro ao salvar ocorrência. Verifique sua conexão.");
      }
    }
  },
  deleteOccurrence: (id) => {
    const state = useCourseStore.getState();
    const occurrence = state.occurrences.find((o) => o.id === id);
    set((state) => ({
      occurrences: state.occurrences.filter((o) => o.id !== id),
    }));
    if (occurrence) {
      logAction({
        action: "DELETE",
        entity: "OCCURRENCE",
        entityId: id,
        entityName: `Ocorrência - ${occurrence.instructorTrigram}`,
      });
      if (true) {
        deleteDocument("occurrences", id);
        invalidateStaticCache("occurrences");
      }
    }
  },
  migrateDisciplinesLocation: () => {
    set((state) => {
      const updatedDisciplines = state.disciplines.map((d) => ({
        ...d,
        location: d.location || "Sala de Aula",
      }));

      if (true) {
        batchSave("disciplines", updatedDisciplines);
      }

      return { disciplines: updatedDisciplines };
    });

    logAction({
      action: "UPDATE",
      entity: "DISCIPLINE",
      entityId: "ALL",
      entityName: "Migração de Local (Sala de Aula)",
      after: { location: "Sala de Aula" },
    });
  },

  fetchYearlyEvents: async (year: number): Promise<ScheduleEvent[]> => {
    const state: CourseState = useCourseStore.getState();

    // 1. Cache em memória (mais rápido)
    if (state.yearEventsCache[year]) {
      return state.yearEventsCache[year];
    }

    if (ongoingYearlyRequests[year]) {
      return ongoingYearlyRequests[year];
    }

    const request = (async () => {
      // 2. Busca no Supabase com paginação (limite do servidor é 1000 por request)
      const { supabase } = await import("../config/supabase");

      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      const PAGE_SIZE = 1000;
      let allRows: any[] = [];
      let page = 0;
      while (true) {
        const { data: pageData, error } = await supabase
          .from("programacao_aulas")
          .select("*")
          .gte("date", start)
          .lte("date", end)
          .order("date", { ascending: true })
          .order("id",   { ascending: true })   // desempate para paginação estável
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) throw error;
        allRows = allRows.concat(pageData ?? []);
        if ((pageData ?? []).length < PAGE_SIZE) break;
        page++;
      }

      // Deduplica por (classId, date, startTime) — eventos acadêmicos nunca deduplicados
      const slotSeen = new Map<string, typeof allRows[0]>();
      allRows.forEach((r: any) => {
        if (r.type === 'ACADEMIC' || r.disciplineId === 'ACADEMIC') {
          slotSeen.set(r.id, r);
          return;
        }
        const slotKey = `${r.classId}|${r.date}|${normalizeTime(r.startTime)}`;
        const existing = slotSeen.get(slotKey);
        if (!existing) { slotSeen.set(slotKey, r); return; }
        if (r.type === "EVALUATION" && existing.type !== "EVALUATION") { slotSeen.set(slotKey, r); return; }
        if (r.id > existing.id) slotSeen.set(slotKey, r);
      });
      const deduped = [...slotSeen.values()];
      console.log(`[fetchYearlyEvents] ${year}: ${allRows.length} → ${deduped.length} eventos após dedup`);
      const events = deduped.map(normalizeEvent) as unknown as ScheduleEvent[];

      // Salva apenas em memória — localStorage causa jank com 2000+ eventos
      set((s: CourseState) => ({
        yearEventsCache: { ...s.yearEventsCache, [year]: events },
      }));

      return events;
    })();

    ongoingYearlyRequests[year] = request;
    try {
      return await request;
    } finally {
      delete ongoingYearlyRequests[year];
    }
  },

  fetchWeeklyEvents: async (
    startDay: string,
    endDay: string,
    squadronId: number,
  ): Promise<ScheduleEvent[]> => {
    const state: CourseState = useCourseStore.getState();
    const yearMatch = startDay.match(/^\d{4}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

    if (state.yearEventsCache[year]) {
      return state.yearEventsCache[year].filter((e: ScheduleEvent) => {
        const isAcademic =
          e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC";
        const belongsToSquadron = e.classId
          ? e.classId.startsWith(String(squadronId))
          : false;
        const isGlobal =
          e.classId === "Geral" ||
          e.classId === "GLOBAL" ||
          (e.classId ? e.classId.endsWith("ESQ") : false);
        return (
          (isAcademic || belongsToSquadron || isGlobal) &&
          e.date >= startDay &&
          e.date <= endDay
        );
      });
    }

    const cacheKey = `${startDay}-${squadronId}`;
    if (state.weeklyEventsCache[cacheKey]) {
      return state.weeklyEventsCache[cacheKey];
    }

    if (ongoingWeeklyRequests[cacheKey]) {
      return ongoingWeeklyRequests[cacheKey];
    }

    const request = (async () => {
      const { supabase } = await import("../config/supabase");

      const { data: rawData, error: fetchError } = await supabase
        .from("programacao_aulas")
        .select("*")
        .gte("date",startDay)
        .lte("date",endDay);

      if (fetchError) throw fetchError;
      const allEvents = (rawData ?? []).map(normalizeEvent) as unknown as ScheduleEvent[];
      const filtered = allEvents.filter((e) => {
        const isAcademic = e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC";
        const belongsToSquadron = e.classId && e.classId.startsWith(String(squadronId));
        const isGlobal =
          e.classId === "Geral" ||
          e.classId === "GLOBAL" ||
          (e.classId && e.classId.endsWith("ESQ"));
        return isAcademic || belongsToSquadron || isGlobal;
      });

      set((state) => ({
        weeklyEventsCache: {
          ...state.weeklyEventsCache,
          [cacheKey]: filtered,
        },
      }));

      return filtered;
    })();

    ongoingWeeklyRequests[cacheKey] = request;
    try {
      return await request;
    } finally {
      delete ongoingWeeklyRequests[cacheKey];
    }
  },

  // ── Locais de Instrução ──────────────────────────────────────────────────────
  locations: [],
  locationIssues: [],
  locationReservations: [],

  setLocations: (locs: InstructionLocation[]) => set({ locations: locs }),
  setLocationIssues: (issues: LocationIssue[]) => set({ locationIssues: issues }),
  setLocationReservations: (reservations: LocationReservation[]) => set({ locationReservations: reservations }),

  addLocation: async (location: InstructionLocation): Promise<string> => {
    // Não passa id — deixa o banco gerar para evitar update silencioso em row inexistente
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _frontendId, createdAt: _ca, ...locationWithoutId } = location;
    const result = await contentFn("save_location", { location: locationWithoutId });
    const realId = (result.id as string) ?? location.id;
    set((s: CourseState) => ({ locations: [...s.locations, { ...location, id: realId }] }));
    invalidateStaticCache("instruction_locations");
    return realId;
  },

  updateLocation: async (id: string, updates: Partial<InstructionLocation>) => {
    set((s: CourseState) => ({ locations: s.locations.map((l: InstructionLocation) => l.id === id ? { ...l, ...updates } : l) }));
    const loc = useCourseStore.getState().locations.find((l: InstructionLocation) => l.id === id);
    if (loc) await contentFn("save_location", { location: loc });
    invalidateStaticCache("instruction_locations");
  },

  deleteLocation: async (id: string) => {
    set((s: CourseState) => ({ locations: s.locations.filter((l: InstructionLocation) => l.id !== id) }));
    await contentFn("delete_location", { id });
    invalidateStaticCache("instruction_locations");
  },

  addLocationIssue: async (issue: Omit<LocationIssue, "id" | "createdAt" | "createdBy">) => {
    const newIssue: LocationIssue = { ...issue, id: crypto.randomUUID(), createdAt: new Date().toISOString(), createdBy: "" };
    set((s: CourseState) => ({ locationIssues: [...s.locationIssues, newIssue] }));
    await contentFn("save_issue", { issue: newIssue });
    invalidateStaticCache("location_issues");
  },

  updateLocationIssue: async (id: string, updates: Partial<LocationIssue>) => {
    set((s: CourseState) => ({ locationIssues: s.locationIssues.map((i: LocationIssue) => i.id === id ? { ...i, ...updates } : i) }));
    const issue = useCourseStore.getState().locationIssues.find((i: LocationIssue) => i.id === id);
    if (issue) await contentFn("save_issue", { issue });
    invalidateStaticCache("location_issues");
  },

  deleteLocationIssue: async (id: string) => {
    set((s: CourseState) => ({ locationIssues: s.locationIssues.filter((i: LocationIssue) => i.id !== id) }));
    await contentFn("delete_issue", { id });
    invalidateStaticCache("location_issues");
  },

  addLocationReservation: async (reservation: Omit<LocationReservation, "id" | "createdAt" | "createdBy">) => {
    const newRes: LocationReservation = { ...reservation, id: crypto.randomUUID(), createdAt: new Date().toISOString(), createdBy: "" };
    set((s: CourseState) => ({ locationReservations: [...s.locationReservations, newRes] }));
    await contentFn("save_reservation", { reservation: newRes });
    invalidateStaticCache("location_reservations");
  },

  deleteLocationReservation: async (id: string) => {
    set((s: CourseState) => ({ locationReservations: s.locationReservations.filter((r: LocationReservation) => r.id !== id) }));
    await contentFn("delete_reservation", { id });
    invalidateStaticCache("location_reservations");
  },

  setAppConfig: async (key: string, value: unknown) => {
    set((s: CourseState) => ({ appConfigs: { ...s.appConfigs, [key]: value } }));
    await contentFn("save_app_config", { key, value });
  },
  loadAppConfigs: (configs: Record<string, unknown>) => {
    set((s: CourseState) => ({ appConfigs: { ...s.appConfigs, ...configs } }));
  },
}));
