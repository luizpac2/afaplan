import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, BookOpen, Bell, AlertTriangle, Info, CalendarDays, Zap, Plus } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useCourseStore } from "../store/useCourseStore";
import { getCohortColorTokens } from "../utils/cohortColors";
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
  PARTIAL: "Parcial", EXAM: "Exame", FINAL: "Prova Final",
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
      const isAcad = e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC" || e.type === "EVALUATION";
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

  // Selected day details
  const selectedEvents  = selectedDate ? eventsForDay(selectedDate)  : [];
  const selectedNotices = selectedDate ? noticesForDay(selectedDate) : [];

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

  const sqColor = (sq: number | null) => cohortTokens[sq ?? 0]?.primary ?? "#6366f1";

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

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`e${i}`} className={`min-h-[64px] lg:min-h-[110px] border-t border-r ${border} ${isDark ? "bg-slate-900/30" : "bg-slate-50/50"}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day     = i + 1;
              const col     = (firstDow + i) % 7;
              const dateStr = formatISODate(year, month, day);
              const isToday = dateStr === todayStr;
              const isSel   = dateStr === selectedDate;
              const isWknd  = col === 0 || col === 6;
              const dayEvts = eventsForDay(dateStr);
              const dayNots = noticesForDay(dateStr);
              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(isSel ? null : dateStr)}
                  className={`min-h-[64px] lg:min-h-[110px] border-t border-r ${border} p-1.5 cursor-pointer transition-colors flex flex-col gap-0.5
                    ${isSel ? (isDark ? "bg-blue-900/30 ring-1 ring-inset ring-blue-500/50" : "bg-blue-50 ring-1 ring-inset ring-blue-300") : ""}
                    ${!isSel && isWknd ? (isDark ? "bg-slate-900/50" : "bg-slate-50/70") : ""}
                    ${!isSel && !isWknd ? (isDark ? "hover:bg-slate-700/40" : "hover:bg-slate-50") : ""}
                  `}
                >
                  {/* Day number */}
                  <span className={`text-[11px] font-semibold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0
                    ${isToday ? "bg-blue-600 text-white" : (isWknd ? muted : (isDark ? "text-slate-200" : "text-slate-700"))}
                  `}>
                    {day}
                  </span>

                  {/* Event chips — mobile: 2, desktop: 6 */}
                  {dayEvts.slice(0, 6).map((ev, idx) => {
                    const sq = ev.targetSquadron ? Number(ev.targetSquadron) : null;
                    const color = (sq && sq >= 1 && sq <= 4) ? sqColor(sq) : (ev.color ?? "#6366f1");
                    const label = ev.type === "EVALUATION"
                      ? `${EVAL_LABELS[ev.evaluationType ?? ""] ?? "Aval."} ${sq ? SQ_LABELS[sq] : ""}`
                      : (ev.description || ev.location || "Evento");
                    return (
                      <div key={ev.id}
                        className={`rounded px-1 py-0.5 text-[9px] leading-tight font-medium truncate text-white${idx >= 2 ? " hidden lg:block" : ""}`}
                        style={{ backgroundColor: color + "cc" }}>
                        {label}
                      </div>
                    );
                  })}
                  {/* overflow indicator */}
                  {dayEvts.length > 6 && (
                    <span className={`text-[9px] ${muted} hidden lg:block`}>+{dayEvts.length - 6}</span>
                  )}
                  {dayEvts.length > 2 && (
                    <span className={`text-[9px] ${muted} lg:hidden`}>+{dayEvts.length - 2}</span>
                  )}
                  {/* Notice dot */}
                  {dayNots.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap mt-auto">
                      {dayNots.slice(0, 3).map(n => (
                        <div key={n.id} className="w-1.5 h-1.5 rounded-full bg-amber-400" title={n.title} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
                  : <div className="flex flex-col gap-2">
                      {selectedEvents.map(ev => {
                        const sq = ev.targetSquadron ? Number(ev.targetSquadron) : null;
                        const color = (sq && sq >= 1 && sq <= 4) ? sqColor(sq) : (ev.color ?? "#6366f1");
                        const disc = disciplines.find(d => d.id === ev.disciplineId);
                        const title = ev.type === "EVALUATION"
                          ? `${EVAL_LABELS[ev.evaluationType ?? ""] ?? "Avaliação"}${disc ? " — " + disc.code : ""}`
                          : (ev.description || ev.location || "Evento Acadêmico");
                        const endDateVal = (ev as any).endDate;
                        const isMultiDay = endDateVal && endDateVal !== ev.date;
                        const fmtDate = (iso: string) => iso.split("-").reverse().join("/");
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
                            {sq && <p className={`text-[10px] ${muted} ml-3.5`}>{SQ_LABELS[sq]}{ev.targetCourse && ev.targetCourse !== "ALL" ? ` · ${ev.targetCourse}` : ""}</p>}
                            {isMultiDay && <p className={`text-[10px] ${muted} ml-3.5`}>De {fmtDate(ev.date)} a {fmtDate(endDateVal)}</p>}
                            {ev.location && ev.type !== "EVALUATION" && <p className={`text-[10px] ${muted} ml-3.5`}>📍 {ev.location}</p>}
                          </div>
                        );
                      })}
                    </div>
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
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tokens.primary }} />
                      <span className={`text-[11px] ${isDark ? "text-slate-300" : "text-slate-700"}`}>{SQ_LABELS[sq]}</span>
                    </div>
                    <span className={`text-[11px] font-semibold ${muted}`}>{sqEvts.length} evento{sqEvts.length !== 1 ? "s" : ""}</span>
                  </div>
                );
              })}
              {monthNotices.length > 0 && (
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className={`text-[11px] ${isDark ? "text-slate-300" : "text-slate-700"}`}>Avisos</span>
                  </div>
                  <span className={`text-[11px] font-semibold ${muted}`}>{monthNotices.length}</span>
                </div>
              )}
            </div>

            <div className={`border-t pt-3 ${border}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${muted}`}>Legenda</p>
              <div className="flex flex-col gap-1.5">
                {[1,2,3,4].map(sq => {
                  const tokens = cohortTokens[sq];
                  return (
                    <div key={sq} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: tokens.primary }} />
                      <span className={`text-[10px] ${muted}`}>{SQ_LABELS[sq]}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
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
