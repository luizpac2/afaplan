import React, { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, BookOpen, Bell, AlertTriangle, Info, CalendarDays, Zap, Plus } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useCourseStore } from "../store/useCourseStore";
import { getCohortColorTokens, sqDisplayColor } from "../utils/cohortColors";
import { AcademicEventForm } from "../components/AcademicEventForm";
import { NoticeForm } from "../components/NoticeForm";
import type { CohortColor, ScheduleEvent, SystemNotice } from "../types";

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const NOTICE_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  URGENT:     { bg: "bg-red-500/15 border-red-400/40",      text: "text-red-500",    icon: <AlertTriangle size={10} /> },
  WARNING:    { bg: "bg-amber-500/15 border-amber-400/40",  text: "text-amber-500",  icon: <AlertTriangle size={10} /> },
  INFO:       { bg: "bg-blue-500/15 border-blue-400/40",    text: "text-blue-500",   icon: <Info size={10} /> },
  EVENT:      { bg: "bg-purple-500/15 border-purple-400/40",text: "text-purple-500", icon: <CalendarDays size={10} /> },
  EVALUATION: { bg: "bg-orange-500/15 border-orange-400/40",text: "text-orange-500", icon: <Zap size={10} /> },
  GENERAL:    { bg: "bg-slate-500/15 border-slate-400/40",  text: "text-slate-500",  icon: <Info size={10} /> },
};

const EVAL_LABELS: Record<string, string> = {
  PARTIAL: "Parcial", EXAM: "Exame", FINAL: "Final",
  SECOND_CHANCE: "2ª Época", REVIEW: "Vista",
};

const SQ_LABELS = ["", "1º ESQ", "2º ESQ", "3º ESQ", "4º ESQ"];

function formatISODate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number) {
  const base = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return m === 1 && isLeap(y) ? 29 : base[m];
}

