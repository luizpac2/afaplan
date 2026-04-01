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
} from "../types";
import { logAction, getEntityName } from "../utils/auditLogger";
import {
  saveDocument,
  updateDocument,
  deleteDocument,
  batchSave,
  batchDelete,
} from "../services/supabaseService"; // Import firestore service

import { TIME_SLOTS } from "../utils/constants";

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
  deleteNotice: (id: string) => void;

  // Visual config actions
  setVisualConfigs: (configs: VisualConfig[]) => void;
  updateVisualConfig: (id: string, updates: Partial<VisualConfig>) => void;

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
const invalidateStaticCache = (collectionName: string) => {
  try {
    localStorage.removeItem(`afa_cache_${collectionName}`);
  } catch {
    /* ignora */
  }
};

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
      dataReady: false,
    }),

  addNotice: (notice) => {
    set((state) => ({ notices: [...state.notices, notice] }));
    logAction({
      action: "ADD",
      entity: "NOTICE",
      entityId: notice.id,
      entityName: notice.title,
    });
    saveDocument("notices", notice.id, notice);
  },

  updateNotice: (id, updates) => {
    const state = useCourseStore.getState();
    const before = state.notices.find((n) => n.id === id);
    set((state) => ({
      notices: state.notices.map((n) =>
        n.id === id ? { ...n, ...updates } : n,
      ),
    }));
    const after = useCourseStore.getState().notices.find((n) => n.id === id);
    if (before && after) {
      logAction({
        action: "UPDATE",
        entity: "NOTICE",
        entityId: id,
        entityName: after.title,
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      });
    }
    if (after)
      saveDocument("notices", id, after);
  },

  deleteNotice: (id) => {
    const state = useCourseStore.getState();
    const notice = state.notices.find((n) => n.id === id);
    set((state) => ({ notices: state.notices.filter((n) => n.id !== id) }));
    if (notice) {
      logAction({
        action: "DELETE",
        entity: "NOTICE",
        entityId: id,
        entityName: notice.title,
      });
    }
    deleteDocument("notices", id);
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
        "events",
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

  addDiscipline: (discipline) => {
    set((state) => ({ disciplines: [...state.disciplines, discipline] }));
    logAction({
      action: "ADD",
      entity: "DISCIPLINE",
      entityId: discipline.id,
      entityName: getEntityName(
        discipline as unknown as Record<string, unknown>,
        "DISCIPLINE",
      ),
    });
    if (true) {
      saveDocument("disciplines", discipline.id, discipline);
      invalidateStaticCache("disciplines");
    }
  },

  updateDiscipline: (id, updates) => {
    const state = useCourseStore.getState();
    const before = state.disciplines.find((d) => d.id === id);
    set((state) => ({
      disciplines: state.disciplines.map((d) =>
        d.id === id ? { ...d, ...updates } : d,
      ),
    }));
    const after = useCourseStore
      .getState()
      .disciplines.find((d) => d.id === id);
    if (before && after) {
      logAction({
        action: "UPDATE",
        entity: "DISCIPLINE",
        entityId: id,
        entityName: getEntityName(
          after as unknown as Record<string, unknown>,
          "DISCIPLINE",
        ),
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      });
    }
    if (after) {
      saveDocument("disciplines", id, after);
      invalidateStaticCache("disciplines");
    }
  },

  updateBatchDisciplines: async (updates) => {
    const itemsToSave: Discipline[] = [];

    set((state) => {
      const newDisciplines = state.disciplines.map((d) => {
        if (updates[d.id]) {
          const updatedItem = { ...d, ...updates[d.id] };
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
      if (true) {
        await batchSave("disciplines", itemsToSave);
        invalidateStaticCache("disciplines");
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

      // Sync with Firestore for each updated discipline
      if (true) {
        batchSave("disciplines", updatedDisciplines);
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

  deleteDiscipline: (id) => {
    const state = useCourseStore.getState();
    const discipline = state.disciplines.find((d) => d.id === id);

    // Find associated events to delete
    const eventsToDelete = state.events.filter((e) => e.disciplineId === id);

    set((state) => {
      const newYearCache = { ...state.yearEventsCache };
      eventsToDelete.forEach((event) => {
        const year = new Date(event.date + "T12:00:00").getFullYear();
        if (newYearCache[year]) {
          newYearCache[year] = newYearCache[year].filter(
            (e) => e.id !== event.id,
          );
        }
      });

      return {
        disciplines: state.disciplines.filter((d) => d.id !== id),
        events: state.events.filter((e) => e.disciplineId !== id),
        yearEventsCache: newYearCache,
        weeklyEventsCache: {},
      };
    });

    if (discipline) {
      logAction({
        action: "DELETE",
        entity: "DISCIPLINE",
        entityId: id,
        entityName: getEntityName(
          discipline as unknown as Record<string, unknown>,
          "DISCIPLINE",
        ),
      });
    }

    if (true) {
      deleteDocument("disciplines", id);
      invalidateStaticCache("disciplines");
      // Delete associated events from Firestore
      if (eventsToDelete.length > 0) {
        batchDelete(
          "events",
          eventsToDelete.map((e) => e.id),
        ).catch((err) =>
          console.error(`Failed to delete events for discipline ${id}`, err),
        );
      }
    }
  },

  deleteBatchDisciplines: async (ids) => {
    const state = useCourseStore.getState();
    const disciplinesToDelete = state.disciplines.filter((d) =>
      ids.includes(d.id),
    );
    const eventsToDelete = state.events.filter((e) =>
      ids.includes(e.disciplineId),
    );
    const eventIdsToDelete = eventsToDelete.map((e) => e.id);

    set((state) => {
      const newYearCache = { ...state.yearEventsCache };
      eventsToDelete.forEach((event) => {
        const year = new Date(event.date + "T12:00:00").getFullYear();
        if (newYearCache[year]) {
          newYearCache[year] = newYearCache[year].filter(
            (e) => e.id !== event.id,
          );
        }
      });

      return {
        disciplines: state.disciplines.filter((d) => !ids.includes(d.id)),
        events: state.events.filter((e) => !ids.includes(e.disciplineId)),
        yearEventsCache: newYearCache,
        weeklyEventsCache: {},
      };
    });

    disciplinesToDelete.forEach((d) => {
      logAction({
        action: "DELETE",
        entity: "DISCIPLINE",
        entityId: d.id,
        entityName: getEntityName(
          d as unknown as Record<string, unknown>,
          "DISCIPLINE",
        ),
      });
    });

    if (true) {
      await batchDelete("disciplines", ids);
      invalidateStaticCache("disciplines");
      if (eventIdsToDelete.length > 0) {
        // Bulk delete associated events
        await batchDelete("events", eventIdsToDelete).catch((err) =>
          console.error("Failed to batch delete associated events:", err),
        );
      }
    }
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

    if (true) {
      saveDocument("events", event.id, event).catch((err) => {
        console.error("Failed to save event:", err);
      });
    }
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
      batchSave("events", events).catch((err) => {
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

    if (true) {
      saveDocument("events", id, updates).catch((err) => {
        console.error("Failed to update event:", err);
      });
    }
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

    if (true) {
      deleteDocument("events", id).catch((err) => {
        console.error("Failed to delete event:", err);
      });
    }
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

    if (true) {
      batchDelete("events", ids).catch((err) => {
        console.error("❌ Falha crítica ao deletar no Firestore:", err);
      });
    }
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

    // Sync with Firestore
    if (true) {
      updates.forEach((update) => {
        saveDocument("events", update.id, update).catch((err) => {
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
        if (true) {
          saveDocument("visualConfigs", id, updated);
          invalidateStaticCache("visualConfigs");
        }
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
      if (true) {
        saveDocument("visualConfigs", id, newConfig);
        invalidateStaticCache("visualConfigs");
      }
    }
  },

  // Instructor Implementations
  setInstructors: (instructors) => set({ instructors }),
  addInstructor: async (instructor) => {
    set((state) => ({ instructors: [...state.instructors, instructor] }));
    logAction({
      action: "ADD",
      entity: "INSTRUCTOR",
      entityId: instructor.trigram,
      entityName: instructor.warName,
    });

    if (true) {
      try {
        await saveDocument("instructors", instructor.trigram, instructor);
        invalidateStaticCache("instructors");
        console.log(`✅ Instrutor ${instructor.trigram} salvo no Firestore`);
      } catch (err) {
        console.error("❌ Falha ao salvar instrutor no Firestore:", err);
        alert(
          "Erro ao salvar docente no banco de dados. Verifique sua conexão.",
        );
      }
    } else {
      console.warn(
        "⚠️ Usuário não autenticado. Instructor não será salvo no Firestore.",
      );
    }
  },
  updateInstructor: async (trigram, updates) => {
    const state = useCourseStore.getState();
    const before = state.instructors.find((i) => i.trigram === trigram);
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
      if (true) {
        try {
          await saveDocument("instructors", trigram, after);
          invalidateStaticCache("instructors");
          console.log(`✅ Instrutor ${trigram} atualizado no Firestore`);
        } catch (err) {
          console.error("❌ Falha ao atualizar instrutor no Firestore:", err);
          alert(
            "Erro ao atualizar docente. Suas mudanças podem não ter sido salvas.",
          );
        }
      }
    }
  },
  deleteInstructor: (trigram) => {
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
      if (true) {
        deleteDocument("instructors", trigram);
        invalidateStaticCache("instructors");
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
        console.log(`✅ Ocorrência ${occurrence.id} salva no Firestore`);
      } catch (err) {
        console.error("❌ Falha ao salvar ocorrência no Firestore:", err);
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
      // 2. Cache no localStorage (sobrevive a reloads, TTL de 5 min)
      const lsKey = `afa_events_${year}`;
      try {
        const raw = localStorage.getItem(lsKey);
        if (raw) {
          const { data, ts } = JSON.parse(raw) as {
            data: ScheduleEvent[];
            ts: number;
          };
          if (Date.now() - ts < 30 * 60 * 1000) {
            console.log(
              `⚡ Cache localStorage para eventos de ${year} (0 reads Firebase)`,
            );
            set((s: CourseState) => ({
              yearEventsCache: { ...s.yearEventsCache, [year]: data },
            }));
            return data;
          }
        }
      } catch {
        /* ignora erros de parse */
      }

      // 3. Busca no Supabase (só quando cache expirou)
      const { supabase } = await import("../config/supabase");

      const start = `${year}-01-01`;
      const end = `${year}-12-31`;

      console.log(`📡 Buscando eventos de ${year} no Supabase...`);
      const { data, error } = await supabase
        .from("programacao_aulas")
        .select("*")
        .gte("data", start)
        .lte("data", end);

      if (error) throw error;
      const events = (data ?? []) as unknown as ScheduleEvent[];

      // Salva nos dois caches
      set((s: CourseState) => ({
        yearEventsCache: { ...s.yearEventsCache, [year]: events },
      }));
      try {
        localStorage.setItem(
          lsKey,
          JSON.stringify({ data: events, ts: Date.now() }),
        );
      } catch {
        /* quota exceeded etc */
      }

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
      console.log(`🚀 Usando cache SEMANAL para ${startDay} (0 reads)`);
      return state.weeklyEventsCache[cacheKey];
    }

    if (ongoingWeeklyRequests[cacheKey]) {
      return ongoingWeeklyRequests[cacheKey];
    }

    const request = (async () => {
      const { supabase } = await import("../config/supabase");

      console.log(
        `📡 Buscando semana [${startDay} a ${endDay}] para ESQ ${squadronId} (Lazy Loading)...`,
      );
      const { data: rawData, error: fetchError } = await supabase
        .from("programacao_aulas")
        .select("*")
        .gte("data", startDay)
        .lte("data", endDay);

      if (fetchError) throw fetchError;
      const allEvents = (rawData ?? []) as unknown as ScheduleEvent[];
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
}));
