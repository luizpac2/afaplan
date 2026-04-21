import {
  getWeekDays,
  formatDate,
  getDayOfYear,
  getWeekNumber,
  formatDateForDisplay,
} from "../utils/dateUtils";
import { TIME_SLOTS } from "../utils/constants";
import type { ScheduleEvent, Discipline, SystemNotice, NoticeType } from "../types";
import { CheckSquare, Square, AlertCircle } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { getCohortColorTokens, COHORT_COLORS, sqDisplayColor } from "../utils/cohortColors";
import { formatClassId } from "../utils/formatters";
import { FileEdit } from "lucide-react";

interface CalendarGridProps {
  events: ScheduleEvent[];
  disciplines: Discipline[];
  notices?: SystemNotice[];
  weekStart: Date;
  onSlotClick: (day: string, time: string) => void;
  onEventClick: (event: ScheduleEvent) => void;
  onEventDrop?: (eventId: string, date: string, time: string) => void;
  selectionMode?: boolean;
  selectedSlots?: string[]; // format: "YYYY-MM-DD|HH:mm"
  selectedEventIds?: string[];
  onEventSelect?: (eventId: string) => void;
  eventCounts?: Record<string, { current: number; total: number }>;
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DAY_LABELS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export const CalendarGrid = ({
  events,
  disciplines,
  notices = [],
  weekStart,
  onSlotClick,
  onEventClick,
  onEventDrop,
  selectionMode = false,
  selectedSlots = [],
  selectedEventIds = [],
  onEventSelect,
  eventCounts,
}: CalendarGridProps) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { cohorts, visualConfigs, instructors, changeRequests } =
    useCourseStore();
  const visualYear = weekStart.getFullYear();
  const getDiscipline = (id: string) => disciplines.find((d) => d.id === id);
  const getChangeRequest = (id?: string) =>
    id ? changeRequests.find((r) => r.id === id) : null;

  const weekDays = getWeekDays(weekStart);

