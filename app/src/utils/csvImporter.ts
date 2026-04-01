import type { ScheduleEvent, Discipline } from "../types";
import { TIME_SLOTS } from "./constants";

export const parseCsvToEvents = (
  csvContent: string,
  disciplines: Discipline[],
  squadron: number = 1,
): ScheduleEvent[] => {
  const lines = csvContent.split("\n");
  const events: ScheduleEvent[] = [];

  // Header: Data,Turma,Tempo,Materia
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const [dateStr, classLetter, tempoStr, materiaCode] = line.split(",");

    if (!dateStr || !classLetter || !tempoStr || !materiaCode) continue;

    // 1. Format Date: DD/MM/YYYY -> YYYY-MM-DD
    const [day, month, year] = dateStr.split("/");
    const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

    // 2. Class ID: e.g. "A" -> "1A"
    const classId = `${squadron}${classLetter}`;

    // 3. Time Slot: 1-8 -> TIME_SLOTS index 0-7
    const tempoIdx = parseInt(tempoStr) - 1;
    const slot = TIME_SLOTS[tempoIdx];
    if (!slot) continue;

    // 4. Discipline ID: Map Materia Code to Discipline.id
    // Try exact match on code, then on name/id
    const discipline = disciplines.find(
      (d) => d.code === materiaCode || d.id === materiaCode,
    );

    if (!discipline) {
      console.warn(`Disciplina não encontrada para o código: ${materiaCode}`);
      // If discipline not found, we might want to log it or skip
      // For now, skip to avoid invalid events
      continue;
    }

    events.push({
      id: crypto.randomUUID(),
      disciplineId: discipline.id,
      classId: classId,
      date: isoDate,
      startTime: slot.start,
      endTime: slot.end,
      location: discipline.location || "",
      type: "CLASS",
      color: discipline.color,
      targetSquadron: squadron as any,
      targetClass: classLetter,
    });
  }

  return events;
};
