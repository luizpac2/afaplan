import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { getCohortColorTokens } from "../utils/cohortColors";
import type { CohortColor } from "../types";

// ── Constants ──────────────────────────────────────────────────────────────────
const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const FIELD_LABELS: Record<string, string> = {
  GERAL:                    "Geral",
  MILITAR:                  "Militar",
  PROFISSIONAL:             "Profissional",
  ATIVIDADES_COMPLEMENTARES:"At. Complementares",
};

const FIELD_COLORS: Record<string, string> = {
  GERAL:                    "#6366f1",
  MILITAR:                  "#ef4444",
  PROFISSIONAL:             "#14b8a6",
  ATIVIDADES_COMPLEMENTARES:"#f59e0b",
};

const COURSE_LABELS: Record<string, string> = {
  AVIATION:   "Aviação",
  INTENDANCY: "Intendência",
  INFANTRY:   "Infantaria",
};

const COURSE_COLORS: Record<string, string> = {
  AVIATION:   "#3b82f6",
  INTENDANCY: "#8b5cf6",
  INFANTRY:   "#22c55e",
};

const ALL_FIELDS   = ["GERAL","MILITAR","PROFISSIONAL","ATIVIDADES_COMPLEMENTARES"] as const;
const ALL_COURSES  = ["AVIATION","INTENDANCY","INFANTRY"] as const;
const ALL_SQ_YEARS = [1, 2, 3, 4] as const;

const LABEL_W = 300;
const ROW_H   = 34;
const HEAD_H  = 32;

// ── Types ──────────────────────────────────────────────────────────────────────
interface DisciplineRow {
  key:           string;
  disciplineId:  string;
  name:          string;
  code:          string;
  classId:       string;
  sqYear:        number;   // 1-4 — maps to Esquadrão
  course:        string;
  trainingField: string;
  color:         string;
  firstDate:     Date;
  lastDate:      Date;
  classCount:    number;
  totalLoad:     number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysInMonth(year: number, m: number): number {
  return new Date(year, m + 1, 0).getDate();
}

function fmtShort(d: Date): string {
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}

function toggle<T>(set: Set<T>, val: T): Set<T> {
  const n = new Set(set);
  if (n.has(val)) n.delete(val); else n.add(val);
  return n;
}

// ── Component ──────────────────────────────────────────────────────────────────
export const DisciplineGantt = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { fetchYearlyEvents, disciplines, cohorts, classes } = useCourseStore();

  const currentYear = new Date().getFullYear();
  const [year, setYear]     = useState(currentYear);
  const [hovered, setHovered] = useState<string | null>(null);

  // Multi-select filters — empty = all
  const [selYears,   setSelYears]   = useState<Set<number>>(new Set());
  const [selFields,  setSelFields]  = useState<Set<string>>(new Set());
  const [selCourses, setSelCourses] = useState<Set<string>>(new Set());

  const bodyRef   = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Subscribe to store cache
  const EMPTY: never[] = useMemo(() => [], []);
  const events = useCourseStore(state => state.yearEventsCache[year] ?? EMPTY);

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

  // Cohort color tokens per squadron year
  const cohortTokens = useMemo(() => {
    const r: Record<number, ReturnType<typeof getCohortColorTokens>> = {};
    ALL_SQ_YEARS.forEach(yr => {
      const entryYear = year - yr + 1;
      const c = cohorts.find(x => Number(x.entryYear) === entryYear);
      r[yr] = getCohortColorTokens((c?.color ?? "blue") as CohortColor);
    });
    return r;
  }, [cohorts, year]);

  // Discipline lookup map
  const disciplineMap = useMemo(() => {
    const m: Record<string, typeof disciplines[0]> = {};
    disciplines.forEach(d => { m[d.id] = d; });
    return m;
  }, [disciplines]);

