import type { Discipline, ScheduleEvent, CourseYear, SemesterConfig } from '../types';
import { TIME_SLOTS } from './constants';
import { formatDate, addDays, createDateFromISO, getWeekNumber } from './dateUtils';

export interface SchedulingParams {
    disciplineId: string;
    squadron: CourseYear; // 1-4
    classLetter: string; // A-F or ESQ (all classes)
    startDate: Date;
    endDate: Date;
}
// ...
// skipping to line 216


export interface SchedulingResult {
    success: boolean;
    events?: ScheduleEvent[];
    errors?: string[];
    warnings?: string[];
}

export interface Conflict {
    type: 'overlap' | 'overload' | 'restriction' | 'distribution';
    severity: 'error' | 'warning';
    message: string;
    events?: ScheduleEvent[];
    disciplineId?: string;
    classId?: string;
    year?: number | 'ALL';
    date?: string;
    timeSlot?: string;
}

/**
 * Validates if discipline has complete Ficha Informativa
 */
export function validateInformativeSheet(discipline: Discipline): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!discipline) {
        errors.push('Disciplina não encontrada');
        return { valid: false, errors };
    }

    if (!discipline.load_hours || discipline.load_hours <= 0) {
        errors.push(`Disciplina "${discipline.name}" não possui carga horária definida`);
    }

    if (!discipline.trainingField) {
        errors.push(`Disciplina "${discipline.name}" não possui campo de instrução definido`);
    }

    // Note: allowed_days não existe no tipo, usando dias úteis padrão (Seg-Sex)

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Finds available time slots for scheduling
 */
export function findAvailableSlots(
    params: SchedulingParams,
    existingEvents: ScheduleEvent[]
): Date[] {
    const availableSlots: Date[] = [];
    const { startDate, endDate, squadron, classLetter } = params;
    const classId = classLetter === 'ESQ' ? `${squadron}ESQ` : `${squadron}${classLetter}`;

    // Get allowed days (0=Sunday, 1=Monday, ..., 6=Saturday)
    // Por padrão usa Segunda a Sexta-feira
    const allowedDays = [1, 2, 3, 4, 5]; // Monday-Friday

    let currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);

    while (currentDate <= endDateTime) {
        const dayOfWeek = currentDate.getDay();

        // Check if this day is allowed
        if (allowedDays.includes(dayOfWeek)) {
            const dateStr = formatDate(currentDate);

            // Check each time slot
            for (const slot of TIME_SLOTS) {
                // Check if slot is free for this class
                const hasConflict = existingEvents.some(event => {
                    // Check for Academic events (dias bloqueados) - affects all classes on that date
                    // Only blocks if isBlocking is true (default to true for legacy events)
                    const isAcad = event.type === 'ACADEMIC' || event.disciplineId === 'ACADEMIC';
                    if (isAcad && event.date === dateStr && (event.isBlocking !== false)) return true;

                    if (event.date !== dateStr) return false;
                    if (event.startTime !== slot.start) return false;

                    // Check if same class or if one of them is ESQ (affects all classes)
                    if (event.classId === classId) return true;
                    if (event.classId === `${squadron}ESQ`) return true;
                    if (classId === `${squadron}ESQ` && event.classId.startsWith(`${squadron}`)) return true;

                    return false;
                });

                if (!hasConflict) {
                    const slotDate = new Date(currentDate);
                    slotDate.setHours(parseInt(slot.start.split(':')[0]), parseInt(slot.start.split(':')[1]));
                    availableSlots.push(slotDate);
                }
            }
        }

        currentDate = addDays(currentDate, 1);
    }

    return availableSlots;
}

/**
 * Auto-schedule a discipline
 */