export const PanoramicMirror = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { userProfile } = useAuth();
  const { fetchYearlyEvents, notices, disciplines, cohorts, addEvent, addNotice, updateNotice, deleteNotice } = useCourseStore();
  const canEdit = ["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role ?? "");

  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Modal state
  const [academicFormDate, setAcademicFormDate]   = useState<string | null>(null);
  const [editingAcademic, setEditingAcademic]     = useState<ScheduleEvent | null>(null);
  const [noticeFormDate, setNoticeFormDate]       = useState<string | null>(null);
  const [editingNotice, setEditingNotice]         = useState<SystemNotice | null>(null);

  // Load events for current year
  useEffect(() => {
    fetchYearlyEvents(year).then(setEvents);
  }, [year, fetchYearlyEvents]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Academic events and evaluations for this month
  const monthAcademic = useMemo(() => {
    return events.filter(e => {
      const SHOW = new Set(["ACADEMIC","EVALUATION","DAY_OFF","COMMEMORATIVE","SPORTS","INFORMATIVE","HOLIDAY","MILITARY","FLIGHT_INSTRUCTION","TRIP"]);
      const isAcad = SHOW.has(e.type ?? "") || e.disciplineId === "ACADEMIC";
      if (!isAcad) return false;
      // multi-day: startDate ≤ day ≤ endDate
      const start = e.date;
      const end   = (e as any).endDate ?? e.date;
      const monthStart = formatISODate(year, month, 1);
      const monthEnd   = formatISODate(year, month, daysInMonth(year, month));
      return start <= monthEnd && end >= monthStart;
    });
  }, [events, year, month]);

  // Notices active in this month
  const monthNotices = useMemo(() => {
    const monthStart = formatISODate(year, month, 1);
    const monthEnd   = formatISODate(year, month, daysInMonth(year, month));
    return notices.filter(n => n.startDate <= monthEnd && n.endDate >= monthStart);
  }, [notices, year, month]);

  // Events and notices for a specific day
  const eventsForDay = (dateStr: string) =>
    monthAcademic.filter(e => {
      const end = (e as any).endDate ?? e.date;
      return e.date <= dateStr && end >= dateStr;
    });

  const noticesForDay = (dateStr: string) =>
    monthNotices.filter(n => n.startDate <= dateStr && n.endDate >= dateStr);

  // Calendar grid
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const totalDays = daysInMonth(year, month);
  const todayStr  = formatISODate(today.getFullYear(), today.getMonth(), today.getDate());

  // Squadron → cohort color tokens
  const cohortTokens = useMemo(() => {
    const result: Record<number, ReturnType<typeof getCohortColorTokens>> = {};
    [1, 2, 3, 4].forEach(sq => {
      const entryYear = year - sq + 1;
      const cohort = cohorts.find(c => Number(c.entryYear) === entryYear);
      result[sq] = getCohortColorTokens((cohort?.color || "blue") as CohortColor);
    });
    return result;
  }, [cohorts, year]);

  const sqColor = (sq: number | null) => sqDisplayColor(cohortTokens[sq ?? 0] ?? getCohortColorTokens("blue"), isDark);

  // ── Multi-day bar layout (Google Calendar style) ──────────────────────────
  // Deduplicate multi-day non-evaluation events, compute row segments and lanes
  const multiDayBars = useMemo(() => {
    const TYPE_COLOR_MAP: Record<string, string> = {
      DAY_OFF: "#b91c1c", COMMEMORATIVE: "#b45309", SPORTS: "#0f766e",
      INFORMATIVE: "#0369a1", HOLIDAY: "#be123c", ACADEMIC: "#4338ca",
      MILITARY: "#15803d", FLIGHT_INSTRUCTION: "#1d4ed8", TRIP: "#6d28d9",
    };
    const monthStart = formatISODate(year, month, 1);
    const monthEnd   = formatISODate(year, month, totalDays);

    // Collect unique multi-day events (endDate > date), skip EVALUATION (shown as chips)
    const seen = new Set<string>();
    const multiEvts = monthAcademic.filter(e => {
      if (e.type === "EVALUATION") return false;
      const end = (e as any).endDate ?? e.date;
      if (end <= e.date) return false; // single day
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    // For each event, compute segments (one per calendar row it spans)
    type Segment = {
      evId: string; label: string; color: string; isDayOff: boolean;
      row: number; colStart: number; colEnd: number; // 0-indexed col in week row
      isStart: boolean; isEnd: boolean;
    };
    const segments: Segment[] = [];

    for (const ev of multiEvts) {
      const evStart = ev.date < monthStart ? monthStart : ev.date;
      const evEnd   = ((ev as any).endDate ?? ev.date) > monthEnd ? monthEnd : (ev as any).endDate ?? ev.date;
      const sqN = ev.targetSquadron != null && ev.targetSquadron !== "ALL" ? Number(ev.targetSquadron) : null;
      const sqV = sqN !== null && Number.isFinite(sqN) && sqN >= 1 && sqN <= 4;
      const isDayOff = ev.type === "DAY_OFF";
      const color = isDayOff ? "#b91c1c"
        : sqV ? (() => { const t = cohortTokens[sqN!]; return t ? sqDisplayColor(t, isDark) : "#4338ca"; })()
        : (TYPE_COLOR_MAP[ev.type ?? ""] ?? "#4338ca");
      const label = ev.description || ev.location || ev.type || "Evento";

      // Walk from evStart to evEnd, grouping by calendar row
      let cur = new Date(evStart + "T00:00:00");
      const endD = new Date(evEnd + "T00:00:00");
      while (cur <= endD) {
        const dayNum = cur.getDate(); // 1-based
        const gridIdx = firstDow + dayNum - 1; // position in grid (0-based, including leading empties)
        const row = Math.floor(gridIdx / 7);
        const col = gridIdx % 7;

        // Find where this segment ends (end of week or end of event)
        let segEnd = new Date(cur);
        while (segEnd < endD) {
          const nextDay = new Date(segEnd);
          nextDay.setDate(nextDay.getDate() + 1);
          const nextGrid = firstDow + nextDay.getDate() - 1;
          if (Math.floor(nextGrid / 7) !== row) break;
          segEnd = nextDay;
        }
        const colEnd = (firstDow + segEnd.getDate() - 1) % 7;

        segments.push({
          evId: ev.id, label, color, isDayOff,
          row, colStart: col, colEnd,
          isStart: cur.toISOString().slice(0,10) === ev.date || cur.toISOString().slice(0,10) === monthStart,
          isEnd: segEnd.toISOString().slice(0,10) === ((ev as any).endDate ?? ev.date) || segEnd.toISOString().slice(0,10) === monthEnd,
        });

        // Move to next row start
        cur = new Date(segEnd);
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Assign lanes per row to avoid overlap
    // lane = vertical slot index within a row
    const rowLanes: Record<number, { evId: string; colStart: number; colEnd: number; lane: number }[]> = {};
    const evLane: Record<string, number> = {}; // evId → lane (consistent across rows)

    segments.forEach(seg => {
      if (!rowLanes[seg.row]) rowLanes[seg.row] = [];
      const used = new Set(rowLanes[seg.row]
        .filter(s => s.colEnd >= seg.colStart && s.colStart <= seg.colEnd)
        .map(s => s.lane));
      // Prefer same lane as previous segment of same event
      let lane = evLane[seg.evId] ?? 0;
      if (used.has(lane)) {
        lane = 0;
        while (used.has(lane)) lane++;
      }
      evLane[seg.evId] = lane;
      rowLanes[seg.row].push({ evId: seg.evId, colStart: seg.colStart, colEnd: seg.colEnd, lane });
      (seg as any).lane = lane;
    });

    return segments as (Segment & { lane: number })[];
  }, [monthAcademic, firstDow, totalDays, year, month, cohortTokens, isDark]);

  // Selected day details
  const selectedEvents  = selectedDate ? eventsForDay(selectedDate)  : [];
  const selectedNotices = selectedDate ? noticesForDay(selectedDate) : [];

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAcademicSubmit = (data: Omit<ScheduleEvent, "id">) => {
    const id = crypto.randomUUID();
    const ev = { ...data, id };
    addEvent(ev);
    setEvents(prev => [...prev, ev]);
    setAcademicFormDate(null);
  };

  const handleAcademicUpdate = (data: Omit<ScheduleEvent, "id">) => {
    if (!editingAcademic) return;
    useCourseStore.getState().updateEvent(editingAcademic.id, data);
    setEvents(prev => prev.map(e => e.id === editingAcademic.id ? { ...e, ...data } : e));
    setEditingAcademic(null);
  };

  const handleAcademicDelete = (id: string) => {
    useCourseStore.getState().deleteEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
    setEditingAcademic(null);
  };

  const handleNoticeSubmit = (data: Partial<SystemNotice>) => {
    addNotice({ ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), createdBy: userProfile?.uid ?? "system" } as SystemNotice);
    setNoticeFormDate(null);
  };

  const handleNoticeUpdate = (data: Partial<SystemNotice>) => {
    if (!editingNotice) return;
    updateNotice(editingNotice.id, data);
    setEditingNotice(null);
  };

  const handleNoticeDelete = (id: string) => {
    deleteNotice(id);
    setEditingNotice(null);
  };

  // Styling tokens (same as Dashboard/GanttProgramming)
  const card   = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 shadow-sm";
  const muted  = isDark ? "text-slate-400" : "text-slate-500";
  const border = isDark ? "border-slate-700" : "border-slate-200";

  return (
    <div className={`p-4 md:p-6 flex flex-col gap-5 max-w-5xl mx-auto`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl">
            <CalendarIcon className="text-blue-500" size={20} />
          </div>
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Calendário Acadêmico
            </h1>
            <p className={`text-xs ${muted}`}>Eventos e avaliações do ano letivo</p>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}>
            <ChevronLeft size={18} />
          </button>
          <span className={`text-sm font-semibold min-w-[130px] text-center ${isDark ? "text-white" : "text-slate-900"}`}>
            {MONTHS_PT[month]} {year}
          </span>
          <button onClick={nextMonth} className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Calendar grid + detail panel */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* Grid */}
        <div className={`rounded-xl border overflow-hidden flex-1 ${card}`}>
          {/* Day headers */}
          <div className="grid grid-cols-7">
            {DAYS_SHORT.map(d => (
              <div key={d} className={`py-2 text-center text-[10px] font-bold uppercase tracking-wider ${muted} ${isDark ? "bg-slate-800/80" : "bg-slate-50"}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells — rendered per week row so bars are positioned inside each row */}
          {(() => {
            const BAR_H = 18;
            const BAR_GAP = 2;
            const DAY_NUM_H = 28; // px reserved for day number at top of cell
            const CELL_PADDING = 6; // px padding inside cell
            const TYPE_LABEL_MAP: Record<string, string> = {
              DAY_OFF: "Day Off", COMMEMORATIVE: "Comemorativo", SPORTS: "CDEF",
              INFORMATIVE: "Informativo", HOLIDAY: "Feriado",
              MILITARY: "Militar", FLIGHT_INSTRUCTION: "Instrução de Voo", TRIP: "Viagem",
            };
            const TYPE_COLOR_MAP2: Record<string, string> = {
              DAY_OFF: "#b91c1c", COMMEMORATIVE: "#b45309", SPORTS: "#0f766e",
              INFORMATIVE: "#0369a1", HOLIDAY: "#be123c",
              MILITARY: "#15803d", FLIGHT_INSTRUCTION: "#1d4ed8", TRIP: "#6d28d9",
            };

            // Build week rows: row 0 = grid positions 0..6, row 1 = 7..13, etc.
            const totalGridCells = firstDow + totalDays;
            const numRows = Math.ceil(totalGridCells / 7);

            return Array.from({ length: numRows }).map((_, rowIdx) => {
              // Bars for this row
              const rowBars = multiDayBars.filter(b => b.row === rowIdx);
              const maxLane = rowBars.length > 0 ? Math.max(...rowBars.map(b => b.lane)) + 1 : 0;
              // Height reserved for bars inside each cell
              const barsAreaH = maxLane * (BAR_H + BAR_GAP);

              // 7 grid positions in this row
              const cells = Array.from({ length: 7 }).map((_, colIdx) => {
                const gridIdx = rowIdx * 7 + colIdx;
                const day = gridIdx - firstDow + 1;
                const isEmpty = day < 1 || day > totalDays;

                if (isEmpty) {
                  return (
                    <div key={`e${gridIdx}`}
                      className={`border-t border-r ${border} ${isDark ? "bg-slate-900/30" : "bg-slate-50/50"}`}
                      style={{ minHeight: DAY_NUM_H + barsAreaH + 80 }}
                    />
                  );
                }

                const dateStr = formatISODate(year, month, day);
                const isToday = dateStr === todayStr;
                const isSel   = dateStr === selectedDate;
                const isWknd  = colIdx === 0 || colIdx === 6;
                const dayEvts = eventsForDay(dateStr);
                const dayNots = noticesForDay(dateStr);
                const hasDayOff = dayEvts.some(e => e.type === "DAY_OFF");

                // Single-day events only (multi-day are shown as bars)
                const singleDayEvts = dayEvts.filter(e => {
                  if (e.type === "EVALUATION") return true;
                  const end = (e as any).endDate ?? e.date;
                  return end <= e.date;
                });

                // Build chips
                const evalChipMap = new Map<string, { ev: typeof singleDayEvts[0]; sqNums: Set<number> }>();
                const otherEvts: typeof singleDayEvts = [];
                for (const ev of singleDayEvts) {
                  if (ev.type === "EVALUATION") {
                    const key = `${ev.disciplineId}|${ev.evaluationType ?? ""}`;
                    if (!evalChipMap.has(key)) evalChipMap.set(key, { ev, sqNums: new Set() });
                    const sqN = ev.classId ? parseInt(ev.classId.charAt(0)) : NaN;
                    if (!isNaN(sqN) && sqN >= 1 && sqN <= 4) evalChipMap.get(key)!.sqNums.add(sqN);
                  } else {
                    otherEvts.push(ev);
                  }
                }
                const chips: React.ReactElement[] = [];
                for (const { ev, sqNums } of evalChipMap.values()) {
                  const disc = disciplines.find(d => d.id === ev.disciplineId);
                  const code = disc?.code || "";
                  const evalLabel = EVAL_LABELS[ev.evaluationType ?? ""] ?? "Aval.";
                  const firstSq = sqNums.values().next().value as number | undefined;
                  const sqLabel = sqNums.size === 1 && firstSq != null ? ` ${SQ_LABELS[firstSq]}` : sqNums.size > 1 ? ` ${sqNums.size}ESQ` : "";
                  const label = code ? `${code} ${evalLabel}${sqLabel}` : `${evalLabel}${sqLabel}`;
                  chips.push(
                    <div key={`${ev.disciplineId}|${ev.evaluationType}`}
                      className="rounded px-1 py-0.5 text-[9px] leading-tight font-medium truncate text-white"
                      style={{ backgroundColor: "#c2410c" }}>
                      {label}
                    </div>
                  );
                }
                for (const ev of otherEvts) {
                  const sqN = ev.targetSquadron != null && ev.targetSquadron !== "ALL" ? Number(ev.targetSquadron) : null;
                  const sqV = sqN !== null && Number.isFinite(sqN) && sqN >= 1 && sqN <= 4;
                  const isSpecial = ["DAY_OFF","COMMEMORATIVE","SPORTS","INFORMATIVE","HOLIDAY","MILITARY","FLIGHT_INSTRUCTION","TRIP"].includes(ev.type ?? "");
                  const color = isSpecial ? (TYPE_COLOR_MAP2[ev.type!] ?? "#4338ca") : sqV ? sqColor(sqN!) : (ev.color ?? "#4338ca");
                  const label = isSpecial ? (ev.description || TYPE_LABEL_MAP[ev.type!] || "Evento") : (ev.description || ev.location || "Evento");
                  chips.push(
                    <div key={ev.id}
                      className="rounded px-1 py-0.5 text-[9px] leading-tight font-medium truncate text-white"
                      style={{ backgroundColor: color }}>
                      {label}
                    </div>
                  );
                }

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDate(isSel ? null : dateStr)}
                    className={`border-t border-r ${border} p-1.5 cursor-pointer transition-colors flex flex-col gap-0.5
                      ${isSel ? (isDark ? "bg-blue-900/30 ring-1 ring-inset ring-blue-500/50" : "bg-blue-50 ring-1 ring-inset ring-blue-300") : ""}
                      ${hasDayOff && !isSel ? (isDark ? "bg-red-900/15" : "bg-red-50/60") : ""}
                      ${!isSel && !hasDayOff && isWknd ? (isDark ? "bg-slate-900/50" : "bg-slate-50/70") : ""}
                      ${!isSel && !hasDayOff && !isWknd ? (isDark ? "hover:bg-slate-700/40" : "hover:bg-slate-50") : ""}
                    `}
                    style={{ minHeight: DAY_NUM_H + barsAreaH + 80 }}
                  >
                    {/* Day number */}
                    <span className={`text-[11px] font-semibold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0
                      ${isToday ? "bg-blue-600 text-white" : (isWknd ? muted : (isDark ? "text-slate-200" : "text-slate-700"))}
                    `}>
                      {day}
                    </span>

                    {/* Spacer for bars area */}
                    {barsAreaH > 0 && <div style={{ height: barsAreaH }} className="flex-shrink-0" />}

                    {/* Single-day chips */}
                    {chips.slice(0, 8)}

                    {/* Notice dots */}
                    {dayNots.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap mt-auto">
                        {dayNots.slice(0, 3).map(n => (
                          <div key={n.id} className="w-1.5 h-1.5 rounded-full bg-amber-600" title={n.title} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              });

              return (
                <div key={rowIdx} className="relative grid grid-cols-7">
                  {cells}
                  {/* Multi-day bars for this row — absolute inside this row container */}
                  {rowBars.map(bar => {
                    const leftPct  = (bar.colStart / 7) * 100;
                    const widthPct = ((bar.colEnd - bar.colStart + 1) / 7) * 100;
                    const topPx    = DAY_NUM_H + CELL_PADDING + bar.lane * (BAR_H + BAR_GAP);
                    return (
                      <div
                        key={`${bar.evId}-r${bar.row}`}
                        className="absolute pointer-events-none z-10 flex items-center overflow-hidden"
                        style={{
                          left: `calc(${leftPct}% + 3px)`,
                          width: `calc(${widthPct}% - 6px)`,
                          top: topPx,
                          height: BAR_H,
                          backgroundColor: bar.isDayOff ? bar.color + "55" : bar.color,
                          border: bar.isDayOff ? `1px dashed ${bar.color}` : "none",
                          borderRadius: bar.isStart && bar.isEnd ? 4
                            : bar.isStart ? "4px 0 0 4px"
                            : bar.isEnd   ? "0 4px 4px 0"
                            : 0,
                          paddingLeft: 6,
                        }}
                      >
                        <span className={`text-[9px] font-semibold leading-none truncate ${bar.isDayOff ? "text-red-900" : "text-white"}`}>
                          {bar.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>

        {/* Detail panel */}
        {selectedDate ? (
          <div className={`rounded-xl border flex flex-col gap-0 lg:w-72 flex-shrink-0 ${card}`}>
            {/* Panel header */}
            <div className={`px-4 py-3 border-b ${border} flex items-center justify-between`}>
              <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                {new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(selectedDate + "T12:00:00"))}
              </span>
              <button onClick={() => setSelectedDate(null)} className={`text-xs ${muted} hover:opacity-60`}>✕</button>
            </div>

            <div className="flex flex-col gap-0 overflow-y-auto max-h-[400px] lg:max-h-none lg:flex-1">
              {/* Academic events */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${muted}`}>
                    <BookOpen size={10} /> Eventos
                  </p>
                  {canEdit && (
                    <button onClick={() => setAcademicFormDate(selectedDate)} className="text-[10px] text-purple-500 hover:text-purple-400 flex items-center gap-0.5 transition-colors">
                      <Plus size={10} /> Novo
                    </button>
                  )}
                </div>
                {selectedEvents.length === 0
                  ? <p className={`text-[10px] italic ${muted} opacity-60`}>Sem eventos</p>
                  : (() => {
                      // Group EVALUATION events by disciplineId|evaluationType; keep others as-is
                      const evalMap = new Map<string, { ev: typeof selectedEvents[0]; turmas: string[] }>();
                      const otherEvents: typeof selectedEvents = [];
                      for (const ev of selectedEvents) {
                        if (ev.type === "EVALUATION") {
                          const key = `${ev.disciplineId}|${ev.evaluationType ?? ""}`;
                          if (!evalMap.has(key)) evalMap.set(key, { ev, turmas: [] });
                          if (ev.classId && !evalMap.get(key)!.turmas.includes(ev.classId))
                            evalMap.get(key)!.turmas.push(ev.classId);
                        } else {
                          otherEvents.push(ev);
                        }
                      }
                      const fmtDate = (iso: string) => iso.split("-").reverse().join("/");
                      return (
                        <div className="flex flex-col gap-2">
                          {/* Consolidated evaluation cards */}
                          {[...evalMap.values()].map(({ ev, turmas }) => {
                            const disc = disciplines.find(d => d.id === ev.disciplineId);
                            const evalLabel = EVAL_LABELS[ev.evaluationType ?? ""] ?? "Avaliação";
                            const code = disc?.code || "";
                            const title = code ? `${code} — ${evalLabel}` : evalLabel;
                            turmas.sort();
                            return (
                              <div key={`${ev.disciplineId}|${ev.evaluationType}`}
                                className="rounded-lg border px-3 py-2 flex flex-col gap-1"
                                style={{ borderColor: "#c2410c55", backgroundColor: "#c2410c11" }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: "#c2410c" }} />
                                  <span className="text-[11px] font-semibold leading-tight" style={{ color: "#c2410c" }}>{title}</span>
                                </div>
                                {turmas.length > 0 && (
                                  <div className="flex flex-wrap gap-1 ml-3.5">
                                    {turmas.map(t => (
                                      <span key={t} className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c2410c22", color: "#c2410c" }}>{t}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {/* Non-evaluation events */}
                          {otherEvents.map(ev => {
                            const isDayOff = ev.type === "DAY_OFF";
                            const sqNum = ev.targetSquadron != null && ev.targetSquadron !== "ALL" ? Number(ev.targetSquadron) : null;
                            const sqValid = sqNum !== null && Number.isFinite(sqNum) && sqNum >= 1 && sqNum <= 4;
                            const color = isDayOff ? "#ef4444" : (sqValid ? sqColor(sqNum!) : (ev.color ?? "#6366f1"));
                            const title = isDayOff
                              ? (ev.description || "Day Off")
                              : (ev.description || ev.location || "Evento Acadêmico");
                            const notes = (ev as any).notes;
                            const hasNotes = notes && notes !== title;
                            const showLocation = ev.location && ev.location !== title && !isDayOff;
                            const endDateVal = (ev as any).endDate;
                            const isMultiDay = endDateVal && endDateVal !== ev.date;
                            if (isDayOff) return (
                              <div key={ev.id}
                                className={`rounded-lg border border-dashed border-red-500/40 px-3 py-2 flex flex-col gap-0.5 bg-red-500/10 ${canEdit ? "cursor-pointer hover:bg-red-500/15 transition-colors" : ""}`}
                                onClick={canEdit ? () => setEditingAcademic(ev) : undefined}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px]">⛔</span>
                                  <span className="text-[11px] font-semibold leading-tight text-red-400">{title}</span>
                                </div>
                                <p className="text-[10px] text-red-400/70 ml-5">Alocação de aulas bloqueada</p>
                                {isMultiDay && <p className={`text-[10px] ${muted} ml-5`}>De {fmtDate(ev.date)} a {fmtDate(endDateVal)}</p>}
                              </div>
                            );
                            return (
                              <div key={ev.id}
                                className={`rounded-lg border px-3 py-2 flex flex-col gap-0.5 ${canEdit ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                                style={{ borderColor: color + "55", backgroundColor: color + "11" }}
                                onClick={canEdit ? () => setEditingAcademic(ev) : undefined}
                              >
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                  <span className="text-[11px] font-semibold leading-tight" style={{ color }}>{title}</span>
                                </div>
                                {sqValid && <p className={`text-[10px] ${muted} ml-3.5`}>{SQ_LABELS[sqNum!]}</p>}
                                {isMultiDay && <p className={`text-[10px] ${muted} ml-3.5`}>De {fmtDate(ev.date)} a {fmtDate(endDateVal)}</p>}
                                {showLocation && <p className={`text-[10px] ${muted} ml-3.5`}>📍 {ev.location}</p>}
                                {hasNotes && <p className={`text-[10px] ${muted} ml-3.5 leading-tight`}>{notes}</p>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                }
              </div>

              <div className={`mx-4 border-t ${border}`} />

              {/* Notices */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${muted}`}>
                    <Bell size={10} /> Avisos
                  </p>
                  {canEdit && (
                    <button onClick={() => setNoticeFormDate(selectedDate)} className="text-[10px] text-blue-500 hover:text-blue-400 flex items-center gap-0.5 transition-colors">
                      <Plus size={10} /> Novo
                    </button>
                  )}
                </div>
                {selectedNotices.length === 0
                  ? <p className={`text-[10px] italic ${muted} opacity-60`}>Sem avisos</p>
                  : <div className="flex flex-col gap-1.5">
                      {selectedNotices.map(n => {
                        const style = NOTICE_STYLES[n.type ?? "GENERAL"] ?? NOTICE_STYLES.GENERAL;
                        return (
                          <div key={n.id}
                            className={`rounded-lg border px-3 py-2 ${style.bg} ${canEdit ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                            onClick={canEdit ? () => setEditingNotice(n) : undefined}
                          >
                            <div className={`flex items-center gap-1 font-semibold text-[11px] ${style.text}`}>
                              {style.icon} {n.title}
                            </div>
                            {n.description && <p className={`text-[10px] mt-0.5 ${muted} leading-tight`}>{n.description}</p>}
                          </div>
                        );
                      })}
                    </div>
                }
              </div>
            </div>
          </div>
        ) : (
          /* Legend / summary when no day selected */
          <div className={`rounded-xl border p-4 lg:w-72 flex-shrink-0 flex flex-col gap-4 ${card}`}>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${muted}`}>Resumo do Mês</p>
              {[1, 2, 3, 4].map(sq => {
                const tokens = cohortTokens[sq];
                const sqEvts = monthAcademic.filter(e => Number(e.targetSquadron) === sq || (!e.targetSquadron && e.type === "ACADEMIC"));
                if (!sqEvts.length && sq !== 1) return null;
                return (
                  <div key={sq} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sqDisplayColor(tokens, isDark) }} />
                      <span className={`text-[11px] ${isDark ? "text-slate-300" : "text-slate-700"}`}>{SQ_LABELS[sq]}</span>
                    </div>
                    <span className={`text-[11px] font-semibold ${muted}`}>{sqEvts.length} evento{sqEvts.length !== 1 ? "s" : ""}</span>
                  </div>
                );
              })}
              {monthNotices.length > 0 && (
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                    <span className={`text-[11px] ${isDark ? "text-slate-300" : "text-slate-700"}`}>Avisos</span>
                  </div>
                  <span className={`text-[11px] font-semibold ${muted}`}>{monthNotices.length}</span>
                </div>
              )}
            </div>

            <div className={`border-t pt-3 ${border}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${muted}`}>Legenda</p>
              <div className="flex flex-col gap-1.5">
                {/* Squadron colors */}
                {[1,2,3,4].map(sq => {
                  const tokens = cohortTokens[sq];
                  return (
                    <div key={sq} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: sqDisplayColor(tokens, isDark) }} />
                      <span className={`text-[10px] ${muted}`}>{SQ_LABELS[sq]}</span>
                    </div>
                  );
                })}
                {/* Event type colors */}
                {([
                  ["DAY_OFF",           "#b91c1c", "Day Off"],
                  ["EVALUATION",        "#c2410c", "Avaliação"],
                  ["COMMEMORATIVE",     "#b45309", "Comemorativo"],
                  ["HOLIDAY",           "#be123c", "Feriado"],
                  ["SPORTS",            "#0f766e", "CDEF"],
                  ["INFORMATIVE",       "#0369a1", "Informativo"],
                  ["MILITARY",          "#15803d", "Militar"],
                  ["FLIGHT_INSTRUCTION","#1d4ed8", "Instrução de Voo"],
                  ["TRIP",              "#6d28d9", "Viagem"],
                ] as [string, string, string][]).map(([type, color, label]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: type === "DAY_OFF" ? color + "55" : color, border: type === "DAY_OFF" ? `1px dashed ${color}` : "none" }} />
                    <span className={`text-[10px] ${muted}`}>{label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-600 flex-shrink-0" />
                  <span className={`text-[10px] ${muted}`}>Avisos ativos</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className={`text-[11px] ${muted} text-center`}>
        Clique em um dia para ver os detalhes.{canEdit ? "" : " Alterações via Planejamento → Calendário."}
      </p>

      {/* Modal: Novo evento acadêmico */}
      {academicFormDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAcademicFormDate(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg mx-4">
            <AcademicEventForm
              initialData={{ date: academicFormDate, type: "ACADEMIC", disciplineId: "ACADEMIC", classId: "ESQ" }}
              onSubmit={handleAcademicSubmit}
              onCancel={() => setAcademicFormDate(null)}
            />
          </div>
        </div>
      )}

      {/* Modal: Editar evento acadêmico */}
      {editingAcademic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingAcademic(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg mx-4">
            <AcademicEventForm
              initialData={editingAcademic}
              onSubmit={handleAcademicUpdate}
              onDelete={() => handleAcademicDelete(editingAcademic.id)}
              onCancel={() => setEditingAcademic(null)}
            />
          </div>
        </div>
      )}

      {/* Modal: Novo aviso */}
      {noticeFormDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setNoticeFormDate(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md mx-4">
            <NoticeForm
              initialData={{ startDate: noticeFormDate, endDate: noticeFormDate }}
              onSubmit={handleNoticeSubmit}
              onCancel={() => setNoticeFormDate(null)}
            />
          </div>
        </div>
      )}

      {/* Modal: Editar aviso */}
      {editingNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingNotice(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md mx-4">
            <NoticeForm
              initialData={editingNotice}
              onSubmit={handleNoticeUpdate}
              onDelete={() => handleNoticeDelete(editingNotice.id)}
              onCancel={() => setEditingNotice(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
