import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { BarChart2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useCourseStore } from "../store/useCourseStore";
import { getCohortColorTokens, sqDisplayColor } from "../utils/cohortColors";
import { AcademicEventForm } from "../components/AcademicEventForm";
import type { CohortColor, ScheduleEvent } from "../types";

const SQ_LABELS = ["Todos", "1º ESQ", "2º ESQ", "3º ESQ", "4º ESQ"];

const EVAL_LABELS: Record<string, string> = {
  PARTIAL: "Parcial", EXAM: "Exame", FINAL: "Prova Final",
  SECOND_CHANCE: "2ª Época", REVIEW: "Vista",
};

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// Color per event type — darker, higher-contrast palette
const TYPE_COLORS: Record<string, string> = {
  ACADEMIC:      "#4338ca", // indigo-700
  EVALUATION:    "#c2410c", // orange-700
  DAY_OFF:       "#b91c1c", // red-700
  COMMEMORATIVE: "#b45309", // amber-700
  SPORTS:        "#0f766e", // teal-700
  INFORMATIVE:   "#0369a1", // sky-700
  HOLIDAY:       "#be123c", // rose-700
};

const TYPE_LABELS: Record<string, string> = {
  ACADEMIC:      "Acadêmico",
  EVALUATION:    "Avaliação",
  DAY_OFF:       "Day Off",
  COMMEMORATIVE: "Comemorativo",
  SPORTS:        "Esportivo",
  INFORMATIVE:   "Informativo",
  HOLIDAY:       "Feriado",
};

interface GanttEvent {
  id: string;           // id do primeiro evento fundido (chave React)
  mergedIds: string[];  // todos os ids fundidos nesta barra
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

function daysInMonth(year: number, m: number): number {
  return new Date(year, m + 1, 0).getDate();
}

function fmtShort(d: Date): string {
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function mergeConsecutive(events: GanttEvent[]): GanttEvent[] {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: GanttEvent[] = [];
  for (const ev of sorted) {
    const key = `${ev.type}||${ev.label}||${ev.squadron ?? "null"}`;
    let last: GanttEvent | undefined;
    for (let i = merged.length - 1; i >= 0; i--) {
      if (`${merged[i].type}||${merged[i].label}||${merged[i].squadron ?? "null"}` === key) { last = merged[i]; break; }
    }
    if (last && diffDays(last.end, ev.start) <= 1) {
      if (ev.end > last.end) last.end = ev.end;
      last.mergedIds.push(...ev.mergedIds);
    } else {
      merged.push({ ...ev, mergedIds: [...ev.mergedIds] });
    }
  }
  return merged;
}

const LABEL_W = 240;
const ROW_H   = 36;
const HEAD_H  = 32;

const ALL_TYPES = ["ACADEMIC", "EVALUATION", "DAY_OFF", "COMMEMORATIVE", "SPORTS", "INFORMATIVE", "HOLIDAY"] as const;
const SQUADRONS = [1, 2, 3, 4] as const;

export const AcademicGantt = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { userProfile } = useAuth();
  const canEdit = ["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role ?? "");
  const { fetchYearlyEvents, cohorts, addEvent, updateEvent, deleteEvent } = useCourseStore();

  const currentYear = new Date().getFullYear();
  const [year, setYear]           = useState(currentYear);
  const [addingNew, setAddingNew] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [hovered, setHovered]     = useState<string | null>(null);

  // Multi-select filters: empty set = "all"
  const [selTypes, setSelTypes]       = useState<Set<string>>(new Set());
  const [selSquadrons, setSelSquadrons] = useState<Set<number>>(new Set());

  const bodyRef   = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Subscribe directly to store cache — mutations update it synchronously
  const EMPTY_EVENTS = useMemo<ScheduleEvent[]>(() => [], []);
  const events = useCourseStore(state => state.yearEventsCache[year] ?? EMPTY_EVENTS);

  // Fetch if not cached
  useEffect(() => {
    if (!useCourseStore.getState().yearEventsCache[year]) {
      fetchYearlyEvents(year);
    }
  }, [year, fetchYearlyEvents]);

  // Sync header scroll with body
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
    SQUADRONS.forEach(sq => {
      const entryYear = year - sq + 1;
      const c = cohorts.find(x => Number(x.entryYear) === entryYear);
      r[sq] = getCohortColorTokens((c?.color || "blue") as CohortColor);
    });
    return r;
  }, [cohorts, year]);

