import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import type { ScheduleEvent, Discipline } from "../types";
import { TIME_SLOTS } from "../utils/constants";

interface Props {
  date: string;
  events: ScheduleEvent[];
  disciplines: Discipline[];
  classes: string[];
  onEventClick?: (event: ScheduleEvent) => void;
  eventCounts?: Record<string, { current: number; total: number }>;
}

export const GanttView = ({ date, events, disciplines, classes, onEventClick, eventCounts }: Props) => {
  const { instructors } = useCourseStore();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const dayEvents = useMemo(() => {
    const filtered = events.filter((e) => e.date === date && e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC");
    if (filtered.length > 0) {
      const ev = filtered[0];
      console.log('[GanttView] evento exemplo:', JSON.stringify({ id: ev.id, instructorTrigram: ev.instructorTrigram, classId: ev.classId, disciplineId: ev.disciplineId }));
    }
    return filtered;
  }, [events, date]);

  const classLetters = useMemo(() => {
    const letters = new Set(classes.map((c) => c.slice(1)));
    return Array.from(letters).sort();
  }, [classes]);

  const squadronNum = classes[0]?.[0] ?? "1";

  const text   = isDark ? "text-slate-100" : "text-slate-800";
  const muted  = isDark ? "text-slate-400" : "text-slate-500";
  const border = isDark ? "border-slate-700" : "border-slate-200";
  const rowBg  = isDark ? "bg-slate-700/50" : "bg-slate-100";

  // Find which slot index an event maps to (by startTime)
  function slotIndex(startTime: string) {
    return TIME_SLOTS.findIndex((s) => s.start === startTime);
  }

  return (
    <div className="w-full">
      {/* ── Header row: slot labels ──────────────────────────────────── */}
      <div className="flex">
        {/* Label column spacer */}
        <div className="flex-shrink-0 w-12" />
        {TIME_SLOTS.map((slot, i) => (
          <div
            key={i}
            className={`flex-1 text-center text-[9px] font-semibold ${muted} border-l ${border} pb-1`}
          >
            {slot.start}
          </div>
        ))}
      </div>

      {/* ── Rows per class ───────────────────────────────────────────── */}
      {classLetters.map((letter) => {
        const classId = `${squadronNum}${letter}`;
        const rowEvents = dayEvents.filter((e) => e.classId === classId);

        // Build a slot → event map
        const slotMap: Record<number, ScheduleEvent> = {};
        rowEvents.forEach((ev) => {
          const idx = slotIndex(ev.startTime || "");
          if (idx >= 0) slotMap[idx] = ev;
        });

        return (
          <div key={letter} className={`flex items-stretch border-b ${border}`}>
            {/* Row label */}
            <div className={`flex-shrink-0 w-12 flex items-center justify-center text-xs font-bold ${text} ${rowBg} border-r ${border}`}>
              T{letter}
            </div>

            {/* Slots */}
            {TIME_SLOTS.map((_, i) => {
              const ev = slotMap[i];
              const disc = ev ? disciplines.find((d) => d.id === ev.disciplineId) : null;
              const count = ev ? eventCounts?.[String(ev.id)] : null;
              const bgColor = disc?.color || "#3b82f6";
              const trigram = ev ? (ev.instructorTrigram || disc?.instructorTrigram || disc?.instructor || "") : "";
              const inst = trigram ? instructors.find((i) => i.trigram === trigram) : null;
              const displayInstructor = inst?.warName || trigram;
              const displayLocation = ev ? (ev.location || disc?.location || "") : "";

              return (
                <div
                  key={i}
                  className={`flex-1 border-l ${border} p-0.5 min-h-[52px]`}
                  style={{ background: ev ? undefined : (isDark ? "rgba(15,23,42,0.3)" : "rgba(248,250,252,0.8)") }}
                >
                  {ev ? (
                    <div
                      onClick={() => onEventClick?.(ev)}
                      title={`${disc?.name || ev.disciplineId}${displayInstructor ? ` | ${displayInstructor}` : ""}${displayLocation ? ` | ${displayLocation}` : ""}${count ? ` | Aula ${count.current}/${count.total}` : ""}`}
                      className="h-full w-full rounded cursor-pointer hover:brightness-110 transition-all flex flex-col justify-between px-1.5 py-1 overflow-hidden"
                      style={{ backgroundColor: bgColor, border: "1px solid rgba(0,0,0,0.2)" }}
                    >
                      <span className="text-white text-[10px] font-bold leading-tight truncate">
                        {disc?.code || ev.disciplineId}
                      </span>
                      <div className="flex items-end justify-between gap-1">
                        <span className="text-white/70 text-[8px] leading-none truncate">
                          {displayInstructor}
                          {displayInstructor && displayLocation ? " · " : ""}
                          {displayLocation}
                        </span>
                        {count && (
                          <span className="text-white/60 text-[8px] leading-none flex-shrink-0">
                            {count.current}/{count.total}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
