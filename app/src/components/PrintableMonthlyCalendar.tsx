import React from "react";
import { createPortal } from "react-dom";
import type { ScheduleEvent } from "../types";
import { useCourseStore } from "../store/useCourseStore";
import { getCohortColorTokens } from "../utils/cohortColors";

interface PrintableMonthlyCalendarProps {
  year: number;
  monthsToPrint: number[];
  events: ScheduleEvent[];
  printTrigger?: number;
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

const squadronInfo: Record<
  number,
  { name: string; colors: { primary: string; dark: string } }
> = {
  1: { name: "Cometa", colors: { primary: "#f59e0b", dark: "#92400e" } },
  2: { name: "Mercúrio", colors: { primary: "#ef4444", dark: "#991b1b" } },
  3: { name: "Apolo", colors: { primary: "#3b82f6", dark: "#1e40af" } },
  4: { name: "Netuno", colors: { primary: "#10b981", dark: "#065f46" } },
};

const getCourseInfo = (
  targetCourse: string | undefined,
  targetSquadron: any,
  year: number,
  cohorts: any[],
) => {
  const course = targetCourse || "ALL";
  let primary: any = null;
  let secondary: any = null;

  if (course === "ALL") {
    const squad = targetSquadron;
    if (
      squad &&
      squad !== "ALL" &&
      ["1", "2", "3", "4"].includes(String(squad))
    ) {
      const entryYear = year - Number(squad) + 1;
      const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);

      if (cohort) {
        const tokens = getCohortColorTokens(cohort.color || "blue");
        primary = {
          label: cohort.name,
          color: tokens.primary,
          bgColor: tokens.light,
          textColor: tokens.dark,
          isCustom: true,
        };
      } else {
        const defaults: Record<string, { label: string; color: string }> = {
          "1": { label: "1º Esq", color: "#f59e0b" },
          "2": { label: "2º Esq", color: "#ef4444" },
          "3": { label: "3º Esq", color: "#3b82f6" },
          "4": { label: "4º Esq", color: "#10b981" },
        };
        primary = defaults[String(squad)] || {
          label: "CCAer",
          color: "#64748b",
        };
      }
    } else {
      primary = { label: "CCAer", color: "#64748b" };
    }
  } else {
    const courseMap: Record<string, { label: string; color: string }> = {
      AVIATION: { label: "Aviação", color: "#71717a" },
      INTENDANCY: { label: "Intendência", color: "#d97706" },
      INFANTRY: { label: "Infantaria", color: "#78350f" },
      ALL: { label: "CCAer", color: "#64748b" },
    };
    primary = courseMap[course] || courseMap["ALL"];

    // Add cohort as secondary if available
    const squad = targetSquadron;
    if (
      squad &&
      squad !== "ALL" &&
      ["1", "2", "3", "4"].includes(String(squad))
    ) {
      const entryYear = year - Number(squad) + 1;
      const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);
      if (cohort) {
        const tokens = getCohortColorTokens(cohort.color || "blue");
        secondary = {
          label: cohort.name,
          color: tokens.primary,
          bgColor: tokens.light,
          textColor: tokens.dark,
          isCustom: true,
        };
      }
    }
  }

  return { primary, secondary };
};

export const PrintableMonthlyCalendar: React.FC<
  PrintableMonthlyCalendarProps
