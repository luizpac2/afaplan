import { useState, useEffect, useMemo, useRef } from "react";
import { BarChart2, ChevronLeft, ChevronRight, Filter, Plus } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useCourseStore } from "../store/useCourseStore";
import { getCohortColorTokens } from "../utils/cohortColors";
import { AcademicEventForm } from "../components/AcademicEventForm";
import type { CohortColor, ScheduleEvent } from "../types";

const SQ_LABELS = ["Todos", "1º ESQ", "2º ESQ", "3º ESQ", "4º ESQ"];

const EVAL_LABELS: Record<string, string> = {
  PARTIAL: "Parcial", EXAM: "Exame", FINAL: "Prova Final",
  SECOND_CHANCE: "2ª Época", REVIEW: "Vista",
};

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const DAY_OFF_COLOR = "#ef4444"; // red-500

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

function mergeConsecutive(events: GanttEvent[]): GanttEvent[] {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: GanttEvent[] = [];
  for (const ev of sorted) {
    const key = `${ev.type}||${ev.label}||${ev.squadron ?? "null"}`;
    let last: GanttEvent | undefined;
    for (let i = merged.length - 1; i >= 0; i--) {
      const mk = `${merged[i].type}||${merged[i].label}||${merged[i].squadron ?? "null"}`;
      if (mk === key) { last = merged[i]; break; }
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

type TypeFilter = "ALL" | "ACADEMIC" | "DAY_OFF";

export const AcademicGantt = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { userProfile } = useAuth();
  const canEdit = ["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role ?? "");
  const { fetchYearlyEvents, cohorts, addEvent, updateEvent, deleteEvent } = useCourseStore();

  const currentYear = new Date().getFullYear();
  const [year, setYear]           = useState(currentYear);
  const [events, setEvents]       = useState<ScheduleEvent[]>([]);
  const [squadron, setSquadron]   = useState<number | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [hovered, setHovered]     = useState<string | null>(null);

  // Edit modal state
  const [addingNew, setAddingNew]             = useState(false);
  const [editingEvent, setEditingEvent]       = useState<ScheduleEvent | null>(null);

  const bodyRef   = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchYearlyEvents(year).then(setEvents); }, [year, fetchYearlyEvents]);

  // Sync header scroll
  useEffect(() => {
    const body = bodyRef.current, header = headerRef.current;
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

  // Map id → original event for editing
  const eventsById = useMemo(() => {
    const m: Record<string, ScheduleEvent> = {};
    events.forEach(e => { m[e.id] = e; });
    return m;
  }, [events]);

  const ganttEvents = useMemo((): GanttEvent[] => {
    const raw: GanttEvent[] = events
      .filter(e => {
        const isAcad   = e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC" || e.type === "EVALUATION";
        const isDayOff = e.type === "DAY_OFF";
        return isAcad || isDayOff;
      })
      .map(e => {
        const isDayOff = e.type === "DAY_OFF";
        const sqRaw    = e.targetSquadron;
        const sqNum    = sqRaw != null && sqRaw !== "ALL" ? Number(sqRaw) : null;
        const sqValid  = sqNum !== null && Number.isFinite(sqNum) && sqNum >= 1 && sqNum <= 4;

        const label = isDayOff
          ? (e.description || "Day Off")
          : e.type === "EVALUATION"
            ? (EVAL_LABELS[e.evaluationType ?? ""] ?? "Avaliação")
            : (e.description || e.location || "Evento");

        const start = parseDate(e.date);
        const end   = parseDate((e as any).endDate ?? e.date);
        const color = isDayOff ? DAY_OFF_COLOR : (sqValid ? sqColor(sqNum!) : (e.color ?? "#6366f1"));

        return { id: e.id, label, start, end, color, squadron: sqValid ? sqNum : null, type: e.type ?? "ACADEMIC" };
      })
      .filter(e => {
        if (squadron !== "ALL" && e.squadron !== null && e.squadron !== squadron) return false;
        if (typeFilter === "ACADEMIC" && e.type === "DAY_OFF") return false;
        if (typeFilter === "DAY_OFF"  && e.type !== "DAY_OFF") return false;
        return true;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    return mergeConsecutive(raw);
  }, [events, squadron, typeFilter, cohortTokens]);

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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAdd = (data: Omit<ScheduleEvent, "id">) => {
    const id = crypto.randomUUID();
    const ev = { ...data, id };
    addEvent(ev);
    setEvents(prev => [...prev, ev]);
    setAddingNew(false);
  };

  const handleUpdate = (data: Omit<ScheduleEvent, "id">) => {
    if (!editingEvent) return;
    updateEvent(editingEvent.id, data as Partial<ScheduleEvent>);
    setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...e, ...data } : e));
    setEditingEvent(null);
  };

  const handleDelete = (id: string) => {
    deleteEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
    setEditingEvent(null);
  };

  const handleBarClick = (ev: GanttEvent) => {
    if (!canEdit) return;
    const original = eventsById[ev.id];
    if (original) setEditingEvent(original);
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
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

  const modal = (addingNew || editingEvent) ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md">
        <AcademicEventForm
          initialData={editingEvent ? {
            ...editingEvent,
            date:    editingEvent.date,
            endDate: (editingEvent as any).endDate ?? editingEvent.date,
          } : undefined}
          onSubmit={editingEvent ? handleUpdate : handleAdd}
          onDelete={editingEvent ? handleDelete : undefined}
          onCancel={() => { setAddingNew(false); setEditingEvent(null); }}
        />
      </div>
    </div>
  ) : null;

  return (
    <>
      {modal}
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

            {/* Type filter */}
            <div className={`flex items-center gap-1 rounded-xl border px-2 py-1 ${isDark ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
              <Filter size={12} className={muted} />
              {(["ALL", "ACADEMIC", "DAY_OFF"] as TypeFilter[]).map(tf => (
                <button key={tf} onClick={() => setTypeFilter(tf)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150 ${
                    typeFilter === tf
                      ? tf === "DAY_OFF" ? "bg-red-600 text-white shadow-sm" : "bg-indigo-600 text-white shadow-sm"
                      : `${muted} ${isDark ? "hover:bg-slate-700" : "hover:bg-slate-200"}`
                  }`}
                >
                  {tf === "ALL" ? "Todos" : tf === "ACADEMIC" ? "Acadêmico" : "Day Off"}
                </button>
              ))}
            </div>

            {/* Squadron filter */}
            <div className={`flex items-center gap-1 rounded-xl border px-2 py-1 ${isDark ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
              {(["ALL", 1, 2, 3, 4] as const).map(sq => (
                <button key={sq} onClick={() => setSquadron(sq)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150 ${
                    squadron === sq ? "bg-indigo-600 text-white shadow-sm" : `${muted} ${isDark ? "hover:bg-slate-700" : "hover:bg-slate-200"}`
                  }`}
                >
                  {sq === "ALL" ? "Esq." : `${sq}º`}
                </button>
              ))}
            </div>

            {/* Add button — admin only */}
            {canEdit && (
              <button onClick={() => setAddingNew(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm">
                <Plus size={13} /> Novo Evento
              </button>
            )}
          </div>
        </div>

        {/* Gantt chart */}
        {ganttEvents.length === 0 ? (
          <div className={`rounded-xl border py-16 text-center ${muted} text-sm ${card}`}>
            Nenhum evento encontrado para {year}
          </div>
        ) : (
          <div className={`rounded-xl border ${card}`}>

            {/* Sticky header */}
            <div className={`sticky top-0 z-30 border-b ${border} rounded-t-xl`} style={{ overflow: "hidden" }}>
              <div ref={headerRef} style={{ overflow: "hidden", pointerEvents: "none" }}>
                <div style={{ display: "flex", width: LABEL_W + totalWidth }}>
                  <div className={`flex-shrink-0 border-r ${border} ${cornerBg}`} style={{ width: LABEL_W, height: HEAD_H }} />
                  <div className="relative flex-1" style={{ height: HEAD_H }}>
                    {monthTicks.map(t => (
                      <div key={t.m} className={`absolute top-0 bottom-0 flex items-center border-r ${border}`}
                        style={{ left: t.left, width: t.width, background: headBg(t.m) }}>
                        <span className={`text-[10px] font-bold ml-1.5 ${muted}`}>{t.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div ref={bodyRef} className="overflow-x-auto">
              <div style={{ width: LABEL_W + totalWidth, minWidth: "100%" }}>
                {ganttEvents.map((ev) => {
                  const isHov    = hovered === ev.id;
                  const left     = barLeft(ev);
                  const width    = barWidth(ev);
                  const isMulti  = diffDays(ev.start, ev.end) > 0;
                  const sqValid  = ev.squadron !== null;
                  const isDayOff = ev.type === "DAY_OFF";

                  return (
                    <div key={ev.id}
                      onMouseEnter={() => setHovered(ev.id)}
                      onMouseLeave={() => setHovered(null)}
                      className={`flex border-b transition-colors duration-100 ${border} ${isHov ? (isDark ? "bg-indigo-900/15" : "bg-indigo-50/50") : ""}`}
                      style={{ height: ROW_H }}
                    >
                      {/* Label — sticky left */}
                      <div
                        className={`flex-shrink-0 flex items-center gap-2 px-3 border-r ${border} ${cornerBg} z-10 ${canEdit ? "cursor-pointer" : ""}`}
                        style={{ width: LABEL_W, position: "sticky", left: 0 }}
                        onClick={() => handleBarClick(ev)}
                        title={canEdit ? "Clique para editar" : undefined}
                      >
                        {isDayOff
                          ? <div className="w-2 h-2 rounded-sm flex-shrink-0 bg-red-500" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.4) 2px, rgba(255,255,255,0.4) 3px)" }} />
                          : <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                        }
                        <span className={`text-[10px] leading-tight truncate ${isDayOff ? "text-red-400 font-semibold" : (isDark ? "text-slate-200" : "text-slate-700")}`}>
                          {ev.label}
                        </span>
                        {sqValid && (
                          <span className="text-[9px] ml-auto flex-shrink-0 font-semibold" style={{ color: ev.color }}>
                            {ev.squadron}º
                          </span>
                        )}
                        {canEdit && isHov && (
                          <span className={`text-[8px] ml-auto flex-shrink-0 opacity-50 ${muted}`}>editar</span>
                        )}
                      </div>

                      {/* Timeline */}
                      <div className="relative" style={{ width: totalWidth, height: ROW_H }}>
                        {/* Month bands */}
                        {monthTicks.map(t => (
                          <div key={t.m} className="absolute top-0 bottom-0"
                            style={{ left: t.left, width: t.width, background: bandBg(t.m) }} />
                        ))}

                        {/* DAY_OFF stripe overlay */}
                        {isDayOff && (
                          <div className="absolute top-0 bottom-0"
                            style={{ left: barLeft(ev), width: barWidth(ev),
                              background: "repeating-linear-gradient(45deg, rgba(239,68,68,0.08) 0px, rgba(239,68,68,0.08) 4px, transparent 4px, transparent 8px)",
                              zIndex: 2 }} />
                        )}

                        {/* Today */}
                        {todayLeft !== null && (
                          <div className="absolute top-0 bottom-0 w-px bg-red-500/60 z-10" style={{ left: todayLeft }} />
                        )}

                        {/* Bar */}
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 rounded-md flex items-center px-1.5 overflow-hidden transition-all duration-150 ${canEdit ? "cursor-pointer" : ""}`}
                          style={{
                            left, width, height: ROW_H - 10, zIndex: 5,
                            backgroundColor: isDayOff
                              ? `rgba(239,68,68,${isHov ? 0.35 : 0.2})`
                              : ev.color + (isHov ? "ff" : "cc"),
                            border: isDayOff ? "1px dashed rgba(239,68,68,0.6)" : "none",
                            boxShadow: isHov ? `0 0 0 2px ${ev.color}55` : "none",
                          }}
                          onClick={() => handleBarClick(ev)}
                          title={`${ev.label}${canEdit ? " · clique para editar" : ""}`}
                        >
                          {width > 40 && (
                            <span className={`text-[9px] font-semibold truncate leading-tight drop-shadow ${isDayOff ? "text-red-600 dark:text-red-300" : "text-white"}`}>
                              {isMulti ? `${fmtShort(ev.start)} – ${fmtShort(ev.end)}` : fmtShort(ev.start)}
                            </span>
                          )}
                        </div>

                        {/* Tooltip */}
                        {isHov && (
                          <div className={`absolute z-50 top-full mt-1 rounded-lg border shadow-xl px-3 py-2 text-[11px] pointer-events-none whitespace-nowrap ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"}`}
                            style={{ left: Math.min(left, totalWidth - 220) }}>
                            <p className="font-semibold">{ev.label}</p>
                            <p className={muted}>
                              {fmtShort(ev.start)}{isMulti ? ` → ${fmtShort(ev.end)} (${diffDays(ev.start, ev.end) + 1}d)` : ""}
                            </p>
                            {isDayOff && <p className="text-red-400 text-[10px] mt-0.5">⛔ Alocação de aulas bloqueada</p>}
                            {ev.squadron && !isDayOff && <p style={{ color: ev.color }}>{SQ_LABELS[ev.squadron]}</p>}
                            {canEdit && <p className={`mt-1 opacity-50 ${muted}`}>clique para editar</p>}
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
        <div className={`rounded-xl border p-3 ${card}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${muted}`}>Legenda</p>
          <div className="flex flex-wrap gap-4">
            {squadron === "ALL" && [1,2,3,4].map(sq => (
              <div key={sq} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cohortTokens[sq]?.primary }} />
                <span className={`text-[11px] ${muted}`}>{SQ_LABELS[sq]}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-indigo-500" />
              <span className={`text-[11px] ${muted}`}>Geral</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border border-dashed border-red-500 bg-red-500/20" />
              <span className={`text-[11px] ${muted}`}>Day Off (sem aulas)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-3 bg-red-500" />
              <span className={`text-[11px] ${muted}`}>Hoje</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