  const renderWeekView = () => (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        <div
          className={`grid grid-cols-7 border-b sticky top-0 z-40 ${theme === "dark" ? "border-slate-700" : "border-gray-100"}`}
        >
          <div
            className={`p-2  text-[10px] border-r flex items-center justify-center sticky top-0 z-50 ${theme === "dark" ? "text-slate-500 bg-slate-900 border-slate-700" : "text-slate-400 bg-white border-gray-100"}`}
          >
            HORÁRIO
          </div>
          {DAYS.map((day, index) => {
            const date = weekDays[index];
            return (
              <div
                key={day}
                className={`p-1.5 text-center border-r ${theme === "dark" ? "border-slate-700 bg-slate-800/50" : "border-gray-100 bg-gray-50/50"}`}
              >
                <div
                  className={`text-[11px]  ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}
                >
                  {DAY_LABELS[index]} -{" "}
                  {date
                    ?.toLocaleDateString("pt-BR", {
                      day: "numeric",
                      month: "short",
                    })
                    .replace(".", "")}
                </div>
                {date && (
                  <div
                    className={`flex items-center justify-center gap-1.5 mt-0.5 text-[9px]  ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}
                  >
                    <span>Dia {getDayOfYear(date)}</span>
                    <span className="opacity-50">•</span>
                    <span>Semana {getWeekNumber(date)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Notices Row */}
        <div
          className={`grid grid-cols-7 border-b sticky top-[48px] z-30 ${theme === "dark" ? "border-slate-700 bg-slate-900" : "border-gray-100 bg-slate-50"}`}
        >
          <div
            className={`p-1.5 text-[10px]  flex items-center justify-center border-r sticky left-0 z-40 ${theme === "dark" ? "text-slate-500 border-slate-700 bg-slate-900" : "text-slate-400 border-gray-200 bg-slate-50"}`}
          >
            AVISOS
          </div>
          <div className="col-span-6 p-0.5" style={{ minHeight: "28px" }}>
            {(() => {
              // Compute all notice bars
              // Combine original notices with academic events as notices

              // 1. Filter academic events
              const academicEvents = events.filter(
                (e) => e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC",
              );

              // 2. Group them by consecutive days if they have same location and color
              const groupedAcademicEvents: (ScheduleEvent & { startDate: string; endDate: string })[] = [];

              if (academicEvents.length > 0) {
                // Sort by date first to easily find consecutive items
                const sortedAcads = [...academicEvents].sort((a, b) =>
                  a.date.localeCompare(b.date),
                );

                let currentGroup = {
                  ...sortedAcads[0],
                  startDate: sortedAcads[0].date,
                  endDate: sortedAcads[0].date,
                };

                for (let i = 1; i < sortedAcads.length; i++) {
                  const event = sortedAcads[i];
                  const prevDate = new Date(currentGroup.endDate + "T00:00:00");
                  const currDate = new Date(event.date + "T00:00:00");
                  const diffTime = Math.abs(
                    currDate.getTime() - prevDate.getTime(),
                  );
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                  // Check if same type, same location, same color, and consecutive day
                  if (
                    diffDays === 1 &&
                    event.location === currentGroup.location &&
                    event.color === currentGroup.color &&
                    event.type === currentGroup.type &&
                    event.isBlocking === currentGroup.isBlocking &&
                    event.targetCourse === currentGroup.targetCourse
                  ) {
                    currentGroup.endDate = event.date; // Extend the group
                  } else {
                    groupedAcademicEvents.push(currentGroup);
                    currentGroup = {
                      ...event,
                      startDate: event.date,
                      endDate: event.date,
                    };
                  }
                }
                groupedAcademicEvents.push(currentGroup);
              }

              const combinedNotices = [
                ...notices,
                ...groupedAcademicEvents.map((e) => ({
                  id: e.id,
                  title: e.location || "Evento",
                  description:
                    e.description ||
                    (e.isBlocking !== false
                      ? "Bloqueio Acadêmico"
                      : "Evento Acadêmico"),
                  startDate: e.startDate,
                  endDate: e.endDate,
                  type: (e.isBlocking !== false ? "WARNING" : "EVENT") as NoticeType,
                  targetCourse: e.targetCourse,
                  targetClass: e.targetClass,
                  createdAt: "",
                  authorId: "",
                  targetAudience: { type: "GLOBAL" as const },
                })),
              ];

              const noticesBars = combinedNotices
                .filter((notice) => {
                  const weekStartStr = weekDays[0]?.toISOString().split("T")[0];
                  const weekEndStr = weekDays[5]?.toISOString().split("T")[0];
                  if (!weekStartStr || !weekEndStr) return false;
                  return (
                    notice.startDate <= weekEndStr &&
                    notice.endDate >= weekStartStr
                  );
                })
                .map((notice) => {
                  let startIndex = 0;
                  let endIndex = 5;
                  const nStart = new Date(notice.startDate + "T00:00:00");
                  const nEnd = new Date(notice.endDate + "T00:00:00");

                  weekDays.forEach((day, idx) => {
                    if (!day) return;
                    const d = new Date(day);
                    d.setHours(0, 0, 0, 0);
                    if (d.getTime() === nStart.getTime()) startIndex = idx;
                    else if (d < nStart) startIndex = idx + 1;
                    if (d.getTime() === nEnd.getTime()) endIndex = idx;
                    else if (d > nEnd && endIndex === 5) endIndex = idx - 1;
                  });

                  if (startIndex > 5 || endIndex < 0 || startIndex > endIndex)
                    return null;
                  startIndex = Math.max(0, startIndex);
                  endIndex = Math.min(5, endIndex);

                  return { notice, startIndex, endIndex };
                })
                .filter(Boolean) as {
                notice: (typeof notices)[0];
                startIndex: number;
                endIndex: number;
              }[];

              // Sort by startIndex for stable row assignment
              noticesBars.sort((a, b) => a.startIndex - b.startIndex);

              // Pack into rows: non-overlapping notices share a row
              const packedRows: (typeof noticesBars)[] = [];
              const rowEnds: number[] = [];
              noticesBars.forEach((bar) => {
                let placed = false;
                for (let r = 0; r < rowEnds.length; r++) {
                  if (bar.startIndex > rowEnds[r]) {
                    rowEnds[r] = bar.endIndex;
                    packedRows[r].push(bar);
                    placed = true;
                    break;
                  }
                }
                if (!placed) {
                  rowEnds.push(bar.endIndex);
                  packedRows.push([bar]);
                }
              });

              return (
                <div className="flex flex-col gap-1.5">
                  {packedRows.map((row, rowIdx) => (
                    <div key={rowIdx} className="grid grid-cols-6 gap-1.5">
                      {row.map((bar) => {
                        const { notice, startIndex, endIndex } = bar;
                        const totalCols = endIndex - startIndex + 1;

                        const getEventBadgeInfo = () => {
                          const course = notice.targetCourse || "ALL";
                          let primaryInfo: { label: string; color: string; hex: string; bgColor?: string; textColor?: string } | null = null;
                          let secondaryInfo: { label: string; color: string; hex: string; bgColor?: string; textColor?: string } | null = null;

                          if (course === "ALL") {
                            const squad = notice.targetSquadron;
                            if (
                              squad &&
                              ["1", "2", "3", "4"].includes(String(squad))
                            ) {
                              const entryYear = visualYear - Number(squad) + 1;
                              const cohort = cohorts.find(
                                (c) => Number(c.entryYear) === entryYear,
                              );

                              if (cohort) {
                                const tokens = getCohortColorTokens(
                                  cohort.color || "blue",
                                );
                                primaryInfo = {
                                  label: cohort.name,
                                  color: "bg-custom",
                                  hex: sqDisplayColor(tokens, isDark),
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
                                  "1": {
                                    label: "1º Esq",
                                    color: "bg-amber-500",
                                    hex: "#f59e0b",
                                  },
                                  "2": {
                                    label: "2º Esq",
                                    color: "bg-red-600",
                                    hex: "#dc2626",
                                  },
                                  "3": {
                                    label: "3º Esq",
                                    color: "bg-blue-600",
                                    hex: "#2563eb",
                                  },
                                  "4": {
                                    label: "4º Esq",
                                    color: "bg-emerald-600",
                                    hex: "#059669",
                                  },
                                };
                                primaryInfo = defaults[String(squad)] || {
                                  label: "CCAer",
                                  color: "bg-slate-500",
                                  hex: "#64748b",
                                };
                              }
                            } else {
                              primaryInfo = {
                                label: "CCAer",
                                color: "bg-slate-500",
                                hex: "#64748b",
                              };
                            }
                          } else {
                            const courseLabels: Record<
                              string,
                              { label: string; color: string; hex: string }
                            > = {
                              AVIATION: {
                                label: "Aviação",
                                color: "bg-blue-600",
                                hex: "#1e40af",
                              },
                              INTENDANCY: {
                                label: "Intendência",
                                color: "bg-amber-600",
                                hex: "#d97706",
                              },
                              INFANTRY: {
                                label: "Infantaria",
                                color: "bg-green-700",
                                hex: "#15803d",
                              },
                            };
                            primaryInfo = courseLabels[course] || {
                              label: "Outro",
                              color: "bg-slate-500",
                              hex: "#64748b",
                            };

                            // Add cohort as secondary if available
                            const squad = notice.targetSquadron;
                            if (
                              squad &&
                              ["1", "2", "3", "4"].includes(String(squad))
                            ) {
                              const entryYear = visualYear - Number(squad) + 1;
                              const cohort = cohorts.find(
                                (c) => Number(c.entryYear) === entryYear,
                              );
                              if (cohort) {
                                const tokens = getCohortColorTokens(
                                  cohort.color || "blue",
                                );
                                secondaryInfo = {
                                  label: cohort.name,
                                  color: "bg-custom",
                                  hex: sqDisplayColor(tokens, isDark),
                                  bgColor: tokens.light,
                                  textColor: tokens.dark,
                                };
                              }
                            }
                          }

                          return {
                            primary: primaryInfo,
                            secondary: secondaryInfo,
                          };
                        };

                        const badgeData = getEventBadgeInfo();
                        const info = badgeData.primary;
                        const secondaryInfo = badgeData.secondary;
                        const color = info.hex;

                        const nStart = new Date(notice.startDate + "T00:00:00");
                        const nEnd = new Date(notice.endDate + "T00:00:00");
                        const totalDays =
                          Math.ceil(
                            Math.abs(nEnd.getTime() - nStart.getTime()) /
                              (1000 * 60 * 60 * 24),
                          ) + 1;

                        return (
                          <div
                            key={notice.id}
                            className={`self-start rounded py-1 flex flex-col gap-1.5 text-[10px] border shadow-sm group hover:z-20 transition-all hover:shadow-md ${theme === "dark" ? "text-slate-100 border-slate-700" : "text-slate-900 border-slate-200"}`}
                            style={{
                              gridColumn: `${startIndex + 1} / ${endIndex + 2}`,
                              borderLeft: `4px solid ${color}`,
                              backgroundColor:
                                theme === "dark"
                                  ? `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.18)`
                                  : `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.12)`,
                            }}
                            title={`${notice.title}\n${notice.description}\n${formatDateForDisplay(notice.startDate)} - ${formatDateForDisplay(notice.endDate)}`}
                          >
                            <div
                              className={`grid gap-1`}
                              style={{
                                gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))`,
                              }}
                            >
                              {Array.from({ length: totalCols }).map((_, i) => {
                                const dayInWeek = weekDays[startIndex + i];
                                let dayIndex = 0;
                                if (dayInWeek) {
                                  const currentD = new Date(dayInWeek);
                                  currentD.setHours(0, 0, 0, 0);
                                  dayIndex =
                                    Math.ceil(
                                      Math.abs(
                                        currentD.getTime() - nStart.getTime(),
                                      ) /
                                        (1000 * 60 * 60 * 24),
                                    ) + 1;
                                }

                                return (
                                  <div
                                    key={i}
                                    className="px-1.5 flex flex-col gap-1.5 min-w-0"
                                  >
                                    <div className="flex items-center justify-between gap-0 overflow-hidden">
                                      <div className="flex items-center gap-1.5 max-w-[80%] flex-wrap">
                                        <span
                                          className={`${info.color === "bg-custom" ? "" : info.color + " text-white"} px-1.5 py-0.5 rounded-[4px] text-[7px]  uppercase tracking-wider truncate ${dayIndex === 1 ? "" : "opacity-40"}`}
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
                                            className={`px-1.5 py-0.5 rounded-[4px] text-[7px]  uppercase tracking-wider truncate ${dayIndex === 1 ? "" : "opacity-40"}`}
                                            style={{
                                              backgroundColor:
                                                secondaryInfo.bgColor,
                                              color: secondaryInfo.textColor,
                                              border: `1px solid ${secondaryInfo.hex}`,
                                            }}
                                          >
                                            {secondaryInfo.label}
                                          </span>
                                        )}
                                      </div>
                                      {totalDays > 1 && (
                                        <span
                                          className={`text-[7px]  ${dayIndex === 1 ? "opacity-60" : "opacity-30"} flex-shrink-0 ${theme === "dark" ? "text-white" : "text-slate-600"}`}
                                        >
                                          {dayIndex}/{totalDays}
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className={`mt-0.5 ${dayIndex > 1 ? "opacity-60" : ""}`}
                                    >
                                      <div className=" uppercase text-[8px] leading-tight flex items-center gap-0">
                                        {notice.title}
                                      </div>
                                      {/* Avaliações Badges removidas de notice pois SystemNotice não possui estes campos */}
                                      {notice.description &&
                                        notice.description !==
                                          "Bloqueio Acadêmico" &&
                                        notice.description !==
                                          "Evento Acadêmico" && (
                                          <div className="text-[6px] opacity-70 leading-none lowercase first-letter:uppercase break-words">
                                            {notice.description}
                                          </div>
                                        )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        <div>
          {TIME_SLOTS.map((slot, index) => (
            <div
              key={slot.start}
              className={`
                                grid grid-cols-7 border-b min-h-[36px] transition-colors
                                ${theme === "dark" ? "border-slate-700" : "border-gray-100"}
                                ${index % 2 === 0 ? (theme === "dark" ? "bg-slate-800/30" : "bg-gray-50/20") : ""}
                            `}
            >
              {/* Time Label */}
              <div
                className={`p-2 text-[12px]  border-r flex items-center justify-center ${theme === "dark" ? "text-slate-300 border-slate-700 bg-slate-800/30" : "text-slate-600 border-gray-100 bg-gray-50/30"}`}
              >
                {slot.start}
              </div>
              {/* Day Slots */}
              {DAYS.map((day, dayIndex) => {
                const date = weekDays[dayIndex];
                if (!date)
                  return (
                    <div
                      key={day}
                      className={`border-r ${theme === "dark" ? "bg-slate-900/50 border-slate-700" : "bg-gray-50/50 border-gray-100"}`}
                    />
                  );

                const slotKey = `${formatDate(date)}|${slot.start}`;
                const isSelected = selectedSlots.includes(slotKey);

                const targetDateString = date ? formatDate(date) : "";

                const slotEvents = events.filter((e) => {
                  const isAcad =
                    e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC";
                  return (
                    e.date === targetDateString &&
                    e.startTime === slot.start &&
                    !isAcad
                  );
                });

                const blockingNotice =
                  slotEvents.length === 0
                    ? events.find(
                        (e) =>
                          e.date === targetDateString &&
                          (e.type === "ACADEMIC" ||
                            e.disciplineId === "ACADEMIC") &&
                          e.isBlocking !== false,
                      )
                    : null;
                const isBlocked = !!blockingNotice;

                return (
                  <div
                    key={dayIndex}
                    className={`
                                        border-r min-h-0 h-auto relative
                                        transition-all p-0.5 flex flex-col items-stretch gap-1.5
                                        ${theme === "dark" ? "border-slate-700" : "border-gray-100"}
                                        ${
                                          isBlocked
                                            ? "cursor-not-allowed"
                                            : selectionMode
                                              ? isSelected
                                                ? theme === "dark"
                                                  ? "bg-blue-900/30 ring-2 ring-inset ring-blue-700"
                                                  : "bg-blue-100 ring-2 ring-inset ring-blue-500"
                                                : theme === "dark"
                                                  ? "hover:bg-blue-900/10"
                                                  : "hover:bg-blue-50"
                                              : theme === "dark"
                                                ? "hover:bg-slate-700/30 cursor-pointer"
                                                : "hover:bg-blue-50/30 cursor-pointer"
                                        }
                                    `}
                    onClick={() => {
                      if (!isBlocked) onSlotClick(DAYS[dayIndex], slot.start);
                    }}
                    onDragOver={(e) => {
                      if (selectionMode || !onEventDrop || isBlocked) return;
                      e.preventDefault(); // Required for drop
                      e.currentTarget.classList.add("bg-blue-50/50");
                    }}
                    onDragLeave={(e) => {
                      if (isBlocked) return;
                      e.currentTarget.classList.remove("bg-blue-50/50");
                    }}
                    onDrop={(e) => {
                      if (selectionMode || !onEventDrop || isBlocked) return;
                      e.preventDefault();
                      e.currentTarget.classList.remove("bg-blue-50/50");
                      const eventId = e.dataTransfer.getData("eventId");
                      if (eventId) {
                        onEventDrop(eventId, targetDateString, slot.start);
                      }
                    }}
                  >
                    {selectionMode && !isBlocked && (
                      <div className="absolute top-1 right-1 z-20 pointer-events-none">
                        {isSelected ? (
                          <CheckSquare
                            size={14}
                            className="text-blue-600 fill-blue-100"
                          />
                        ) : (
                          <Square size={14} className="text-slate-300" />
                        )}
                      </div>
                    )}
                    {isBlocked && (
                      <div
                        className="flex flex-col items-center justify-center flex-1 rounded opacity-50 overflow-hidden min-h-[24px]"
                        style={{
                          backgroundColor: blockingNotice.color || "#f59e0b",
                        }}
                        title={`Bloqueio: ${blockingNotice.location}`}
                      >
                        <span className="text-white  text-[8px] uppercase text-center leading-tight drop-shadow-md truncate w-full px-1">
                          {blockingNotice.location || "BLOQUEIO"}
                        </span>
                      </div>
                    )}
                    {slotEvents.map((event) => {
                      const discipline = getDiscipline(event.disciplineId);
                      const isEvaluation = event.type === "EVALUATION";

                      const bgColor = discipline?.color || "#3b82f6";

                      // Helper: resolve course type color (dark shade)
                      const COURSE_COLORS: Record<string, string> = {
                        AVIATION: "#1e40af", // Blue
                        INTENDANCY: "#d97706", // Amber
                        INFANTRY: "#15803d", // Green
                      };

                      const getClassBadgeBg = (id: string): string => {
                        if (id.endsWith("AVIATION") || id.includes("AVIATION"))
                          return COURSE_COLORS.AVIATION;
                        if (
                          id.endsWith("INTENDANCY") ||
                          id.includes("INTENDANCY")
                        )
                          return COURSE_COLORS.INTENDANCY;
                        if (id.endsWith("INFANTRY") || id.includes("INFANTRY"))
                          return COURSE_COLORS.INFANTRY;
                        if (id.endsWith("ESQ")) {
                          const squadron = parseInt(id.charAt(0));
                          const entryYear = visualYear - squadron + 1;
                          const cohort = cohorts.find(
                            (c) => Number(c.entryYear) === entryYear,
                          );
                          if (cohort?.color && COHORT_COLORS[cohort.color]) {
                            return COHORT_COLORS[cohort.color].dark;
                          }
                          return "rgba(255,255,255,0.2)";
                        }
                        // Specific class (e.g. "1A", "2E", "3F")
                        // Letter A-D = Aviation, E = Intendancy, F = Infantry
                        const classLetter = id.slice(1).toUpperCase();
                        if (["A", "B", "C", "D"].includes(classLetter))
                          return COURSE_COLORS.AVIATION;
                        if (classLetter === "E")
                          return COURSE_COLORS.INTENDANCY;
                        if (classLetter === "F") return COURSE_COLORS.INFANTRY;
                        return "rgba(255,255,255,0.2)";
                      };

                      const isFirstClass =
                        eventCounts && eventCounts[event.id]?.current === 1;
                      const isLastClass =
                        eventCounts &&
                        eventCounts[event.id]?.total > 0 &&
                        eventCounts[event.id]?.current ===
                          eventCounts[event.id]?.total;

                      const activeConfig = visualConfigs
                        .filter((c) => c.active)
                        .sort((a, b) => b.priority - a.priority)
                        .find((c) => {
                          if (c.ruleType === "EVALUATION" && isEvaluation) {
                            return (
                              !c.evaluationType ||
                              c.evaluationType === event.evaluationType
                            );
                          }
                          if (c.ruleType === "FIRST_LESSON" && isFirstClass)
                            return true;
                          if (c.ruleType === "LAST_LESSON" && isLastClass)
                            return true;
                          return false;
                        });

                      const activeRingColor = activeConfig
                        ? theme === "light" &&
                          (activeConfig.ringColor === "#FFFFFF" ||
                            activeConfig.ringColor?.toLowerCase() === "#ffffff")
                          ? "#1e293b"
                          : activeConfig.ringColor
                        : "";

                      return (
                        <div
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectionMode && onEventSelect) {
                              onEventSelect(event.id);
                            } else {
                              onEventClick(event);
                            }
                          }}
                          className={`rounded-md px-1.5 py-1 text-white shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col w-full cursor-pointer active:scale-[0.98] active:opacity-75 ${selectionMode && selectedEventIds.includes(event.id) ? "ring-2 ring-white ring-offset-2 ring-offset-blue-500" : ""}`}
                          style={{
                            backgroundColor: bgColor,
                            border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.3)"}`,
                            boxShadow: activeConfig?.showRing
                              ? `inset 0 0 0 ${activeConfig.ringWidth || 2}px ${activeRingColor}, 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`
                              : "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
                          }}
                          title={`${isEvaluation ? `[${event.evaluationType}] ` : ""}${activeConfig?.showTag ? `[${activeConfig.tagText}] ` : ""}${discipline?.name || "???"} - ${formatClassId(event.classId)}${event.instructorTrigram || discipline?.instructorTrigram ? ` - ${event.instructorTrigram || discipline?.instructorTrigram}` : discipline?.instructor ? ` - ${discipline.instructor}` : ""}${` - ${event.type === "ACADEMIC" ? event.location : discipline?.location || "a definir"}`}`}
                          draggable={!selectionMode && !!onEventDrop}
                          onDragStart={(e) => {
                            if (selectionMode || !onEventDrop) return;
                            e.dataTransfer.setData("eventId", event.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                        >
                          {/* Line 1: Code + Turma badge */}
                          <div className="flex items-center gap-1 w-full">
                            {(isEvaluation || isFirstClass) &&
                              activeConfig?.showIcon !== false && (
                                <AlertCircle
                                  size={10}
                                  className="text-white fill-white/20"
                                />
                              )}
                            <span className=" text-[10px] drop-shadow-sm truncate min-w-0 flex-1 flex items-center gap-1">
                              {selectionMode && (
                                <div className="mr-1">
                                  {selectedEventIds.includes(event.id) ? (
                                    <CheckSquare
                                      size={10}
                                      className="text-white fill-white/20"
                                    />
                                  ) : (
                                    <Square
                                      size={10}
                                      className="text-white opacity-40"
                                    />
                                  )}
                                </div>
                              )}
                              <span className="truncate font-bold">
                                {discipline?.code || "???"}
                              </span>
                              {activeConfig?.showTag && (
                                <span
                                  className="px-1 py-0.5 rounded-[3px] text-[7px]  uppercase tracking-tighter inline-flex items-center justify-center leading-none flex-shrink-0"
                                  style={{
                                    backgroundColor: activeConfig.tagBgColor,
                                    color: activeConfig.tagTextColor,
                                  }}
                                >
                                  {activeConfig.tagText}
                                </span>
                              )}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[8px]  flex-shrink-0 ml-auto shadow-sm tracking-tighter border backdrop-blur-md inline-flex items-center justify-center leading-none ${theme === "dark" ? "border-white/20" : "border-black/30"}`}
                              style={{
                                backgroundColor: getClassBadgeBg(event.classId),
                              }}
                            >
                              {formatClassId(event.classId)}
                            </span>
                          </div>

                          {/* SAP Badge */}
                          {(() => {
                            const sap = getChangeRequest(event.changeRequestId);
                            if (!sap) return null;
                            return (
                              <div
                                className="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/90 text-white text-[7px] w-fit shadow-sm border border-amber-400/50"
                                title={`SAP: ${sap.numeroAlteracao}\nSolicitante: ${sap.solicitante}\nMotivo: ${sap.motivo}\n${sap.descricao}`}
                              >
                                <FileEdit size={8} />
                                <span className="font-bold">
                                  {sap.numeroAlteracao}
                                </span>
                              </div>
                            );
                          })()}

                          {/* Line 2: Instructor trigram + counter */}
                          <div className="flex items-center justify-between w-full gap-1">
                            {(() => {
                              const trigram =
                                event.instructorTrigram ||
                                discipline?.instructorTrigram;
                              const inst = trigram
                                ? instructors.find((i) => i.trigram === trigram)
                                : null;
                              const isUnauthorized =
                                trigram &&
                                inst &&
                                (!inst.enabledClasses?.includes(event.classId) ||
                                  !inst.enabledDisciplines?.includes(event.disciplineId));
                              const displayName =
                                trigram ||
                                (discipline?.noSpecificInstructor ? "—" : "???");

                              return (
                                <div className="text-[8px] opacity-70 flex items-center gap-0.5 min-w-0 flex-1 overflow-hidden">
                                  {isUnauthorized && (
                                    <span title="Docente não habilitado para esta turma/disciplina">
                                      <AlertCircle size={8} className="text-red-400 fill-red-400/20" />
                                    </span>
                                  )}
                                  <span className={`truncate ${isUnauthorized ? "text-red-300" : ""}`}>
                                    {displayName}
                                  </span>
                                </div>
                              );
                            })()}

                            {eventCounts && eventCounts[String(event.id)] && (
                              <div
                                className="text-[8px] bg-black/10 px-1 rounded flex-shrink-0 text-center min-w-[24px]"
                                title={`Aula ${eventCounts[String(event.id)].current} de ${eventCounts[String(event.id)].total} programadas`}
                              >
                                {eventCounts[String(event.id)].current}/{eventCounts[String(event.id)].total}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMobileListView = () => (
    <div className="flex flex-col gap-4 pb-20">
      {DAYS.map((day, dayIndex) => {
        const date = weekDays[dayIndex];
        const dateString = date ? formatDate(date) : "";

        // Check if day has any events to highlight it?
        // Alternatively, just render all days.

        return (
          <div
            key={day}
            className={`border rounded-xl overflow-hidden shadow-sm ${theme === "dark" ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}
          >
            <div
              className={`p-3 border-b flex justify-between items-center ${theme === "dark" ? "bg-slate-700 border-slate-600" : "bg-slate-50 border-slate-200"}`}
            >
              <div
                className={` flex items-center gap-1.5 ${theme === "dark" ? "text-slate-200" : "text-slate-700"}`}
              >
                <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-xs">
                  {date?.getDate()}
                </span>
                <div>
                  <div>{DAY_LABELS[dayIndex]}</div>
                  <div
                    className={`text-[10px] font-normal uppercase ${theme === "dark" ? "text-slate-400" : "text-slate-400"}`}
                  >
                    {date?.toLocaleDateString("pt-BR", { month: "long" })}
                  </div>
                </div>
              </div>
              {day === "Saturday" && (
                <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full">
                  Dia {date ? getDayOfYear(date) : ""}
                </span>
              )}
            </div>

            <div
              className={`divide-y ${theme === "dark" ? "divide-slate-700" : "divide-slate-100"}`}
            >
              {TIME_SLOTS.map((slot) => {
                const slotEvents = events.filter(
                  (e) => e.date === dateString && e.startTime === slot.start,
                );

                const slotKey = `${dateString}|${slot.start}`;
                const isSelected = selectedSlots.includes(slotKey);

                if (slotEvents.length === 0) {
                  const blockingNotice = events.find(
                    (e) =>
                      e.date === dateString &&
                      (e.type === "ACADEMIC" ||
                        e.disciplineId === "ACADEMIC") &&
                      e.isBlocking !== false,
                  );
                  if (blockingNotice) {
                    return (
                      <div
                        key={slot.start}
                        className={`
                                                    p-3 flex gap-3 transition-all group opacity-70 cursor-not-allowed
                                                    ${theme === "dark" ? "hover:bg-slate-700/30" : "hover:bg-slate-50/50"}
                                                `}
                      >
                        <div className="w-16 text-xs text-slate-400 font-mono pt-1">
                          {slot.start.substring(0, 5)}
                        </div>
                        <div
                          className="flex-1 text-[10px] border border-transparent rounded px-2 py-1 flex items-center justify-center text-white/95  uppercase text-center drop-shadow-sm"
                          style={{
                            backgroundColor: blockingNotice.color || "#f59e0b",
                          }}
                        >
                          {blockingNotice.location || "Bloqueio"}
                        </div>
                      </div>
                    );
                  }

                  // Empty slot
                  return (
                    <div
                      key={slot.start}
                      onClick={() => onSlotClick(DAYS[dayIndex], slot.start)}
                      className={`
                                                p-3 flex gap-3 cursor-pointer transition-all group
                                                ${
                                                  selectionMode
                                                    ? isSelected
                                                      ? "bg-blue-50 ring-2 ring-inset ring-blue-500 dark:bg-blue-900/30 dark:ring-blue-700"
                                                      : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                                }
                                            `}
                    >
                      <div className="w-16 text-xs text-slate-400 dark:text-slate-500 font-mono pt-1">
                        {slot.start.substring(0, 5)}
                      </div>
                      <div
                        className={`
                                                flex-1 text-xs border border-dashed rounded px-2 py-1 transition-colors
                                                ${
                                                  isSelected
                                                    ? "border-blue-500 text-blue-700 bg-blue-100/50"
                                                    : theme === "dark"
                                                      ? "text-slate-500 border-slate-600 group-hover:border-blue-300 group-hover:text-blue-400"
                                                      : "text-slate-300 border-slate-200 group-hover:border-blue-300 group-hover:text-blue-400"
                                                }
                                            `}
                      >
                        {isSelected ? "Selecionado" : "Adicionar aula..."}
                      </div>
                      {selectionMode && (
                        <div className="text-slate-400 dark:text-slate-600">
                          {isSelected ? (
                            <CheckSquare
                              size={16}
                              className="text-blue-600 dark:text-blue-400"
                            />
                          ) : (
                            <Square size={16} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={slot.start}
                    className={`
                                            p-3 flex gap-3 h-auto relative transition-all
                                            ${
                                              selectionMode && isSelected
                                                ? theme === "dark"
                                                  ? "bg-blue-900/20 ring-2 ring-inset ring-blue-500"
                                                  : "bg-blue-50 ring-2 ring-inset ring-blue-500"
                                                : theme === "dark"
                                                  ? "bg-slate-800"
                                                  : "bg-white"
                                            }
                                        `}
                    onClick={() =>
                      selectionMode
                        ? onSlotClick(DAYS[dayIndex], slot.start)
                        : null
                    }
                  >
                    <div className="w-16">
                      <div
                        className={`text-[12px]  ${theme === "dark" ? "text-slate-200" : "text-slate-900"}`}
                      >
                        {slot.start.substring(0, 5)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {slot.end.substring(0, 5)}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-1.5">
                      {/* In selection mode, clicking event also selects the slot */}
                      {selectionMode && (
                        <div
                          className="absolute inset-0 z-20"
                          onClick={() =>
                            onSlotClick(DAYS[dayIndex], slot.start)
                          }
                        ></div>
                      )}
                      {slotEvents.map((event) => {
                        const discipline = getDiscipline(event.disciplineId);
                        const bgColor = discipline?.color || "#3b82f6";
                        const mIsEval = event.type === "EVALUATION";

                        const mIsFirst =
                          eventCounts && eventCounts[event.id]?.current === 1;
                        const mIsLast =
                          eventCounts &&
                          eventCounts[event.id]?.total > 0 &&
                          eventCounts[event.id]?.current ===
                            eventCounts[event.id]?.total;

                        const mActiveConfig = visualConfigs
                          .filter((c) => c.active)
                          .sort((a, b) => b.priority - a.priority)
                          .find((c) => {
                            if (c.ruleType === "EVALUATION" && mIsEval) {
                              return (
                                !c.evaluationType ||
                                c.evaluationType === event.evaluationType
                              );
                            }
                            if (c.ruleType === "FIRST_LESSON" && mIsFirst)
                              return true;
                            if (c.ruleType === "LAST_LESSON" && mIsLast)
                              return true;
                            return false;
                          });

                        const mActiveRingColor = mActiveConfig
                          ? theme === "light" &&
                            (mActiveConfig.ringColor === "#FFFFFF" ||
                              mActiveConfig.ringColor?.toLowerCase() ===
                                "#ffffff")
                            ? "#1e293b"
                            : mActiveConfig.ringColor
                          : "";

                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectionMode) {
                                onSlotClick(DAYS[dayIndex], slot.start);
                              } else {
                                onEventClick(event);
                              }
                            }}
                            className={`px-3 py-2 rounded-lg text-white shadow-sm relative overflow-hidden cursor-pointer flex flex-col gap-1.5`}
                            style={{
                              backgroundColor: bgColor,
                              border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.3)"}`,
                              boxShadow: mActiveConfig?.showRing
                                ? `inset 0 0 0 ${mActiveConfig.ringWidth || 2}px ${mActiveRingColor}, 0 1px 2px 0 rgb(0 0 0 / 0.05)`
                                : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                            }}
                          >
                            {/* Line 1: Code + Turma badge */}
                            <div className="flex items-center gap-1.5">
                              {eventCounts &&
                                eventCounts[event.id]?.current === 1 && (
                                  <AlertCircle
                                    size={14}
                                    className="text-white fill-white/20"
                                  />
                                )}
                              <span className=" text-sm flex-shrink-0 flex items-center gap-1.5">
                                {discipline?.code}
                                {event.instructorTrigram ||
                                discipline?.instructorTrigram ? (
                                  <span className="text-[10px]  opacity-60 bg-black/20 px-1 rounded">
                                    {event.instructorTrigram ||
                                      discipline?.instructorTrigram}
                                  </span>
                                ) : null}
                                {mActiveConfig?.showTag && (
                                  <span
                                    className="px-0.5 rounded-[1px] text-[7px]  uppercase tracking-tighter leading-none"
                                    style={{
                                      backgroundColor: mActiveConfig.tagBgColor,
                                      color: mActiveConfig.tagTextColor,
                                    }}
                                  >
                                    {mActiveConfig.tagText}
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-0 ml-auto flex-shrink-0">
                                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]  backdrop-blur-sm">
                                  {formatClassId(event.classId)}
                                </span>
                                {selectionMode && (
                                  <div className="ml-1 text-white">
                                    {isSelected ? (
                                      <CheckSquare
                                        size={14}
                                        className="fill-blue-600 "
                                      />
                                    ) : (
                                      <Square
                                        size={14}
                                        className="opacity-50"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Avaliações Badges */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {!!(event as ScheduleEvent & { isGraded?: boolean }).isGraded && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase border inline-flex items-center leading-none bg-red-50 text-red-600 border-red-100`}
                                >
                                  Avaliação
                                </span>
                              )}
                              {!!(event as ScheduleEvent & { isLessonOrder?: boolean }).isLessonOrder && (
                                <>
                                  {!!(event as ScheduleEvent & { isFirstLesson?: boolean }).isFirstLesson && (
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase border inline-flex items-center leading-none bg-blue-50 text-blue-600 border-blue-100`}
                                    >
                                      1ª Aula
                                    </span>
                                  )}
                                  {!!(event as ScheduleEvent & { isLastLesson?: boolean }).isLastLesson && (
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase border inline-flex items-center leading-none bg-purple-50 text-purple-600 border-purple-100`}
                                    >
                                      Última
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            {/* Line 2: Full discipline name */}
                            <div className="text-sm opacity-95 leading-snug truncate">
                              {discipline?.name}
                            </div>
                            {/* Line 3: Instructor + Location */}
                            {(() => {
                              const trigram =
                                event.instructorTrigram ||
                                discipline?.instructorTrigram;
                              const inst = trigram
                                ? instructors.find((i) => i.trigram === trigram)
                                : null;
                              const isUnauthorized =
                                trigram &&
                                inst &&
                                (!inst.enabledClasses?.includes(
                                  event.classId,
                                ) ||
                                  !inst.enabledDisciplines?.includes(
                                    event.disciplineId,
                                  ));
                              const displayName = inst
                                ? inst.warName
                                : trigram || discipline?.instructor;

                              if (
                                !displayName &&
                                !event.location &&
                                !discipline?.location
                              )
                                return null;

                              return (
                                <div className="text-xs opacity-75 flex items-center gap-1 truncate">
                                  {isUnauthorized && (
                                    <AlertCircle
                                      size={10}
                                      className="text-red-400"
                                    />
                                  )}
                                  {displayName && (
                                    <span
                                      className={`flex-shrink-0 ${isUnauthorized ? "text-red-300 " : ""}`}
                                    >
                                      {displayName}
                                    </span>
                                  )}
                                  {displayName && (
                                    <span className="flex-shrink-0">•</span>
                                  )}
                                  <span className="truncate">
                                    {event.type === "ACADEMIC"
                                      ? event.location
                                      : discipline?.location || "a definir"}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="md:hidden">{renderMobileListView()}</div>
      <div className="hidden md:block">{renderWeekView()}</div>
    </>
  );
};