> = ({ year, monthsToPrint, events }) => {
  const { cohorts } = useCourseStore();
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const months = MONTHS.map((m, i) =>
    i === 1 ? { ...m, days: isLeapYear ? 29 : 28 } : m,
  );

  const renderMonthGrid = (mIdx: number) => {
    const month = months[mIdx];
    const monthYearStr = `${year}-${(mIdx + 1).toString().padStart(2, "0")}`;

    const monthEvents = events.filter((e) => {
      const isAcad = e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC";
      return isAcad && e.date.startsWith(monthYearStr);
    });

    const rawGrid: Record<
      number,
      Record<string | number, ScheduleEvent[]>
    > = {};
    for (let d = 1; d <= month.days; d++) {
      rawGrid[d] = { ALL: [], 1: [], 2: [], 3: [], 4: [] };
    }

    monthEvents.forEach((e) => {
      const dayParts = e.date.split("-");
      const day = parseInt(dayParts[2]);
      if (rawGrid[day]) {
        const squadron = e.targetSquadron;
        const key: string | number =
          squadron === 1 || squadron === 2 || squadron === 3 || squadron === 4
            ? squadron
            : "ALL";
        rawGrid[day][key].push(e);
      }
    });

    const columns: (string | number)[] = ["ALL", 1, 2, 3, 4];
    const processedGrid: Record<
      number,
      Record<string | number, { events: any[] }>
    > = {};

    columns.forEach((col) => {
      for (let d = 1; d <= month.days; d++) {
        if (!processedGrid[d])
          processedGrid[d] = {
            ALL: { events: [] },
            1: { events: [] },
            2: { events: [] },
            3: { events: [] },
            4: { events: [] },
          };

        const currentDayEvents = rawGrid[d][col];
        const enhancedEvents = currentDayEvents.map((event) => {
          const fingerprint = `${event.location}-${event.isBlocking}-${event.type}-${event.targetCourse || "ALL"}`;
          let dayIndex = 1;
          let checkDay = d - 1;
          while (checkDay > 0) {
            const prevEvents = rawGrid[checkDay][col];
            if (
              prevEvents.some(
                (e) =>
                  `${e.location}-${e.isBlocking}-${e.type}-${e.targetCourse || "ALL"}` ===
                  fingerprint,
              )
            ) {
              dayIndex++;
              checkDay--;
            } else {
              break;
            }
          }
          let forwardCount = 0;
          checkDay = d + 1;
          while (checkDay <= month.days) {
            const nextEvents = rawGrid[checkDay][col];
            if (
              nextEvents.some(
                (e) =>
                  `${e.location}-${e.isBlocking}-${e.type}-${e.targetCourse || "ALL"}` ===
                  fingerprint,
              )
            ) {
              forwardCount++;
              checkDay++;
            } else {
              break;
            }
          }
          return {
            ...event,
            isStart: dayIndex === 1,
            isEnd: forwardCount === 0,
            dayIndex,
            totalDays: dayIndex + forwardCount,
          };
        });
        processedGrid[d][col] = { events: enhancedEvents };
      }
    });

    return (
      <div key={mIdx} className="monthly-page">
        <style>{`
                    .print-tag {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .bg-blue-600 { background-color: #2563eb !important; }
                    .bg-zinc-500 { background-color: #71717a !important; }
                    .bg-amber-600 { background-color: #d97706 !important; }
                    .bg-amber-900 { background-color: #78350f !important; }
                    .bg-amber-500 { background-color: #f59e0b !important; }
                    .bg-red-600 { background-color: #dc2626 !important; }
                    .bg-emerald-600 { background-color: #059669 !important; }
                    .bg-slate-500 { background-color: #64748b !important; }
                `}</style>
        <div className="text-center mb-4">
          <h1 className="text-2xl  uppercase tracking-tighter text-slate-900">
            {month.name} <span className="text-blue-600">{year}</span>
          </h1>
        </div>

        <table className="w-full border-collapse table-fixed text-[8px] border-2 border-slate-300">
          <thead>
            <tr className="bg-slate-100">
              <th className="border-2 border-slate-300 p-1 w-[35px] uppercase  text-center">
                Data
              </th>
              <th className="border-2 border-slate-300 p-1 w-[25px] uppercase  text-center">
                Dia
              </th>
              <th className="border-2 border-slate-300 p-1 w-[18%] uppercase  bg-slate-200 text-center">
                Geral
              </th>
              {SQUADRONS.map((s) => (
                <th
                  key={s}
                  className="border-2 border-slate-300 p-1 w-[16%] uppercase  text-center"
                  style={{
                    backgroundColor: squadronInfo[s].colors.primary + "30",
                  }}
                >
                  {s}º ESQ
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: month.days }).map((_, i) => {
              const day = i + 1;
              const date = new Date(year, mIdx, day);
              const dayOfWeek = date.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const rowBg = isWeekend ? "bg-slate-50" : "bg-white";
              const hasBlockingAll = processedGrid[day]["ALL"].events.some(
                (e) => e.isBlocking !== false,
              );

              return (
                <tr key={day} className={rowBg}>
                  <td className="border border-slate-200 p-1 text-center ">
                    {day.toString().padStart(2, "0")}
                  </td>
                  <td
                    className={`border border-slate-200 p-1 text-center  ${dayOfWeek === 0 ? "text-red-500" : ""}`}
                  >
                    {DAYS_SHORT[dayOfWeek]}
                  </td>

                  <td
                    className="border border-slate-200 p-0 align-top relative"
                    colSpan={hasBlockingAll ? 5 : 1}
                  >
                    <div className="flex flex-col h-full min-h-[16px]">
                      {processedGrid[day]["ALL"].events.map((event, idx) => (
                        <PrintEventCard
                          key={`${event.id}-${idx}`}
                          event={event}
                          year={year}
                          cohorts={cohorts}
                        />
                      ))}
                    </div>
                  </td>

                  {!hasBlockingAll &&
                    SQUADRONS.map((s) => (
                      <td
                        key={s}
                        className="border border-slate-200 p-0 align-top relative"
                      >
                        <div className="flex flex-col h-full min-h-[16px]">
                          {processedGrid[day][s].events.map((event, idx) => (
                            <PrintEventCard
                              key={`${event.id}-${idx}`}
                              event={event}
                              year={year}
                              cohorts={cohorts}
                            />
                          ))}
                        </div>
                      </td>
                    ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const content = (
    <div
      id="printable-panoramic-view"
      className="hidden print:block w-full min-h-screen bg-white text-black p-0 absolute top-0 left-0 z-[9999]"
    >
      <style>{`
                @media print {
                    @page { margin: 8mm; size: portrait; }
                    html, body, #root { 
                        background-color: white !important; 
                        color: black !important; 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                    }
                    body > *:not(#printable-panoramic-view) { display: none !important; }
                    #printable-panoramic-view { display: block !important; position: absolute !important; left: 0; top: 0; width: 100%; }
                    .monthly-page { page-break-after: always; break-after: page; width: 100%; padding: 0; box-sizing: border-box; }
                    .monthly-page:last-child { page-break-after: auto; break-after: auto; }
                    table { border-collapse: collapse !important; width: 100% !important; }
                    tr, td { page-break-inside: avoid !important; break-inside: avoid !important; }
                    td, th { border: 1px solid #ddd !important; -webkit-print-color-adjust: exact !important; }
                }
            `}</style>

      {monthsToPrint.map((mIdx) => renderMonthGrid(mIdx))}
    </div>
  );

  return createPortal(content, document.body);
};

const PrintEventCard = ({
  event,
  year,
  cohorts,
}: {
  event: any;
  year: number;
  cohorts: any[];
}) => {
  const {
    isStart,
    isEnd,
    location,
    dayIndex,
    totalDays,
    targetCourse,
    targetSquadron,
    type,
    evaluationType,
  } = event;
  const badgeData = getCourseInfo(targetCourse, targetSquadron, year, cohorts);
  const info = badgeData.primary;
  const secondary = badgeData.secondary;
  const badgeColor = info.color || "#64748b";

  let evalRingColor = "";
  const isEvaluation = type === "EVALUATION";
  if (isEvaluation) {
    switch (evaluationType) {
      case "PARTIAL":
        evalRingColor = "#f59e0b";
        break; // Amber
      case "FINAL":
        evalRingColor = "#dc2626";
        break; // Red
      case "EXAM":
        evalRingColor = "#7c3aed";
        break; // Purple
      case "SECOND_CHANCE":
        evalRingColor = "#eab308";
        break; // Yellow
      case "REVIEW":
        evalRingColor = "#ec4899";
        break; // Pink
      default:
        evalRingColor = "#ea580c"; // default orange
    }
  }

  return (
    <div
      className={`px-1 py-0.5 border-l-[3px] flex flex-col relative overflow-hidden print-tag ${isStart ? "rounded-t-[2px] mt-[1px]" : "border-t-0 mt-0"} ${isEnd ? "rounded-b-[2px] mb-[1px]" : "border-b-0 mb-0"}`}
      style={{
        borderLeftColor: isEvaluation ? "#f97316" : badgeColor,
        backgroundColor: isEvaluation
          ? "rgba(249, 115, 22, 0.25)"
          : info.isCustom
            ? info.bgColor
            : badgeColor + (isStart ? "30" : "12"),
        ...(isEvaluation
          ? { boxShadow: `inset 0 0 0 1.5px ${evalRingColor}` }
          : {}),
      }}
    >
      <div className="flex items-center justify-between gap-0.5 mb-0.5">
        <div className="flex items-center gap-0.5 flex-wrap">
          <span
            className="px-1 rounded-[1px] text-[5px]  uppercase whitespace-nowrap print-tag"
            style={{
              backgroundColor: info.isCustom ? info.bgColor : info.color,
              color: info.isCustom ? info.textColor : "white",
              border: info.isCustom ? `0.5px solid ${info.color}` : "none",
            }}
          >
            {info.label}
          </span>
          {secondary && (
            <span
              className="px-1 rounded-[1px] text-[5px]  uppercase whitespace-nowrap print-tag"
              style={{
                backgroundColor: secondary.bgColor,
                color: secondary.textColor,
                border: `0.5px solid ${secondary.color}`,
              }}
            >
              {secondary.label}
            </span>
          )}
        </div>
        {totalDays > 1 && (
          <span
            className={`text-[5px]  opacity-60 ${!isStart ? "opacity-30" : ""}`}
          >
            {dayIndex}/{totalDays}
          </span>
        )}
      </div>
      <span
        className={`text-[6px] uppercase leading-[1.1] font-bold ${!isStart ? "opacity-40" : ""}`}
      >
        {location}
      </span>
    </div>
  );
};
