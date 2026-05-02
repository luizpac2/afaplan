import { useMemo, useRef, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { useDefaultRoomsMap } from "../hooks/useDefaultRoom";
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
  onDeleteEvent?: (eventId: string) => void;
}

const LABEL_W = 28;
const TRAINING_FIELDS = new Set(["GERAL", "MILITAR", "PROFISSIONAL", "ATIVIDADES_COMPLEMENTARES"]);

const EVAL_LABELS: Record<string, string> = {
  PARTIAL:       "Parcial",
  EXAM:          "Exame",
  FINAL:         "Final",
  SECOND_CHANCE: "2ª Chamada",
  REVIEW:        "Vista",
};
const EVAL_COLORS: Record<string, string> = {
  PARTIAL:       "#ea580c",
  EXAM:          "#ea580c",
  FINAL:         "#ea580c",
  SECOND_CHANCE: "#ea580c",
  REVIEW:        "#ea580c",
};

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
  onDeleteEvent,
}: Props) => {
  const { instructors, locations, changeRequests } = useCourseStore();
  const { theme } = useTheme();
  const defaultRoomsMap = useDefaultRoomsMap();
  const isDark = theme === "dark";
  const dragEventRef = useRef<ScheduleEvent | null>(null);
  // Overlap popover: { key: "classId_slotIdx", events }
  const [overlapPopover, setOverlapPopover] = useState<{ key: string; evs: ScheduleEvent[] } | null>(null);

  const dayEvents = useMemo(() => {
    return events.filter((e) => e.date === date && e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC");
  }, [events, date]);

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

  return (
    <div className="w-full">
      <div className="w-full">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className={`flex border-b ${border}`}>
          {/* Label spacer */}
          <div style={{ width: LABEL_W, flexShrink: 0 }} className={`${labelBg} border-r ${border}`} />

          {TIME_SLOTS.map((slot, i) => (
            <div
              key={i}
              style={{ flexShrink: 1, flexGrow: 1, flexBasis: 0, minWidth: 36, overflow: "hidden" }}
              className={`flex flex-col items-center justify-center py-1 border-l ${border} ${i === 0 ? "border-l-0" : ""}`}
            >
              <span className={`text-[9px] font-bold leading-none ${textMain}`}>{slot.start}</span>
              <span className={`text-[7px] leading-none mt-0.5 ${textMuted} hidden md:block`}>{slot.end}</span>
            </div>
          ))}
        </div>

        {/* ── Rows ─────────────────────────────────────────────────── */}
        {classLetters.map((letter) => {
          const classId = `${squadronNum}${letter}`;
          const rowEvents = dayEvents.filter((e) => e.classId === classId);

          const slotMap: Record<number, ScheduleEvent> = {};
          const overlapMap: Record<number, ScheduleEvent[]> = {}; // idx → todos os eventos sobrepostos
          rowEvents.forEach((ev) => {
            const idx = slotIndex(ev.startTime || "");
            if (idx < 0) return;
            if (slotMap[idx]) {
              overlapMap[idx] = overlapMap[idx] ?? [slotMap[idx]];
              overlapMap[idx].push(ev);
              console.warn(`[GanttView] Sobreposição detectada: classId=${classId} slot=${ev.startTime} date=${date}`, overlapMap[idx]);
            } else {
              slotMap[idx] = ev;
            }
          });

          return (
            <div
              key={letter}
              className={`flex border-b ${border} h-10 md:h-20`}
            >
              {/* Row label */}
              <div
                style={{ width: LABEL_W, flexShrink: 0 }}
                className={`flex items-center justify-center text-[9px] font-bold ${textMain} ${labelBg} border-r ${border} h-full`}
              >
                {squadronNum}{letter}
              </div>

              {/* Slots */}
              {TIME_SLOTS.map((_, i) => {
                const ev   = slotMap[i];
                const overlapEvs = overlapMap[i]; // defined only when ≥2 events share this slot
                const hasOverlap = !!overlapEvs;
                const disc = ev ? disciplines.find((d) => d.id === ev.disciplineId) : null;
                const slotKey = ev ? `${ev.classId}|${ev.date}|${ev.startTime}` : null;
                const count = slotKey ? eventCounts?.[slotKey] : null;

                const isEval = ev?.type === "EVALUATION";
                const evalType = ev?.evaluationType || "";
                const bgColor = hasOverlap ? "#b91c1c"
                  : isEval ? (EVAL_COLORS[evalType] || "#92400e")
                  : (disc?.color || "#3b82f6");
                const trigram = ev
                  ? (ev.instructorTrigram || disc?.instructorTrigram || (disc as unknown as { data?: Record<string,string> })?.data?.instructor || "")
                  : "";
                const inst = trigram ? instructors.find((ins) => ins.trigram === trigram) : null;
                const displayInstructor = inst?.warName || trigram || "—";
                const rawLocation = ev ? (ev.location || disc?.location || "") : "";
                // Fallback: sala padrão da turma quando nem o evento nem a disciplina têm local
                const effectiveLocation = (() => {
                  if (rawLocation && !TRAINING_FIELDS.has(rawLocation) && rawLocation.toLowerCase() !== "sala de aula") return rawLocation;
                  const defaultLocId = defaultRoomsMap[ev?.classId ?? ""];
                  if (defaultLocId) return locations.find((l) => l.id === defaultLocId)?.name ?? rawLocation;
                  return rawLocation;
                })();
                const displayLocation = TRAINING_FIELDS.has(effectiveLocation) ? "" : effectiveLocation;
                const rawCode = disc?.code || ev?.disciplineId || "";
                // Se não achou a disciplina e o id parece UUID, mostra só "???"
                const code = disc ? rawCode : (rawCode.includes("-") ? "???" : rawCode);

                const sapLinked = ev?.changeRequestId
                  ? changeRequests.find((r) => r.id === ev.changeRequestId)
                  : null;
                const sapTag = sapLinked
                  ? sapLinked.numeroAlteracao.replace(/^SAP\s*/, "SAP-").replace(/\/\d+$/, "")
                  : null;

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
                  if (hasOverlap && canEdit) {
                    const key = `${classId}_${i}`;
                    setOverlapPopover(prev => prev?.key === key ? null : { key, evs: overlapEvs! });
                    return;
                  }
                  if (isSelectionMode && onSelectEvent) {
                    onSelectEvent(ev.id);
                  } else {
                    onEventClick?.(ev);
                  }
                };

                const popoverKey = `${classId}_${i}`;
                const isPopoverOpen = overlapPopover?.key === popoverKey;

                return (
                  <div
                    key={i}
                    style={{
                      flexShrink: 1,
                      flexGrow: 1,
                      flexBasis: 0,
                      minWidth: 36,
                      overflow: "hidden",
                      background: ev ? undefined : emptyBg,
                      position: "relative",
                    }}
                    className={`border-l ${border} p-[2px] ${
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
                      <>
                        <div
                          onClick={handleClick}
                          draggable={canEdit && !hasOverlap}
                          onDragStart={handleDragStart}
                          title={hasOverlap
                            ? `⚠ ${overlapEvs!.length} aulas no mesmo horário — clique para resolver`
                            : `${disc?.name || ev.disciplineId} | ${displayInstructor} | ${displayLocation}${count ? ` | Aula ${count.current}/${count.total}` : ""}`}
                          className="w-full h-full rounded transition-all flex flex-col items-center justify-center overflow-hidden relative gap-0.5"
                          style={{
                            backgroundColor: bgColor,
                            border: hasOverlap ? "2px solid #ef4444" : isEval ? "2px solid rgba(255,255,255,0.3)" : isSelected ? "2px solid white" : "1px solid rgba(0,0,0,0.15)",
                            outline: isSelected ? "2px solid #3b82f6" : "none",
                            outlineOffset: "1px",
                            cursor: hasOverlap ? "pointer" : canEdit ? (isSelectionMode ? "pointer" : "grab") : "pointer",
                          }}
                        >
                          {/* Badge SAP — desktop: tag centralizada com padding; mobile: ponto vermelho no canto */}
                          {!hasOverlap && sapTag && (
                            <>
                              {/* Desktop */}
                              <div className="absolute hidden md:flex" style={{ top: 2, left: 0, right: 0, justifyContent: "center", pointerEvents: "none" }}>
                                <span className="bg-red-600 text-white font-bold px-1 leading-tight rounded-b-sm" style={{ fontSize: 6, letterSpacing: "0.02em" }}>
                                  {sapTag}
                                </span>
                              </div>
                              {/* Mobile: indicador mínimo no canto superior direito */}
                              <div className="absolute top-0 right-0 md:hidden flex items-center justify-center bg-red-600 rounded-bl-sm" style={{ width: 10, height: 8 }}>
                                <span className="text-white font-black leading-none" style={{ fontSize: 4 }}>S</span>
                              </div>
                            </>
                          )}
                          {/* Código da disciplina — sempre visível, nunca truncado */}
                          <span className="text-white text-[9px] font-extrabold leading-none w-full text-center overflow-hidden" style={{ letterSpacing: "-0.02em" }}>
                            {hasOverlap ? "⚠" : code}
                          </span>
                          {/* Label de avaliação */}
                          {!hasOverlap && isEval && (
                            <span className="text-white/90 text-[7px] font-bold leading-none uppercase tracking-wide w-full text-center truncate px-0.5">
                              {EVAL_LABELS[evalType] || evalType || "Parcial"}
                            </span>
                          )}
                          {/* Contagem */}
                          {!hasOverlap && count && (
                            <span className="text-white/60 text-[8px] leading-none">
                              {count.current}/{count.total}
                            </span>
                          )}
                          {/* Trigrama — apenas no desktop (junto com nome de guerra) */}
                          {/* Nome de guerra e local — apenas no desktop */}
                          {!hasOverlap && (
                            <span className="text-white/80 text-[8px] leading-none truncate px-1 w-full text-center hidden md:block">
                              {displayInstructor}
                            </span>
                          )}
                          {!hasOverlap && displayLocation && displayLocation !== "—" && (
                            <span className="text-white/60 text-[7px] leading-none truncate px-1 w-full text-center hidden md:block">
                              {displayLocation}
                            </span>
                          )}
                        </div>

                        {/* Overlap popover */}
                        {isPopoverOpen && overlapEvs && (
                          <div
                            className="absolute z-50 top-full left-0 mt-1 w-64 rounded-lg shadow-xl border overflow-hidden"
                            style={{ background: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }}
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: isDark ? "#334155" : "#e2e8f0" }}>
                              <span className="text-xs font-bold text-red-500">⚠ {overlapEvs.length} eventos sobrepostos</span>
                              <button onClick={() => setOverlapPopover(null)} className="text-slate-400 hover:text-slate-200 text-xs">✕</button>
                            </div>
                            <div className={`flex flex-col divide-y ${isDark ? "divide-slate-700" : "divide-slate-200"}`}>
                              {overlapEvs.map((oEv, oIdx) => {
                                const oDisc = disciplines.find(d => d.id === oEv.disciplineId);
                                const oName = oDisc?.name || oEv.disciplineId;
                                const oCode = oDisc?.code || oEv.disciplineId;
                                return (
                                  <div key={oEv.id} className="px-3 py-2 flex items-center justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-xs font-semibold truncate ${isDark ? "text-slate-100" : "text-slate-800"}`}>{oCode} — {oName}</p>
                                      <p className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{oEv.startTime} · {oEv.classId}</p>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                      {canEdit && (
                                        <button
                                          onClick={() => { onEventClick?.(oEv); setOverlapPopover(null); }}
                                          className="px-2 py-1 text-[10px] rounded border text-blue-400 border-blue-700 hover:bg-blue-900/30"
                                        >
                                          Editar
                                        </button>
                                      )}
                                      {canEdit && onDeleteEvent && (
                                        <button
                                          onClick={() => {
                                            onDeleteEvent(oEv.id);
                                            if (overlapEvs.length <= 2) setOverlapPopover(null);
                                            else setOverlapPopover(p => p ? { ...p, evs: p.evs.filter(e => e.id !== oEv.id) } : null);
                                          }}
                                          className="px-2 py-1 text-[10px] rounded border text-red-400 border-red-700 hover:bg-red-900/30"
                                          title={`Excluir evento ${oIdx + 1}`}
                                        >
                                          Excluir
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className={`px-3 py-1.5 text-[10px] ${isDark ? "text-slate-500 bg-slate-800/50" : "text-slate-400 bg-slate-50"}`}>
                              Exclua os eventos duplicados para resolver o conflito
                            </div>
                          </div>
                        )}
                      </>
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
