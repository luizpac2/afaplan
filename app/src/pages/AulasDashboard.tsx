import { useEffect, useMemo, useState } from "react";
import { BookOpen, Users, CalendarDays, GraduationCap, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { getCohortColorTokens } from "../utils/cohortColors";
import type { CourseYear, CohortColor } from "../types";

const COURSE_LABELS: Record<string, string> = {
  AVIATION: "Aviação",
  INTENDANCY: "Intendência",
  INFANTRY: "Infantaria",
};

const FIELD_LABELS: Record<string, string> = {
  GERAL: "Geral",
  MILITAR: "Militar",
  PROFISSIONAL: "Profissional",
  ATIVIDADES_COMPLEMENTARES: "Ativ. Complementares",
};

const VENTURE_LABELS: Record<string, string> = {
  EFETIVO: "Efetivo",
  PRESTADOR_TAREFA: "Prestador/Tarefa",
  CIVIL: "Civil",
  QOCON: "QOCON",
};

const YEARS: CourseYear[] = [1, 2, 3, 4];
const COURSES = ["AVIATION", "INTENDANCY", "INFANTRY"] as const;
const FIELDS = ["GERAL", "MILITAR", "PROFISSIONAL", "ATIVIDADES_COMPLEMENTARES"] as const;

// Conta dias letivos (Seg–Sáb) no ano, excluindo domingos
function countWeekdaysInYear(year: number): number {
  let count = 0;
  const d = new Date(year, 0, 1);
  while (d.getFullYear() === year) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++; // exclui domingo (0) e sábado (6)
    d.setDate(d.getDate() + 1);
  }
  return count;
}

const DAY_OFF_TYPES = new Set(["DAY_OFF", "HOLIDAY"]);
const FULL_DAY_BLOCK_KEYWORDS = ["INTERAFA", "NAVAMAER", "ESPADIM", "ASPIRANTADO"];

type SEvent = import("../types").ScheduleEvent;

// Expande evento multi-dia e adiciona seus dias úteis (Seg-Sex) ao Set
function expandWeekdays(ev: SEvent, year: number, out: Set<string>) {
  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;
  const start = ev.date >= yearStart ? ev.date : yearStart;
  const rawEnd = (ev as any).endDate ?? ev.date;
  const end   = rawEnd <= yearEnd ? rawEnd : yearEnd;
  const d = new Date(start + "T12:00:00");
  const endDate = new Date(end + "T12:00:00");
  while (d <= endDate) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) out.add(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
}

// Verifica se evento se aplica ao esquadrão (null/ALL = global)
function appliesToSquadron(ev: SEvent, squadronId: number): boolean {
  const ts = (ev as any).targetSquadron;
  return ts === null || ts === undefined || ts === "ALL" || Number(ts) === squadronId;
}

// Retorna breakdown de exclusões para um esquadrão específico
function calcExcludedDays(events: SEvent[], year: number, squadronId: number) {
  const offDates     = new Set<string>();
  const blockedDates = new Set<string>();

  for (const ev of events) {
    if (!appliesToSquadron(ev, squadronId)) continue;

    if (DAY_OFF_TYPES.has(ev.type ?? "")) {
      expandWeekdays(ev, year, offDates);
      continue;
    }
    const isBlocking = (ev as any).isBlocking !== false;
    const loc = ((ev.location ?? "") + " " + (ev.description ?? "")).toUpperCase();
    if (isBlocking && FULL_DAY_BLOCK_KEYWORDS.some((kw) => loc.includes(kw))) {
      expandWeekdays(ev, year, blockedDates);
    }
  }

  const all = new Set([...offDates, ...blockedDates]);
  return { total: all.size, dayOff: offDates.size, blocked: blockedDates.size };
}

