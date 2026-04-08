import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import type { ScheduleEvent, Discipline } from "../types";
import { TIME_SLOTS } from "../utils/constants";

interface Props {
  date: string; // YYYY-MM-DD
  events: ScheduleEvent[];
  disciplines: Discipline[];
  classes: string[]; // e.g. ["1A","1B","1C","1D","1E","1F"]
  onEventClick?: (event: ScheduleEvent) => void;
  eventCounts?: Record<string, { current: number; total: number }>;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const SLOT_START = timeToMinutes(TIME_SLOTS[0].start);            // 07:00 = 420
const SLOT_END   = timeToMinutes(TIME_SLOTS[TIME_SLOTS.length - 1].end); // 17:50 = 1070
const TOTAL_MINS = SLOT_END - SLOT_START;

function pct(t: string) {
  return ((timeToMinutes(t) - SLOT_START) / TOTAL_MINS) * 100;
}

function width(start: string, end: string) {
  return ((timeToMinutes(end) - timeToMinutes(start)) / TOTAL_MINS) * 100;
}

// ─── component ───────────────────────────────────────────────────────────────

export const GanttView = ({
  date,
  events,
  disciplines,
  classes,
  onEventClick,
  eventCounts,
}: Props) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const dayEvents = useMemo(
    () => events.filter((e) => e.date === date && e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC"),
    [events, date]
  );

  const classLetters = useMemo(() => {
    const letters = new Set(classes.map((c) => c.slice(1)));
    return Array.from(letters).sort();
  }, [classes]);

  const squadronNum = classes[0]?.[0] ?? "1";

  const text    = isDark ? "text-slate-100" : "text-slate-800";
  const muted   = isDark ? "text-slate-400" : "text-slate-500";
  const border  = isDark ? "border-slate-700" : "border-slate-200";
  const rowBg   = isDark ? "bg-slate-800/50" : "bg-slate-50";
  const trackBg = isDark ? "bg-slate-900/60" : "bg-slate-100";

  return (
    <div className="flex flex-col gap-0 overflow-x-auto">
      {/* ── Time ruler ────────────────────────────────────────────────── */}
      <div className="flex" style={{ paddingLeft: "3.5rem" }}>
        {TIME_SLOTS.map((slot, i) => (
          <div
            key={i}
            className={`flex-shrink-0 text-[9px] font-medium ${muted} border-l ${border} pl-1`}
            style={{ width: `${100 / TIME_SLOTS.length}%` }}
          >
            {slot.start}
          </div>
        ))}
        {/* last tick */}
        <div className={`flex-shrink-0 text-[9px] font-medium ${muted} border-l ${border} pl-1`}>
          {TIME_SLOTS[TIME_SLOTS.length - 1].end}
        </div>
      </div>

      {/* ── Rows per class ────────────────────────────────────────────── */}
      {classLetters.map((letter) => {
        const classId = `${squadronNum}${letter}`;
        const rowEvents = dayEvents.filter((e) => e.classId === classId);

        return (
          <div key={letter} className={`flex items-center gap-2 border-b ${border} py-1`}>
            {/* Label */}
            <div
              className={`flex-shrink-0 w-12 text-center text-xs font-bold ${text} ${rowBg} rounded py-1`}
            >
              T{letter}
            </div>

            {/* Track */}
            <div className={`relative flex-1 h-9 rounded-md ${trackBg} overflow-hidden`}>
              {/* Slot separators */}
              {TIME_SLOTS.map((slot, i) => (
                <div
                  key={i}
                  className={`absolute top-0 bottom-0 border-l ${border} opacity-40`}
                  style={{ left: `${pct(slot.start)}%` }}
                />
              ))}

              {/* Events */}
              {rowEvents.map((ev) => {
                const disc = disciplines.find((d) => d.id === ev.disciplineId);
                const start = ev.startTime || "07:00";
                const end   = ev.endTime   || "08:00";
                const left  = pct(start);
                const w     = width(start, end);
                const count = eventCounts?.[String(ev.id)];
                const bgColor = disc?.color || "#3b82f6";

                return (
                  <div
                    key={ev.id}
                    onClick={() => onEventClick?.(ev)}
                    title={`${disc?.name || ev.disciplineId} | ${start}–${end}${ev.instructorTrigram ? ` | ${ev.instructorTrigram}` : ""}${count ? ` | Aula ${count.current}/${count.total}` : ""}`}
                    className="absolute top-0.5 bottom-0.5 rounded cursor-pointer hover:brightness-110 hover:z-10 transition-all flex flex-col justify-between px-1.5 overflow-hidden"
                    style={{
                      left: `${left}%`,
                      width: `${w}%`,
                      backgroundColor: bgColor,
                      border: `1px solid rgba(0,0,0,0.25)`,
                    }}
                  >
                    <span className="text-white text-[10px] font-bold leading-tight truncate">
                      {disc?.code || ev.disciplineId}
                    </span>
                    {count && (
                      <span className="text-white/70 text-[8px] leading-none text-right">
                        {count.current}/{count.total}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Empty state */}
              {rowEvents.length === 0 && (
                <div className={`absolute inset-0 flex items-center justify-center text-[10px] ${muted} opacity-40`}>
                  sem aulas
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
