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

// Largura fixa de cada coluna de tempo (px) — define o quadrado
const COL_W = 76;
const ROW_H = COL_W; // quadrado perfeito
const LABEL_W = 36;

export const GanttView = ({ date, events, disciplines, classes, onEventClick, eventCounts }: Props) => {
  const { instructors } = useCourseStore();
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

  const border = isDark ? "border-slate-700" : "border-slate-200";
  const labelBg = isDark ? "bg-slate-800" : "bg-slate-50";
  const emptyBg = isDark ? "rgba(15,23,42,0.3)" : "rgba(248,250,252,0.9)";
  const textMain = isDark ? "text-slate-100" : "text-slate-800";
  const textMuted = isDark ? "text-slate-400" : "text-slate-500";

  function slotIndex(startTime: string) {
    return TIME_SLOTS.findIndex((s) => s.start === startTime);
  }

  const totalW = LABEL_W + COL_W * TIME_SLOTS.length;

  return (
    <div className="overflow-x-auto">
      <div style={{ width: totalW, minWidth: totalW }}>

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className={`flex border-b ${border}`}>
          {/* Label spacer */}
          <div style={{ width: LABEL_W, flexShrink: 0 }} className={`${labelBg} border-r ${border}`} />

          {TIME_SLOTS.map((slot, i) => (
            <div
              key={i}
              style={{ width: COL_W, flexShrink: 0 }}
              className={`flex flex-col items-center justify-center py-1 border-l ${border} ${i === 0 ? "border-l-0" : ""}`}
            >
              <span className={`text-[10px] font-bold leading-none ${textMain}`}>{slot.start}</span>
              <span className={`text-[8px] leading-none mt-0.5 ${textMuted}`}>{slot.end}</span>
            </div>
          ))}
        </div>

        {/* ── Rows ─────────────────────────────────────────────────── */}
        {classLetters.map((letter) => {
          const classId = `${squadronNum}${letter}`;
          const rowEvents = dayEvents.filter((e) => e.classId === classId);

          const slotMap: Record<number, ScheduleEvent> = {};
          rowEvents.forEach((ev) => {
            const idx = slotIndex(ev.startTime || "");
            if (idx >= 0) slotMap[idx] = ev;
          });

          return (
            <div
              key={letter}
              className={`flex border-b ${border}`}
              style={{ height: ROW_H }}
            >
              {/* Row label */}
              <div
                style={{ width: LABEL_W, flexShrink: 0 }}
                className={`flex items-center justify-center text-[10px] font-bold ${textMain} ${labelBg} border-r ${border}`}
              >
                T{letter}
              </div>

              {/* Slots */}
              {TIME_SLOTS.map((_, i) => {
                const ev   = slotMap[i];
                const disc = ev ? disciplines.find((d) => d.id === ev.disciplineId) : null;
                const count = ev ? eventCounts?.[String(ev.id)] : null;

                const bgColor = disc?.color || "#3b82f6";
                const trigram = ev
                  ? (ev.instructorTrigram || disc?.instructorTrigram || (disc as unknown as { data?: Record<string,string> })?.data?.instructor || "")
                  : "";
                const inst = trigram ? instructors.find((ins) => ins.trigram === trigram) : null;
                const displayInstructor = inst?.warName || trigram || "—";
                const displayLocation   = ev ? (ev.location || (disc as unknown as { data?: Record<string,string> })?.data?.location || "—") : "";
                const code = disc?.code || ev?.disciplineId || "";

                return (
                  <div
                    key={i}
                    style={{
                      width: COL_W,
                      height: ROW_H,
                      flexShrink: 0,
                      background: ev ? undefined : emptyBg,
                    }}
                    className={`border-l ${border} p-[3px]`}
                  >
                    {ev ? (
                      <div
                        onClick={() => onEventClick?.(ev)}
                        title={`${disc?.name || ev.disciplineId} | ${displayInstructor} | ${displayLocation}${count ? ` | Aula ${count.current}/${count.total}` : ""}`}
                        className="w-full h-full rounded cursor-pointer hover:brightness-110 transition-all flex flex-col justify-between px-[5px] py-[4px] overflow-hidden"
                        style={{
                          backgroundColor: bgColor,
                          border: "1px solid rgba(0,0,0,0.15)",
                        }}
                      >
                        {/* Linha 1 — código (maior) */}
                        <span className="text-white text-[11px] font-extrabold leading-none truncate">
                          {code}
                        </span>

                        {/* Linha 2 — docente */}
                        <span className="text-white/80 text-[8px] leading-none truncate">
                          {displayInstructor}
                        </span>

                        {/* Linha 3 — local */}
                        <span className="text-white/70 text-[8px] leading-none truncate">
                          {displayLocation}
                        </span>

                        {/* Linha 4 — contagem */}
                        <span className="text-white/60 text-[8px] leading-none">
                          {count ? `${count.current}/${count.total}` : ""}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
