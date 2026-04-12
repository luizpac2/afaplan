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

export interface ConflictSuggestion {
    label: string;       // Texto curto para exibir no botão
    action: 'navigate' | 'info';
    payload?: string;    // URL de navegação ou texto informativo
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
    suggestions?: ConflictSuggestion[];
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
 * Detect conflicts in current schedule.
 *
 * Key design decisions:
 * - classId values may be arbitrary strings (UUID, numeric string like "1", "2", or legacy "1A").
 *   The engine does NOT assume any particular format beyond what is stored in each event.
 * - Two CLASS/EVALUATION events overlap when they share the same classId AND the same
 *   (date, startTime). We generate exactly ONE conflict entry per unique pair of overlapping
 *   events to avoid exponential duplicates.
 * - ACADEMIC events with isBlocking !== false block every non-ACADEMIC event on that date.
 * - Instructor conflicts: if two events on the same slot share the same instructorTrigram,
 *   that instructor is double-booked.
 */
export function detectConflicts(
    events: ScheduleEvent[],
    disciplines: Discipline[],
    semesterConfigs: SemesterConfig[] = []
): Conflict[] {
    const conflicts: Conflict[] = [];

    // ── Pre-processing ────────────────────────────────────────────────────────
    // Separate academic blocking events from regular class events.
    const academicBlockingDates = new Map<string, ScheduleEvent>(); // date -> first blocking ACADEMIC event
    const classEvents: ScheduleEvent[] = [];

    events.forEach(event => {
        const isAcad = event.type === 'ACADEMIC' || event.disciplineId === 'ACADEMIC';
        if (isAcad) {
            if (event.isBlocking !== false && !academicBlockingDates.has(event.date)) {
                academicBlockingDates.set(event.date, event);
            }
            return;
        }
        classEvents.push(event);
    });

    // ── 1. Overlap detection ──────────────────────────────────────────────────
    // Group class events by (date, startTime, classId). If a group has >1 event,
    // there is an overlap. We use a Set of pair-keys to avoid duplicate conflict entries.
    const overlapSeen = new Set<string>();
    const slotMap = new Map<string, ScheduleEvent[]>(); // key = date_startTime_classId

    classEvents.forEach(event => {
        const key = `${event.date}_${event.startTime}_${event.classId}`;
        const group = slotMap.get(key) ?? [];
        group.push(event);
        slotMap.set(key, group);
    });

    slotMap.forEach((group, key) => {
        if (group.length < 2) return;

        // One conflict per slot+class, referencing all overlapping events
        if (!overlapSeen.has(key)) {
            overlapSeen.add(key);
            const ev = group[0];
            const discipline1 = disciplines.find(d => d.id === group[0].disciplineId);
            const discipline2 = disciplines.find(d => d.id === group[1].disciplineId);
            const d1Name = discipline1?.name ?? group[0].disciplineId;
            const d2Name = discipline2?.name ?? group[1].disciplineId;
            conflicts.push({
                type: 'overlap',
                severity: 'error',
                message: `Sobreposição: turma ${ev.classId} tem ${group.length} aulas no mesmo horário (${ev.date} ${ev.startTime}) — "${d1Name}" e "${d2Name}"`,
                events: group,
                classId: ev.classId,
                date: ev.date,
                timeSlot: ev.startTime,
                suggestions: [
                    {
                        label: 'Reagendar 1ª aula',
                        action: 'info',
                        payload: `Remova ou mova "${d1Name}" (${ev.classId}, ${ev.date} ${ev.startTime}) para outro horário livre.`
                    },
                    {
                        label: 'Reagendar 2ª aula',
                        action: 'info',
                        payload: `Remova ou mova "${d2Name}" (${ev.classId}, ${ev.date} ${ev.startTime}) para outro horário livre.`
                    }
                ]
            });
        }
    });

    // ── 2. Instructor double-booking ──────────────────────────────────────────
    const instructorSlotMap = new Map<string, ScheduleEvent[]>(); // key = date_startTime_trigram
    classEvents.forEach(event => {
        if (!event.instructorTrigram) return;
        const key = `${event.date}_${event.startTime}_${event.instructorTrigram}`;
        const group = instructorSlotMap.get(key) ?? [];
        group.push(event);
        instructorSlotMap.set(key, group);
    });

    instructorSlotMap.forEach((group) => {
        if (group.length < 2) return;
        const ev = group[0];
        const trigram = ev.instructorTrigram!;
        const d1 = disciplines.find(d => d.id === group[0].disciplineId)?.name ?? group[0].disciplineId;
        const d2 = disciplines.find(d => d.id === group[1].disciplineId)?.name ?? group[1].disciplineId;
        conflicts.push({
            type: 'overlap',
            severity: 'error',
            message: `Docente duplo: ${trigram} está escalado em ${group.length} turmas simultaneamente (${ev.date} ${ev.startTime}) — "${d1}" e "${d2}"`,
            events: group,
            classId: group.map(e => e.classId).join('/'),
            date: ev.date,
            timeSlot: ev.startTime,
            suggestions: [
                {
                    label: 'Substituir docente',
                    action: 'info',
                    payload: `Atribua outro docente habilitado em "${d2}" para a turma ${group[1].classId} no horário ${ev.date} ${ev.startTime}.`
                },
                {
                    label: 'Reagendar uma aula',
                    action: 'info',
                    payload: `Mova uma das aulas de ${trigram} para um horário em que ele esteja livre.`
                }
            ]
        });
    });

    // ── 3. Academic block violations ──────────────────────────────────────────
    classEvents.forEach(event => {
        const blockEvent = academicBlockingDates.get(event.date);
        if (!blockEvent) return;
        const blockLabel = blockEvent.location ?? blockEvent.description ?? 'Evento Acadêmico';
        const discipline = disciplines.find(d => d.id === event.disciplineId);
        const discName = discipline?.name ?? event.disciplineId;
        conflicts.push({
            type: 'restriction',
            severity: 'error',
            message: `Dia bloqueado: "${discName}" (${event.classId}) está agendada em ${event.date} que é um dia não-programável — "${blockLabel}"`,
            events: [event],
            classId: event.classId,
            date: event.date,
            timeSlot: event.startTime,
            suggestions: [
                {
                    label: 'Mover aula',
                    action: 'navigate',
                    payload: `/programming/${event.classId}?date=${event.date}`
                },
                {
                    label: 'Remover bloqueio',
                    action: 'info',
                    payload: `Acesse o Calendário Acadêmico e remova o bloqueio em ${event.date} se ele estiver incorreto.`
                }
            ]
        });
    });

    // ── 4. Semester restriction violations ───────────────────────────────────
    classEvents.forEach(event => {
        const discipline = disciplines.find(d => d.id === event.disciplineId);
        if (!discipline?.scheduling_criteria?.semester) return;

        const year = new Date(event.date).getFullYear();
        const config = semesterConfigs.find(c => c.year === year);
        if (!config) return;

        const targetSem = discipline.scheduling_criteria.semester;
        const dateStr = event.date;
        let isOutside = false;
        let periodStr = '';

        if (targetSem === 1 && config.s1Start && config.s1End) {
            isOutside = dateStr < config.s1Start || dateStr > config.s1End;
            periodStr = `1º sem: ${config.s1Start} a ${config.s1End}`;
        } else if (targetSem === 2 && config.s2Start && config.s2End) {
            isOutside = dateStr < config.s2Start || dateStr > config.s2End;
            periodStr = `2º sem: ${config.s2Start} a ${config.s2End}`;
        }

        if (!isOutside) return;

        conflicts.push({
            type: 'restriction',
            severity: 'warning',
            message: `Semestre incorreto: "${discipline.name}" (${event.classId}) está em ${dateStr} mas deveria ser no ${targetSem}º semestre (${periodStr})`,
            events: [event],
            classId: event.classId,
            year: discipline.year,
            date: event.date,
            timeSlot: event.startTime,
            suggestions: [
                {
                    label: 'Mover para período correto',
                    action: 'navigate',
                    payload: `/programming/${event.classId}?date=${event.date}`
                },
                {
                    label: 'Revisar Ficha Informativa',
                    action: 'info',
                    payload: `Acesse a Ficha Informativa de "${discipline.name}" e confirme a restrição de semestre.`
                }
            ]
        });
    });

    // ── 5. Overload detection ─────────────────────────────────────────────────
    // Group by disciplineId + classId and count sessions (1 session = 1 hour).
    // Skip ACADEMIC events — they were already filtered into classEvents above.
    const loadMap = new Map<string, ScheduleEvent[]>();
    classEvents.forEach(event => {
        const key = `${event.disciplineId}__${event.classId}`;
        const list = loadMap.get(key) ?? [];
        list.push(event);
        loadMap.set(key, list);
    });

    loadMap.forEach((discEvents, key) => {
        const sepIdx = key.indexOf('__');
        const disciplineId = key.slice(0, sepIdx);
        const classId = key.slice(sepIdx + 2);
        const discipline = disciplines.find(d => d.id === disciplineId);
        if (!discipline) return;

        const allocatedHours = discEvents.length; // 1 event = 1 hour

        // Determine expected hours — use ppcLoads if available
        let expectedHours = discipline.load_hours ?? 0;
        if (discipline.ppcLoads && expectedHours === 0) {
            const allLoads = Object.values(discipline.ppcLoads).filter(v => typeof v === 'number') as number[];
            if (allLoads.length > 0) expectedHours = Math.max(...allLoads);
        }

        if (expectedHours <= 0) return; // No reference — can't determine overload

        const tolerance = 1.1; // 10% buffer
        if (allocatedHours <= expectedHours * tolerance) return;

        const excess = allocatedHours - expectedHours;
        conflicts.push({
            type: 'overload',
            severity: 'warning',
            message: `Carga excedida: "${discipline.name}" tem ${allocatedHours}h alocadas na turma ${classId} (previsto: ${expectedHours}h, excesso: ${excess}h)`,
            events: discEvents,
            disciplineId: discipline.id,
            classId,
            year: discipline.year,
            timeSlot: 'Total',
            suggestions: [
                {
                    label: 'Remover aulas excedentes',
                    action: 'navigate',
                    payload: `/programming/${classId}`
                },
                {
                    label: 'Ajustar carga na Ficha',
                    action: 'info',
                    payload: `Acesse a Ficha Informativa de "${discipline.name}" e corrija a carga horária prevista se o PPC foi atualizado.`
                }
            ]
        });
    });

    return conflicts;
}
