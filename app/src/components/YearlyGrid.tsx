import React, { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "../contexts/ThemeContext";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  X,
  Plus,
  Save,
  Printer,
  Trash2,
} from "lucide-react";
import type { ScheduleEvent } from "../types";
import { useCourseStore } from "../store/useCourseStore";
import {
  formatDate,
  createDateFromISO,
  getDayOfYear,
  getWeekNumber,
} from "../utils/dateUtils";
import { PrintableMonthlyCalendar } from "./PrintableMonthlyCalendar";
import { getCohortColorTokens } from "../utils/cohortColors";

interface YearlyGridProps {
  year: number;
  events: ScheduleEvent[];
  initialSquadron?: number | "ALL";
  readOnly?: boolean;
}

const MONTHS = [
  { name: "Janeiro", days: 31 },
  { name: "Fevereiro", days: 28 },
  { name: "Março", days: 31 },
  { name: "Abril", days: 30 },
  { name: "Maio", days: 31 },
  { name: "Junho", days: 30 },
  { name: "Julho", days: 31 },
  { name: "Agosto", days: 31 },
  { name: "Setembro", days: 30 },
  { name: "Outubro", days: 31 },
  { name: "Novembro", days: 30 },
  { name: "Dezembro", days: 31 },
];

const DAYS_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const SQUADRONS = [1, 2, 3, 4] as const;

type ColumnKey = "ALL" | 1 | 2 | 3 | 4;

