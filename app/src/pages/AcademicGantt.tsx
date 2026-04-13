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

/** Merge consecutive / overlapping events that share the same label + squadron. */
function mergeConsecutive(events: GanttEvent[]): GanttEvent[] {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: GanttEvent[] = [];
  for (const ev of sorted) {
    const key = `${ev.label}||${ev.squadron ?? "null"}`;
    let last: GanttEvent | undefined;
    for (let i = merged.length - 1; i >= 0; i--) {
      if (`${merged[i].label}||${merged[i].squadron ?? "null"}` === key) { last = merged[i]; break; }
    }
    if (last && diffDays(last.end, ev.start) <= 1) {
      if (ev.end > last.end) last.end = ev.end;
    } else {
      merged.push({ ...ev });
    }
  }
  return merged;
}

const DAY_PX  = 3;
const LABEL_W = 240;
const ROW_H   = 36;
const HEAD_H  = 32;

export const AcademicGantt = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { fetchYearlyEvents, cohorts } = useCourseStore();

  const currentYear = new Date().getFullYear();
  const [year, setYear]         = useState(currentYear);
  const [events, setEvents]     = useState<ScheduleEvent[]>([]);
  const [squadron, setSquadron] = useState<number | "ALL">("ALL");
  const [hovered, setHovered]   = useState<string | null>(null);

  // Two separate refs: header mirrors body scroll
  const bodyRef   = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchYearlyEvents(year).then(setEvents); }, [year, fetchYearlyEvents]);

  // Sync header scroll with body scroll
  useEffect(() => {
    const body   = bodyRef.current;
    const header = headerRef.current;
    if (!body || !header) return;
    const onScroll = () => { header.scrollLeft = body.scrollLeft; };
    body.addEventListener("scroll", onScroll, { passive: true });
    return () => body.removeEventListener("scroll", onScroll);
  }, []);

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

  const ganttEvents = useMemo((): GanttEvent[] => {
    const raw: GanttEvent[] = events
      .filter(e => e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC" || e.type === "EVALUATION")
      .map(e => {
        const sqRaw   = e.targetSquadron;
        const sqNum   = sqRaw != null && sqRaw !== "ALL" ? Number(sqRaw) : null;
        const sqValid = sqNum !== null && Number.isFinite(sqNum) && sqNum >= 1 && sqNum <= 4;
        const label   = e.type === "EVALUATION"
          ? (EVAL_LABELS[e.evaluationType ?? ""] ?? "Avaliação")
          : (e.description || e.location || "Evento");
        const start = parseDate(e.date);
        const end   = parseDate((e as any).endDate ?? e.date);
        const color = sqValid ? sqColor(sqNum!) : (e.color ?? "#6366f1");
        return { id: e.id, label, start, end, color, squadron: sqValid ? sqNum : null, type: e.type ?? "ACADEMIC" };
      })
      .filter(e => squadron === "ALL" || e.squadron === squadron || e.squadron === null)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return mergeConsecutive(raw);
  }, [events, squadron, cohortTokens]);

  const timelineStart = useMemo(() => new Date(year, 0, 1), [year]);
  const timelineEnd   = useMemo(() => new Date(year, 11, 31), [year]);
  const totalDays     = diffDays(timelineStart, timelineEnd) + 1;
  const totalWidth    = totalDays * DAY_PX;

  const barLeft  = (ev: GanttEvent) => Math.max(0, diffDays(timelineStart, ev.start)) * DAY_PX;
  const barWidth = (ev: GanttEvent) => Math.max(DAY_PX * 2, (diffDays(ev.start, ev.end) + 1) * DAY_PX);

  const monthTicks = useMemo(() => Array.from({ length: 12 }, (_, m) => {
    const start = new Date(year, m, 1);
    const end   = new Date(year, m + 1, 0);
    return { label: MONTHS_PT[m], m, left: diffDays(timelineStart, start) * DAY_PX, width: (diffDays(start, end) + 1) * DAY_PX };
  }), [year, timelineStart]);

  const todayLeft = useMemo(() => {
    const t = new Date(); t.setHours(0,0,0,0);
    if (t.getFullYear() !== year) return null;
    return diffDays(timelineStart, t) * DAY_PX;
  }, [year, timelineStart]);

  const card     = isDark ? "bg-slate-800 border-slate-700"  : "bg-white border-slate-200 shadow-sm";
  const muted    = isDark ? "text-slate-400" : "text-slate-500";
  const border   = isDark ? "border-slate-700" : "border-slate-200";
  const cornerBg = isDark ? "bg-slate-800" : "bg-slate-50";
  const bandBg   = (m: number) => m % 2 === 0
    ? (isDark ? "rgba(255,255,255,0.00)" : "rgba(255,255,255,1)")
    : (isDark ? "rgba(255,255,255,0.03)" : "rgba(241,245,249,0.8)");
  const headBg   = (m: number) => m % 2 === 0
    ? (isDark ? "#1e293b" : "#f8fafc")
    : (isDark ? "#162032" : "#f1f5f9");

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 max-w-[1800px] mx-auto">

      {/* Page header */}
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
          <div className="flex items-center gap-1">
            <button onClick={() => setYear(y => y - 1)} className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}>
              <ChevronLeft size={16} />
            </button>
            <span className={`text-sm font-semibold w-12 text-center ${isDark ? "text-white" : "text-slate-900"}`}>{year}</span>
            <button onClick={() => setYear(y => y + 1)} className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className={`flex items-center gap-1 rounded-xl border px-2 py-1 ${isDark ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
            <Filter size={12} className={muted} />
            {(["ALL", 1, 2, 3, 4] as const).map(sq => (
              <button key={sq} onClick={() => setSquadron(sq)}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150 ${
                  squadron === sq ? "bg-indigo-600 text-white shadow-sm" : `${muted} ${isDark ? "hover:bg-slate-700" : "hover:bg-slate-200"}`
                }`}
              >
                {sq === "ALL" ? "Todos" : `${sq}º`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gantt chart */}
      {ganttEvents.length === 0 ? (
        <div className={`rounded-xl border py-16 text-center ${muted} text-sm ${card}`}>
          Nenhum evento encontrado para {year}
        </div>
      ) : (
        <div className={`rounded-xl border ${card}`}>

          {/* ── Sticky header ── sits OUTSIDE the scroll container so top-0 works */}
          <div
            className={`sticky top-0 z-30 border-b ${border} rounded-t-xl`}
            style={{ overflow: "hidden" }}
          >
            {/* This inner div is scrolled in sync with the body via JS */}
            <div ref={headerRef} style={{ overflow: "hidden", pointerEvents: "none" }}>
              <div style={{ display: "flex", width: LABEL_W + totalWidth }}>
                {/* Corner */}
                <div
                  className={`flex-shrink-0 border-r ${border} ${cornerBg}`}
                  style={{ width: LABEL_W, height: HEAD_H }}
                />
                {/* Month labels */}
                <div className="relative flex-1" style={{ height: HEAD_H }}>
                  {monthTicks.map(t => (
                    <div
                      key={t.m}
                      className={`absolute top-0 bottom-0 flex items-center border-r ${border}`}
                      style={{ left: t.left, width: t.width, background: headBg(t.m) }}
                    >
                      <span className={`text-[10px] font-bold ml-1.5 ${muted}`}>{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div ref={bodyRef} className="overflow-x-auto">
            <div style={{ width: LABEL_W + totalWidth, minWidth: "100%" }}>
              {ganttEvents.map((ev) => {
                const isHov   = hovered === ev.id;
                const left    = barLeft(ev);
                const width   = barWidth(ev);
                const isMulti = diffDays(ev.start, ev.end) > 0;
                const sqValid = ev.squadron !== null;

                return (
                  <div
                    key={ev.id}
                    onMouseEnter={() => setHovered(ev.id)}
                    onMouseLeave={() => setHovered(null)}
                    className={`flex border-b transition-colors duration-100 ${border} ${isHov ? (isDark ? "bg-indigo-900/15" : "bg-indigo-50/50") : ""}`}
                    style={{ height: ROW_H }}
                  >
                    {/* Label — sticky left */}
                    <div
                      className={`flex-shrink-0 flex items-center gap-2 px-3 border-r ${border} ${cornerBg} z-10`}
                      style={{ width: LABEL_W, position: "sticky", left: 0 }}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                      <span className={`text-[10px] leading-tight truncate ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                        {ev.label}
                      </span>
                      {sqValid && (
                        <span className="text-[9px] ml-auto flex-shrink-0 font-semibold" style={{ color: ev.color }}>
                          {ev.squadron}º
                        </span>
                      )}
                    </div>

                    {/* Timeline */}
                    <div className="relative" style={{ width: totalWidth, height: ROW_H }}>
                      {/* Month bands */}
                      {monthTicks.map(t => (
                        <div key={t.m} className="absolute top-0 bottom-0"
                          style={{ left: t.left, width: t.width, background: bandBg(t.m) }} />
                      ))}

                      {/* Today */}
                      {todayLeft !== null && (
                        <div className="absolute top-0 bottom-0 w-px bg-red-500/60 z-10" style={{ left: todayLeft }} />
                      )}

                      {/* Bar */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 rounded-md flex items-center px-1.5 overflow-hidden transition-all duration-150"
                        style={{
                          left, width, height: ROW_H - 10, zIndex: 5,
                          backgroundColor: ev.color + (isHov ? "ff" : "cc"),
                          boxShadow: isHov ? `0 0 0 2px ${ev.color}55` : "none",
                        }}
                        title={`${ev.label} · ${fmtShort(ev.start)}${isMulti ? " → " + fmtShort(ev.end) : ""}`}
                      >
                        {width > 40 && (
                          <span className="text-white text-[9px] font-semibold truncate leading-tight drop-shadow">
                            {isMulti ? `${fmtShort(ev.start)} – ${fmtShort(ev.end)}` : fmtShort(ev.start)}
                          </span>
                        )}
                      </div>

                      {/* Tooltip */}
                      {isHov && (
                        <div
                          className={`absolute z-50 top-full mt-1 rounded-lg border shadow-xl px-3 py-2 text-[11px] pointer-events-none whitespace-nowrap ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"}`}
                          style={{ left: Math.min(left, totalWidth - 210) }}
                        >
                          <p className="font-semibold">{ev.label}</p>
                          <p className={muted}>
                            {fmtShort(ev.start)}{isMulti ? ` → ${fmtShort(ev.end)} (${diffDays(ev.start, ev.end) + 1}d)` : ""}
                          </p>
                          {ev.squadron && <p style={{ color: ev.color }}>{SQ_LABELS[ev.squadron]}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