export function autoScheduleDiscipline(
    params: SchedulingParams,
    discipline: Discipline,
    existingEvents: ScheduleEvent[],
    semesterConfigs: SemesterConfig[] = []
): SchedulingResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Step 1: Validate Ficha Informativa
    const validation = validateInformativeSheet(discipline);
    if (!validation.valid) {
        return {
            success: false,
            errors: validation.errors
        };
    }

    // Determine target load from class properties
    const classId = params.classLetter === 'ESQ' ? `${params.squadron}ESQ` : `${params.squadron}${params.classLetter}`;

    // We need to know the course type to get the right PPC load. 
    // Usually, we pass the full classes array, but here we don't have it.
    // However, we can guess the load if it's identical across all enabled courses of that year, 
    // or we'll need to pass the class type explicitly if we refactor SchedulingParams.
    // For now, we will use Math.max of ppcLoads for the given squadron as a fallback or if ESQ.
    let ppcTotalHours = discipline.load_hours || 0;

    if (discipline.ppcLoads) {
        const loadsForYear = Object.entries(discipline.ppcLoads)
            .filter(([key]) => key.endsWith(`_${params.squadron}`))
            .map(([, load]) => load);
        if (loadsForYear.length > 0) {
            // For now, if "ESQ", we take max. If specific class, ideally we'd know the course.
            // Since we don't have course here, max is the safest for not returning "already full" too early.
            ppcTotalHours = Math.max(...loadsForYear);
        }
    }

    // Scheduling Criteria from Ficha Informativa
    const criteria = discipline.scheduling_criteria || {
        frequency: 2,
        allowConsecutiveDays: false,
        preferredSlots: [],
        priority: 5,
        maxClassesPerDay: 2
    };

    const weeklyFrequency = criteria.frequency || 2;
    const maxDailySessions = criteria.maxClassesPerDay || 2;
    const allowConsecutive = criteria.allowConsecutiveDays ?? false;
    const preferredSlots = criteria.preferredSlots || [];

    // Step 2: Check existing allocated hours
    const existingClassEvents = existingEvents.filter(event =>
        event.disciplineId === params.disciplineId &&
        (event.classId === classId ||
            (params.classLetter === 'ESQ' && event.classId.startsWith(`${params.squadron}`)) ||
            (event.classId === `${params.squadron}ESQ` && classId.startsWith(`${params.squadron}`)))
    );

    const hoursPerTempo = 1; // Fixed 1h duration per session as per request
    const allocatedHours = existingClassEvents.length * hoursPerTempo;
    const remainingHours = ppcTotalHours - allocatedHours;

    if (remainingHours <= 0) {
        return {
            success: false,
            errors: [`Carga horária total (${ppcTotalHours}h) já alocada.`]
        };
    }

    // sessions needed
    let sessionsToAllocate = Math.round(remainingHours / hoursPerTempo);

    // Step 3: Handle Semester Restriction
    const semester = discipline.scheduling_criteria?.semester;
    let finalStartDate = new Date(params.startDate);
    let finalEndDate = new Date(params.endDate);

    if (semester) {
        const year = finalStartDate.getFullYear();
        const config = semesterConfigs.find(c => c.year === year);
        if (config) {
            const semStartStr = semester === 1 ? config.s1Start : config.s2Start;
            const semEndStr = semester === 1 ? config.s1End : config.s2End;

            if (semStartStr && semEndStr) {
                const semStart = createDateFromISO(semStartStr);
                const semEnd = createDateFromISO(semEndStr);

                if (!isNaN(semStart.getTime()) && !isNaN(semEnd.getTime())) {
                    // Intersection
                    if (semStart > finalStartDate) finalStartDate = semStart;
                    if (semEnd < finalEndDate) finalEndDate = semEnd;

                    if (finalStartDate > finalEndDate) {
                        return {
                            success: false,
                            errors: [`O intervalo de datas selecionado (${formatDate(params.startDate)} a ${formatDate(params.endDate)}) está TOTALMENTE fora do ${semester}º Semestre configurado (${semStartStr} a ${semEndStr})`]
                        };
                    }
                }
            }
        }
    }

    // Update params with effective range for finding slots
    const effectiveParams = { ...params, startDate: finalStartDate, endDate: finalEndDate };

    // Step 4: Find available slots and group by day
    const availableSlots = findAvailableSlots(effectiveParams, existingEvents);
    if (availableSlots.length === 0) {
        return { success: false, errors: ['Nenhum horário disponível.'] };
    }

    const slotsByDate = new Map<string, Date[]>();
    availableSlots.forEach(slot => {
        const dateStr = formatDate(slot);
        if (!slotsByDate.has(dateStr)) slotsByDate.set(dateStr, []);
        slotsByDate.get(dateStr)?.push(slot);
    });

    // Step 4: Distribution Logic
    const newEvents: ScheduleEvent[] = [];
    const sortedDates = Array.from(slotsByDate.keys()).sort();
    const usedSessionsCount: Map<string, number> = new Map(); // date -> count
    const weeklySessionsCount: Map<string, number> = new Map(); // year_week -> count
    const lastSessionDate: Map<string, Date> = new Map(); // classId -> Date

    // Pre-calculate existing sessions counts
    existingClassEvents.forEach(e => {
        const date = createDateFromISO(e.date);
        const dateStr = e.date;
        const weekKey = `${date.getUTCFullYear()}_W${getWeekNumber(date)}`;

        usedSessionsCount.set(dateStr, (usedSessionsCount.get(dateStr) || 0) + 1);
        weeklySessionsCount.set(weekKey, (weeklySessionsCount.get(weekKey) || 0) + 1);

        const currentLast = lastSessionDate.get(classId);
        if (!currentLast || date > currentLast) {
            lastSessionDate.set(classId, date);
        }
    });

    let currentDayIdx = 0;
    let attempts = 0;
    const maxAttempts = sessionsToAllocate * sortedDates.length * 10;

    while (sessionsToAllocate > 0 && attempts < maxAttempts) {
        attempts++;

        const dateStr = sortedDates[currentDayIdx];
        const date = createDateFromISO(dateStr);
        const weekKey = `${date.getUTCFullYear()}_W${getWeekNumber(date)}`;

        const dailyCount = usedSessionsCount.get(dateStr) || 0;
        const weeklyCount = weeklySessionsCount.get(weekKey) || 0;

        // Constraint: Max Daily
        if (dailyCount >= maxDailySessions) {
            currentDayIdx = (currentDayIdx + 1) % sortedDates.length;
            continue;
        }

        // Constraint: Weekly Frequency
        if (weeklyCount >= weeklyFrequency) {
            currentDayIdx = (currentDayIdx + 1) % sortedDates.length;
            continue;
        }

        // Constraint: No Consecutive Days
        if (!allowConsecutive && lastSessionDate.has(classId)) {
            const lastDate = lastSessionDate.get(classId)!;
            const diffDays = Math.abs((date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 1.5) { // Same day or consecutive (less than 36h approx)
                currentDayIdx = (currentDayIdx + 1) % sortedDates.length;
                continue;
            }
        }

        const daySlots = slotsByDate.get(dateStr) || [];
        if (daySlots.length === 0) {
            currentDayIdx = (currentDayIdx + 1) % sortedDates.length;
            continue;
        }

        // Search Strategy: Prefer Preferred Slots
        let selectedSlotIdx = -1;
        if (preferredSlots.length > 0) {
            // Try to find a slot that starts at a preferred time
            selectedSlotIdx = daySlots.findIndex(s => {
                const time = `${s.getHours().toString().padStart(2, '0')}:${s.getMinutes().toString().padStart(2, '0')}`;
                return (preferredSlots as string[]).includes(time);
            });
        }

        // Fallback: Pick first available slot in the day
        if (selectedSlotIdx === -1) {
            selectedSlotIdx = 0;
        }

        const slotDate = daySlots[selectedSlotIdx];
        const startTime = `${slotDate.getHours().toString().padStart(2, '0')}:${slotDate.getMinutes().toString().padStart(2, '0')}`;
        const endHour = slotDate.getHours() + 1;
        const endTime = `${endHour.toString().padStart(2, '0')}:${slotDate.getMinutes().toString().padStart(2, '0')}`;

        const newEvent: ScheduleEvent = {
            id: crypto.randomUUID(),
            disciplineId: params.disciplineId,
            classId: classId,
            date: dateStr,
            startTime,
            endTime,
            location: discipline.trainingField || 'A definir'
        };

        newEvents.push(newEvent);

        // Remove from available
        daySlots.splice(selectedSlotIdx, 1);

        // Update counters
        usedSessionsCount.set(dateStr, dailyCount + 1);
        weeklySessionsCount.set(weekKey, weeklyCount + 1);
        lastSessionDate.set(classId, date);
        sessionsToAllocate--;

        // Move to next day to spread out (Round Robin)
        currentDayIdx = (currentDayIdx + 1) % sortedDates.length;
    }

    if (sessionsToAllocate > 0) {
        warnings.push(`Não foi possível alocar todas as aulas (${sessionsToAllocate} sessões faltantes) respeitando cadência (${weeklyFrequency}x/sem) ou restrição de dias consecutivos.`);
    }

    const finalAllocatedHours = allocatedHours + (newEvents.length * hoursPerTempo);

    return {
        success: newEvents.length > 0,
        events: newEvents,
        errors: errors.length > 0 ? errors : undefined,
        warnings: [...warnings, `Total alocado: ${finalAllocatedHours}h de ${ppcTotalHours}h.`]
    };
}

