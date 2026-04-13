import { useState, useEffect, useMemo, useRef } from "react";
import { BarChart2, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { getCohortColorTokens } from "../utils/cohortColors";
import type { CohortColor, ScheduleEvent } from "../types";

const SQ_LABELS = ["Todos", "1º ESQ", "2º ESQ", "3º ESQ", "4º ESQ"];

const EVAL_LABELS: Record<string, string> = {
  PARTIAL: "Parcial", EXAM: "Exame", FINAL: "Prova Final",
  SECOND_CHANCE: "2ª Época", REVIEW: "Vista",
};

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface GanttEvent {
  id: string;
  label: string;
  start: Date;
  end: Date;
  color: string;
  squadron: number | null;
  type: string;
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function fmtShort(d: Date): string {
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}

export const AcademicGantt = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { fetchYearlyEvents, cohorts } = useCourseStore();

  const currentYear = new Date().getFullYear();
  const [year, setYear]       = useState(currentYear);
  const [events, setEvents]   = useState<ScheduleEvent[]>([]);
  const [squadron, setSquadron] = useState<number | "ALL">("ALL");
  const [hovered, setHovered] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchYearlyEvents(year).then(setEvents); }, [year, fetchYearlyEvents]);

  // Cohort color map
  const cohortTokens = useMemo(() => {
    const r: Record<number, ReturnType<typeof getCohortColorTokens>> = {};
    [1,2,3,4].forEach(sq => {
      const entryYear = year - sq + 1;
      const c = cohorts.find(x => Number(x.entryYear) === entryYear);
      r[sq] = getCohortColorTokens((c?.color || "blue") as CohortColor);
    });
    return r;
  }, [cohorts, year]);

  const sqColor = (sq: number | null) => cohortTokens[sq ?? 0]?.primary ?? "#6366f1";

  // Parse academic events into Gantt rows
  const ganttEvents = useMemo((): GanttEvent[] => {
    return events
      .filter(e => e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC" || e.type === "EVALUATION")
      .map(e => {
        const sqRaw = e.targetSquadron;
        const sqNum = sqRaw != null && sqRaw !== "ALL" ? Number(sqRaw) : null;
        const sqValid = sqNum !== null && Number.isFinite(sqNum) && sqNum >= 1 && sqNum <= 4;

        const label = e.type === "EVALUATION"
          ? `${EVAL_LABELS[e.evaluationType ?? ""] ?? "Avaliação"}${e.disciplineId && e.disciplineId !== "ACADEMIC" ? "" : ""}`
          : (e.description || e.location || "Evento");

        const start = parseDate(e.date);
        const end   = parseDate((e as any).endDate ?? e.date);
        const color = sqValid ? sqColor(sqNum!) : (e.color ?? "#6366f1");

        return { id: e.id, label, start, end, color, squadron: sqValid ? sqNum : null, type: e.type ?? "ACADEMIC" };
      })
      .filter(e => {
        if (squadron === "ALL") return true;
        return e.squadron === squadron || e.squadron === null;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [events, squadron, cohortTokens]);

  // Timeline bounds: Jan 1 – Dec 31 of year
  const timelineStart = useMemo(() => new Date(year, 0, 1), [year]);
  const timelineEnd   = useMemo(() => new Date(year, 11, 31), [year]);
  const totalDays     = diffDays(timelineStart, timelineEnd) + 1;

  // px per day — responsive
  const DAY_PX = 3; // compact: each day = 3px → 365*3 = ~1095px total width
  const totalWidth = totalDays * DAY_PX;

  const barLeft  = (ev: GanttEvent) => Math.max(0, diffDays(timelineStart, ev.start)) * DAY_PX;
  const barWidth = (ev: GanttEvent) => Math.max(DAY_PX * 2, (diffDays(ev.start, ev.end) + 1) * DAY_PX);

  // Month tick positions
  const monthTicks = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const d = new Date(year, m, 1);
      return { label: MONTHS_PT[m], left: diffDays(timelineStart, d) * DAY_PX };
    });
  }, [year, timelineStart]);

  // Today marker
  const todayLeft = useMemo(() => {
    const t = new Date(); t.setHours(0,0,0,0);
    if (t.getFullYear() !== year) return null;
    return diffDays(timelineStart, t) * DAY_PX;
  }, [year, timelineStart]);

  const card   = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 shadow-sm";
  const muted  = isDark ? "text-slate-400" : "text-slate-500";
  const border = isDark ? "border-slate-700" : "border-slate-200";

  const ROW_H = 36;
  const LABEL_W = 180;

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 max-w-[1800px] mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl">
            <BarChart2 className="text-indigo-500" size={20} />
          </div>
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Gráfico de Gantt
            </h1>
            <p className={`text-xs ${muted}`}>Eventos acadêmicos ao longo do ano</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Year nav */}
          <div className="flex items-center gap-1">
            <button onClick={() => setYear(y => y - 1)} className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}>
              <ChevronLeft size={16} />
            </button>
            <span className={`text-sm font-semibold w-12 text-center ${isDark ? "text-white" : "text-slate-900"}`}>{year}</span>
            <button onClick={() => setYear(y => y + 1)} className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Squadron filter */}
          <div className={`flex items-center gap-1 rounded-xl border px-2 py-1 ${isDark ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
            <Filter size={12} className={muted} />
            {(["ALL", 1, 2, 3, 4] as const).map(sq => (
              <button
                key={sq}
                onClick={() => setSquadron(sq)}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150 ${
                  squadron === sq
                    ? "bg-indigo-600 text-white shadow-sm"
                    : `${muted} ${isDark ? "hover:bg-slate-700" : "hover:bg-slate-200"}`
                }`}
              >
                {sq === "ALL" ? "Todos" : `${sq}º`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gantt chart */}
      <div className={`rounded-xl border overflow-hidden ${card}`}>
        {ganttEvents.length === 0 ? (
          <div className={`py-16 text-center ${muted} text-sm`}>Nenhum evento encontrado para {year}</div>
        ) : (
          <div className="flex">

            {/* Fixed label column */}
            <div className="flex-shrink-0 z-10" style={{ width: LABEL_W }}>
              {/* Header spacer */}
              <div className={`h-8 border-b border-r ${border} ${isDark ? "bg-slate-800" : "bg-slate-50"}`} />
              {/* Row labels */}
              {ganttEvents.map((ev) => {
                const isHov = hovered === ev.id;
                const sqValid = ev.squadron !== null;
                const color = ev.color;
                return (
                  <div
                    key={ev.id}
                    onMouseEnter={() => setHovered(ev.id)}
                    onMouseLeave={() => setHovered(null)}
                    className={`flex items-center gap-2 px-3 border-b border-r transition-colors duration-100 ${border} ${isHov ? (isDark ? "bg-slate-700/60" : "bg-slate-100") : ""}`}
                    style={{ height: ROW_H }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className={`text-[10px] leading-tight truncate ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                      {ev.label}
                    </span>
                    {sqValid && (
                      <span className="text-[9px] ml-auto flex-shrink-0 font-semibold" style={{ color }}>
                        {ev.squadron}º
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Scrollable timeline */}
            <div className="flex-1 overflow-x-auto" ref={scrollRef}>
              <div style={{ width: totalWidth, minWidth: "100%" }}>

                {/* Month headers */}
                <div className={`relative h-8 border-b ${border} ${isDark ? "bg-slate-800" : "bg-slate-50"}`}>
                  {monthTicks.map(t => (
                    <div key={t.label} className="absolute top-0 bottom-0 flex items-center"
                      style={{ left: t.left }}>
                      <div className={`absolute top-0 bottom-0 w-px ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
                      <span className={`text-[10px] font-semibold ml-1.5 ${muted}`}>{t.label}</span>
                    </div>
                  ))}
                </div>

                {/* Rows */}
                {ganttEvents.map((ev) => {
                  const isHov = hovered === ev.id;
                  const left  = barLeft(ev);
                  const width = barWidth(ev);
                  const isMulti = diffDays(ev.start, ev.end) > 0;

                  return (
                    <div
                      key={ev.id}
                      onMouseEnter={() => setHovered(ev.id)}
                      onMouseLeave={() => setHovered(null)}
                      className={`relative border-b transition-colors duration-100 ${border} ${isHov ? (isDark ? "bg-slate-700/30" : "bg-slate-50/80") : ""}`}
                      style={{ height: ROW_H }}
                    >
                      {/* Month grid lines */}
                      {monthTicks.map(t => (
                        <div key={t.label} className={`absolute top-0 bottom-0 w-px ${isDark ? "bg-slate-700/40" : "bg-slate-100"}`}
                          style={{ left: t.left }} />
                      ))}

                      {/* Today line */}
                      {todayLeft !== null && (
                        <div className="absolute top-0 bottom-0 w-px bg-red-500/60 z-10" style={{ left: todayLeft }} />
                      )}

                      {/* Event bar */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 rounded-md flex items-center px-1.5 overflow-hidden transition-all duration-150"
                        style={{
                          left,
                          width,
                          height: ROW_H - 10,
                          backgroundColor: ev.color + (isHov ? "ff" : "cc"),
                          boxShadow: isHov ? `0 0 0 2px ${ev.color}66` : "none",
                        }}
                        title={`${ev.label} · ${fmtShort(ev.start)}${isMulti ? " → " + fmtShort(ev.end) : ""}`}
                      >
                        {width > 40 && (
                          <span className="text-white text-[9px] font-semibold truncate leading-tight drop-shadow">
                            {isMulti ? `${fmtShort(ev.start)} – ${fmtShort(ev.end)}` : fmtShort(ev.start)}
                          </span>
                        )}
                      </div>

                      {/* Tooltip on hover */}
                      {isHov && (
                        <div
                          className={`absolute z-20 top-full mt-1 rounded-lg border shadow-xl px-3 py-2 text-[11px] pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-100 ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"}`}
                          style={{ left: Math.min(left, totalWidth - 200) }}
                        >
                          <p className="font-semibold">{ev.label}</p>
                          <p className={muted}>
                            {fmtShort(ev.start)}{isMulti ? ` → ${fmtShort(ev.end)} (${diffDays(ev.start, ev.end) + 1}d)` : ""}
                          </p>
                          {ev.squadron && <p style={{ color: ev.color }}>{SQ_LABELS[ev.squadron]}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {squadron === "ALL" && (
        <div className={`rounded-xl border p-3 ${card}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${muted}`}>Legenda por Esquadrão</p>
          <div className="flex flex-wrap gap-4">
            {[1,2,3,4].map(sq => (
              <div key={sq} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cohortTokens[sq]?.primary }} />
                <span className={`text-[11px] ${muted}`}>{SQ_LABELS[sq]}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-indigo-500" />
              <span className={`text-[11px] ${muted}`}>Geral (todos)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-3 bg-red-500" />
              <span className={`text-[11px] ${muted}`}>Hoje</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
