import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, CalendarDays, BookOpen,
  Info, Zap, ClipboardList, GraduationCap, Clock, MapPin, User, Star,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToEventsByDateRange } from "../services/supabaseService";
import { GanttView } from "../components/GanttView";
import {
  getStartOfWeek, addDays, formatDate, getWeekDays, formatDateForDisplay,
} from "../utils/dateUtils";
import type { ScheduleEvent, Discipline } from "../types";

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const EVAL_LABELS: Record<string, string> = {
  PARTIAL: "Av. Parcial", EXAM: "Exame", FINAL: "Av. Final",
  SECOND_CHANCE: "2ª Chamada", REVIEW: "Vista",
};

const EVAL_TYPES = ["PARTIAL", "EXAM", "FINAL", "SECOND_CHANCE", "REVIEW"] as const;

const SESSION_KEY_CADET   = "minhas_aulas_date";
const SESSION_KEY_DOCENTE = "minhas_aulas_docente_date";
const LS_KEY_CADET_CLASS  = "minhas_aulas_turma";
const LS_KEY_DOCENTE      = "minhas_aulas_docente_filter";

function isoToday(): string {
  const d = new Date();
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return formatDate(d);
}

// ── Main component ────────────────────────────────────────────────────────────

export const MinhasAulas = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { userProfile } = useAuth();

  const { disciplines, classes, instructors, notices, dataReady, fetchYearlyEvents } =
    useCourseStore();

  const role      = userProfile?.role ?? "";
  const isDocente = ["DOCENTE", "SUPER_ADMIN", "ADMIN"].includes(role);
  const isCadet   = ["CADETE", "CHEFE_TURMA"].includes(role);

  // ── Date navigation ─────────────────────────────────────────────────────────
  const sessionKey = isDocente ? SESSION_KEY_DOCENTE : SESSION_KEY_CADET;

  const [currentDateStr, setCurrentDateStr] = useState<string>(
    () => sessionStorage.getItem(sessionKey) ?? isoToday()
  );

  useEffect(() => { sessionStorage.setItem(sessionKey, currentDateStr); }, [currentDateStr, sessionKey]);

  const weekStartDate = useMemo(() => getStartOfWeek(new Date(currentDateStr + "T12:00:00")), [currentDateStr]);
  const weekDayStrs   = useMemo(() => getWeekDays(weekStartDate).map(formatDate), [weekStartDate]);
  const calendarYear  = useMemo(() => new Date(currentDateStr).getFullYear(), [currentDateStr]);
  const weekEndDate   = addDays(weekStartDate, 5);

  // Calendar picker state
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDatePickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node))
        setIsDatePickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isDatePickerOpen]);

  const goToPrevWeek = () => setCurrentDateStr(formatDate(addDays(weekStartDate, -7)));
  const goToNextWeek = () => setCurrentDateStr(formatDate(addDays(weekStartDate,  7)));

  // ── Events ──────────────────────────────────────────────────────────────────
  const [weekEvents,   setWeekEvents]   = useState<ScheduleEvent[]>([]);
  const [yearlyEvents, setYearlyEvents] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    if (!dataReady) return;
    const unsub = subscribeToEventsByDateRange(
      formatDate(weekStartDate), formatDate(weekEndDate),
      (evs) => setWeekEvents(evs)
    );
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatDate(weekStartDate), dataReady]);

  useEffect(() => {
    if (!dataReady) return;
    fetchYearlyEvents(calendarYear).then((evs) => setYearlyEvents(evs ?? []));
  }, [calendarYear, dataReady, fetchYearlyEvents]);

  // ── Theme tokens ─────────────────────────────────────────────────────────────
  const card    = isDark ? "bg-slate-800/60 border-slate-700/50" : "bg-white border-slate-200";
  const border  = isDark ? "border-slate-700/50" : "border-slate-200";
  const muted   = isDark ? "text-slate-400" : "text-slate-500";
  const text    = isDark ? "text-slate-100" : "text-slate-800";
  const todayBg = isDark ? "bg-blue-600/10 border-blue-500/40" : "bg-blue-50 border-blue-300";

  const todayStr = formatDate(new Date());

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getDisciplineColor = useCallback(
    (id: string) => disciplines.find((d) => d.id === id)?.color ?? "#3b82f6",
    [disciplines]
  );
  const getDisciplineLabel = useCallback(
    (id: string) => { const d = disciplines.find((d) => d.id === id); return d ? `${d.code} — ${d.name}` : id; },
    [disciplines]
  );

  // ── Event counts ─────────────────────────────────────────────────────────────
  const eventCounts = useMemo(() => {
    const counts: Record<string, { current: number; total: number }> = {};
    if (!yearlyEvents.length) return counts;
    const groupings: Record<string, ScheduleEvent[]> = {};
    yearlyEvents.forEach((ev) => {
      if (ev.type === "ACADEMIC" || ev.disciplineId === "ACADEMIC") return;
      if (new Date(ev.date).getFullYear() !== calendarYear) return;
      const key = `${ev.disciplineId}|${ev.classId}`;
      if (!groupings[key]) groupings[key] = [];
      groupings[key].push(ev);
    });
    Object.values(groupings).forEach((group) => {
      const disc  = disciplines.find((d) => d.id === group[0].disciplineId);
      const cls   = classes.find((c) => c.id === group[0].classId);
      const pkKey = cls ? `${cls.type}_${cls.year}` : "";
      const total = (disc?.ppcLoads && pkKey && disc.ppcLoads[pkKey]) || (disc as any)?.load_hours || group.length;
      group
        .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
        .forEach((ev, i) => { counts[`${ev.classId}|${ev.date}|${ev.startTime}`] = { current: i + 1, total }; });
    });
    return counts;
  }, [yearlyEvents, calendarYear, disciplines, classes]);

  // ── Notices ──────────────────────────────────────────────────────────────────
  const todayNotices = useMemo(
    () => notices.filter((n) => currentDateStr >= n.startDate && currentDateStr <= n.endDate),
    [notices, currentDateStr]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // CADET STATE
  // ═══════════════════════════════════════════════════════════════════════════

  const [activeTab, setActiveTab] = useState<"aulas" | "avaliacoes">("aulas");
  const [evalTypeFilter, setEvalTypeFilter] = useState<string>("ALL");

  const defaultCadetClass = useMemo(() => {
    const cadetId = userProfile?.cadetId ?? "";
    const turma   = userProfile?.turmaAula?.replace("TURMA_", "") ?? "";
    const sqDigit = cadetId.charAt(0);
    if (sqDigit && turma) return `${sqDigit}${turma}`;
    return "";
  }, [userProfile]);

  const [selectedClass, setSelectedClass] = useState<string>(
    () => localStorage.getItem(LS_KEY_CADET_CLASS) ?? ""
  );

  useEffect(() => { if (!selectedClass && defaultCadetClass) setSelectedClass(defaultCadetClass); }, [defaultCadetClass, selectedClass]);
  useEffect(() => { if (selectedClass) localStorage.setItem(LS_KEY_CADET_CLASS, selectedClass); }, [selectedClass]);

  const allClassIds = useMemo(
    () => [...new Set(yearlyEvents.filter((e) => e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC" && e.classId).map((e) => e.classId as string))].sort(),
    [yearlyEvents]
  );

  const classWeekEvents = useMemo(
    () => weekEvents.filter((e) => e.classId === selectedClass && e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC"),
    [weekEvents, selectedClass]
  );

  const myEvaluations = useMemo(
    () => yearlyEvents
      .filter((e) => e.type === "EVALUATION" && e.classId === selectedClass)
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`)),
    [yearlyEvents, selectedClass]
  );

  // Deduplicação: avaliação com vários tempos no mesmo dia → só o mais cedo
  const dedupedEvals = useMemo(() => {
    const seen = new Map<string, ScheduleEvent>();
    for (const ev of myEvaluations) {
      const key = `${ev.date}|${ev.disciplineId}|${ev.evaluationType}`;
      if (!seen.has(key) || ev.startTime < seen.get(key)!.startTime) seen.set(key, ev);
    }
    return [...seen.values()].sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
  }, [myEvaluations]);

  const filteredEvals = useMemo(
    () => evalTypeFilter === "ALL" ? dedupedEvals : dedupedEvals.filter((e) => e.evaluationType === evalTypeFilter),
    [dedupedEvals, evalTypeFilter]
  );

  const upcomingEvals = filteredEvals.filter((e) => e.date >= todayStr);
  const pastEvals     = filteredEvals.filter((e) => e.date <  todayStr);

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCENTE STATE
  // ═══════════════════════════════════════════════════════════════════════════

  const [docenteFilter, setDocenteFilter] = useState<string>(
    () => localStorage.getItem(LS_KEY_DOCENTE) ?? (userProfile?.instructorTrigram ?? "")
  );

  useEffect(() => { if (!docenteFilter && userProfile?.instructorTrigram) setDocenteFilter(userProfile.instructorTrigram); }, [userProfile, docenteFilter]);
  useEffect(() => { if (docenteFilter) localStorage.setItem(LS_KEY_DOCENTE, docenteFilter); }, [docenteFilter]);

  const myInstructor = useMemo(() => instructors.find((i) => i.trigram === docenteFilter), [instructors, docenteFilter]);

  const docenteWeekEvents = useMemo(
    () => weekEvents.filter((e) =>
      (e.instructorTrigram === docenteFilter || disciplines.find((d) => d.id === e.disciplineId)?.instructorTrigram === docenteFilter) &&
      e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC"
    ),
    [weekEvents, docenteFilter, disciplines]
  );

  const docenteYearly = useMemo(
    () => yearlyEvents
      .filter((e) =>
        (e.instructorTrigram === docenteFilter || disciplines.find((d) => d.id === e.disciplineId)?.instructorTrigram === docenteFilter) &&
        e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC"
      )
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`)),
    [yearlyEvents, docenteFilter, disciplines]
  );

  const docenteUpcoming = docenteYearly.filter((e) => e.date >= todayStr);
  const docentePast     = [...docenteYearly].filter((e) => e.date < todayStr).reverse();
  const docenteClassIds = useMemo(() => [...new Set(docenteWeekEvents.map((e) => e.classId))].sort(), [docenteWeekEvents]);
  const myDisciplines   = useMemo(() => disciplines.filter((d) => d.instructorTrigram === docenteFilter), [disciplines, docenteFilter]);

  const currentMonth        = todayStr.slice(0, 7);
  const monthEvents         = docenteYearly.filter((e) => e.date.startsWith(currentMonth));
  const upcomingEvalDocente = docenteYearly.filter((e) => e.type === "EVALUATION" && e.date >= todayStr);

  // ── Calendar picker render ────────────────────────────────────────────────
  const renderCalendarPicker = (alignRight = true) => (
    <div className="relative">
      <button
        onClick={() => { setPickerMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setIsDatePickerOpen((v) => !v); }}
        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-blue-400 ${text}`}
      >
        Calendário
      </button>
      {isDatePickerOpen && (
        <div
          ref={datePickerRef}
          className={`absolute ${alignRight ? "right-0" : "left-0"} mt-1 z-50 rounded-xl border shadow-xl p-3 w-64 ${isDark ? "bg-slate-800 border-slate-600" : "bg-white border-slate-200"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1))} className={`p-1 rounded hover:bg-slate-500/20 ${muted}`}><ChevronLeft size={14} /></button>
            <span className={`text-xs font-semibold ${text}`}>{pickerMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
            <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1))} className={`p-1 rounded hover:bg-slate-500/20 ${muted}`}><ChevronRight size={14} /></button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {["D","S","T","Q","Q","S","S"].map((d, i) => <div key={i} className={`text-center text-[10px] font-bold ${muted}`}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {(() => {
              const year = pickerMonth.getFullYear(), month = pickerMonth.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const cells: React.ReactNode[] = [];
              for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
              for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month, d);
                const ds = formatDate(date);
                const isT   = ds === todayStr;
                const isSel = formatDate(getStartOfWeek(new Date(currentDateStr + "T12:00:00"))) === formatDate(getStartOfWeek(date));
                cells.push(
                  <button key={d}
                    onClick={() => { setCurrentDateStr(ds); setIsDatePickerOpen(false); }}
                    className={`text-[11px] h-7 w-full rounded transition-colors font-medium ${isT ? "bg-blue-500 text-white" : isSel ? (isDark ? "bg-slate-600 text-slate-100" : "bg-slate-200 text-slate-800") : `hover:bg-blue-500/15 ${text}`}`}
                  >{d}</button>
                );
              }
              return cells;
            })()}
          </div>
          <button
            onClick={() => { setCurrentDateStr(isoToday()); setIsDatePickerOpen(false); }}
            className="mt-2 w-full text-[11px] py-1 rounded-lg border border-blue-400/50 text-blue-500 hover:bg-blue-500/10 transition-colors font-medium"
          >Ir para hoje</button>
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 p-3">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between rounded-xl border px-3 py-2 ${card}`}>
        <div className="flex items-center gap-2 min-w-0">
          {isDocente ? <GraduationCap size={16} className="text-blue-500 shrink-0" /> : <Star size={16} className="text-blue-500 shrink-0" />}
          <span className={`font-bold text-sm truncate ${text}`}>
            {isDocente
              ? myInstructor ? `${myInstructor.rank ? myInstructor.rank + " " : ""}${myInstructor.warName}` : "Minhas Aulas"
              : `Minhas Aulas${selectedClass ? ` — Turma ${selectedClass}` : ""}`}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={goToPrevWeek} className={`p-1.5 rounded-lg hover:bg-slate-700/30 transition-colors ${muted}`}><ChevronLeft size={15} /></button>
          {renderCalendarPicker(true)}
          <button onClick={goToNextWeek} className={`p-1.5 rounded-lg hover:bg-slate-700/30 transition-colors ${muted}`}><ChevronRight size={15} /></button>
          <span className={`text-[11px] ml-1 hidden sm:block ${muted}`}>
            {formatDateForDisplay(formatDate(weekStartDate))} – {formatDateForDisplay(formatDate(weekEndDate))}
          </span>
        </div>
      </div>

      {/* ══════════════════ CADET VIEW ═══════════════════════════════════════ */}
      {isCadet && (
        <>
          {/* Controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${muted}`}>Turma de Aula</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className={`text-[12px] font-mono rounded-lg border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${isDark ? "bg-slate-800 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-800"}`}
            >
              <option value="">Selecionar…</option>
              {allClassIds.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>

            {/* Tabs */}
            <div className={`flex rounded-lg border p-0.5 ${isDark ? "bg-slate-800/60 border-slate-700/50" : "bg-slate-100 border-slate-200"}`}>
              {(["aulas", "avaliacoes"] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    activeTab === tab
                      ? isDark ? "bg-blue-600 text-white" : "bg-white text-blue-600 shadow-sm"
                      : `${muted} hover:text-blue-500`
                  }`}>
                  {tab === "aulas" ? "Minhas Aulas" : "Minhas Avaliações"}
                </button>
              ))}
            </div>

            {/* Eval type filter (shown only on avaliações tab) */}
            {activeTab === "avaliacoes" && (
              <div className="flex items-center gap-1 flex-wrap">
                {(["ALL", ...EVAL_TYPES] as const).map((t) => (
                  <button key={t}
                    onClick={() => setEvalTypeFilter(t)}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-colors ${
                      evalTypeFilter === t
                        ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                        : `${isDark ? "border-slate-600 text-slate-400 hover:border-orange-500/40" : "border-slate-300 text-slate-500 hover:border-orange-400"}`
                    }`}>
                    {t === "ALL" ? "Todas" : EVAL_LABELS[t]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Minhas Aulas tab ─────────────────────────────────────────── */}
          {activeTab === "aulas" && (
            <div className={`rounded-xl border overflow-hidden ${card}`}>
              {weekDayStrs.map((dateStr, idx) => {
                const dayEvents = classWeekEvents
                  .filter((e) => e.date === dateStr)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                const isToday = dateStr === todayStr;
                const dow     = new Date(dateStr + "T12:00:00").getDay();
                return (
                  <div key={dateStr} className={`flex items-center gap-2 px-3 py-1.5 ${idx < 5 ? `border-b ${border}` : ""} ${isToday ? (isDark ? "bg-blue-600/10" : "bg-blue-50") : ""}`}>
                    {/* Date label */}
                    <div className="shrink-0 flex items-center gap-1.5 w-28">
                      <span className={`text-[10px] font-bold uppercase w-7 ${isToday ? "text-blue-500" : muted}`}>{DAYS_SHORT[dow]}</span>
                      <span className={`text-[11px] font-semibold ${isToday ? "text-blue-500" : text}`}>{dateStr.slice(8)}/{dateStr.slice(5,7)}</span>
                      {isToday && <span className="text-[9px] font-bold bg-blue-500 text-white px-1 rounded">HOJE</span>}
                    </div>
                    {/* Event chips */}
                    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                      {dayEvents.length === 0 ? (
                        <span className={`text-[10px] italic ${muted} opacity-50`}>Sem aulas</span>
                      ) : dayEvents.map((ev) => {
                        const disc  = disciplines.find((d) => d.id === ev.disciplineId);
                        const color = getDisciplineColor(ev.disciplineId);
                        const isEval = ev.type === "EVALUATION";
                        const cnt   = eventCounts[`${ev.classId}|${ev.date}|${ev.startTime}`];
                        return (
                          <span
                            key={ev.id}
                            title={disc?.name ?? ev.disciplineId}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border"
                            style={{ borderColor: color + "60", backgroundColor: isEval ? "#f97316" + "25" : color + "20", color: isEval ? "#f97316" : color }}
                          >
                            {disc?.code ?? ev.disciplineId}
                            {isEval && <span className="opacity-70 text-[9px]">{EVAL_LABELS[ev.evaluationType ?? ""] ?? "Av."}</span>}
                            {cnt && !isEval && <span className="opacity-60 text-[9px]">{cnt.current}/{cnt.total}</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Minhas Avaliações tab ────────────────────────────────────── */}
          {activeTab === "avaliacoes" && (
            <div className={`rounded-xl border overflow-hidden ${card}`}>
              {/* Upcoming */}
              {upcomingEvals.length > 0 && (
                <>
                  <div className={`px-3 py-2 border-b ${border} flex items-center gap-2`}>
                    <Zap size={12} className="text-orange-400" />
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${text}`}>Próximas</span>
                    <span className={`text-[10px] ${muted}`}>({upcomingEvals.length})</span>
                  </div>
                  <div className="divide-y divide-slate-700/20">
                    {upcomingEvals.map((ev) => (
                      <EvalRow key={ev.id} ev={ev} disciplines={disciplines} isDark={isDark} muted={muted} text={text} getDisciplineColor={getDisciplineColor} />
                    ))}
                  </div>
                </>
              )}
              {/* Past */}
              {pastEvals.length > 0 && (
                <>
                  <div className={`px-3 py-2 border-t ${border} flex items-center gap-2 ${upcomingEvals.length > 0 ? "mt-0" : ""}`}>
                    <ClipboardList size={12} className={muted} />
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}>Anteriores</span>
                    <span className={`text-[10px] ${muted}`}>({pastEvals.length})</span>
                  </div>
                  <div className="divide-y divide-slate-700/20 opacity-65">
                    {pastEvals.map((ev) => (
                      <EvalRow key={ev.id} ev={ev} disciplines={disciplines} isDark={isDark} muted={muted} text={text} getDisciplineColor={getDisciplineColor} />
                    ))}
                  </div>
                </>
              )}
              {upcomingEvals.length === 0 && pastEvals.length === 0 && (
                <p className={`px-3 py-4 text-[11px] italic ${muted} opacity-60`}>Nenhuma avaliação</p>
              )}
            </div>
          )}
        </>
      )}

      {/* ══════════════════ DOCENTE VIEW ═════════════════════════════════════ */}
      {isDocente && (
        <>
          {/* Instructor selector + chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${muted}`}>Docente</span>
            <select
              value={docenteFilter}
              onChange={(e) => setDocenteFilter(e.target.value)}
              className={`text-[12px] rounded-lg border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${isDark ? "bg-slate-800 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-800"}`}
            >
              <option value="">Todos os docentes</option>
              {instructors.slice().sort((a, b) => a.warName.localeCompare(b.warName)).map((i) => (
                <option key={i.trigram} value={i.trigram}>{i.rank ? `${i.rank} ` : ""}{i.warName} ({i.trigram})</option>
              ))}
            </select>
            {myDisciplines.map((d) => (
              <span key={d.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                style={{ borderColor: d.color + "60", backgroundColor: d.color + "18", color: d.color }}>
                {d.code}
              </span>
            ))}
          </div>

          {/* Dashboard cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="Aulas este mês"   value={monthEvents.length}                                          icon={<BookOpen size={14} className="text-blue-400" />}    isDark={isDark} card={card} text={text} muted={muted} />
            <StatCard label="Próximas aulas"   value={docenteUpcoming.filter((e) => e.type !== "EVALUATION").length} icon={<CalendarDays size={14} className="text-green-400" />}  isDark={isDark} card={card} text={text} muted={muted} />
            <StatCard label="Aval. a corrigir" value={upcomingEvalDocente.filter((e) => e.date <= todayStr).length}  icon={<Zap size={14} className="text-orange-400" />}          isDark={isDark} card={card} text={text} muted={muted} />
            <StatCard label="Disciplinas"      value={myDisciplines.length}                                         icon={<ClipboardList size={14} className="text-purple-400" />} isDark={isDark} card={card} text={text} muted={muted} />
          </div>

          {/* Week gantt */}
          {docenteFilter && (
            <div className="flex flex-col gap-2">
              {weekDayStrs.map((dateStr) => {
                const dayEvents = docenteWeekEvents.filter((e) => e.date === dateStr);
                const isToday   = dateStr === todayStr;
                const dow       = new Date(dateStr + "T12:00:00").getDay();
                return (
                  <div key={dateStr} className={`rounded-xl border overflow-hidden ${isToday ? todayBg : card}`}>
                    <div className={`flex items-center gap-2 px-3 py-1.5 border-b ${border}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wide w-7 ${isToday ? "text-blue-500" : muted}`}>{DAYS_SHORT[dow]}</span>
                      <span className={`text-[12px] font-bold ${isToday ? "text-blue-500" : text}`}>{dateStr.slice(8)}/{dateStr.slice(5,7)}</span>
                      {isToday && <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded">HOJE</span>}
                      <span className={`text-[10px] ${muted} ml-auto`}>{dayEvents.length} aula(s)</span>
                    </div>
                    {dayEvents.length === 0 ? (
                      <p className={`px-3 py-2 text-[10px] italic ${muted} opacity-50`}>Sem aulas</p>
                    ) : (
                      <div className="px-1.5 py-1.5">
                        <GanttView date={dateStr} events={dayEvents} disciplines={disciplines}
                          classes={docenteClassIds.length > 0 ? docenteClassIds : ["1A"]} canEdit={false} eventCounts={eventCounts} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Upcoming / Past two-column list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`rounded-xl border overflow-hidden ${card}`}>
              <div className={`px-3 py-2 border-b ${border} flex items-center gap-2`}>
                <CalendarDays size={12} className="text-green-400" />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${text}`}>Próximas Aulas</span>
                <span className={`text-[10px] ${muted}`}>({docenteUpcoming.filter((e) => e.type !== "EVALUATION").length})</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {docenteUpcoming.filter((e) => e.type !== "EVALUATION").slice(0, 30).map((ev) => (
                  <DocenteEventRow key={ev.id} ev={ev} isDark={isDark} muted={muted} text={text} getDisciplineLabel={getDisciplineLabel} getDisciplineColor={getDisciplineColor} />
                ))}
                {docenteUpcoming.filter((e) => e.type !== "EVALUATION").length === 0 && (
                  <p className={`px-3 py-3 text-[10px] italic ${muted} opacity-60`}>Nenhuma aula futura</p>
                )}
              </div>
            </div>
            <div className={`rounded-xl border overflow-hidden ${card}`}>
              <div className={`px-3 py-2 border-b ${border} flex items-center gap-2`}>
                <ClipboardList size={12} className={muted} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}>Aulas Anteriores</span>
                <span className={`text-[10px] ${muted}`}>({docentePast.filter((e) => e.type !== "EVALUATION").length})</span>
              </div>
              <div className="max-h-64 overflow-y-auto opacity-75">
                {docentePast.filter((e) => e.type !== "EVALUATION").slice(0, 30).map((ev) => (
                  <DocenteEventRow key={ev.id} ev={ev} isDark={isDark} muted={muted} text={text} getDisciplineLabel={getDisciplineLabel} getDisciplineColor={getDisciplineColor} />
                ))}
                {docentePast.filter((e) => e.type !== "EVALUATION").length === 0 && (
                  <p className={`px-3 py-3 text-[10px] italic ${muted} opacity-60`}>Nenhuma aula anterior</p>
                )}
              </div>
            </div>
          </div>

          {upcomingEvalDocente.length > 0 && (
            <div className={`rounded-xl border overflow-hidden ${card}`}>
              <div className={`px-3 py-2 border-b ${border} flex items-center gap-2`}>
                <Zap size={12} className="text-orange-400" />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${text}`}>Próximas Avaliações</span>
                <span className={`text-[10px] ${muted}`}>({upcomingEvalDocente.length})</span>
              </div>
              <div className="divide-y divide-slate-700/20">
                {upcomingEvalDocente.map((ev) => (
                  <EvalRow key={ev.id} ev={ev} disciplines={disciplines} isDark={isDark} muted={muted} text={text} getDisciplineColor={getDisciplineColor} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Notices */}
      {todayNotices.length > 0 && (
        <div className={`rounded-xl border p-2.5 ${card}`}>
          <div className={`flex items-center gap-1 mb-1.5 text-[10px] font-bold uppercase tracking-wide ${muted}`}>
            <Info size={10} /> Avisos do dia
          </div>
          <div className="flex flex-col gap-1">
            {todayNotices.map((n) => (
              <div key={n.id} className={`rounded-lg border px-2 py-1 text-[10px] ${
                n.type === "URGENT"  ? "bg-red-500/15 border-red-400/40 text-red-400" :
                n.type === "WARNING" ? "bg-amber-500/15 border-amber-400/40 text-amber-400" :
                "bg-slate-500/15 border-slate-400/40 text-slate-400"
              }`}>
                <span className="font-semibold">{n.title}</span>
                {n.description && <span className={`ml-1.5 opacity-70`}>{n.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

function EvalRow({ ev, disciplines, isDark, muted, text, getDisciplineColor }: {
  ev: ScheduleEvent; disciplines: Discipline[]; isDark: boolean; muted: string; text: string;
  getDisciplineColor: (id: string) => string;
}) {
  const disc  = disciplines.find((d) => d.id === ev.disciplineId);
  const label = EVAL_LABELS[ev.evaluationType ?? ""] ?? "Avaliação";
  const color = getDisciplineColor(ev.disciplineId);
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 ${isDark ? "hover:bg-slate-700/20" : "hover:bg-slate-50"} transition-colors`}>
      <div className="w-1 h-7 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-bold ${text} truncate`}>
          {disc?.code ?? ev.disciplineId}
          <span className="ml-1.5 font-normal text-orange-400 text-[10px]">{label}</span>
        </p>
        {disc && <p className={`text-[10px] ${muted} truncate`}>{disc.name}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-[11px] font-semibold ${text}`}>{ev.date.slice(8)}/{ev.date.slice(5,7)}</p>
        <p className={`text-[10px] ${muted}`}>{ev.startTime}</p>
      </div>
    </div>
  );
}

function DocenteEventRow({ ev, isDark, muted, text, getDisciplineLabel, getDisciplineColor }: {
  ev: ScheduleEvent; isDark: boolean; muted: string; text: string;
  getDisciplineLabel: (id: string) => string; getDisciplineColor: (id: string) => string;
}) {
  const color = getDisciplineColor(ev.disciplineId);
  return (
    <div className={`flex items-center gap-2.5 px-3 py-1.5 ${isDark ? "hover:bg-slate-700/20" : "hover:bg-slate-50"} transition-colors`}>
      <div className="w-1 h-7 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-semibold ${text} truncate`}>{getDisciplineLabel(ev.disciplineId)}</p>
        <div className={`flex items-center gap-2 text-[10px] ${muted}`}>
          <span className="flex items-center gap-0.5"><User size={9} />{ev.classId}</span>
          {ev.location && <span className="flex items-center gap-0.5"><MapPin size={9} />{ev.location}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-[11px] font-semibold ${text}`}>{ev.date.slice(8)}/{ev.date.slice(5,7)}</p>
        <p className={`text-[10px] ${muted} flex items-center gap-0.5 justify-end`}><Clock size={9} />{ev.startTime}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, isDark, card, text, muted }: {
  label: string; value: number; icon: React.ReactNode;
  isDark: boolean; card: string; text: string; muted: string;
}) {
  return (
    <div className={`rounded-xl border p-2.5 flex items-center gap-2.5 ${card}`}>
      <div className={`p-1.5 rounded-lg ${isDark ? "bg-slate-700/50" : "bg-slate-100"}`}>{icon}</div>
      <div>
        <p className={`text-lg font-bold leading-tight ${text}`}>{value}</p>
        <p className={`text-[10px] ${muted} leading-tight`}>{label}</p>
      </div>
    </div>
  );
}