/**
 * Detect conflicts in current schedule
 */
export function detectConflicts(
    events: ScheduleEvent[],
    disciplines: Discipline[],
    semesterConfigs: SemesterConfig[] = []
): Conflict[] {
    const conflicts: Conflict[] = [];

    // Group events by date and time
    const eventsBySlot = new Map<string, ScheduleEvent[]>();
    const academicBlocks = new Set<string>();

    events.forEach(event => {
        const isAcad = event.type === 'ACADEMIC' || event.disciplineId === 'ACADEMIC';
        if (isAcad) {
            academicBlocks.add(event.date);
            return; // Don't count academic events as potential overlaps with themselves
        }
        const key = `${event.date}_${event.startTime}`;
        const existing = eventsBySlot.get(key) || [];
        existing.push(event);
        eventsBySlot.set(key, existing);
    });

    // Check for semester restriction violation
    events.forEach(event => {
        const discipline = disciplines.find(d => d.id === event.disciplineId);
        if (!discipline || !discipline.scheduling_criteria?.semester) return;

        const year = new Date(event.date).getFullYear();
        const config = semesterConfigs.find(c => c.year === year);
        if (!config) return;

        const targetSemester = discipline.scheduling_criteria.semester;
        const eventDateStr = event.date; // ISO format

        const s1Start = config.s1Start;
        const s1End = config.s1End;
        const s2Start = config.s2Start;
        const s2End = config.s2End;

        let isOutside = false;
        let periodStr = "";

        if (targetSemester === 1) {
            if (s1Start && s1End) {
                isOutside = eventDateStr < s1Start || eventDateStr > s1End;
                periodStr = `S1: ${s1Start} a ${s1End}`;
            }
        } else if (targetSemester === 2) {
            if (s2Start && s2End) {
                isOutside = eventDateStr < s2Start || eventDateStr > s2End;
                periodStr = `S2: ${s2Start} a ${s2End}`;
            }
        }

        if (isOutside) {
            conflicts.push({
                type: 'restriction',
                severity: 'warning',
                message: `Fora do Semestre: ${discipline.name} (${event.classId}) deve ser no ${targetSemester}º semestre (${periodStr})`,
                events: [event],
                classId: event.classId,
                year: discipline.year,
                date: event.date,
                timeSlot: event.startTime
            });
        }
    });

    // Check for academic blocks violation
    events.forEach(event => {
        const isAcad = event.type === 'ACADEMIC' || event.disciplineId === 'ACADEMIC';
        if (!isAcad && academicBlocks.has(event.date)) {
            const academicEvent = events.find(e => e.date === event.date && (e.type === 'ACADEMIC' || e.disciplineId === 'ACADEMIC') && (e.isBlocking !== false));
            if (academicEvent) {
                conflicts.push({
                    type: 'restriction',
                    severity: 'error',
                    message: `Dia Bloqueado: ${event.classId} tem aula em dia não programável (${academicEvent?.location})`,
                    events: [event],
                    classId: event.classId,
                    year: parseInt(event.classId.charAt(0)) || undefined,
                    date: event.date,
                    timeSlot: event.startTime
                });
            }
        }
    });

    // Check for overlaps (same class, same time)
    eventsBySlot.forEach((slotEvents) => {
        const classesBySlot = new Map<string, ScheduleEvent[]>();

        slotEvents.forEach(event => {
            // Check if classId conflicts with any existing
            for (const [existingClass, existingEvents] of classesBySlot.entries()) {
                // Same class
                if (event.classId === existingClass) {
                    conflicts.push({
                        type: 'overlap',
                        severity: 'error',
                        message: `Sobreposição: Turma ${event.classId} tem múltiplas aulas no mesmo horário`,
                        events: [...existingEvents, event],
                        classId: event.classId,
                        year: parseInt(event.classId.charAt(0)) || undefined,
                        date: event.date,
                        timeSlot: event.startTime
                    });
                }

                // ESQ conflicts with specific classes
                if (event.classId.endsWith('ESQ')) {
                    const squadron = event.classId.charAt(0);
                    if (existingClass.startsWith(squadron)) {
                        conflicts.push({
                            type: 'overlap',
                            severity: 'error',
                            message: `Conflito ESQ: Aula geral do ${squadron}º Esquadrão conflita com aula da turma ${existingClass}`,
                            events: [...existingEvents, event],
                            classId: existingClass,
                            year: parseInt(existingClass.charAt(0)) || undefined,
                            date: event.date,
                            timeSlot: event.startTime
                        });
                    }
                } else if (existingClass.endsWith('ESQ')) {
                    const squadron = existingClass.charAt(0);
                    if (event.classId.startsWith(squadron)) {
                        conflicts.push({
                            type: 'overlap',
                            severity: 'error',
                            message: `Conflito ESQ: Aula da turma ${event.classId} conflita com aula geral do ${squadron}º Esquadrão`,
                            events: [...existingEvents, event],
                            classId: event.classId,
                            year: parseInt(event.classId.charAt(0)) || undefined,
                            date: event.date,
                            timeSlot: event.startTime
                        });
                    }
                }
            }

            const classList = classesBySlot.get(event.classId) || [];
            classList.push(event);
            classesBySlot.set(event.classId, classList);
        });
    });

    // Check for load violations (more classes than load_hours)
    // Agrupa por Disciplina E Turma para evitar soma global incorreta
    const eventsByDisciplineAndClass = new Map<string, ScheduleEvent[]>();
    events.forEach(event => {
        const key = `${event.disciplineId}_${event.classId}`;
        const existing = eventsByDisciplineAndClass.get(key) || [];
        existing.push(event);
        eventsByDisciplineAndClass.set(key, existing);
    });

    eventsByDisciplineAndClass.forEach((discEvents, key) => {
        const [disciplineId, classId] = key.split('_');
        const discipline = disciplines.find(d => d.id === disciplineId);
        if (!discipline) return;

        const hoursPerClass = 1;
        const allocatedHours = discEvents.length * hoursPerClass;

        let expectedHours = discipline.load_hours || 0;
        if (discipline.ppcLoads) {
            // Check if classId starts with a number (e.g. 1A, 2B)
            const yearMatch = classId.match(/^(\d)/);
            const classYear = yearMatch ? yearMatch[1] : null;
            if (classYear) {
                const loadsForYear = Object.entries(discipline.ppcLoads)
                    .filter(([k]) => k.endsWith(`_${classYear}`))
                    .map(([, load]) => load);
                if (loadsForYear.length > 0) {
                    expectedHours = Math.max(...loadsForYear);
                }
            }
        }

        if (allocatedHours > expectedHours * 1.1) { // 10% tolerance
            conflicts.push({
                type: 'overload',
                severity: 'warning',
                message: `Carga horária excedida: "${discipline.name}" tem ${allocatedHours.toFixed(1)}h alocadas na turma ${classId} mas o previsto máximo é ${expectedHours}h`,
                events: discEvents,
                disciplineId: discipline.id,
                classId: classId,
                year: parseInt(classId.charAt(0)) || discipline.year,
                timeSlot: 'Total'
            });
        }
    });

    return conflicts;
}
