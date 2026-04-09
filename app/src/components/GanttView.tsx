import { useMemo, useRef } from "react";
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
  canEdit?: boolean;
  selectedEventIds?: string[];
  onSelectEvent?: (eventId: string) => void;
  isSelectionMode?: boolean;
  onSlotDrop?: (event: ScheduleEvent, newSlotIndex: number) => void;
  onEmptySlotClick?: (classId: string, slotIndex: number, date: string) => void;
  isBatchMode?: boolean;
  selectedSlots?: { classId: string; slotIndex: number; date: string }[];
  onSlotSelect?: (classId: string, slotIndex: number, date: string) => void;
}

// Largura fixa de cada coluna de tempo (px) — define o quadrado
const COL_W = 76;
const ROW_H = COL_W; // quadrado perfeito
const LABEL_W = 36;

export const GanttView = ({
  date,
  events,
  disciplines,
  classes,
  onEventClick,
  eventCounts,
  canEdit = false,
  selectedEventIds = [],
  onSelectEvent,
  isSelectionMode = false,
  onSlotDrop,
  onEmptySlotClick,
  isBatchMode = false,
  selectedSlots = [],
  onSlotSelect,
}: Props) => {
  const { instructors } = useCourseStore();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const dragEventRef = useRef<ScheduleEvent | null>(null);

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
                {squadronNum}{letter}
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

                const isSelected = ev ? selectedEventIds.includes(ev.id) : false;
                const isSlotSelected = !ev && selectedSlots.some(
                  (s) => s.classId === classId && s.slotIndex === i && s.date === date
                );

                const handleDragStart = (e: React.DragEvent) => {
                  if (!canEdit || !ev) return;
                  dragEventRef.current = ev;
                  e.dataTransfer.effectAllowed = "move";
                };

                const handleDragOver = (e: React.DragEvent) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                };

                const handleDrop = (e: React.DragEvent) => {
                  e.preventDefault();
                  if (!canEdit || !dragEventRef.current || !onSlotDrop) return;
                  const dragged = dragEventRef.current;
                  dragEventRef.current = null;
                  // Only move if same row (classId) and different slot
                  if (dragged.classId !== classId) return;
                  if (slotIndex(dragged.startTime || "") === i) return;
                  onSlotDrop(dragged, i);
                };

                const handleClick = () => {
                  if (!ev) return;
                  if (isSelectionMode && onSelectEvent) {
                    onSelectEvent(ev.id);
                  } else {
                    onEventClick?.(ev);
                  }
                };

                return (
                  <div
                    key={i}
                    style={{
                      width: COL_W,
                      height: ROW_H,
                      flexShrink: 0,
                      background: ev ? undefined : emptyBg,
                    }}
                    className={`border-l ${border} p-[3px] ${
                      isBatchMode && !ev
                        ? isSlotSelected
                          ? "bg-green-500/20 ring-1 ring-green-400 cursor-pointer"
                          : "hover:bg-green-500/10 cursor-pointer"
                        : canEdit && !ev && !isSelectionMode
                          ? "hover:bg-blue-500/10 cursor-pointer"
                          : ""
                    }`}
                    onClick={
                      isBatchMode && !ev
                        ? () => onSlotSelect?.(classId, i, date)
                        : !ev && canEdit && !isSelectionMode
                          ? () => onEmptySlotClick?.(classId, i, date)
                          : undefined
                    }
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    {ev ? (
                      <div
                        onClick={handleClick}
                        draggable={canEdit}
                        onDragStart={handleDragStart}
                        title={`${disc?.name || ev.disciplineId} | ${displayInstructor} | ${displayLocation}${count ? ` | Aula ${count.current}/${count.total}` : ""}`}
                        className="w-full h-full rounded cursor-pointer hover:brightness-110 transition-all flex flex-col justify-between px-[5px] py-[4px] overflow-hidden"
                        style={{
                          backgroundColor: bgColor,
                          border: isSelected ? "2px solid white" : "1px solid rgba(0,0,0,0.15)",
                          outline: isSelected ? "2px solid #3b82f6" : "none",
                          outlineOffset: "1px",
                          cursor: canEdit ? (isSelectionMode ? "pointer" : "grab") : "pointer",
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