  // CourseClass lookup: year+letter → type
  const classTypeMap = useMemo(() => {
    const m: Record<string, string> = {};
    classes.forEach(c => {
      const key = `${c.year}${c.name}`;  // e.g. "1A", "2B"
      m[key] = c.type;
    });
    return m;
  }, [classes]);

  // ── Compute rows ─────────────────────────────────────────────────────────────
  const allRows = useMemo((): DisciplineRow[] => {
    // Only regular class events (not academic/holiday markers)
    const classEvents = events.filter(e =>
      (e.type === "CLASS" || !e.type) &&
      e.disciplineId &&
      e.disciplineId !== "ACADEMIC"
    );

    // Group by (disciplineId, classId)
    const groups = new Map<string, typeof classEvents>();
    classEvents.forEach(e => {
      const key = `${e.disciplineId}__${e.classId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    });

    const rows: DisciplineRow[] = [];

    groups.forEach((evts, key) => {
      const sepIdx       = key.indexOf("__");
      const disciplineId = key.slice(0, sepIdx);
      const classId      = key.slice(sepIdx + 2);
      const disc = disciplineMap[disciplineId];
      if (!disc || !classId) return;

      // Extract year digit and class letter from classId (e.g. "1A", "3B")
      const sqYear    = parseInt(classId.charAt(0));
      const classLetter = classId.charAt(1);
      if (isNaN(sqYear) || sqYear < 1 || sqYear > 4) return;

      // Course from CourseClass lookup, fallback to discipline's first enabledCourse
      const course = classTypeMap[`${sqYear}${classLetter}`]
        ?? disc.enabledCourses?.[0]
        ?? "AVIATION";

      // Date span
      let tMin = Infinity, tMax = -Infinity;
      evts.forEach(e => {
        const t = parseLocalDate(e.date).getTime();
        if (t < tMin) tMin = t;
        if (t > tMax) tMax = t;
      });

      // Bar color: prefer discipline.color, fallback to trainingField color
      const color = disc.color && disc.color !== "#000000" && disc.color !== ""
        ? disc.color
        : FIELD_COLORS[disc.trainingField] ?? "#6366f1";

      // Total load from ppcLoads (e.g. "AVIATION_1": 64)
      const ppcKey = `${course}_${sqYear}`;
      const totalLoad = disc.ppcLoads?.[ppcKey] ?? 0;

      rows.push({
        key,
        disciplineId,
        name: disc.name,
        code: disc.code,
        classId,
        sqYear,
        course,
        trainingField: disc.trainingField,
        color,
        firstDate: new Date(tMin),
        lastDate:  new Date(tMax),
        classCount: evts.length,
        totalLoad,
      });
    });

    // Sort: squadron year → first date → name
    return rows.sort((a, b) =>
      a.sqYear !== b.sqYear ? a.sqYear - b.sqYear :
      a.firstDate.getTime() !== b.firstDate.getTime() ? a.firstDate.getTime() - b.firstDate.getTime() :
      a.name.localeCompare(b.name, "pt")
    );
  }, [events, disciplineMap, classTypeMap]);

  // Apply filters
  const filteredRows = useMemo(() =>
    allRows.filter(r => {
      if (selYears.size   > 0 && !selYears.has(r.sqYear))        return false;
      if (selFields.size  > 0 && !selFields.has(r.trainingField)) return false;
      if (selCourses.size > 0 && !selCourses.has(r.course))       return false;
      return true;
    }),
  [allRows, selYears, selFields, selCourses]);

  // ── Timeline helpers ──────────────────────────────────────────────────────────
  const dateToPercent = useCallback((date: Date): number => {
    const m = date.getMonth(), d = date.getDate();
    return ((m + (d - 1) / daysInMonth(year, m)) / 12) * 100;
  }, [year]);

  const monthTicks = useMemo(() =>
    Array.from({ length: 12 }, (_, m) => ({
      label: MONTHS_PT[m], m,
      leftPct:  (m / 12) * 100,
      widthPct: (1 / 12) * 100,
    })),
  []);

  const todayPct = useMemo(() => {
    const t = new Date(); t.setHours(0,0,0,0);
    if (t.getFullYear() !== year) return null;
    return dateToPercent(t);
  }, [year, dateToPercent]);

  // ── Styles ────────────────────────────────────────────────────────────────────
  const card     = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 shadow-sm";
  const muted    = isDark ? "text-slate-400" : "text-slate-500";
  const border   = isDark ? "border-slate-700" : "border-slate-200";
  const cornerBg = isDark ? "bg-slate-800" : "bg-slate-50";

  const bandBg = (m: number) => m % 2 === 0
    ? (isDark ? "rgba(255,255,255,0.00)" : "rgba(255,255,255,1)")
    : (isDark ? "rgba(255,255,255,0.03)" : "rgba(241,245,249,0.8)");

  const headBg = (m: number) => m % 2 === 0
    ? (isDark ? "#1e293b" : "#f8fafc")
    : (isDark ? "#162032" : "#f1f5f9");

  const pillBase = "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150 border";
  const pillOff  = isDark
    ? `${pillBase} border-slate-600 text-slate-400 hover:border-slate-500`
    : `${pillBase} border-slate-300 text-slate-500 hover:border-slate-400`;
  const pillAllOn = `${pillBase} bg-slate-600 border-slate-600 text-white`;

  // ── Render ────────────────────────────────────────────────────────────────────
  const loading = events.length === 0;

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 max-w-[1800px] mx-auto">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 rounded-xl">
              <BookOpen className="text-teal-500" size={20} />
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Gantt de Disciplinas
              </h1>
              <p className={`text-xs ${muted}`}>
                Distribuição das disciplinas ao longo do ano letivo por turma
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setYear(y => y - 1)}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}>
              <ChevronLeft size={16} />
            </button>
            <span className={`text-sm font-semibold w-12 text-center ${isDark ? "text-white" : "text-slate-900"}`}>
              {year}
            </span>
            <button onClick={() => setYear(y => y + 1)}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className={`flex flex-wrap gap-x-4 gap-y-2 p-3 rounded-xl border ${card}`}>

          {/* Esquadrão */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider mr-1 ${muted}`}>Esq.</span>
            <button onClick={() => setSelYears(new Set())}
              className={selYears.size === 0 ? pillAllOn : pillOff}>
              Todos
            </button>
            {ALL_SQ_YEARS.map(yr => {
              const active = selYears.has(yr);
              const col = cohortTokens[yr]?.primary ?? "#6366f1";
              return (
                <button key={yr}
                  onClick={() => setSelYears(prev => toggle(prev, yr))}
                  className={`${pillBase} ${active ? "text-white" : (isDark ? "text-slate-400 hover:border-slate-500" : "text-slate-500 hover:border-slate-400")}`}
                  style={active ? { backgroundColor: col, borderColor: col } : undefined}>
                  {yr}º
                </button>
              );
            })}
          </div>

          <div className={`hidden sm:block w-px self-stretch ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />

          {/* Campo do conhecimento */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider mr-1 ${muted}`}>Campo</span>
            <button onClick={() => setSelFields(new Set())}
              className={selFields.size === 0 ? pillAllOn : pillOff}>
              Todos
            </button>
            {ALL_FIELDS.map(f => {
              const active = selFields.has(f);
              return (
                <button key={f}
                  onClick={() => setSelFields(prev => toggle(prev, f))}
                  className={`${pillBase} ${active ? "text-white" : (isDark ? "text-slate-400 hover:border-slate-500" : "text-slate-500 hover:border-slate-400")}`}
                  style={active ? { backgroundColor: FIELD_COLORS[f], borderColor: FIELD_COLORS[f] } : undefined}>
                  {FIELD_LABELS[f]}
                </button>
              );
            })}
          </div>

          <div className={`hidden sm:block w-px self-stretch ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />

          {/* Curso */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider mr-1 ${muted}`}>Curso</span>
            <button onClick={() => setSelCourses(new Set())}
              className={selCourses.size === 0 ? pillAllOn : pillOff}>
              Todos
            </button>
            {ALL_COURSES.map(c => {
              const active = selCourses.has(c);
              return (
                <button key={c}
                  onClick={() => setSelCourses(prev => toggle(prev, c))}
                  className={`${pillBase} ${active ? "text-white" : (isDark ? "text-slate-400 hover:border-slate-500" : "text-slate-500 hover:border-slate-400")}`}
                  style={active ? { backgroundColor: COURSE_COLORS[c], borderColor: COURSE_COLORS[c] } : undefined}>
                  {COURSE_LABELS[c]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Gantt chart ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className={`rounded-xl border py-16 text-center ${muted} text-sm ${card}`}>
          Carregando disciplinas de {year}…
        </div>
      ) : filteredRows.length === 0 ? (
        <div className={`rounded-xl border py-16 text-center ${muted} text-sm ${card}`}>
          Nenhuma disciplina encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className={`rounded-xl border ${card}`}>

          {/* Sticky month header */}
          <div className={`sticky top-0 z-30 border-b ${border} rounded-t-xl`} style={{ overflow: "hidden" }}>
            <div ref={headerRef} style={{ overflow: "hidden", pointerEvents: "none" }}>
              <div style={{ display: "flex" }}>
                <div className={`flex-shrink-0 border-r ${border} ${cornerBg}`}
                  style={{ width: LABEL_W, height: HEAD_H }} />
                <div className="relative flex-1" style={{ height: HEAD_H }}>
                  {monthTicks.map(t => (
                    <div key={t.m}
                      className={`absolute top-0 bottom-0 flex items-center border-r ${border}`}
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

              {/* Group separator between years */}
              {(() => {
                const elements: React.ReactNode[] = [];
                let lastYear = -1;

                filteredRows.forEach(row => {
                  // Insert group header when year changes (only when showing multiple years)
                  if (selYears.size !== 1 && row.sqYear !== lastYear) {
                    lastYear = row.sqYear;
                    const sqColor = cohortTokens[row.sqYear]?.primary ?? "#6366f1";
                    elements.push(
                      <div key={`hdr-${row.sqYear}`}
                        className={`flex items-center gap-2 border-b px-3 ${border}`}
                        style={{ height: 24, backgroundColor: sqColor + "18" }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sqColor }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: sqColor }}>
                          {row.sqYear}º Esquadrão
                        </span>
                      </div>
                    );
                  }

                  const isHov = hovered === row.key;
                  const sqColor = cohortTokens[row.sqYear]?.primary ?? "#6366f1";

                  // Bar position
                  const leftPct  = dateToPercent(row.firstDate);
                  const rightPct = ((row.lastDate.getMonth() +
                    row.lastDate.getDate() / daysInMonth(year, row.lastDate.getMonth())) / 12) * 100;
                  const widthPct = Math.max(0.3, rightPct - leftPct);
                  const spanDays = Math.round(
                    (row.lastDate.getTime() - row.firstDate.getTime()) / 86400000
                  ) + 1;

                  elements.push(
                    <div key={row.key}
                      onMouseEnter={() => setHovered(row.key)}
                      onMouseLeave={() => setHovered(null)}
                      className={`flex border-b transition-colors duration-100 ${border} ${isHov ? (isDark ? "bg-teal-900/10" : "bg-teal-50/40") : ""}`}
                      style={{ height: ROW_H }}>

                      {/* Label — sticky left */}
                      <div className={`flex-shrink-0 flex items-center gap-2 px-2 border-r ${border} ${cornerBg} z-10`}
                        style={{ width: LABEL_W, position: "sticky", left: 0 }}>

                        {/* TrainingField color stripe */}
                        <div className="w-1 self-stretch flex-shrink-0 rounded-full my-1.5"
                          style={{ backgroundColor: FIELD_COLORS[row.trainingField] ?? "#6366f1" }} />

                        <span className={`text-[10px] leading-tight truncate flex-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}
                          title={row.name}>
                          {row.name}
                        </span>

                        {/* Class badge */}
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ backgroundColor: sqColor + "22", color: sqColor }}>
                          {row.classId}
                        </span>
                      </div>

                      {/* Timeline */}
                      <div className="relative flex-1" style={{ height: ROW_H }}>

                        {/* Month bands */}
                        {monthTicks.map(t => (
                          <div key={t.m} className="absolute top-0 bottom-0"
                            style={{ left: `${t.leftPct}%`, width: `${t.widthPct}%`, background: bandBg(t.m) }} />
                        ))}

                        {/* Today line */}
                        {todayPct !== null && (
                          <div className="absolute top-0 bottom-0 w-px bg-red-500/60 z-10"
                            style={{ left: `${todayPct}%` }} />
                        )}

                        {/* Bar */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded-sm flex items-center overflow-hidden"
                          style={{
                            left: `${leftPct}%`, width: `${widthPct}%`, height: ROW_H - 12,
                            zIndex: 5,
                            backgroundColor: row.color + (isHov ? "ff" : "cc"),
                            boxShadow: isHov ? `0 0 0 2px ${row.color}55` : "none",
                          }}>
                          {widthPct > 3 && (
                            <span className="text-[8px] font-semibold text-white truncate leading-tight drop-shadow px-1">
                              {fmtShort(row.firstDate)} – {fmtShort(row.lastDate)}
                            </span>
                          )}
                        </div>

                        {/* Tooltip */}
                        {isHov && (
                          <div className={`absolute z-50 top-full mt-1 rounded-lg border shadow-xl px-3 py-2 text-[11px] pointer-events-none whitespace-nowrap ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"}`}
                            style={{ left: `min(${leftPct}%, calc(100% - 260px))` }}>
                            <p className="font-semibold">{row.name}</p>
                            <p className={muted}>
                              <span className="font-mono text-[10px]">{row.code}</span>
                              {" · "}Turma <strong>{row.classId}</strong>
                              {" · "}{row.sqYear}º Esquadrão
                            </p>
                            <p className={muted}>
                              {fmtShort(row.firstDate)} → {fmtShort(row.lastDate)}
                              {" "}({spanDays}d span · <strong>{row.classCount}</strong> aulas
                              {row.totalLoad > 0 ? ` · ${row.totalLoad}h PPC` : ""})
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
                                style={{ backgroundColor: FIELD_COLORS[row.trainingField] }}>
                                {FIELD_LABELS[row.trainingField]}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
                                style={{ backgroundColor: COURSE_COLORS[row.course] ?? "#6366f1" }}>
                                {COURSE_LABELS[row.course] ?? row.course}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });

                return elements;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Legend / stats ───────────────────────────────────────────────────── */}
      <div className={`rounded-xl border p-3 ${card}`}>
        <div className="flex flex-wrap gap-x-5 gap-y-2 items-center">
          <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>
            {filteredRows.length} disciplina{filteredRows.length !== 1 ? "s" : ""}
            {filteredRows.length !== allRows.length ? ` de ${allRows.length}` : ""}
          </p>

          {/* TrainingField legend */}
          {ALL_FIELDS.map(f => {
            const count = filteredRows.filter(r => r.trainingField === f).length;
            if (!count) return null;
            return (
              <div key={f} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: FIELD_COLORS[f] }} />
                <span className={`text-[11px] ${muted}`}>{FIELD_LABELS[f]}: {count}</span>
              </div>
            );
          })}

          {/* Today marker */}
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-0.5 h-3 bg-red-500" />
            <span className={`text-[11px] ${muted}`}>Hoje</span>
          </div>
        </div>
      </div>
    </div>
  );
};