  const sqColor = (sq: number | null) => sqDisplayColor(cohortTokens[sq ?? 0] ?? getCohortColorTokens("blue"), isDark);

  const eventsById = useMemo(() => {
    const m: Record<string, ScheduleEvent> = {};
    events.forEach(e => { m[e.id] = e; });
    return m;
  }, [events]);

  // ── Percentage-based month layout (fills available width exactly) ────────
  // dateToPercent: returns 0-100 position within the timeline
  const dateToPercent = useCallback((date: Date): number => {
    const m = date.getMonth();
    const d = date.getDate();
    return ((m + (d - 1) / daysInMonth(year, m)) / 12) * 100;
  }, [year]);

  const barLeftPct = useCallback((ev: GanttEvent) => dateToPercent(ev.start), [dateToPercent]);
  const barWidthPct = useCallback((ev: GanttEvent) => {
    const em = ev.end.getMonth(), ed = ev.end.getDate();
    const rightPct = ((em + ed / daysInMonth(year, em)) / 12) * 100;
    return Math.max(0.3, rightPct - dateToPercent(ev.start));
  }, [dateToPercent, year]);

  const monthTicks = useMemo(() => Array.from({ length: 12 }, (_, m) => ({
    label: MONTHS_PT[m], m,
    leftPct:  (m / 12) * 100,
    widthPct: (1 / 12) * 100,
  })), []);

  const todayPct = useMemo(() => {
    const t = new Date(); t.setHours(0,0,0,0);
    if (t.getFullYear() !== year) return null;
    return dateToPercent(t);
  }, [year, dateToPercent]);