export const AulasDashboard = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { disciplines, instructors, classes, cohorts, fetchYearlyEvents, dataReady } = useCourseStore();

  const currentYear = new Date().getFullYear();
  const [calendarYear, setCalendarYear] = useState(currentYear);
  const [yearlyEvents, setYearlyEvents] = useState<import("../types").ScheduleEvent[]>([]);

  useEffect(() => {
    if (!dataReady) return;
    fetchYearlyEvents(calendarYear).then(setYearlyEvents);
  }, [dataReady, calendarYear, fetchYearlyEvents]);

  // ── Dias letivos por esquadrão ────────────────────────────────────────────
  const totalWeekdays = useMemo(() => countWeekdaysInYear(calendarYear), [calendarYear]);

  const diasLetivosBySquadron = useMemo(() => {
    return YEARS.map((sq) => {
      const excl = calcExcludedDays(yearlyEvents, calendarYear, sq);
      return { sq, dias: totalWeekdays - excl.total, excl };
    });
  }, [yearlyEvents, calendarYear, totalWeekdays]);

  // Mínimo entre esquadrões para o card de resumo
  const diasLetivos = useMemo(
    () => Math.min(...diasLetivosBySquadron.map((d) => d.dias)),
    [diasLetivosBySquadron],
  );

  // Breakdown global (union de todos os esquadrões) para a legenda
  const excludedGlobal = useMemo(() => {
    const off = new Set<string>();
    const blocked = new Set<string>();
    for (const sq of YEARS) {
      for (const ev of yearlyEvents) {
        if (!appliesToSquadron(ev, sq)) continue;
        if (DAY_OFF_TYPES.has(ev.type ?? "")) { expandWeekdays(ev, calendarYear, off); continue; }
        const isBlocking = (ev as any).isBlocking !== false;
        const loc = ((ev.location ?? "") + " " + (ev.description ?? "")).toUpperCase();
        if (isBlocking && FULL_DAY_BLOCK_KEYWORDS.some((kw) => loc.includes(kw)))
          expandWeekdays(ev, calendarYear, blocked);
      }
    }
    const all = new Set([...off, ...blocked]);
    return { total: all.size, dayOff: off.size, blocked: blocked.size };
  }, [yearlyEvents, calendarYear]);

  // ── Disciplinas ativa = tem enabledYears ou enabledCourses preenchidos ───
  const activeDisciplines = useMemo(
    () => disciplines.filter((d) => d.enabledYears?.length > 0 || d.enabledCourses?.length > 0),
    [disciplines],
  );

  // ── Total de alunos ───────────────────────────────────────────────────────
  const totalStudents = useMemo(
    () => classes.reduce((acc, c) => acc + (c.studentCount ?? 0), 0),
    [classes],
  );

  // ── Disciplinas por esquadrão (year) × curso ──────────────────────────────
  // Para cada (year, course): quantas disciplinas têm esse year em enabledYears
  // E esse course em enabledCourses
  const discByYearCourse = useMemo(() => {
    const matrix: Record<number, Record<string, { count: number; hours: number }>> = {};
    for (const year of YEARS) {
      matrix[year] = {};
      for (const course of COURSES) {
        const discs = activeDisciplines.filter(
          (d) =>
            d.enabledYears?.includes(year as CourseYear) &&
            d.enabledCourses?.includes(course),
        );
        const hours = discs.reduce((acc, d) => {
          const key = `${course}_${year}`;
          return acc + (d.ppcLoads?.[key] ?? d.load_hours ?? 0);
        }, 0);
        matrix[year][course] = { count: discs.length, hours };
      }
    }
    return matrix;
  }, [activeDisciplines]);

  // ── Disciplinas por campo × ano letivo ───────────────────────────────────
  const discByFieldYear = useMemo(() => {
    const matrix: Record<string, Record<number, number>> = {};
    for (const field of FIELDS) {
      matrix[field] = {};
      for (const year of YEARS) {
        matrix[field][year] = activeDisciplines.filter(
          (d) =>
            d.trainingField === field &&
            d.enabledYears?.includes(year as CourseYear),
        ).length;
      }
    }
    return matrix;
  }, [activeDisciplines]);

  // ── Docentes por tipo de vínculo ──────────────────────────────────────────
  const instructorsByVenture = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inst of instructors) {
      const v = inst.venture || "EFETIVO";
      counts[v] = (counts[v] ?? 0) + 1;
    }
    return counts;
  }, [instructors]);

  // ── Carga total por esquadrão (via ppcLoads) ──────────────────────────────
  const totalHoursByYear = useMemo(() => {
    const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const d of activeDisciplines) {
      for (const year of d.enabledYears ?? []) {
        for (const course of d.enabledCourses ?? []) {
          const key = `${course}_${year}`;
          totals[year] = (totals[year] ?? 0) + (d.ppcLoads?.[key] ?? 0);
        }
      }
    }
    return totals;
  }, [activeDisciplines]);

  // ── Cohort name por esquadrão ────────────────────────────────────────────
  const cohortBySquadron = useMemo(() => {
    const map: Record<number, string> = {};
    for (const year of YEARS) {
      const entryYear = calendarYear - year + 1;
      const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);
      map[year] = cohort?.name ?? `${year}º Esq`;
    }
    return map;
  }, [cohorts, calendarYear]);

  const squadronColor = (year: number) => {
    const entryYear = calendarYear - year + 1;
    const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);
    return getCohortColorTokens((cohort?.color ?? "blue") as CohortColor);
  };

  // ── Estilos base ─────────────────────────────────────────────────────────
  const card = isDark
    ? "bg-slate-800 border-slate-700"
    : "bg-white border-slate-200 shadow-sm";
  const cardHeader = isDark ? "bg-slate-700/50 border-slate-600" : "bg-slate-50 border-slate-200";
  const text = isDark ? "text-slate-100" : "text-slate-800";
  const muted = isDark ? "text-slate-400" : "text-slate-500";
  const divider = isDark ? "divide-slate-700" : "divide-slate-100";
  const tableBorder = isDark ? "border-slate-700" : "border-slate-200";
  const rowHover = isDark ? "hover:bg-slate-700/30" : "hover:bg-slate-50";

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-6">

      {/* ── Título + navegação de ano ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={`text-2xl font-bold ${text}`}>Painel Acadêmico</h1>
          <p className={`text-sm mt-0.5 ${muted}`}>
            Visão consolidada de disciplinas, docentes e carga horária
          </p>
        </div>
        <div className={`flex items-center gap-1 rounded-xl border p-1 ${isDark ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
          <button
            onClick={() => setCalendarYear((y) => y - 1)}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
          >
            <ChevronLeft size={16} />
          </button>
          <span className={`px-3 text-sm font-bold min-w-[60px] text-center ${text}`}>
            {calendarYear}
          </span>
          <button
            onClick={() => setCalendarYear((y) => y + 1)}
            disabled={calendarYear >= currentYear}
            className={`p-1.5 rounded-lg transition-colors ${
              calendarYear >= currentYear
                ? "opacity-30 cursor-not-allowed"
                : isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"
            }`}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Cards de resumo ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: <CalendarDays size={20} className="text-blue-400" />,
            label: "Dias Letivos",
            value: diasLetivos,
            sub: diasLetivosBySquadron.every((d) => d.dias === diasLetivos)
              ? `igual para todos os esquadrões`
              : `mín. entre esquadrões`,
          },
          {
            icon: <BookOpen size={20} className="text-purple-400" />,
            label: "Disciplinas Ativas",
            value: activeDisciplines.length,
            sub: `de ${disciplines.length} cadastradas`,
          },
          {
            icon: <Users size={20} className="text-emerald-400" />,
            label: "Docentes",
            value: instructors.length,
            sub: Object.entries(instructorsByVenture)
              .map(([v, c]) => `${c} ${VENTURE_LABELS[v] ?? v}`)
              .join(" · "),
          },
          {
            icon: <GraduationCap size={20} className="text-amber-400" />,
            label: "Cadetes",
            value: totalStudents || "—",
            sub: `${classes.length} turmas`,
          },
        ].map(({ icon, label, value, sub }) => (
          <div key={label} className={`rounded-xl border p-4 flex flex-col gap-1 ${card}`}>
            <div className="flex items-center gap-2">
              {icon}
              <span className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{label}</span>
            </div>
            <span className={`text-3xl font-bold ${text}`}>{value}</span>
            <span className={`text-[11px] leading-tight ${muted}`}>{sub}</span>
          </div>
        ))}
      </div>

      {/* ── Dias letivos por esquadrão ───────────────────────────────────── */}
      <div className={`rounded-xl border overflow-hidden ${card}`}>
        <div className={`px-4 py-3 border-b flex items-center gap-2 ${cardHeader}`}>
          <CalendarDays size={15} className="text-blue-400" />
          <span className={`text-sm font-semibold ${text}`}>Dias Letivos por Esquadrão</span>
          <span className={`ml-auto text-[11px] ${muted}`}>{calendarYear}</span>
        </div>
        <div className={`divide-y ${divider}`}>
          {diasLetivosBySquadron.map(({ sq, dias, excl }) => {
            const tokens = squadronColor(sq);
            const pct = totalWeekdays > 0 ? Math.round((dias / totalWeekdays) * 100) : 0;
            return (
              <div key={sq} className={`px-4 py-3 flex items-center gap-3 ${rowHover}`}>
                <div className="flex items-center gap-2 w-40 shrink-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tokens.primary }}
                  />
                  <span className={`text-sm font-medium ${text}`}>{sq}º Esquadrão</span>
                </div>
                <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-sm font-bold w-10 text-right ${text}`}>{dias}</span>
                <span className={`text-[11px] w-28 text-right ${muted}`}>
                  {excl.total > 0
                    ? `−${excl.total} excluído${excl.total !== 1 ? "s" : ""}`
                    : "sem exclusões"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Disciplinas por Esquadrão × Curso ────────────────────────────── */}
      <div className={`rounded-xl border overflow-hidden ${card}`}>
        <div className={`px-4 py-3 border-b flex items-center gap-2 ${cardHeader}`}>
          <Layers size={15} className="text-purple-400" />
          <span className={`text-sm font-semibold ${text}`}>Disciplinas por Esquadrão / Curso</span>
          <span className={`ml-auto text-[11px] ${muted}`}>quantidade · carga horária (h)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${tableBorder}`}>
                <th className={`text-left px-4 py-2.5 text-xs font-semibold ${muted} w-36`}>Esquadrão</th>
                {COURSES.map((c) => (
                  <th key={c} className={`text-center px-3 py-2.5 text-xs font-semibold ${muted}`}>
                    {COURSE_LABELS[c]}
                  </th>
                ))}
                <th className={`text-center px-3 py-2.5 text-xs font-semibold ${muted}`}>Carga Total (h)</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${divider}`}>
              {YEARS.map((year) => {
                const tokens = squadronColor(year);
                return (
                  <tr key={year} className={rowHover}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tokens.primary }}
                        />
                        <span className={`font-medium ${text}`}>{year}º Esquadrão</span>
                      </div>
                      <span className={`text-[11px] ${muted} pl-[18px]`}>{cohortBySquadron[year]}</span>
                    </td>
                    {COURSES.map((c) => {
                      const { count, hours } = discByYearCourse[year][c];
                      return (
                        <td key={c} className="px-3 py-3 text-center">
                          {count > 0 ? (
                            <>
                              <span className={`font-semibold ${text}`}>{count}</span>
                              {hours > 0 && (
                                <span className={`ml-1 text-[11px] ${muted}`}>({hours}h)</span>
                              )}
                            </>
                          ) : (
                            <span className={`${muted} text-xs`}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center">
                      <span className={`font-semibold ${text}`}>{totalHoursByYear[year] || "—"}</span>
                      {totalHoursByYear[year] > 0 && (
                        <span className={`ml-0.5 text-[11px] ${muted}`}>h</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Disciplinas por Campo × Ano Letivo ────────────────────────────── */}
      <div className={`rounded-xl border overflow-hidden ${card}`}>
        <div className={`px-4 py-3 border-b flex items-center gap-2 ${cardHeader}`}>
          <BookOpen size={15} className="text-blue-400" />
          <span className={`text-sm font-semibold ${text}`}>Disciplinas por Campo / Ano Letivo</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${tableBorder}`}>
                <th className={`text-left px-4 py-2.5 text-xs font-semibold ${muted}`}>Campo de Formação</th>
                {YEARS.map((y) => (
                  <th key={y} className={`text-center px-4 py-2.5 text-xs font-semibold ${muted}`}>
                    {y}º Ano
                  </th>
                ))}
                <th className={`text-center px-4 py-2.5 text-xs font-semibold ${muted}`}>Total</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${divider}`}>
              {FIELDS.map((field) => {
                const rowTotal = YEARS.reduce((acc, y) => acc + (discByFieldYear[field][y] ?? 0), 0);
                return (
                  <tr key={field} className={rowHover}>
                    <td className={`px-4 py-3 font-medium ${text}`}>{FIELD_LABELS[field]}</td>
                    {YEARS.map((y) => {
                      const count = discByFieldYear[field][y] ?? 0;
                      return (
                        <td key={y} className="px-4 py-3 text-center">
                          {count > 0 ? (
                            <span className={`font-semibold ${text}`}>{count}</span>
                          ) : (
                            <span className={`${muted} text-xs`}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`font-bold ${rowTotal > 0 ? text : muted}`}
                      >
                        {rowTotal || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* Linha de totais por ano */}
              <tr className={`border-t-2 ${tableBorder} font-bold`}>
                <td className={`px-4 py-3 text-xs uppercase tracking-wide ${muted}`}>Total por Ano</td>
                {YEARS.map((y) => {
                  const colTotal = FIELDS.reduce((acc, f) => acc + (discByFieldYear[f][y] ?? 0), 0);
                  return (
                    <td key={y} className={`px-4 py-3 text-center ${text}`}>
                      {colTotal || "—"}
                    </td>
                  );
                })}
                <td className={`px-4 py-3 text-center ${text}`}>
                  {FIELDS.reduce(
                    (acc, f) => acc + YEARS.reduce((a, y) => a + (discByFieldYear[f][y] ?? 0), 0),
                    0,
                  ) || "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Docentes por vínculo ──────────────────────────────────────────── */}
      <div className={`rounded-xl border overflow-hidden ${card}`}>
        <div className={`px-4 py-3 border-b flex items-center gap-2 ${cardHeader}`}>
          <Users size={15} className="text-emerald-400" />
          <span className={`text-sm font-semibold ${text}`}>Corpo Docente</span>
          <span className={`ml-auto text-[11px] ${muted}`}>{instructors.length} docentes cadastrados</span>
        </div>
        <div className={`divide-y ${divider}`}>
          {Object.entries(VENTURE_LABELS).map(([key, label]) => {
            const count = instructorsByVenture[key] ?? 0;
            const pct = instructors.length > 0 ? Math.round((count / instructors.length) * 100) : 0;
            return (
              <div key={key} className={`px-4 py-3 flex items-center gap-3 ${rowHover}`}>
                <span className={`w-40 text-sm font-medium ${text}`}>{label}</span>
                <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-sm font-semibold w-8 text-right ${text}`}>{count}</span>
                <span className={`text-xs w-10 text-right ${muted}`}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legenda: critérios para dia letivo ────────────────────────────── */}
      <div className={`rounded-xl border p-4 ${card}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${muted}`}>
          Como é calculado o total de dias letivos
        </p>
        <ol className={`flex flex-col gap-2 text-sm ${muted}`}>
          <li className="flex gap-2">
            <span className={`font-bold shrink-0 ${text}`}>1.</span>
            <span>
              Conta-se todos os dias <strong className={text}>segunda a sexta-feira</strong> do
              ano letivo selecionado ({totalWeekdays} dias em {calendarYear}).
            </span>
          </li>
          <li className="flex gap-2">
            <span className={`font-bold shrink-0 ${text}`}>2.</span>
            <span>
              São subtraídos os dias classificados como{" "}
              <strong className={text}>Day-off</strong> ou{" "}
              <strong className={text}>Feriado</strong> (tipo{" "}
              <code className="text-[11px] bg-slate-200 dark:bg-slate-700 px-1 rounded">DAY_OFF</code> ou{" "}
              <code className="text-[11px] bg-slate-200 dark:bg-slate-700 px-1 rounded">HOLIDAY</code>)
              cadastrados no calendário acadêmico
              {excludedGlobal.dayOff > 0 && (
                <span className="ml-1 text-amber-500 font-semibold">
                  (−{excludedGlobal.dayOff} dia{excludedGlobal.dayOff !== 1 ? "s" : ""} em {calendarYear})
                </span>
              )}.
            </span>
          </li>
          <li className="flex gap-2">
            <span className={`font-bold shrink-0 ${text}`}>3.</span>
            <span>
              São subtraídos dias cujo evento acadêmico bloqueante é{" "}
              <strong className={text}>INTERAFA</strong>,{" "}
              <strong className={text}>NAVAMAER</strong>,{" "}
              <strong className={text}>ESPADIM</strong> ou{" "}
              <strong className={text}>ASPIRANTADO</strong> — eventos que ocupam
              integralmente o dia, impedindo a alocação de aulas regulares
              {excludedGlobal.blocked > 0 && (
                <span className="ml-1 text-amber-500 font-semibold">
                  (−{excludedGlobal.blocked} dia{excludedGlobal.blocked !== 1 ? "s" : ""} em {calendarYear})
                </span>
              )}.
            </span>
          </li>
          <li className="flex gap-2">
            <span className={`font-bold shrink-0 ${text}`}>4.</span>
            <span>
              Sábados e domingos são sempre excluídos, independentemente de qualquer alocação.
            </span>
          </li>
        </ol>
        <p className={`mt-3 text-xs font-semibold ${text}`}>
          Base: {totalWeekdays} dias úteis (Seg–Sex) em {calendarYear}. O total por esquadrão
          varia conforme os eventos acima se apliquem a cada um individualmente.
        </p>
      </div>
    </div>
  );
};