export const YearlyGrid: React.FC<YearlyGridProps> = ({
  year,
  events,
  readOnly = false,
}) => {
  const { theme } = useTheme();
  const { addEvent, addBatchEvents, deleteEvent, deleteBatchEvents, cohorts } =
    useCourseStore();
  const [currentMonthIndex, setCurrentMonthIndex] = useState(
    new Date().getMonth(),
  );
  const [printMode, setPrintMode] = useState<"MONTH" | "YEAR">("MONTH");
  const [printTrigger, setPrintTrigger] = useState(0);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    day: number;
    squadron: ColumnKey;
    event?: ScheduleEvent;
    blockStart?: string;
    blockEnd?: string;
  } | null>(null);
  const [detailEvent, setDetailEvent] = useState<ScheduleEvent | null>(null);

  // Ajuste para ano bissexto
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const currentMonths = MONTHS.map((m, i) =>
    i === 1 ? { ...m, days: isLeapYear ? 29 : 28 } : m,
  );

  const currentMonth = currentMonths[currentMonthIndex];

  const yearEvents = useMemo(() => {
    return events
      .filter((e) => {
        const isAcad =
          e.type === "ACADEMIC" ||
          e.disciplineId === "ACADEMIC" ||
          e.type === "EVALUATION";
        if (!isAcad) return false;
        const eventDate = new Date(e.date + "T00:00:00");
        return eventDate.getFullYear() === year;
      })
      .map((e) => {
        if (e.type === "EVALUATION") {
          const sq = parseInt(e.classId?.charAt(0) || "");
          let tCourse = e.targetCourse || "ALL";
          let tClass = e.targetClass || "ALL";

          if (e.classId) {
            if (e.classId.includes("AVIATION")) tCourse = "AVIATION";
            else if (e.classId.includes("INTENDANCY")) tCourse = "INTENDANCY";
            else if (e.classId.includes("INFANTRY")) tCourse = "INFANTRY";
            else {
              const letter = e.classId.slice(1).toUpperCase();
              if (["A", "B", "C", "D"].includes(letter)) tCourse = "AVIATION";
              else if (letter === "E") tCourse = "INTENDANCY";
              else if (letter === "F") tCourse = "INFANTRY";

              if (
                letter &&
                letter !== "E" &&
                letter !== "S" &&
                letter !== "Q"
              ) {
                tClass = letter;
              }
            }
          }

          const disc = useCourseStore
            .getState()
            .disciplines.find((d) => d.id === e.disciplineId);
          const evalTypeMap: Record<string, string> = {
            PARTIAL: "Parcial",
            EXAM: "Exame",
            FINAL: "Prova Final",
            SECOND_CHANCE: "2ª Época",
            REVIEW: "Vista",
          };
          const typeStr = e.evaluationType
            ? evalTypeMap[e.evaluationType] || e.evaluationType
            : "Avaliação";
          const loc = `[${typeStr}] ${disc ? disc.code : ""}`;

          return {
            ...e,
            targetSquadron: !isNaN(sq) ? (sq as any) : "ALL",
            targetCourse: tCourse as any,
            targetClass: tClass,
            location: loc,
          };
        }
        return e;
      });
  }, [events, year]);

  const monthEvents = useMemo(() => {
    return yearEvents.filter((e) => {
      const eventDate = new Date(e.date + "T00:00:00");
      return eventDate.getMonth() === currentMonthIndex;
    });
  }, [yearEvents, currentMonthIndex]);

  // Lógica de Processamento da Grade
  const gridData = useMemo(() => {
    const columns: ColumnKey[] = ["ALL", ...SQUADRONS];

    // 1. Organizar agrupamentos contínuos processados a partir do ano inteiro
    // Pre-calcular o dayIndex e totalDays usando todos os eventos do ano
    const yearFingerprintMap: Record<string, ScheduleEvent[]> = {};

    yearEvents.forEach((event) => {
      const target = event.targetSquadron || "ALL";
      const fingerprint = `${target}-${event.location}-${event.isBlocking}-${event.type}-${event.targetCourse || "ALL"}`;
      if (!yearFingerprintMap[fingerprint])
        yearFingerprintMap[fingerprint] = [];
      yearFingerprintMap[fingerprint].push(event);
    });

    // Ordenamos os arrays de fingerprint por data para poder dar o contador de sequencia e quebras
    const eventEnhancements = new Map<
      string,
      { isStart: boolean; isEnd: boolean; dayIndex: number; totalDays: number }
    >();

    Object.values(yearFingerprintMap).forEach((group) => {
      // Sort por data
      group.sort((a, b) => a.date.localeCompare(b.date));

      if (group.length === 0) return;

      // Agrupa sequências sub-bloco contínuas
      let currentSubgroupStart = 0;
      for (let i = 0; i < group.length; i++) {
        const currentEvent = group[i];
        const nextEvent = group[i + 1];

        // Considera quebra se a próxima data tiver uma diferença maior que 1 dia
        let isBreak = false;
        if (nextEvent) {
          const currDate = new Date(currentEvent.date + "T00:00:00");
          const nextDate = new Date(nextEvent.date + "T00:00:00");
          const diffTime = Math.abs(nextDate.getTime() - currDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 1) {
            isBreak = true;
          }
        } else {
          isBreak = true; // last event is always a break
        }

        if (isBreak) {
          // Nós finalizamos um bloco contínuo de currentSubgroupStart até i
          const totalDays = i - currentSubgroupStart + 1;
          for (let j = currentSubgroupStart; j <= i; j++) {
            const evt = group[j];
            eventEnhancements.set(evt.id, {
              isStart: j === currentSubgroupStart,
              isEnd: j === i,
              dayIndex: j - currentSubgroupStart + 1,
              totalDays,
            });
          }
          currentSubgroupStart = i + 1; // start of next potential sequence
        }
      }
    });

    // 2. Agora organizar a grade APENAS para o monthEvents com os dados aprimorados já aplicados
    const rawMonthGrid: Record<number, Record<ColumnKey, ScheduleEvent[]>> = {};
    for (let d = 1; d <= currentMonth.days; d++) {
      rawMonthGrid[d] = { ALL: [], 1: [], 2: [], 3: [], 4: [] };
    }

    monthEvents.forEach((event) => {
      const day = parseInt(event.date.split("-")[2]);
      const target = (event.targetSquadron || "ALL") as ColumnKey;
      if (rawMonthGrid[day]) {
        rawMonthGrid[day][target].push(event);
      }
    });

    type ProcessedCell = {
      events: (ScheduleEvent & {
        isStart?: boolean;
        isEnd?: boolean;
        dayIndex?: number;
        totalDays?: number;
      })[];
    };
    const processedGrid: Record<number, Record<ColumnKey, ProcessedCell>> = {};

    columns.forEach((col) => {
      for (let d = 1; d <= currentMonth.days; d++) {
        if (!processedGrid[d])
          processedGrid[d] = {
            ALL: { events: [] },
            1: { events: [] },
            2: { events: [] },
            3: { events: [] },
            4: { events: [] },
          };

        const currentDayEvents = rawMonthGrid[d][col];

        const enhancedEvents = currentDayEvents.map((event) => {
          const enhancement = eventEnhancements.get(event.id);
          return {
            ...event,
            isStart: enhancement?.isStart ?? true,
            isEnd: enhancement?.isEnd ?? true,
            dayIndex: enhancement?.dayIndex ?? 1,
            totalDays: enhancement?.totalDays ?? 1,
          };
        });

        processedGrid[d][col] = {
          events: enhancedEvents,
        };
      }
    });

    return processedGrid;
  }, [yearEvents, monthEvents, currentMonth]);

  // Mapeamento de cores dinâmico por Esquadrão
  const squadronInfo = useMemo(() => {
    const mapping: Record<number, { colors: any; name: string }> = {};
    SQUADRONS.forEach((s) => {
      const entryYearForSquadron = year - s + 1;
      const cohort = cohorts.find(
        (c) => Number(c.entryYear) === entryYearForSquadron,
      );

      if (cohort) {
        const tokens = getCohortColorTokens(cohort.color || "blue");
        mapping[s] = {
          colors: tokens,
          name: cohort.name,
        };
      } else {
        const defaultColors: Record<number, any> = {
          1: {
            primary: "#2563eb",
            light: "#dbeafe",
            dark: "#1e40af",
            name: "Azul",
          },
          2: {
            primary: "#dc2626",
            light: "#fee2e2",
            dark: "#b91c1c",
            name: "Vermelho",
          },
          3: {
            primary: "#16a34a",
            light: "#dcfce7",
            dark: "#15803d",
            name: "Verde",
          },
          4: {
            primary: "#eab308",
            light: "#fef9c3",
            dark: "#a16207",
            name: "Amarelo",
          },
        };
        mapping[s] = {
          colors: defaultColors[s],
          name: "",
        };
      }
    });
    return mapping;
  }, [year, cohorts]);

  const handlePrevMonth = () =>
    setCurrentMonthIndex((prev) => (prev === 0 ? 11 : prev - 1));
  const handleNextMonth = () =>
    setCurrentMonthIndex((prev) => (prev === 11 ? 0 : prev + 1));

  const getEventBlock = (targetEvent: ScheduleEvent): ScheduleEvent[] => {
    const fingerprint = `${targetEvent.targetSquadron || "ALL"}-${targetEvent.location}-${targetEvent.isBlocking}-${targetEvent.type}-${targetEvent.targetCourse || "ALL"}`;

    // Pega todos com o mesmo fingerprint e ordena por data
    const group = yearEvents
      .filter((e) => {
        return (
          `${e.targetSquadron || "ALL"}-${e.location}-${e.isBlocking}-${e.type}-${e.targetCourse || "ALL"}` ===
          fingerprint
        );
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    if (group.length === 0) return [targetEvent];

    let currentSubgroupStart = 0;
    let targetBlock: ScheduleEvent[] = [targetEvent];

    for (let i = 0; i < group.length; i++) {
      const currentEvent = group[i];
      const nextEvent = group[i + 1];

      let isBreak = false;
      if (nextEvent) {
        const currDate = new Date(currentEvent.date + "T00:00:00");
        const nextDate = new Date(nextEvent.date + "T00:00:00");
        const diffTime = Math.abs(nextDate.getTime() - currDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 1) {
          isBreak = true;
        }
      } else {
        isBreak = true;
      }

      if (isBreak) {
        const block = group.slice(currentSubgroupStart, i + 1);
        if (block.some((e) => e.id === targetEvent.id)) {
          targetBlock = block;
          break;
        }
        currentSubgroupStart = i + 1;
      }
    }
    return targetBlock;
  };

  const handleCellClick = (
    day: number,
    squadron: ColumnKey,
    event?: ScheduleEvent,
  ) => {
    if (readOnly) return;

    let blockStart = "";
    let blockEnd = "";

    if (event) {
      const block = getEventBlock(event);
      if (block.length > 0) {
        blockStart = block[0].date;
        blockEnd = block[block.length - 1].date;
      } else {
        blockStart = event.date;
        blockEnd = event.date;
      }
    }

    setSelectedCell({ day, squadron, event, blockStart, blockEnd });
    setIsModalOpen(true);
  };

  const handleSaveQuickEvent = (
    title: string,
    isBlocking: boolean,
    color: string,
    endDateStr?: string,
    targetCourse: string = "ALL",
    targetClass: string = "ALL",
    manualStartDate?: string,
    descriptionDetail?: string,
  ) => {
    if (!selectedCell) return;

    const startDateStr =
      manualStartDate ||
      `${year}-${(currentMonthIndex + 1).toString().padStart(2, "0")}-${selectedCell.day.toString().padStart(2, "0")}`;

    const start = createDateFromISO(startDateStr);
    const end = endDateStr ? createDateFromISO(endDateStr) : start;

    if (end < start) {
      alert("A data final deve ser igual ou posterior à data inicial.");
      return;
    }

    // SE ESTIVER EDITANDO UM EVENTO EXISTENTE, VAMOS APAGAR A FITA INTEIRA PARA RECRIÁ-LA NO NOVO FORMATO
    if (selectedCell.event) {
      const block = getEventBlock(selectedCell.event);
      const deleteIds = block.map((e) => e.id);
      if (deleteIds.length > 1) {
        deleteBatchEvents(deleteIds);
      } else if (deleteIds.length === 1) {
        deleteEvent(deleteIds[0]);
      }
    }

    // CRAFT EVENTS LOOP
    const newEvents: ScheduleEvent[] = [];
    const current = new Date(start);
    while (current <= end) {
      const dateStr = formatDate(current);
      const newEvent: ScheduleEvent = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 11),
        date: dateStr,
        disciplineId: "ACADEMIC",
        classId:
          selectedCell.squadron === "ALL"
            ? "Geral"
            : `${selectedCell.squadron}ESQ`,
        startTime: "00:00",
        endTime: "23:59",
        type: "ACADEMIC",
        location: title,
        description: descriptionDetail,
        isBlocking,
        color,
        targetSquadron: selectedCell.squadron,
        targetCourse: targetCourse as any,
        targetClass: targetClass as any,
      };
      newEvents.push(newEvent);
      current.setDate(current.getDate() + 1);
    }

    if (newEvents.length > 0) {
      if (newEvents.length > 1) {
        addBatchEvents(newEvents);
      } else {
        addEvent(newEvents[0]);
      }
    }

    setIsModalOpen(false);
    setSelectedCell(null);
  };

  const handleEventDrop = (
    eventId: string,
    grabbedDayIndex: number,
    dropDay: number,
    targetSquadron: ColumnKey,
  ) => {
    if (readOnly) return;

    const targetEvent = yearEvents.find((e) => e.id === eventId);
    if (!targetEvent) return;

    const block = getEventBlock(targetEvent);
    if (!block || block.length === 0) return;

    const dropDate = new Date(year, currentMonthIndex, dropDay);
    const startDate = new Date(dropDate);
    startDate.setDate(startDate.getDate() - (grabbedDayIndex - 1));

    const deleteIds = block.map((e) => e.id);
    if (deleteIds.length > 1) {
      deleteBatchEvents(deleteIds);
    } else if (deleteIds.length === 1) {
      deleteEvent(deleteIds[0]);
    }

    const newEvents: ScheduleEvent[] = [];
    const current = new Date(startDate);
    for (let i = 0; i < block.length; i++) {
      const dateStr = formatDate(current);
      const newEvent: ScheduleEvent = {
        ...targetEvent,
        id: crypto.randomUUID(),
        date: dateStr,
        classId: targetSquadron === "ALL" ? "Geral" : `${targetSquadron}ESQ`,
        targetSquadron: targetSquadron === "ALL" ? undefined : targetSquadron,
      };
      newEvents.push(newEvent);
      current.setDate(current.getDate() + 1);
    }

    if (newEvents.length > 0) {
      addBatchEvents(newEvents);
    }
  };

  const handleDeleteQuickEvent = () => {
    if (!selectedCell?.event) return;

    const block = getEventBlock(selectedCell.event);
    const deleteIds = block.map((e) => e.id);

    if (
      window.confirm(
        `Tem certeza que deseja excluir este evento? (${deleteIds.length} dia(s) serão removidos)`,
      )
    ) {
      if (deleteIds.length > 1) {
        deleteBatchEvents(deleteIds);
      } else {
        deleteEvent(deleteIds[0]);
      }

      setIsModalOpen(false);
      setSelectedCell(null);
    }
  };

  return (
    <div className="space-y-6 pt-4 px-4 md:px-6">
      {/* Header com Navegação */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3
            className={`text-xl  uppercase tracking-tighter ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
          >
            {currentMonth.name} <span className="text-blue-500 ">{year}</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              flushSync(() => {
                setPrintMode("MONTH");
                setPrintTrigger((prev) => prev + 1);
              });
              setTimeout(() => window.print(), 100);
            }}
            className={`p-2 px-4 rounded-xl border transition-all text-sm  flex items-center gap-2 mr-2 ${theme === "dark" ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"}`}
            title="Imprimir mês atual em A4"
          >
            <Printer size={18} />
            <span className="hidden sm:inline">Imprimir Mês</span>
          </button>
          <button
            onClick={() => {
              flushSync(() => {
                setPrintMode("YEAR");
                setPrintTrigger((prev) => prev + 1);
              });
              setTimeout(() => window.print(), 100);
            }}
            className={`p-2 px-4 rounded-xl border transition-all text-sm  flex items-center gap-2 mr-2 ${theme === "dark" ? "bg-blue-900 border-blue-700 hover:bg-blue-800 text-blue-100" : "bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700"}`}
            title="Imprimir todos os 12 meses do ano"
          >
            <Printer size={18} />
            <span className="hidden sm:inline">Imprimir Ano</span>
          </button>
          <button
            onClick={handlePrevMonth}
            className={`p-2 rounded-xl border transition-all ${theme === "dark" ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-400" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"}`}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={handleNextMonth}
            className={`p-2 rounded-xl border transition-all ${theme === "dark" ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-400" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"}`}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Planilha Vertical com RowSpan */}
      <div
        className={`rounded-2xl border shadow-xl overflow-hidden ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-300"}`}
      >
        <div className="overflow-x-auto relative">
          <table className="w-full border-collapse relative table-fixed">
            <thead className="sticky top-0 z-30">
              <tr
                className={`${theme === "dark" ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}
              >
                <th
                  className={`p-3 border-r border-b text-[10px]  uppercase tracking-wider w-[65px] text-center sticky left-0 z-40 ${theme === "dark" ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800"}`}
                >
                  Data
                </th>
                <th
                  className={`p-3 border-r border-b text-[10px]  uppercase tracking-wider w-[40px] text-center sticky left-[65px] z-40 ${theme === "dark" ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800"}`}
                >
                  Sem
                </th>
                <th
                  className={`p-3 border-r border-b text-[10px]  uppercase tracking-wider w-[16%] ${theme === "dark" ? "bg-slate-600 text-slate-50" : "bg-slate-300 text-slate-800"}`}
                >
                  Todos
                </th>
                {SQUADRONS.map((s) => {
                  const { colors, name } = squadronInfo[s];
                  const squadronLabel = name
                    ? `${name} - ${s}º ESQ`
                    : `${s}º ESQ`;
                  return (
                    <th
                      key={s}
                      className={`p-3 border-r border-b text-[10px]  uppercase tracking-wider w-[18%] transition-colors`}
                      style={{
                        backgroundColor:
                          theme === "dark"
                            ? `${colors.primary}70`
                            : `${colors.primary}30`,
                        color: theme === "dark" ? "white" : colors.dark,
                      }}
                    >
                      {squadronLabel}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: currentMonth.days }).map((_, i) => {
                const day = i + 1;
                const date = new Date(year, currentMonthIndex, day);
                const dayOfWeek = date.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isSunday = dayOfWeek === 0;
                const isSaturday = dayOfWeek === 6;

                const rowBg = isSunday
                  ? theme === "dark"
                    ? "bg-blue-900/20"
                    : "bg-blue-50/50"
                  : isSaturday
                    ? theme === "dark"
                      ? "bg-slate-800/60"
                      : "bg-slate-100/50"
                    : theme === "dark"
                      ? "bg-slate-900"
                      : "bg-white";

                const dayOfYear = getDayOfYear(date);
                const weekNum = getWeekNumber(date);

                return (
                  <tr
                    key={day}
                    className={`border-b-2 ${theme === "dark" ? "border-slate-800/80 hover:bg-slate-800/20" : "border-slate-200/60 hover:bg-blue-50/30"} transition-colors`}
                  >
                    <td
                      className={`p-2 border-r-2 text-center sticky left-0 z-20 ${rowBg} ${theme === "dark" ? "border-slate-800/80" : "border-slate-200/60"}`}
                    >
                      <div className="flex flex-col items-center">
                        <span
                          className={`text-sm  leading-tight ${isWeekend ? "text-blue-500" : theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
                        >
                          {day.toString().padStart(2, "0")} /{" "}
                          {(currentMonthIndex + 1).toString().padStart(2, "0")}
                        </span>
                        <div className="flex flex-col text-[8px]  opacity-60 uppercase mt-0.5 leading-none">
                          <span>Dia {dayOfYear}</span>
                          <span>Sem {weekNum}</span>
                        </div>
                      </div>
                    </td>

                    <td
                      className={`p-2 border-r-2 text-center text-[10px]  sticky left-[65px] z-20 ${isWeekend ? "text-blue-400" : "opacity-40"} ${rowBg} ${theme === "dark" ? "border-slate-800/80" : "border-slate-200/60"}`}
                    >
                      {DAYS_SHORT[dayOfWeek]}
                    </td>

                    {/* Coluna Geral / Informativo */}
                    {(() => {
                      const hasBlockingAll = gridData[day]["ALL"]?.events.some(
                        (e) => e.isBlocking !== false,
                      );
                      return (
                        <td
                          className={`p-0 border-r-2 align-top h-px ${readOnly ? "" : "cursor-pointer hover:bg-blue-500/10"} transition-colors group/cell ${rowBg} ${theme === "dark" ? "border-slate-800/80" : "border-slate-200/60"}`}
                          colSpan={hasBlockingAll ? 5 : 1}
                          onClick={() =>
                            !readOnly && handleCellClick(day, "ALL")
                          }
                          onDragOver={(e) => {
                            if (readOnly) return;
                            e.preventDefault();
                            e.currentTarget.classList.add("!bg-blue-500/20");
                          }}
                          onDragLeave={(e) => {
                            if (readOnly) return;
                            e.currentTarget.classList.remove("!bg-blue-500/20");
                          }}
                          onDrop={(e) => {
                            if (readOnly) return;
                            e.preventDefault();
                            e.currentTarget.classList.remove("!bg-blue-500/20");
                            const dataStr =
                              e.dataTransfer.getData("application/json");
                            if (dataStr) {
                              const data = JSON.parse(dataStr);
                              handleEventDrop(
                                data.eventId,
                                data.grabbedDayIndex,
                                day,
                                "ALL",
                              );
                            }
                          }}
                        >
                          <div className="h-full flex flex-col gap-1 relative overflow-hidden">
                            {gridData[day]["ALL"]?.events.map((event) => (
                              <div key={event.id} className="w-full">
                                <EventCard
                                  event={event}
                                  theme={theme}
                                  visualYear={year}
                                  readOnly={
                                    readOnly || event.type === "EVALUATION"
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (
                                      readOnly ||
                                      event.type === "EVALUATION"
                                    ) {
                                      setDetailEvent(event);
                                    } else {
                                      handleCellClick(day, "ALL", event);
                                    }
                                  }}
                                />
                              </div>
                            ))}
                            {!readOnly && (
                              <div className="flex-1 m-1 min-h-[50px] flex items-center justify-center opacity-0 group-hover/cell:opacity-40 transition-opacity bg-blue-500/5 rounded-lg border-2 border-dashed border-blue-500/20">
                                <Plus size={20} className="text-blue-500" />
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })()}

                    {/* Colunas Esquadrões */}
                    {!gridData[day]["ALL"]?.events.some(
                      (e) => e.isBlocking !== false,
                    ) &&
                      SQUADRONS.map((s) => {
                        const { colors } = squadronInfo[s];
                        const squadBg =
                          theme === "dark"
                            ? `${colors.primary}40`
                            : `${colors.primary}20`;

                        return (
                          <td
                            key={s}
                            className={`p-0 border-r-2 align-top h-px ${readOnly ? "" : "cursor-pointer hover:bg-blue-500/10"} transition-colors group/cell ${rowBg} ${theme === "dark" ? "border-slate-800/80" : "border-slate-200/60"}`}
                            style={{
                              backgroundColor: isWeekend ? undefined : squadBg,
                            }}
                            onClick={() => !readOnly && handleCellClick(day, s)}
                            onDragOver={(e) => {
                              if (readOnly) return;
                              e.preventDefault();
                              e.currentTarget.classList.add("!bg-blue-500/20");
                            }}
                            onDragLeave={(e) => {
                              if (readOnly) return;
                              e.currentTarget.classList.remove(
                                "!bg-blue-500/20",
                              );
                            }}
                            onDrop={(e) => {
                              if (readOnly) return;
                              e.preventDefault();
                              e.currentTarget.classList.remove(
                                "!bg-blue-500/20",
                              );
                              const dataStr =
                                e.dataTransfer.getData("application/json");
                              if (dataStr) {
                                const data = JSON.parse(dataStr);
                                handleEventDrop(
                                  data.eventId,
                                  data.grabbedDayIndex,
                                  day,
                                  s,
                                );
                              }
                            }}
                          >
                            <div className="h-full flex flex-col gap-1 relative overflow-hidden">
                              {gridData[day][s]?.events.map((event) => (
                                <div key={event.id} className="w-full">
                                  <EventCard
                                    event={event}
                                    theme={theme}
                                    visualYear={year}
                                    readOnly={
                                      readOnly || event.type === "EVALUATION"
                                    }
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (
                                        readOnly ||
                                        event.type === "EVALUATION"
                                      ) {
                                        setDetailEvent(event);
                                      } else {
                                        handleCellClick(day, s, event);
                                      }
                                    }}
                                  />
                                </div>
                              ))}
                              {!readOnly && (
                                <div className="flex-1 m-1 min-h-[50px] flex items-center justify-center opacity-0 group-hover/cell:opacity-40 transition-opacity bg-blue-500/5 rounded-lg border-2 border-dashed border-blue-500/20">
                                  <Plus size={20} className="text-blue-500" />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          className={`p-4 border-t ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"}`}
        >
          <div className="flex flex-wrap items-center gap-6 text-[10px]  uppercase tracking-widest opacity-60">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500 border border-amber-600/20" />
              <span>Bloqueio (Impede Aulas)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500 border border-blue-600/20" />
              <span>Evento (Informativo)</span>
            </div>
            {!readOnly && (
              <div className="ml-auto flex items-center gap-2 text-blue-500">
                <Users size={12} />
                <span>Clique para inserir bloqueios ou eventos</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Event Modal */}
      <QuickEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        data={
          selectedCell
            ? {
                date:
                  selectedCell.blockStart ||
                  `${year}-${(currentMonthIndex + 1).toString().padStart(2, "0")}-${selectedCell.day.toString().padStart(2, "0")}`,
                blockStart: selectedCell.blockStart,
                blockEnd: selectedCell.blockEnd,
                squadron: selectedCell.squadron,
                event: selectedCell.event,
              }
            : null
        }
        onSave={handleSaveQuickEvent}
        onDelete={handleDeleteQuickEvent}
        theme={theme}
      />

      {/* Event Detail Popup */}
      {detailEvent && (
        <EventDetailModal
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          theme={theme}
          visualYear={year}
        />
      )}

      {/* Print Only Component */}
      <PrintableMonthlyCalendar
        year={year}
        monthsToPrint={
          printMode === "MONTH"
            ? [currentMonthIndex]
            : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        }
        events={events}
        printTrigger={printTrigger}
      />
    </div>
  );
};

const QuickEventModal = ({
  isOpen,
  onClose,
  data,
  onSave,
  onDelete,
  theme,
}: {
  isOpen: boolean;
  onClose: () => void;
  data: {
    date: string;
    squadron: ColumnKey;
    event?: ScheduleEvent;
    blockStart?: string;
    blockEnd?: string;
  } | null;
  onSave: (
    title: string,
    block: boolean,
    color: string,
    endDate?: string,
    course?: string,
    targetClass?: string,
    startDate?: string,
    description?: string,
  ) => void;
  onDelete?: () => void;
  theme: string;
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);
  const [color, setColor] = useState("#3b82f6");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetCourse, setTargetCourse] = useState("ALL");
  const [targetClass, setTargetClass] = useState("ALL");

  const isEditing = !!data?.event;

  // Load initial values if editing
  React.useEffect(() => {
    if (isOpen && data?.event) {
      setTitle(data.event.location || "");
      setDescription(data.event.description || "");
      setIsBlocking(false); // In Panoramic View, everything is an Event
      setColor(data.event.color || "#3b82f6");
      setStartDate(data.blockStart || data.event.date);
      setEndDate(data.blockEnd || data.event.date);
      setTargetCourse(data.event.targetCourse || "ALL");
      setTargetClass(data.event.targetClass || "ALL");
    } else if (isOpen && data) {
      setTitle("");
      setDescription("");
      setStartDate(data.date);
      setEndDate("");
      setIsBlocking(false);
      setColor("#3b82f6");
      setTargetCourse("ALL");
      setTargetClass("ALL");
    }
  }, [isOpen, data]);

  const COURSE_OPTIONS = [
    { id: "ALL", label: "Toda a Turma", color: "#64748b" },
    { id: "AVIATION", label: "Aviação", color: "#1e40af" }, // Blue
    { id: "INTENDANCY", label: "Intendência", color: "#d97706" },
    { id: "INFANTRY", label: "Infantaria", color: "#15803d" }, // Green
  ];

  if (!isOpen || !data) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    // Atribuir cor baseada no curso se for evento acadêmico
    let finalColor = color;
    const selectedOpt = COURSE_OPTIONS.find((o) => o.id === targetCourse);
    if (selectedOpt) finalColor = selectedOpt.color;

    onSave(
      title,
      isBlocking,
      finalColor,
      endDate,
      targetCourse,
      targetClass,
      startDate,
      description,
    );
    setTitle("");
    setDescription("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 ${theme === "dark" ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"} animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl  uppercase tracking-tight">
              {isEditing ? "Editar Evento" : "Criar Evento"}
            </h3>
            <p className="text-xs text-slate-500  uppercase mt-1">
              {data.date.split("-").reverse().join("/")} •{" "}
              {data.squadron === "ALL"
                ? "Todos os Esquadrões"
                : `${data.squadron}º Esquadrão`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Blocking option removed as requested for Panoramic View */}

          <div>
            <label className="block text-[10px]  uppercase text-slate-500 mb-2 tracking-widest px-1">
              Público Alvo (Curso)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {COURSE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTargetCourse(opt.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px]  uppercase transition-all ${targetCourse === opt.id ? "bg-blue-500 text-white border-blue-600 shadow-md scale-[1.02]" : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"}`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: opt.color }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px]  uppercase text-slate-500 mb-2 tracking-widest px-1">
              Turmas (Opcional)
            </label>
            <select
              value={targetClass}
              onChange={(e) => setTargetClass(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm  outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer ${theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"}`}
            >
              <option value="ALL">Todas as Turmas (ALL)</option>
              <option value="A">Turma A</option>
              <option value="B">Turma B</option>
              <option value="C">Turma C</option>
              <option value="D">Turma D</option>
              <option value="E">Turma E</option>
              <option value="F">Turma F</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-2 tracking-widest px-1">
              Título do Evento
            </label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Feriado, Palestra, Manobra, etc."
              className={`w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"}`}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-2 tracking-widest px-1">
              Descrição (Detalhes)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Informações adicionais que aparecerão no popup..."
              rows={3}
              className={`w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none ${theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px]  uppercase text-slate-500 mb-2 tracking-widest px-1">
                Data Início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border text-sm  outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"}`}
                required
              />
            </div>
            <div>
              <label className="block text-[10px]  uppercase text-slate-500 mb-2 tracking-widest px-1">
                Data Fim (Opcional)
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border text-sm  outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"}`}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95"
                title="Excluir Evento"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button
              type="submit"
              className={`flex-1 py-3.5 rounded-xl  text-xs uppercase tracking-widest text-white shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${isBlocking ? "bg-amber-600 shadow-amber-500/20 hover:bg-amber-700" : "bg-blue-600 shadow-blue-500/20 hover:bg-blue-700"}`}
            >
              <Save size={16} />
              {isEditing ? "Salvar Alterações" : "Salvar no Calendário"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EventCard = ({
  event,
  theme,
  visualYear,
  readOnly = false,
  className = "",
  onClick,
}: {
  event: ScheduleEvent & {
    isStart?: boolean;
    isEnd?: boolean;
    dayIndex?: number;
    totalDays?: number;
  };
  theme: string;
  visualYear: number;
  readOnly?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) => {
  const { isStart, isEnd, dayIndex, totalDays } = event;
  const { cohorts } = useCourseStore();

  const getEventBadgeInfo = () => {
    const course = event.targetCourse || "ALL";
    let primaryInfo: any = null;
    let secondaryInfo: any = null;

    if (course === "ALL") {
      const squad = event.targetSquadron as any;
      if (
        squad &&
        squad !== "ALL" &&
        ["1", "2", "3", "4"].includes(String(squad))
      ) {
        const entryYear = visualYear - Number(squad) + 1;
        const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);

        if (cohort) {
          const tokens = getCohortColorTokens(cohort.color || "blue");
          primaryInfo = {
            label: cohort.name,
            color: "bg-custom",
            hex: tokens.primary,
            bgColor: tokens.light,
            textColor: tokens.dark,
          };
        } else {
          const defaults: Record<
            string,
            {
              label: string;
              color: string;
              hex: string;
              bgColor?: string;
              textColor?: string;
            }
          > = {
            "1": { label: "1º Esq", color: "bg-amber-500", hex: "#f59e0b" },
            "2": { label: "2º Esq", color: "bg-red-600", hex: "#dc2626" },
            "3": { label: "3º Esq", color: "bg-blue-600", hex: "#2563eb" },
            "4": { label: "4º Esq", color: "bg-emerald-600", hex: "#059669" },
          };
          primaryInfo = defaults[String(squad)] || {
            label: "CCAer",
            color: "bg-slate-500",
            hex: "#64748b",
          };
        }
      } else {
        primaryInfo = { label: "CCAer", color: "bg-slate-500", hex: "#64748b" };
      }
    } else {
      const courseLabels: Record<
        string,
        { label: string; color: string; hex: string }
      > = {
        AVIATION: { label: "Aviação", color: "bg-zinc-500", hex: "#71717a" },
        INTENDANCY: {
          label: "Intendência",
          color: "bg-amber-600",
          hex: "#d97706",
        },
        INFANTRY: {
          label: "Infantaria",
          color: "bg-amber-900",
          hex: "#78350f",
        },
        ALL: { label: "CCAer", color: "bg-slate-500", hex: "#64748b" },
      };
      primaryInfo = courseLabels[course] || courseLabels["ALL"];

      // Add cohort as secondary if available
      const squad = event.targetSquadron as any;
      if (
        squad &&
        squad !== "ALL" &&
        ["1", "2", "3", "4"].includes(String(squad))
      ) {
        const entryYear = visualYear - Number(squad) + 1;
        const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);
        if (cohort) {
          const tokens = getCohortColorTokens(cohort.color || "blue");
          secondaryInfo = {
            label: cohort.name,
            color: "bg-custom",
            hex: tokens.primary,
            bgColor: tokens.light,
            textColor: tokens.dark,
          };
        }
      }
    }

    return { primary: primaryInfo, secondary: secondaryInfo };
  };

  const badgeData = getEventBadgeInfo();
  const info = badgeData.primary;
  const secondaryInfo = badgeData.secondary;
  const isEval = event.type === "EVALUATION";
  const cardColor = isEval ? "#f97316" : info.hex;

  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => {
        if (readOnly) return;
        e.dataTransfer.setData(
          "application/json",
          JSON.stringify({
            eventId: event.id,
            grabbedDayIndex: event.dayIndex || 1,
          }),
        );
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onClick}
      className={`
                px-2 py-1 border-l-4 shadow-sm transition-all hover:shadow-md group relative overflow-hidden flex flex-col cursor-pointer
                ${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-100" : isEval ? "border-slate-300 text-slate-900" : "bg-white border-slate-300 text-slate-900"}
                ${isStart ? "rounded-t-lg pt-2 mt-1" : "border-t-0 pt-1 mt-0"}
                ${isEnd ? "rounded-b-lg pb-2 mb-1" : "border-b-0 pb-1 mb-0 shadow-none"}
                ${className}
            `}
      style={{
        borderLeftColor: cardColor,
        backgroundColor: isEval
          ? theme === "dark"
            ? `rgba(234, 88, 12, 0.3)`
            : `rgba(249, 115, 22, 0.25)`
          : theme === "dark"
            ? `rgba(${parseInt(cardColor.slice(1, 3), 16)}, ${parseInt(cardColor.slice(3, 5), 16)}, ${parseInt(cardColor.slice(5, 7), 16)}, ${isStart ? "0.18" : "0.08"})`
            : `rgba(${parseInt(cardColor.slice(1, 3), 16)}, ${parseInt(cardColor.slice(3, 5), 16)}, ${parseInt(cardColor.slice(5, 7), 16)}, ${isStart ? "0.12" : "0.05"})`,
      }}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1 min-w-0 flex-wrap">
          <span
            className={`${info.color === "bg-custom" ? "" : info.color + " text-white"} px-1 py-0 rounded-[3px] text-[7.5px]  uppercase tracking-tight truncate`}
            style={
              info.color === "bg-custom"
                ? {
                    backgroundColor: info.bgColor,
                    color: info.textColor,
                    border: `1px solid ${info.hex}`,
                  }
                : {}
            }
          >
            {info.label}
          </span>
          {secondaryInfo && (
            <span
              className="px-1 py-0 rounded-[3px] text-[7.5px]  uppercase tracking-tight truncate"
              style={{
                backgroundColor: secondaryInfo.bgColor,
                color: secondaryInfo.textColor,
                border: `1px solid ${secondaryInfo.hex}`,
              }}
            >
              {secondaryInfo.label}
            </span>
          )}
        </div>

        {totalDays && totalDays > 1 && (
          <div
            className={`text-[8px]  px-1.5 py-0.5 rounded-md ${theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-500"} ${!isStart ? "opacity-60" : ""}`}
          >
            {dayIndex}/{totalDays}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span
          className={`text-[10px] uppercase leading-tight line-clamp-3 font-bold ${!isStart ? "opacity-40 text-[9px]" : ""}`}
        >
          {event.location}
        </span>

        {isStart && event.targetClass && event.targetClass !== "ALL" && (
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className={`px-1 rounded text-[7px]  ${theme === "dark" ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"}`}
            >
              TURMA {event.targetClass}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const EventDetailModal = ({
  event,
  onClose,
  theme,
  visualYear,
}: {
  event: ScheduleEvent;
  onClose: () => void;
  theme: string;
  visualYear: number;
}) => {
  const { cohorts } = useCourseStore();

  // Reutilizando lógica de cores do badge
  const getThemeColor = () => {
    if (event.type === "EVALUATION") return "#f97316";
    if (event.color) return event.color;

    const course = event.targetCourse || "ALL";
    if (course === "AVIATION") return "#71717a";
    if (course === "INTENDANCY") return "#d97706";
    if (course === "INFANTRY") return "#78350f";

    const squad = event.targetSquadron as any;
    if (
      squad &&
      squad !== "ALL" &&
      ["1", "2", "3", "4"].includes(String(squad))
    ) {
      const entryYear = visualYear - Number(squad) + 1;
      const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);
      if (cohort) return getCohortColorTokens(cohort.color || "blue").primary;
    }

    return "#64748b"; // Default CCAer
  };

  const activeColor = getThemeColor();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl p-8 relative overflow-hidden animate-in zoom-in-95 duration-200 ${theme === "dark" ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Visual Accent */}
        <div
          className="absolute top-0 left-0 w-full h-2"
          style={{ backgroundColor: activeColor }}
        />

        <div className="flex justify-between items-start mb-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: activeColor }}
              >
                {event.type === "EVALUATION"
                  ? "Avaliação"
                  : event.isBlocking
                    ? "Bloqueio"
                    : "Evento"}
              </span>
              <span className="text-xs text-slate-500 font-medium uppercase tracking-widest">
                {event.date.split("-").reverse().join("/")}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight leading-snug font-bold">
              {event.location}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition"
          >
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div
              className={`p-4 rounded-2xl border ${theme === "dark" ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}
            >
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Público
              </span>
              <span className="text-sm uppercase">
                {event.targetSquadron === "ALL" || !event.targetSquadron
                  ? "Todos Esquadrões"
                  : `${event.targetSquadron}º Esquadrão`}
              </span>
            </div>
            <div
              className={`p-4 rounded-2xl border ${theme === "dark" ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}
            >
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Curso / Turma
              </span>
              <span className="text-sm uppercase">
                {event.targetCourse === "AVIATION"
                  ? "Aviação"
                  : event.targetCourse === "INTENDANCY"
                    ? "Intendência"
                    : event.targetCourse === "INFANTRY"
                      ? "Infantaria"
                      : "Geral"}
                {event.targetClass &&
                  event.targetClass !== "ALL" &&
                  ` - TURMA ${event.targetClass}`}
              </span>
            </div>
          </div>

          {event.description && (
            <div
              className={`p-4 rounded-2xl border ${theme === "dark" ? "bg-blue-500/5 border-blue-500/20" : "bg-blue-50 border-blue-100"}`}
            >
              <span className="block text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2 opacity-60">
                Descrição Detalhada
              </span>
              <p
                className={`text-sm leading-relaxed whitespace-pre-wrap ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}
              >
                {event.description}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 transition active:scale-[0.98]"
          >
            Fechar Visualização
          </button>
        </div>
      </div>
    </div>
  );
};
