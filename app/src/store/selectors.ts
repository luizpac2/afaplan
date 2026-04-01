/**
 * Seletores tipados para o useCourseStore.
 *
 * Uso:
 *   import { useDisciplines, useEvents } from '../store/selectors';
 *   const disciplines = useDisciplines();
 *
 * Vantagem: cada componente assina apenas o slice de estado que precisa,
 * evitando re-renders desnecessários quando outras partes do store mudam.
 */
import { useCourseStore } from './useCourseStore';

// ── Dados ──────────────────────────────────────────────────────────────────────

export const useDisciplines = () => useCourseStore((s) => s.disciplines);

export const useEvents = () => useCourseStore((s) => s.events);

export const useClasses = () => useCourseStore((s) => s.classes);

export const useCohorts = () => useCourseStore((s) => s.cohorts);

export const useNotices = () => useCourseStore((s) => s.notices);

export const useVisualConfigs = () => useCourseStore((s) => s.visualConfigs);

export const useInstructors = () => useCourseStore((s) => s.instructors);

export const useOccurrences = () => useCourseStore((s) => s.occurrences);

export const useSemesterConfigs = () => useCourseStore((s) => s.semesterConfigs);

export const useChangeRequests = () => useCourseStore((s) => s.changeRequests);

export const useDataReady = () => useCourseStore((s) => s.dataReady);

// ── Ações de Disciplinas ───────────────────────────────────────────────────────

export const useDisciplineActions = () =>
  useCourseStore((s) => ({
    addDiscipline: s.addDiscipline,
    updateDiscipline: s.updateDiscipline,
    updateBatchDisciplines: s.updateBatchDisciplines,
    deleteDiscipline: s.deleteDiscipline,
    deleteBatchDisciplines: s.deleteBatchDisciplines,
    clearDisciplines: s.clearDisciplines,
  }));

// ── Ações de Eventos ───────────────────────────────────────────────────────────

export const useEventActions = () =>
  useCourseStore((s) => ({
    addEvent: s.addEvent,
    addBatchEvents: s.addBatchEvents,
    updateEvent: s.updateEvent,
    deleteEvent: s.deleteEvent,
    deleteBatchEvents: s.deleteBatchEvents,
    clearEvents: s.clearEvents,
    swapEvents: s.swapEvents,
    fetchYearlyEvents: s.fetchYearlyEvents,
    fetchWeeklyEvents: s.fetchWeeklyEvents,
  }));

// ── Ações de Turmas ────────────────────────────────────────────────────────────

export const useClassActions = () =>
  useCourseStore((s) => ({
    addClass: s.addClass,
    updateClass: s.updateClass,
    updateBatchClasses: s.updateBatchClasses,
    deleteClass: s.deleteClass,
  }));

// ── Ações de SAPs (Solicitações de Alteração) ──────────────────────────────────

export const useChangeRequestActions = () =>
  useCourseStore((s) => ({
    addChangeRequest: s.addChangeRequest,
    updateChangeRequest: s.updateChangeRequest,
    deleteChangeRequest: s.deleteChangeRequest,
    linkEventsToRequest: s.linkEventsToRequest,
  }));

// ── Ações de Avisos ────────────────────────────────────────────────────────────

export const useNoticeActions = () =>
  useCourseStore((s) => ({
    addNotice: s.addNotice,
    updateNotice: s.updateNotice,
    deleteNotice: s.deleteNotice,
  }));

// ── Ações de Instrutores ───────────────────────────────────────────────────────

export const useInstructorActions = () =>
  useCourseStore((s) => ({
    addInstructor: s.addInstructor,
    updateInstructor: s.updateInstructor,
    deleteInstructor: s.deleteInstructor,
  }));

// ── Seletores derivados (computados) ──────────────────────────────────────────

/** Retorna apenas eventos do ano especificado a partir do cache local. */
export const useYearEventsCache = (year: number) =>
  useCourseStore((s) => s.yearEventsCache[year] ?? []);

/** Retorna a turma pelo ID. */
export const useClassById = (id: string) =>
  useCourseStore((s) => s.classes.find((c) => c.id === id));

/** Retorna o instrutor pelo trigrama. */
export const useInstructorByTrigram = (trigram: string) =>
  useCourseStore((s) => s.instructors.find((i) => i.trigram === trigram));

/** Retorna a disciplina pelo ID. */
export const useDisciplineById = (id: string) =>
  useCourseStore((s) => s.disciplines.find((d) => d.id === id));