  // ── Gantt events ─────────────────────────────────────────────────────────
  const ganttEvents = useMemo((): GanttEvent[] => {
    const SHOW_TYPES = new Set(["ACADEMIC", "EVALUATION", "DAY_OFF", "COMMEMORATIVE", "SPORTS", "INFORMATIVE", "HOLIDAY"]);
    const raw: GanttEvent[] = events
      .filter(e => SHOW_TYPES.has(e.type ?? "") || e.disciplineId === "ACADEMIC")
      .map(e => {
        const isDayOff = e.type === "DAY_OFF";
        const sqRaw    = e.targetSquadron;
        const sqNum    = sqRaw != null && sqRaw !== "ALL" ? Number(sqRaw) : null;
        const sqValid  = sqNum !== null && Number.isFinite(sqNum) && sqNum >= 1 && sqNum <= 4;
        const label    = isDayOff || e.type === "COMMEMORATIVE" || e.type === "SPORTS"
          ? (e.description || TYPE_LABELS[e.type!] || "Evento")
          : e.type === "EVALUATION"
            ? (EVAL_LABELS[e.evaluationType ?? ""] ?? "Avaliação")
            : (e.description || e.location || "Evento");
        const start = parseDate(e.date);
        const end   = parseDate((e as any).endDate ?? e.date);
        // Color: squadron-aware only for ACADEMIC
        const color = (e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC") && sqValid
          ? sqColor(sqNum!)
          : (TYPE_COLORS[e.type ?? ""] ?? TYPE_COLORS.ACADEMIC);
        return { id: e.id, mergedIds: [e.id], label, start, end, color, squadron: sqValid ? sqNum : null, type: e.type ?? "ACADEMIC" };
      })
      .filter(e => {
        // Type filter (multi-select, empty = all)
        if (selTypes.size > 0 && !selTypes.has(e.type)) return false;
        // Squadron filter (multi-select, empty = all); null squadron = general event, always shown
        if (selSquadrons.size > 0 && e.squadron !== null && !selSquadrons.has(e.squadron)) return false;
        return true;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return mergeConsecutive(raw);
  }, [events, selTypes, selSquadrons, cohortTokens]);

  // ── Filters toggle helpers ────────────────────────────────────────────────
  const toggleType = (t: string) => setSelTypes(prev => {
    const next = new Set(prev);
    if (next.has(t)) next.delete(t); else next.add(t);
    return next;
  });
  const toggleSquadron = (sq: number) => setSelSquadrons(prev => {
    const next = new Set(prev);
    if (next.has(sq)) next.delete(sq); else next.add(sq);
    return next;
  });

  // ids de todos os sub-eventos fundidos na barra selecionada
  const [editingMergedIds, setEditingMergedIds] = useState<string[]>([]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAdd = (data: Omit<ScheduleEvent, "id">) => {
    addEvent({ ...data, id: crypto.randomUUID() });
    setAddingNew(false);
  };

  const handleUpdate = (data: Omit<ScheduleEvent, "id">) => {
    if (!editingEvent) return;
    // Se havia múltiplos sub-eventos fundidos, deleta os extras e atualiza o principal
    const [primary, ...extras] = editingMergedIds;
    extras.forEach(xid => deleteEvent(xid));
    // Garante que endDate cobre o span visual completo (start..end da barra merged)
    updateEvent(primary ?? editingEvent.id, data as Partial<ScheduleEvent>);
    setEditingEvent(null);
    setEditingMergedIds([]);
  };

  const handleDelete = (_id: string) => {
    // Deleta todos os sub-eventos que estavam fundidos na barra
    editingMergedIds.forEach(xid => deleteEvent(xid));
    setEditingEvent(null);
    setEditingMergedIds([]);
  };

  const handleBarClick = (ev: GanttEvent) => {
    if (!canEdit) return;
    const o = eventsById[ev.id];
    if (!o) return;
    // Preenche endDate com o fim visual da barra merged (cobre todos os sub-eventos)
    const mergedEndDate = isoDate(ev.end);
    setEditingEvent({ ...o, endDate: mergedEndDate } as any);
    setEditingMergedIds(ev.mergedIds);
  };

  // ── Styles ────────────────────────────────────────────────────────────────
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

  const pillBase = `px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150 border`;
  const pillOff  = isDark ? `${pillBase} border-slate-600 text-slate-400 hover:border-slate-500` : `${pillBase} border-slate-300 text-slate-500 hover:border-slate-400`;
  const typeColors: Record<string, string> = {
    ACADEMIC:      "bg-indigo-700 border-indigo-700 text-white",
    EVALUATION:    "bg-orange-700 border-orange-700 text-white",
    DAY_OFF:       "bg-red-700 border-red-700 text-white",
    COMMEMORATIVE: "bg-amber-700 border-amber-700 text-white",
    SPORTS:        "bg-teal-700 border-teal-700 text-white",
    INFORMATIVE:   "bg-sky-700 border-sky-700 text-white",
    HOLIDAY:       "bg-rose-700 border-rose-700 text-white",
  };

  const modal = (addingNew || editingEvent) ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md">
        <AcademicEventForm
          initialData={editingEvent ? { ...editingEvent, endDate: (editingEvent as any).endDate ?? editingEvent.date } : undefined}
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

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl">
                <BarChart2 className="text-indigo-500" size={20} />
              </div>
              <div>
                <h1 className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>Gantt de Eventos</h1>
                <p className={`text-xs ${muted}`}>Eventos acadêmicos ao longo do ano</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Year nav */}
              <div className="flex items-center gap-1">
                <button onClick={() => setYear(y => y - 1)} className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}><ChevronLeft size={16} /></button>
                <span className={`text-sm font-semibold w-12 text-center ${isDark ? "text-white" : "text-slate-900"}`}>{year}</span>
                <button onClick={() => setYear(y => y + 1)} className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}><ChevronRight size={16} /></button>
              </div>
              {canEdit && (
                <button onClick={() => setAddingNew(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm">
                  <Plus size={13} /> Novo Evento
                </button>
              )}
            </div>
          </div>

          {/* ── Multi-select filters ─────────────────────────────────────── */}
          <div className={`flex flex-wrap gap-3 p-3 rounded-xl border ${card}`}>
            {/* Tipo */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider mr-1 ${muted}`}>Tipo</span>
              <button onClick={() => setSelTypes(new Set())}
                className={selTypes.size === 0 ? `${pillBase} bg-slate-600 border-slate-600 text-white` : pillOff}>
                Todos
              </button>
              {ALL_TYPES.map(t => (
                <button key={t} onClick={() => toggleType(t)}
                  className={selTypes.has(t) ? `${pillBase} ${typeColors[t]}` : pillOff}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            <div className={`hidden sm:block w-px self-stretch ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />

            {/* Esquadrão */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider mr-1 ${muted}`}>Esq.</span>
              <button onClick={() => setSelSquadrons(new Set())}
                className={selSquadrons.size === 0 ? `${pillBase} bg-slate-600 border-slate-600 text-white` : pillOff}>
                Todos
              </button>
              {SQUADRONS.map(sq => {
                const active = selSquadrons.has(sq);
                const col = sqDisplayColor(cohortTokens[sq] ?? getCohortColorTokens("blue"), isDark);
                return (
                  <button key={sq} onClick={() => toggleSquadron(sq)}
                    className={`${pillBase} ${active ? "text-white" : (isDark ? "text-slate-400 hover:border-slate-500" : "text-slate-500 hover:border-slate-400")}`}
                    style={active ? { backgroundColor: col, borderColor: col } : undefined}>
                    {sq}º
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Gantt chart ───────────────────────────────────────────────────── */}
        {ganttEvents.length === 0 ? (
          <div className={`rounded-xl border py-16 text-center ${muted} text-sm ${card}`}>
            Nenhum evento encontrado para {year}
          </div>
        ) : (
          <div className={`rounded-xl border ${card}`}>

            {/* Sticky month header — OUTSIDE overflow-x-auto, synced via JS */}
            <div className={`sticky top-0 z-30 border-b ${border} rounded-t-xl`} style={{ overflow: "hidden" }}>
              <div ref={headerRef} style={{ overflow: "hidden", pointerEvents: "none" }}>
                <div style={{ display: "flex" }}>
                  <div className={`flex-shrink-0 border-r ${border} ${cornerBg}`} style={{ width: LABEL_W, height: HEAD_H }} />
                  <div className="relative flex-1" style={{ height: HEAD_H }}>
                    {monthTicks.map(t => (
                      <div key={t.m} className={`absolute top-0 bottom-0 flex items-center border-r ${border}`}
                        style={{ left: `${t.leftPct}%`, width: `${t.widthPct}%`, background: headBg(t.m) }}>
                        <span className={`text-[10px] font-bold ml-1.5 ${muted}`}>{t.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div ref={bodyRef} className="overflow-x-auto">
              <div style={{ minWidth: 640 }}>
                {ganttEvents.map((ev) => {
                  const isHov    = hovered === ev.id;
                  const leftPct  = barLeftPct(ev);
                  const widthPct = barWidthPct(ev);
                  const isMulti  = diffDays(ev.start, ev.end) > 0;
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
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                        <span className={`text-[10px] leading-tight truncate ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                          {ev.label}
                        </span>
                        {ev.squadron !== null && (
                          <span className="text-[9px] ml-auto flex-shrink-0 font-semibold" style={{ color: ev.color }}>{ev.squadron}º</span>
                        )}
                      </div>

                      {/* Timeline — flex-1 fills remaining card width */}
                      <div className="relative flex-1" style={{ height: ROW_H }}>
                        {/* Month bands */}
                        {monthTicks.map(t => (
                          <div key={t.m} className="absolute top-0 bottom-0"
                            style={{ left: `${t.leftPct}%`, width: `${t.widthPct}%`, background: bandBg(t.m) }} />
                        ))}

                        {/* Today line */}
                        {todayPct !== null && (
                          <div className="absolute top-0 bottom-0 w-px bg-red-500/60 z-10" style={{ left: `${todayPct}%` }} />
                        )}

                        {/* Bar */}
                        {(() => {
                          const dateLabel = isMulti ? `${fmtShort(ev.start)} – ${fmtShort(ev.end)}` : fmtShort(ev.start);
                          const labelFits = widthPct > 5;
                          const nearEnd   = leftPct + widthPct > 88; // close to Dec — label goes left
                          return (
                            <>
                              <div
                                className={`absolute top-1/2 -translate-y-1/2 rounded-md flex items-center px-1.5 overflow-hidden transition-all duration-150 ${canEdit ? "cursor-pointer" : ""}`}
                                style={{
                                  left: `${leftPct}%`, width: `${widthPct}%`, height: ROW_H - 10, zIndex: 5,
                                  backgroundColor: isDayOff
                                    ? `rgba(185,28,28,${isHov ? 0.55 : 0.35})`
                                    : ev.color,
                                  border: isDayOff ? `1px dashed ${TYPE_COLORS.DAY_OFF}` : "none",
                                  boxShadow: isHov ? `0 0 0 2px ${ev.color}55` : "none",
                                }}
                                onClick={() => handleBarClick(ev)}
                              >
                                {labelFits && (
                                  <span className={`text-[9px] font-semibold truncate leading-tight drop-shadow ${isDayOff ? "text-red-500 dark:text-red-300" : "text-white"}`}>
                                    {dateLabel}
                                  </span>
                                )}
                              </div>
                              {/* Label outside bar when it doesn't fit */}
                              {!labelFits && (
                                <span
                                  className={`absolute top-1/2 -translate-y-1/2 text-[9px] font-semibold leading-tight whitespace-nowrap z-10 pointer-events-none ${isDark ? "text-slate-300" : "text-slate-600"}`}
                                  style={nearEnd
                                    ? { right: `${100 - leftPct}%`, marginRight: 3 }
                                    : { left: `${leftPct + widthPct}%`, marginLeft: 3 }
                                  }
                                >
                                  {dateLabel}
                                </span>
                              )}
                            </>
                          );
                        })()}

                        {/* Tooltip */}
                        {isHov && (
                          <div className={`absolute z-50 top-full mt-1 rounded-lg border shadow-xl px-3 py-2 text-[11px] pointer-events-none whitespace-nowrap ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"}`}
                            style={{ left: `min(${leftPct}%, calc(100% - 220px))` }}>
                            <p className="font-semibold">{ev.label}</p>
                            <p className={muted}>
                              {fmtShort(ev.start)}{isMulti ? ` → ${fmtShort(ev.end)} (${diffDays(ev.start, ev.end) + 1}d)` : ""}
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: ev.color }}>{TYPE_LABELS[ev.type] ?? ev.type}</p>
                            {isDayOff && <p className="text-red-400 text-[10px]">⛔ Alocação de aulas bloqueada</p>}
                            {ev.squadron !== null && !isDayOff && <p style={{ color: ev.color }}>{SQ_LABELS[ev.squadron]}</p>}
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

        {/* ── Legend ───────────────────────────────────────────────────────── */}
        <div className={`rounded-xl border p-3 ${card}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${muted}`}>Legenda</p>
          <div className="flex flex-wrap gap-4">
            {ALL_TYPES.map(t => (
              <div key={t} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: t === "DAY_OFF" ? TYPE_COLORS[t] + "50" : TYPE_COLORS[t], border: t === "DAY_OFF" ? `1px dashed ${TYPE_COLORS[t]}` : "none" }} />
                <span className={`text-[11px] ${muted}`}>{TYPE_LABELS[t]}</span>
              </div>
            ))}
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
