import type { Discipline, ScheduleEvent } from "../types";

/**
 * Resolve o trigrama efetivo do docente para um evento específico.
 * Prioridade: override no evento > override por turma no ano > titular do ano > override por turma padrão > titular padrão
 */
export function resolveInstructorTrigram(disc: Discipline, ev: ScheduleEvent): string {
  if (ev.instructorTrigram) return ev.instructorTrigram;
  const year = ev.date?.slice(0, 4) ?? "";
  const yearData = year ? disc.instructorByYear?.[year] : undefined;
  const classOverride = yearData?.byClass?.[ev.classId] ?? disc.instructorByClass?.[ev.classId];
  const defaultTri = yearData?.trigram ?? disc.instructorTrigram ?? "";
  return classOverride || defaultTri;
}

/**
 * Verifica se um docente (trigrama) está associado a uma disciplina em algum ano,
 * considerando o histórico por ano e os padrões.
 */
export function disciplineHasInstructor(disc: Discipline, trigram: string): boolean {
  if (!trigram) return false;
  if (disc.instructorTrigram === trigram) return true;
  if (disc.instructorByClass && Object.values(disc.instructorByClass).includes(trigram)) return true;
  if (disc.instructorByYear) {
    for (const yd of Object.values(disc.instructorByYear)) {
      if (yd.trigram === trigram) return true;
      if (yd.byClass && Object.values(yd.byClass).includes(trigram)) return true;
    }
  }
  return false;
}

/**
 * Resolve o trigrama efetivo do docente para uma turma/ano específicos (sem evento).
 * Usado em filtros do painel.
 */
export function resolveInstructorForClass(
  disc: Discipline,
  classId: string,
  year: string,
): string {
  const yearData = year ? disc.instructorByYear?.[year] : undefined;
  const classOverride = yearData?.byClass?.[classId] ?? disc.instructorByClass?.[classId];
  const defaultTri = yearData?.trigram ?? disc.instructorTrigram ?? "";
  return classOverride || defaultTri;
}
