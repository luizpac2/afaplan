import { useState, useMemo, useEffect, useRef } from 'react';
import {
   Search, Plus, Trash2, Edit2, History, PenLine, Save, Undo2,
   ChevronUp, CheckCircle2, AlertCircle, Zap, BookOpen,
   Clock, GraduationCap, X, TrendingUp, Calendar,
   ChevronDown, FileText, CalendarCheck, Filter, Users,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCourseStore } from '../store/useCourseStore';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import type {
   Instructor, InstructorOccurrence, InstructorVenture, AcademicTitle,
   Discipline, ScheduleEvent, CourseClass,
} from '../types';
import { Badge } from '../components/common/Badge';

// ─── Types ────────────────────────────────────────────────────────────────────
type BulkInstructorEdits = Record<string, Partial<Pick<Instructor, 'venture' | 'maxTitle' | 'weeklyLoadLimit' | 'specialty' | 'rank'>>>;

// ─── Constants ────────────────────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
   GERAL: 'Geral',
   MILITAR: 'Militar',
   PROFISSIONAL: 'Profissional',
   ATIVIDADES_COMPLEMENTARES: 'Ativ. Complementares',
};
const FIELD_COLORS: Record<string, string> = {
   GERAL:                    'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-700 dark:border-slate-600',
   MILITAR:                  'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
   PROFISSIONAL:             'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800',
   ATIVIDADES_COMPLEMENTARES:'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-900/20 dark:border-purple-800',
};
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(dateStr: string) {
   const [y, m, d] = dateStr.split('-').map(Number);
   const dt = new Date(y, m - 1, d);
   return `${String(d).padStart(2, '0')} ${MONTHS_PT[m - 1]} ${y} · ${WEEKDAYS[dt.getDay()]}`;
}

function getTotalPPC(d: Discipline) {
   if (!d.ppcLoads) return 0;
   return Object.values(d.ppcLoads).reduce((s, v) => s + (v || 0), 0);
}

// ─── ICS Generator ───────────────────────────────────────────────────────────
function generateICS(
   disc: Discipline,
   events: ScheduleEvent[],
   classMap: Record<string, CourseClass>,
   instructor: Instructor | undefined,
) {
   const icsDate = (dateStr: string, time: string) => {
      const [y, m, d] = dateStr.split('-');
      const [h, min] = (time || '08:00').split(':');
      return `${y}${m}${d}T${h}${min}00`;
   };

   const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AFA Planner//PT',
      `X-WR-CALNAME:${disc.code} - ${disc.name}`,
      'X-WR-TIMEZONE:America/Sao_Paulo',
      'CALSCALE:GREGORIAN',
   ];

   events.forEach(ev => {
      const cls = classMap[ev.classId];
      const clsLabel = cls ? `${cls.year}º Ano - Turma ${cls.name}` : ev.classId;
      const dtStart = icsDate(ev.date, ev.startTime || '08:00');
      const dtEnd   = icsDate(ev.date, ev.endTime   || '10:00');
      lines.push(
         'BEGIN:VEVENT',
         `UID:${ev.id}@afaplanner`,
         `DTSTAMP:${icsDate(new Date().toISOString().split('T')[0], '00:00')}`,
         `DTSTART:${dtStart}`,
         `DTEND:${dtEnd}`,
         `SUMMARY:${disc.code} - ${disc.name}`,
         `DESCRIPTION:Turma: ${clsLabel}${instructor ? `\\nDocente: ${instructor.trigram} - ${instructor.warName}` : ''}${ev.location ? `\\nLocal: ${ev.location}` : ''}`,
         ev.location ? `LOCATION:${ev.location}` : '',
         'END:VEVENT',
      );
   });

   lines.push('END:VCALENDAR');
   const blob = new Blob([lines.filter(Boolean).join('\r\n')], { type: 'text/calendar;charset=utf-8' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = `${disc.code}_Programacao.ics`;
   a.click();
   URL.revokeObjectURL(url);
}

// ─── PDF Generator ────────────────────────────────────────────────────────────
function generatePDF(
   disc: Discipline,
   events: ScheduleEvent[],
   classMap: Record<string, CourseClass>,
   instructor: Instructor | undefined,
) {
   const doc = new jsPDF();
   const today = new Date().toLocaleDateString('pt-BR');

   doc.setFontSize(14);
   doc.setFont('helvetica', 'bold');
   doc.text(`${disc.code} — ${disc.name}`, 14, 18);
   doc.setFontSize(9);
   doc.setFont('helvetica', 'normal');
   doc.setTextColor(100);
   if (instructor) doc.text(`Docente: ${instructor.rank || ''} ${instructor.warName} (${instructor.trigram})`, 14, 25);
   doc.text(`Campo: ${FIELD_LABELS[disc.trainingField] || disc.trainingField}  |  PPC Total: ${getTotalPPC(disc)}h  |  Aulas agendadas: ${events.length}`, 14, 31);
   doc.text(`Gerado em: ${today}`, 14, 37);
   doc.setTextColor(0);

   const rows = events.map((ev, i) => {
      const [yy, mm, dd] = ev.date.split('-').map(Number);
      const dt = new Date(yy, mm - 1, dd);
      const cls = classMap[ev.classId];
      return [
         String(i + 1),
         `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yy}`,
         WEEKDAYS[dt.getDay()],
         `${ev.startTime || '--'} – ${ev.endTime || '--'}`,
         cls ? `${cls.year}º ${cls.name} (${cls.type === 'AVIATION' ? 'Av' : cls.type === 'INTENDANCY' ? 'Int' : 'Inf'})` : ev.classId,
         ev.location || '',
      ];
   });

   autoTable(doc, {
      startY: 43,
      head: [['#', 'Data', 'Dia', 'Horário', 'Turma', 'Local']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 24 }, 2: { cellWidth: 14 }, 3: { cellWidth: 28 } },
   });

   doc.save(`${disc.code}_Programacao.pdf`);
}

// ─── Schedule Modal ───────────────────────────────────────────────────────────
interface ScheduleModalProps {
   disc: Discipline;
   events: ScheduleEvent[];
   classMap: Record<string, CourseClass>;
   instructor: Instructor | undefined;
   today: string;
   isDark: boolean;
   onClose: () => void;
}

function ScheduleModal({ disc, events, classMap, instructor, today, isDark, onClose }: ScheduleModalProps) {
   const completed = events.filter(e => e.date < today);
   const upcoming  = events.filter(e => e.date >= today);
   const [showAll, setShowAll] = useState(false);
   const displayUpcoming = showAll ? upcoming : upcoming.slice(0, 15);

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
         <div
            className={`w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
         >
            {/* Header */}
            <div className={`px-5 py-4 border-b flex items-start justify-between ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
               <div>
                  <div className="flex items-center gap-2 mb-0.5">
                     <span className="font-mono text-sm font-bold text-blue-500">{disc.code}</span>
                     <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${FIELD_COLORS[disc.trainingField] || FIELD_COLORS.COMPLEMENTARY}`}>{FIELD_LABELS[disc.trainingField]}</span>
                  </div>
                  <h2 className="text-base font-semibold">{disc.name}</h2>
                  {instructor && (
                     <p className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono font-bold text-blue-500">{instructor.trigram}</span> — {instructor.rank ? `${instructor.rank} ` : ''}{instructor.warName}
                     </p>
                  )}
               </div>
               <div className="flex items-center gap-2 shrink-0">
                  <button
                     onClick={() => generatePDF(disc, events, classMap, instructor)}
                     disabled={events.length === 0}
                     title="Baixar PDF"
                     className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20 disabled:opacity-40"
                  >
                     <FileText size={13} /> PDF
                  </button>
                  <button
                     onClick={() => generateICS(disc, events, classMap, instructor)}
                     disabled={events.length === 0}
                     title="Exportar para Google Agenda / iCal"
                     className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20 disabled:opacity-40"
                  >
                     <CalendarCheck size={13} /> .ICS
                  </button>
                  <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                     <X size={18} />
                  </button>
               </div>
            </div>

            {/* Stats bar */}
            <div className={`px-5 py-2.5 flex gap-6 text-xs border-b ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-white'}`}>
               <span><span className="font-bold text-slate-700 dark:text-slate-200">{events.length}</span> <span className="text-slate-400">total</span></span>
               <span><span className="font-bold text-green-500">{completed.length}</span> <span className="text-slate-400">realizadas</span></span>
               <span><span className="font-bold text-blue-500">{upcoming.length}</span> <span className="text-slate-400">próximas</span></span>
               <span className="text-slate-400">PPC: <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{getTotalPPC(disc)}h</span></span>
               {getTotalPPC(disc) > 0 && (
                  <span className="text-slate-400">Cumprimento: <span className="font-bold text-blue-500">{Math.min(100, Math.round((events.length / getTotalPPC(disc)) * 100))}%</span></span>
               )}
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
               {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                     <Calendar size={36} className="mb-3 opacity-30" />
                     <p className="text-sm">Nenhuma aula agendada para esta disciplina</p>
                  </div>
               ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                     {/* Próximas aulas */}
                     {upcoming.length > 0 && (
                        <div>
                           <div className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-blue-400 bg-blue-900/10' : 'text-blue-600 bg-blue-50/60'}`}>
                              Próximas aulas ({upcoming.length})
                           </div>
                           {displayUpcoming.map((ev, i) => {
                              const cls = classMap[ev.classId];
                              const isNext = i === 0;
                              return (
                                 <div key={ev.id} className={`px-5 py-3 flex items-center gap-4 ${isNext ? (isDark ? 'bg-blue-900/10' : 'bg-blue-50/40') : ''} hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors`}>
                                    {/* Date badge */}
                                    <div className={`shrink-0 w-12 text-center rounded-lg py-1 ${isNext ? 'bg-blue-600 text-white' : (isDark ? 'bg-slate-700' : 'bg-slate-100')}`}>
                                       <div className={`text-[10px] font-bold uppercase ${isNext ? 'text-blue-200' : 'text-slate-400'}`}>{MONTHS_PT[Number(ev.date.split('-')[1]) - 1]}</div>
                                       <div className={`text-lg font-bold leading-none ${isNext ? 'text-white' : (isDark ? 'text-slate-100' : 'text-slate-700')}`}>{ev.date.split('-')[2]}</div>
                                       <div className={`text-[9px] ${isNext ? 'text-blue-200' : 'text-slate-400'}`}>{WEEKDAYS[new Date(Number(ev.date.split('-')[0]), Number(ev.date.split('-')[1]) - 1, Number(ev.date.split('-')[2])).getDay()]}</div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                       <div className="flex items-center gap-2 flex-wrap">
                                          {cls && (
                                             <span className={`text-xs font-medium px-2 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'}`}>
                                                {cls.year}º Ano · Turma {cls.name}
                                             </span>
                                          )}
                                          {isNext && <span className="text-[10px] font-bold text-blue-500 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">Próxima</span>}
                                       </div>
                                       <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                          {(ev.startTime || ev.endTime) && (
                                             <span className="flex items-center gap-1"><Clock size={10} /> {ev.startTime || '--'}–{ev.endTime || '--'}</span>
                                          )}
                                          {ev.location && <span className="truncate">{ev.location}</span>}
                                       </div>
                                    </div>
                                 </div>
                              );
                           })}
                           {upcoming.length > 15 && !showAll && (
                              <button
                                 onClick={() => setShowAll(true)}
                                 className={`w-full py-2.5 text-xs font-medium text-blue-500 hover:text-blue-700 flex items-center justify-center gap-1 ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}
                              >
                                 <ChevronDown size={13} /> Ver mais {upcoming.length - 15} aulas
                              </button>
                           )}
                        </div>
                     )}
                     {/* Realizadas */}
                     {completed.length > 0 && (
                        <div>
                           <div className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-green-400 bg-green-900/10' : 'text-green-600 bg-green-50/60'}`}>
                              Realizadas ({completed.length})
                           </div>
                           {[...completed].reverse().slice(0, 5).map(ev => {
                              const cls = classMap[ev.classId];
                              return (
                                 <div key={ev.id} className="px-5 py-2.5 flex items-center gap-4 opacity-60 hover:opacity-100 transition-opacity">
                                    <div className={`shrink-0 w-12 text-center rounded-lg py-1 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                       <div className="text-[10px] font-bold uppercase text-slate-400">{MONTHS_PT[Number(ev.date.split('-')[1]) - 1]}</div>
                                       <div className={`text-lg font-bold leading-none ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{ev.date.split('-')[2]}</div>
                                       <div className="text-[9px] text-slate-400">{WEEKDAYS[new Date(Number(ev.date.split('-')[0]), Number(ev.date.split('-')[1]) - 1, Number(ev.date.split('-')[2])).getDay()]}</div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                       <div className="flex items-center gap-2">
                                          {cls && <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{cls.year}º Ano · Turma {cls.name}</span>}
                                          <CheckCircle2 size={12} className="text-green-500" />
                                       </div>
                                       <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                                          {(ev.startTime || ev.endTime) && <span>{ev.startTime || '--'}–{ev.endTime || '--'}</span>}
                                          {ev.location && <span className="truncate">{ev.location}</span>}
                                       </div>
                                    </div>
                                 </div>
                              );
                           })}
                           {completed.length > 5 && (
                              <p className="px-5 py-2 text-xs text-slate-400 italic">... e mais {completed.length - 5} aulas realizadas</p>
                           )}
                        </div>
                     )}
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}

// ─── Discipline Card ──────────────────────────────────────────────────────────
interface DisciplineCardProps {
   disc: Discipline;
   instructor: Instructor | undefined;
   events: ScheduleEvent[];
   today: string;
   isDark: boolean;
   onViewSchedule: () => void;
}

function DisciplineCard({ disc, instructor, events, today, isDark, onViewSchedule }: DisciplineCardProps) {
   const scheduled = events.length;
   const completed = events.filter(e => e.date < today).length;
   const remaining = events.filter(e => e.date >= today).length;
   const ppcTotal  = getTotalPPC(disc);
   const pct = ppcTotal > 0 ? Math.min(100, Math.round((scheduled / ppcTotal) * 100)) : 0;
   const nextClass = events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
   const fieldColor = FIELD_COLORS[disc.trainingField] || FIELD_COLORS.COMPLEMENTARY;

   return (
      <div className={`rounded-xl border shadow-sm flex flex-col overflow-hidden hover:shadow-md transition-shadow ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
         {/* Accent bar */}
         <div className={`h-1 ${pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`} />

         {/* Header */}
         <div className="px-4 pt-3 pb-2">
            <div className="flex items-start justify-between gap-2">
               <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                     <span className="font-mono text-xs font-bold text-blue-500">{disc.code}</span>
                     <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${fieldColor}`}>{FIELD_LABELS[disc.trainingField] || disc.trainingField}</span>
                  </div>
                  <p className={`text-sm font-semibold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{disc.name}</p>
               </div>
            </div>
         </div>

         {/* Instructor */}
         <div className={`px-4 py-1.5 flex items-center gap-2 border-t border-b ${isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-100 bg-slate-50/60'}`}>
            <GraduationCap size={11} className="text-slate-400 shrink-0" />
            {instructor ? (
               <span className="text-xs truncate">
                  <span className="font-mono font-bold text-blue-500">{instructor.trigram}</span>
                  <span className={isDark ? ' text-slate-300' : ' text-slate-600'}> — {instructor.warName}</span>
                  {instructor.rank && <span className="text-slate-400"> · {instructor.rank}</span>}
               </span>
            ) : (
               <span className="text-xs text-slate-400 italic">Sem docente atribuído</span>
            )}
         </div>

         {/* Metrics */}
         <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center">
            <div>
               <p className={`text-xl font-bold leading-none ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{scheduled}</p>
               <p className="text-[10px] text-slate-400 mt-0.5">Agendadas</p>
            </div>
            <div>
               <p className={`text-xl font-bold leading-none ${completed > 0 ? 'text-green-500' : (isDark ? 'text-slate-600' : 'text-slate-300')}`}>{completed}</p>
               <p className="text-[10px] text-slate-400 mt-0.5">Realizadas</p>
            </div>
            <div>
               <p className={`text-xl font-bold leading-none ${remaining > 0 ? 'text-blue-500' : (isDark ? 'text-slate-600' : 'text-slate-300')}`}>{remaining}</p>
               <p className="text-[10px] text-slate-400 mt-0.5">Restantes</p>
            </div>
         </div>

         {/* PPC progress */}
         {ppcTotal > 0 && (
            <div className="px-4 pb-2">
               <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock size={9} /> {ppcTotal}h PPC</span>
                  <span className={`text-[10px] font-bold ${pct >= 100 ? 'text-green-500' : pct >= 60 ? 'text-blue-500' : 'text-amber-500'}`}>{pct}%</span>
               </div>
               <div className={`h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-500' : 'bg-slate-300'}`} style={{ width: `${pct}%` }} />
               </div>
            </div>
         )}

         {/* Next class hint */}
         {nextClass && (
            <div className={`px-4 py-1.5 border-t text-[11px] flex items-center gap-1.5 ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
               <Calendar size={10} className="text-blue-400 shrink-0" />
               <span>Próxima: <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fmtDate(nextClass.date)}</span></span>
            </div>
         )}

         {/* Courses */}
         {disc.enabledCourses?.length > 0 && (
            <div className={`px-4 py-2 border-t flex flex-wrap gap-1 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
               {disc.enabledCourses.map(c => (
                  <span key={c} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${c === 'AVIATION' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : c === 'INTENDANCY' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                     {c === 'AVIATION' ? 'Aviação' : c === 'INTENDANCY' ? 'Intendência' : 'Infantaria'}
                  </span>
               ))}
               {disc.enabledYears?.map(y => (
                  <span key={y} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">{y}º Ano</span>
               ))}
            </div>
         )}

         {/* View schedule button */}
         <button
            onClick={onViewSchedule}
            className={`mx-4 mb-4 mt-2 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
               scheduled > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : (isDark ? 'bg-slate-700 text-slate-400 cursor-default' : 'bg-slate-100 text-slate-400 cursor-default')
            }`}
            disabled={scheduled === 0}
         >
            <Calendar size={12} />
            {scheduled > 0 ? `Ver programação (${scheduled} aulas)` : 'Sem aulas agendadas'}
         </button>
      </div>
   );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export const Instructors = () => {
   const pageHeaderRef  = useRef<HTMLDivElement>(null);
   const toolbarRef     = useRef<HTMLDivElement>(null);
   const bulkHeaderRef  = useRef<HTMLDivElement>(null);
   const bulkActionsRef = useRef<HTMLDivElement>(null);
   const [pageHeaderH, setPageHeaderH] = useState(64);
   const [toolbarH, setToolbarH]       = useState(96);
   const [bulkHeaderH, setBulkHeaderH] = useState(64);
   const [bulkActionsH, setBulkActionsH] = useState(100);

   const {
      instructors, addInstructor, updateInstructor, deleteInstructor, addOccurrence,
      disciplines, classes, yearEventsCache, fetchYearlyEvents,
   } = useCourseStore();
   const { theme } = useTheme();
   const { userProfile } = useAuth();
   const isDark = theme === 'dark';

   const canEdit  = useMemo(() => ['SUPER_ADMIN', 'ADMIN'].includes(userProfile?.role || ''), [userProfile]);
   const isDocente = userProfile?.role === 'DOCENTE';

   // panel state
   const [showInstructorPanel, setShowInstructorPanel] = useState(false);
   const [selectedDisc, setSelectedDisc] = useState<Discipline | null>(null);

   // ── Discipline filters ───────────────────────────────────────────────────
   const [discSearch, setDiscSearch]   = useState('');
   const [fieldFilter, setFieldFilter] = useState('ALL');
   const [courseFilter, setCourseFilter] = useState('ALL');
   const [yearFilter, setYearFilter]   = useState('ALL');
   const [instrFilter, setInstrFilter] = useState('ALL');
   const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | HAS_EVENTS | NO_EVENTS | DONE | IN_PROGRESS
   const [showFilters, setShowFilters] = useState(false);

   // ── Instructor table state ───────────────────────────────────────────────
   const [searchTerm, setSearchTerm]   = useState('');
   const [debouncedSearch, setDebouncedSearch] = useState('');
   useEffect(() => { const t = setTimeout(() => setDebouncedSearch(searchTerm), 300); return () => clearTimeout(t); }, [searchTerm]);

   const [ventureFilter, setVentureFilter] = useState<InstructorVenture | 'ALL'>('ALL');
   const [titleFilter, setTitleFilter]     = useState<AcademicTitle | 'ALL'>('ALL');
   const [isInstructorModalOpen, setIsInstructorModalOpen] = useState(false);
   const [isOccurrenceModalOpen, setIsOccurrenceModalOpen] = useState(false);
   const [editingInstructor, setEditingInstructor]         = useState<Instructor | null>(null);
   const [selectedInstructorForOccurrence, setSelectedInstructorForOccurrence] = useState<string | null>(null);
   const [disciplineSearch, setDisciplineSearch] = useState('');
   const [classSearch, setClassSearch]           = useState('');
   const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
   const [selectedClasses, setSelectedClasses]         = useState<string[]>([]);

   // ── Bulk edit ────────────────────────────────────────────────────────────
   const [bulkEditOpen, setBulkEditOpen] = useState(false);
   const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
   const [bulkEdits, setBulkEdits]       = useState<BulkInstructorEdits>({});
   const [isSaving, setIsSaving]         = useState(false);
   const [saveResult, setSaveResult]     = useState<{ success: number; total: number } | null>(null);

   useEffect(() => {
      const obs = new ResizeObserver(entries => {
         for (const e of entries) {
            const h = Math.ceil(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height);
            if (e.target === pageHeaderRef.current)  setPageHeaderH(h);
            if (e.target === toolbarRef.current)     setToolbarH(h);
            if (e.target === bulkHeaderRef.current)  setBulkHeaderH(h);
            if (e.target === bulkActionsRef.current) setBulkActionsH(h);
         }
      });
      [pageHeaderRef, toolbarRef, bulkHeaderRef, bulkActionsRef].forEach(r => { if (r.current) obs.observe(r.current); });
      return () => obs.disconnect();
   }, [bulkEditOpen, showInstructorPanel]);

   useEffect(() => {
      const year = new Date().getFullYear();
      if (!yearEventsCache[year]) fetchYearlyEvents(year);
   }, []);

   const today = new Date().toISOString().split('T')[0];

   // ── Derived data ─────────────────────────────────────────────────────────
   const allEvents: ScheduleEvent[] = useMemo(
      () => Object.values(yearEventsCache).flat().filter(e => e.disciplineId && e.disciplineId !== 'ACADEMIC'),
      [yearEventsCache],
   );

   const eventsByDisc = useMemo(() => {
      const map: Record<string, ScheduleEvent[]> = {};
      for (const ev of allEvents) {
         if (!map[ev.disciplineId]) map[ev.disciplineId] = [];
         map[ev.disciplineId].push(ev);
      }
      // sort each list by date
      for (const id of Object.keys(map)) map[id].sort((a, b) => a.date.localeCompare(b.date));
      return map;
   }, [allEvents]);

   const classMap = useMemo(() => {
      const m: Record<string, CourseClass> = {};
      for (const c of classes) m[c.id] = c;
      return m;
   }, [classes]);

   const instructorByTrigram = useMemo(() => {
      const m: Record<string, Instructor> = {};
      for (const i of instructors) m[i.trigram] = i;
      return m;
   }, [instructors]);

   const myInstructor = useMemo(() => {
      if (!isDocente || !userProfile) return null;
      return instructors.find(i => i.email === userProfile.email) || null;
   }, [isDocente, userProfile, instructors]);

   // ── Filtered disciplines ─────────────────────────────────────────────────
   const filteredDiscs = useMemo(() => {
      const q = discSearch.toLowerCase();
      return [...disciplines]
         .filter(d => {
            // DOCENTE: only their disciplines
            if (isDocente && myInstructor && !myInstructor.enabledDisciplines?.includes(d.id)) return false;
            // Instructor filter (for admin)
            if (instrFilter !== 'ALL') {
               const instr = instructors.find(i => i.trigram === instrFilter);
               if (!instr?.enabledDisciplines?.includes(d.id)) return false;
            }
            if (fieldFilter !== 'ALL' && d.trainingField !== fieldFilter) return false;
            if (courseFilter !== 'ALL' && !d.enabledCourses?.includes(courseFilter as any)) return false;
            if (yearFilter !== 'ALL' && !d.enabledYears?.includes(Number(yearFilter) as any)) return false;
            // Status filter
            const evs = eventsByDisc[d.id] || [];
            if (statusFilter === 'HAS_EVENTS' && evs.length === 0) return false;
            if (statusFilter === 'NO_EVENTS' && evs.length > 0) return false;
            if (statusFilter === 'DONE') {
               const ppc = getTotalPPC(d);
               if (ppc === 0 || evs.length < ppc) return false;
            }
            if (statusFilter === 'IN_PROGRESS') {
               const completed = evs.filter(e => e.date < today).length;
               if (completed === 0 || completed >= evs.length) return false;
            }
            if (statusFilter === 'UPCOMING_ONLY') {
               if (evs.filter(e => e.date >= today).length === 0) return false;
            }
            // Search
            if (q) {
               return (
                  d.name.toLowerCase().includes(q) ||
                  (d.code || '').toLowerCase().includes(q) ||
                  (FIELD_LABELS[d.trainingField] || '').toLowerCase().includes(q)
               );
            }
            return true;
         })
         .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
   }, [disciplines, discSearch, fieldFilter, courseFilter, yearFilter, instrFilter, statusFilter, eventsByDisc, today, isDocente, myInstructor, instructors]);

   // ── Summary ──────────────────────────────────────────────────────────────
   const totalScheduled = useMemo(() => filteredDiscs.reduce((s, d) => s + (eventsByDisc[d.id]?.length || 0), 0), [filteredDiscs, eventsByDisc]);
   const totalCompleted = useMemo(() => filteredDiscs.reduce((s, d) => s + (eventsByDisc[d.id]?.filter(e => e.date < today).length || 0), 0), [filteredDiscs, eventsByDisc, today]);
   const totalPPC       = useMemo(() => filteredDiscs.reduce((s, d) => s + getTotalPPC(d), 0), [filteredDiscs]);

   const hasActiveFilters = fieldFilter !== 'ALL' || courseFilter !== 'ALL' || yearFilter !== 'ALL' || instrFilter !== 'ALL' || statusFilter !== 'ALL';

   // ── Instructor table helpers ─────────────────────────────────────────────
   const changedCount = Object.keys(bulkEdits).length;

   const setBulkField = (id: string, field: keyof Pick<Instructor, 'venture' | 'maxTitle' | 'weeklyLoadLimit' | 'specialty' | 'rank'>, value: string | number) => {
      const original = instructors.find(i => i.trigram === id);
      if (!original) return;
      setBulkEdits(prev => {
         const current = { ...prev };
         const edits = { ...(current[id] || {}) };
         const origVal = original[field];
         if (String(origVal ?? '') === String(value)) { delete edits[field as keyof typeof edits]; }
         else { (edits as any)[field] = value; }
         if (Object.keys(edits).length === 0) delete current[id];
         else current[id] = edits;
         return current;
      });
   };

   const getCurrentValue = (inst: Instructor, field: keyof Pick<Instructor, 'venture' | 'maxTitle' | 'weeklyLoadLimit' | 'specialty' | 'rank'>) => {
      const edited = bulkEdits[inst.trigram]?.[field];
      return edited !== undefined ? edited : (inst[field] ?? '');
   };

   const isFieldChanged = (id: string, field: string) => bulkEdits[id]?.[field as keyof typeof bulkEdits[string]] !== undefined;
   const discardEdits = () => { setBulkEdits({}); setSaveResult(null); };

   const saveBulkEdits = async () => {
      setIsSaving(true); setSaveResult(null);
      try {
         await Promise.all(Object.entries(bulkEdits).map(([trigram, updates]) => {
            const original = instructors.find(i => i.trigram === trigram);
            if (!original) return Promise.resolve();
            return updateInstructor(trigram, { ...original, ...updates });
         }));
         setSaveResult({ success: changedCount, total: changedCount }); setBulkEdits({});
      } catch { setSaveResult({ success: 0, total: changedCount }); }
      finally { setIsSaving(false); setTimeout(() => setSaveResult(null), 4000); }
   };

   const handleBulkDelete = async () => {
      const targets = Array.from(selectedIds);
      if (!targets.length) { alert('Selecione pelo menos um docente.'); return; }
      if (!confirm(`Excluir ${targets.length} docente(s)?`)) return;
      for (const trigram of targets) await deleteInstructor(trigram);
      setSelectedIds(new Set());
   };

   const handleSelectAll = (checked: boolean) => setSelectedIds(checked ? new Set(filteredInstructors.map(i => i.trigram)) : new Set());
   const handleSelectOne = (id: string, checked: boolean) => {
      const s = new Set(selectedIds);
      checked ? s.add(id) : s.delete(id);
      setSelectedIds(s);
   };

   const filteredInstructors = useMemo(() => {
      return [...instructors].sort((a, b) => a.warName.localeCompare(b.warName)).filter(i => {
         if (debouncedSearch.startsWith('!')) {
            const t = debouncedSearch.substring(1).toLowerCase();
            if (t === 'disciplina') return !i.enabledDisciplines?.length;
            if (t === 'turma') return !i.enabledClasses?.length;
            if (t === 'ch') return !i.weeklyLoadLimit;
            return false;
         }
         const q = debouncedSearch.toLowerCase();
         return (!q || i.fullName?.toLowerCase().includes(q) || i.warName?.toLowerCase().includes(q) || i.trigram?.toLowerCase().includes(q) || i.specialty?.toLowerCase().includes(q)) &&
            (ventureFilter === 'ALL' || i.venture === ventureFilter) &&
            (titleFilter === 'ALL' || i.maxTitle === titleFilter);
      });
   }, [instructors, debouncedSearch, ventureFilter, titleFilter]);

   const handleSaveInstructor = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const data: Instructor = {
         trigram: editingInstructor ? editingInstructor.trigram : (fd.get('trigram') as string || '').toUpperCase(),
         fullName: fd.get('fullName') as string || '', warName: fd.get('warName') as string || '',
         rank: fd.get('rank') as string || '', cpf_saram: fd.get('cpf_saram') as string || '',
         email: fd.get('email') as string || '', phone: fd.get('phone') as string || '',
         venture: fd.get('venture') as InstructorVenture, maxTitle: fd.get('maxTitle') as AcademicTitle,
         specialty: fd.get('specialty') as string || '',
         weeklyLoadLimit: parseInt(fd.get('weeklyLoadLimit') as string) || 0,
         fixedBlocks: [], plannedAbsences: editingInstructor?.plannedAbsences || [],
         preferences: fd.get('preferences') as string,
         enabledDisciplines: selectedDisciplines, enabledClasses: selectedClasses,
      };
      if (editingInstructor) updateInstructor(editingInstructor.trigram, data);
      else {
         if (instructors.some(i => i.trigram === data.trigram)) { alert('Trigrama já em uso!'); return; }
         addInstructor(data);
      }
      setIsInstructorModalOpen(false); setEditingInstructor(null);
   };

   const handleSaveOccurrence = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      addOccurrence({
         id: crypto.randomUUID(), instructorTrigram: selectedInstructorForOccurrence!,
         date: fd.get('date') as string, type: fd.get('type') as InstructorOccurrence['type'],
         reason: fd.get('reason') as string,
         disciplineId: fd.get('disciplineId') as string || undefined,
      });
      setIsOccurrenceModalOpen(false); setSelectedInstructorForOccurrence(null);
   };

   const inputCls  = `w-full px-3 py-1.5 rounded border focus:ring-1 focus:ring-blue-500 text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200'}`;
   const selectCls = `w-full px-2 py-1.5 rounded border text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200'}`;
   const filterSelectCls = `px-3 py-2 rounded-lg border text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'}`;

   const regularTableHeadTop = pageHeaderH + toolbarH;
   const bulkActionsTop      = pageHeaderH + bulkHeaderH;
   const bulkTableHeadTop    = pageHeaderH + bulkHeaderH + bulkActionsH;

   return (
      <div className={`w-full min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-slate-900'}`}>

         {/* ─── PAGE HEADER ─── */}
         <div ref={pageHeaderRef} className={`sticky top-0 z-50 px-4 md:px-6 border-b backdrop-blur-md ${isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
            <div className="flex items-center justify-between gap-4 py-2.5">
               <div className="flex items-center gap-3">
                  <h1 className="text-lg font-bold tracking-tight">Painel do Docente</h1>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{filteredDiscs.length} disciplinas</span>
               </div>
               <div className="flex items-center gap-2">
                  <button onClick={() => setShowFilters(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${showFilters || hasActiveFilters ? (isDark ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-blue-50 text-blue-600 border-blue-200') : (isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600 shadow-sm')}`}>
                     <Filter size={13} />
                     Filtros
                     {hasActiveFilters && <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center font-bold">!</span>}
                  </button>
                  {canEdit && (
                     <button onClick={() => setShowInstructorPanel(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${showInstructorPanel ? (isDark ? 'bg-amber-900/30 text-amber-400 border-amber-800' : 'bg-amber-50 text-amber-600 border-amber-200') : (isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600 shadow-sm')}`}>
                        <Users size={13} /> Docentes
                        {changedCount > 0 && <span className="bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{changedCount}</span>}
                     </button>
                  )}
               </div>
            </div>
         </div>

         {/* ─── TOOLBAR (search + summary) ─── */}
         <div ref={toolbarRef} className={`sticky z-40 px-4 md:px-6 py-3 border-b backdrop-blur-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`} style={{ top: pageHeaderH }}>
            {/* Search row */}
            <div className="flex gap-2 items-center mb-2">
               <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                     type="text" placeholder="Buscar por nome, código ou campo do conhecimento..."
                     value={discSearch} onChange={e => setDiscSearch(e.target.value)}
                     className={`w-full pl-9 pr-8 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-200 placeholder-slate-400'}`}
                  />
                  {discSearch && (
                     <button onClick={() => setDiscSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>
                  )}
               </div>
            </div>

            {/* Expanded filters */}
            {showFilters && (
               <div className={`rounded-lg border p-3 mb-2 grid grid-cols-2 md:grid-cols-5 gap-2 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Campo</label>
                     <select value={fieldFilter} onChange={e => setFieldFilter(e.target.value)} className={filterSelectCls + ' w-full'}>
                        <option value="ALL">Todos</option>
                        <option value="GERAL">Geral</option>
                        <option value="MILITAR">Militar</option>
                        <option value="PROFISSIONAL">Profissional</option>
                        <option value="ATIVIDADES_COMPLEMENTARES">Ativ. Complementares</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Curso</label>
                     <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className={filterSelectCls + ' w-full'}>
                        <option value="ALL">Todos</option>
                        <option value="AVIATION">Aviação</option>
                        <option value="INTENDANCY">Intendência</option>
                        <option value="INFANTRY">Infantaria</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ano Letivo</label>
                     <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className={filterSelectCls + ' w-full'}>
                        <option value="ALL">Todos</option>
                        <option value="1">1º Ano</option><option value="2">2º Ano</option>
                        <option value="3">3º Ano</option><option value="4">4º Ano</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Docente</label>
                     <select value={instrFilter} onChange={e => setInstrFilter(e.target.value)} className={filterSelectCls + ' w-full'}>
                        <option value="ALL">Todos</option>
                        {[...instructors].sort((a, b) => a.warName.localeCompare(b.warName)).map(i => (
                           <option key={i.trigram} value={i.trigram}>{i.trigram} — {i.warName}</option>
                        ))}
                     </select>
                  </div>
                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                     <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={filterSelectCls + ' w-full'}>
                        <option value="ALL">Todos</option>
                        <option value="HAS_EVENTS">Com aulas</option>
                        <option value="NO_EVENTS">Sem aulas</option>
                        <option value="IN_PROGRESS">Em andamento</option>
                        <option value="UPCOMING_ONLY">Com próximas</option>
                        <option value="DONE">PPC concluído</option>
                     </select>
                  </div>
               </div>
            )}

            {/* Summary row */}
            <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
               <span><strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{filteredDiscs.length}</strong> disciplinas</span>
               <span>·</span>
               <span className="flex items-center gap-1"><Calendar size={10} /> <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{totalScheduled}</strong> aulas agendadas</span>
               <span className="flex items-center gap-1 text-green-500"><CheckCircle2 size={10} /> <strong>{totalCompleted}</strong> realizadas</span>
               <span className="flex items-center gap-1 text-blue-500"><Clock size={10} /> <strong>{totalScheduled - totalCompleted}</strong> restantes</span>
               {totalPPC > 0 && (
                  <span className="flex items-center gap-1"><TrendingUp size={10} /> <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{Math.round((totalScheduled / totalPPC) * 100)}%</strong> do PPC coberto ({totalPPC}h)</span>
               )}
               {hasActiveFilters && (
                  <button onClick={() => { setFieldFilter('ALL'); setCourseFilter('ALL'); setYearFilter('ALL'); setInstrFilter('ALL'); setStatusFilter('ALL'); }} className="ml-auto flex items-center gap-1 text-red-400 hover:text-red-500">
                     <X size={11} /> Limpar filtros
                  </button>
               )}
            </div>
         </div>

         {/* ─── DISCIPLINE CARDS ─── */}
         {!showInstructorPanel && (
            <div className="px-4 md:px-6 py-5">
               {filteredDiscs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                     <BookOpen size={40} className="mb-3 opacity-30" />
                     <p className="text-sm font-medium">Nenhuma disciplina encontrada</p>
                     <p className="text-xs mt-1">Ajuste os filtros ou o termo de busca</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                     {filteredDiscs.map(disc => (
                        <DisciplineCard
                           key={disc.id}
                           disc={disc}
                           instructor={instructorByTrigram[disc.instructorTrigram || disc.instructor || '']}
                           events={eventsByDisc[disc.id] || []}
                           today={today}
                           isDark={isDark}
                           onViewSchedule={() => setSelectedDisc(disc)}
                        />
                     ))}
                  </div>
               )}
            </div>
         )}

         {/* ══════════════════════════════════════════════════════════════════
             INSTRUCTOR MANAGEMENT PANEL (admin)
         ═══════════════════════════════════════════════════════════════════ */}
         {showInstructorPanel && canEdit && (
            <div className="w-full flex flex-col">
               {/* ─── BULK EDIT ─── */}
               {bulkEditOpen && (
                  <div>
                     <div ref={bulkHeaderRef} className={`sticky z-40 px-4 py-3 border-b flex items-center justify-between backdrop-blur-md ${isDark ? 'bg-slate-950/95 border-amber-900/60' : 'bg-amber-50/95 border-amber-200/60'}`} style={{ top: pageHeaderH }}>
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center"><PenLine size={16} className="text-white" /></div>
                           <div>
                              <h2 className={`text-sm font-semibold ${isDark ? 'text-amber-100' : 'text-slate-800'}`}>Edição em Massa</h2>
                              <p className={`text-xs ${isDark ? 'text-amber-200/70' : 'text-slate-500'}`}>Alterações pendentes até salvar.</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <button onClick={handleBulkDelete} disabled={selectedIds.size === 0 || isSaving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"><Trash2 size={13} /> Excluir</button>
                           {changedCount > 0 && <>
                              <button onClick={discardEdits} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg ${isDark ? 'text-slate-300 bg-slate-800 border-slate-700' : 'text-slate-600 bg-white border-slate-200'}`}><Undo2 size={13} /> Descartar</button>
                              <button onClick={saveBulkEdits} disabled={isSaving} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"><Save size={13} /> {isSaving ? 'Salvando...' : 'Salvar'}</button>
                           </>}
                           <button onClick={() => setBulkEditOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg ml-1"><ChevronUp size={18} /></button>
                        </div>
                     </div>
                     {saveResult && (
                        <div className={`mx-5 mt-3 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium ${saveResult.success === saveResult.total ? 'bg-green-100 dark:bg-green-900/30 text-green-800' : 'bg-red-100 text-red-800'}`}>
                           {saveResult.success === saveResult.total ? <><CheckCircle2 size={16} /> {saveResult.success} atualizados!</> : <><AlertCircle size={16} /> {saveResult.success}/{saveResult.total} salvos.</>}
                        </div>
                     )}
                     <div ref={bulkActionsRef} className={`sticky z-30 px-4 py-3 border-b backdrop-blur-sm ${isDark ? 'bg-slate-950/95 border-amber-900/50' : 'bg-amber-50/95 border-amber-100/50'}`} style={{ top: bulkActionsTop }}>
                        <div className="flex flex-nowrap overflow-x-auto pb-1 gap-6 items-center">
                           {[
                              { id: 'smart-venture', label: 'Vínculo', opts: [['EFETIVO','Efetivo'],['PRESTADOR_TAREFA','PTTC'],['CIVIL','Civil'],['QOCON','QOCon']], field: 'venture' },
                              { id: 'smart-title',   label: 'Titulação', opts: [['GRADUADO','Graduado'],['ESPECIALISTA','Especialista'],['MESTRE','Mestre'],['DOUTOR','Doutor']], field: 'maxTitle' },
                           ].map(({ id, label, opts, field }) => (
                              <div key={id} className="flex-none w-[180px]">
                                 <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">{label}</label>
                                 <div className="flex gap-1">
                                    <select id={id} className={`w-full px-2 py-1.5 text-xs border rounded-lg ${isDark ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white border-slate-200'}`}>
                                       {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </select>
                                    <button onClick={() => { const val = (document.getElementById(id) as HTMLSelectElement).value; const targets = selectedIds.size > 0 ? Array.from(selectedIds) : filteredInstructors.map(i => i.trigram); targets.forEach(t => setBulkField(t, field as any, val)); }} className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold">Ok</button>
                                 </div>
                              </div>
                           ))}
                           <div className="flex-none w-[140px]">
                              <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">CH Semanal</label>
                              <div className="flex gap-1">
                                 <input id="smart-ch" type="number" min="0" max="40" placeholder="h/sem" className={`w-full px-2 py-1.5 text-xs border rounded-lg ${isDark ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white border-slate-200'}`} />
                                 <button onClick={() => { const val = parseInt((document.getElementById('smart-ch') as HTMLInputElement).value) || 0; const targets = selectedIds.size > 0 ? Array.from(selectedIds) : filteredInstructors.map(i => i.trigram); targets.forEach(t => setBulkField(t, 'weeklyLoadLimit', val)); (document.getElementById('smart-ch') as HTMLInputElement).value = ''; }} className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold">Ok</button>
                              </div>
                           </div>
                        </div>
                     </div>
                     <table className="w-full text-sm">
                        <thead>
                           <tr className={`text-[10px] uppercase tracking-wider border-b ${isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-gray-50 text-slate-500 border-slate-100'}`}>
                              <th className={`sticky z-30 text-center py-2 px-3 w-10 ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}><input type="checkbox" onChange={e => handleSelectAll(e.target.checked)} checked={selectedIds.size === filteredInstructors.length && filteredInstructors.length > 0} /></th>
                              {['Tri','Guerra','Posto','Vínculo','Titulação','CH','Especialidade'].map(h => <th key={h} className={`sticky z-30 text-left py-2 px-3 ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}>{h}</th>)}
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100/60 dark:divide-amber-900/30">
                           {filteredInstructors.map(inst => {
                              const isSel = selectedIds.has(inst.trigram);
                              const cellCls = (f: string) => `w-full px-2 py-1 text-sm border rounded transition-colors ${isFieldChanged(inst.trigram, f) ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/40 ring-1 ring-amber-200' : (isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'border-slate-200 bg-white')}`;
                              return (
                                 <tr key={inst.trigram} className={`${isSel ? (isDark ? 'bg-amber-900/20' : 'bg-amber-50') : (isDark ? 'hover:bg-slate-800/30' : 'hover:bg-white/50')}`}>
                                    <td className="px-3 py-1.5 text-center"><input type="checkbox" checked={isSel} onChange={e => handleSelectOne(inst.trigram, e.target.checked)} /></td>
                                    <td className="px-3 py-1.5 font-mono text-blue-500 text-xs">{inst.trigram}</td>
                                    <td className="px-3 py-1.5 text-xs font-medium">{inst.warName}</td>
                                    <td className="px-2 py-1"><input value={getCurrentValue(inst,'rank') as string} onChange={e => setBulkField(inst.trigram,'rank',e.target.value)} className={cellCls('rank')} /></td>
                                    <td className="px-2 py-1"><select value={getCurrentValue(inst,'venture') as string} onChange={e => setBulkField(inst.trigram,'venture',e.target.value)} className={cellCls('venture')}><option value="EFETIVO">Efetivo</option><option value="PRESTADOR_TAREFA">PTTC</option><option value="CIVIL">Civil</option><option value="QOCON">QOCon</option></select></td>
                                    <td className="px-2 py-1"><select value={getCurrentValue(inst,'maxTitle') as string} onChange={e => setBulkField(inst.trigram,'maxTitle',e.target.value)} className={cellCls('maxTitle')}><option value="GRADUADO">Graduado</option><option value="ESPECIALISTA">Especialista</option><option value="MESTRE">Mestre</option><option value="DOUTOR">Doutor</option></select></td>
                                    <td className="px-2 py-1 w-20"><input type="number" min={0} value={getCurrentValue(inst,'weeklyLoadLimit') as number} onChange={e => setBulkField(inst.trigram,'weeklyLoadLimit',parseInt(e.target.value)||0)} className={cellCls('weeklyLoadLimit')} /></td>
                                    <td className="px-2 py-1"><input value={getCurrentValue(inst,'specialty') as string} onChange={e => setBulkField(inst.trigram,'specialty',e.target.value)} className={cellCls('specialty')} /></td>
                                 </tr>
                              );
                           })}
                        </tbody>
                     </table>
                     {changedCount > 0 && (
                        <div className={`sticky bottom-0 px-5 py-3 backdrop-blur-sm border-t flex items-center justify-between ${isDark ? 'bg-amber-900/90 border-amber-800' : 'bg-amber-100/90 border-amber-200'}`}>
                           <span className={`text-sm font-medium ${isDark ? 'text-amber-100' : 'text-amber-800'}`}>{changedCount} alteração{changedCount !== 1 ? 'ões' : ''} pendente{changedCount !== 1 ? 's' : ''}.</span>
                           <div className="flex gap-2">
                              <button onClick={discardEdits} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg ${isDark ? 'text-slate-300 bg-slate-800 border-slate-700' : 'text-slate-600 bg-white border-slate-200'}`}><Undo2 size={13} /> Descartar</button>
                              <button onClick={saveBulkEdits} disabled={isSaving} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"><Save size={13} /> {isSaving ? 'Salvando...' : 'Salvar'}</button>
                           </div>
                        </div>
                     )}
                  </div>
               )}

               {/* ─── NORMAL INSTRUCTOR TABLE ─── */}
               {!bulkEditOpen && (
                  <div>
                     <div ref={toolbarRef} className={`sticky z-40 px-4 md:px-6 py-3 border-b backdrop-blur-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`} style={{ top: pageHeaderH }}>
                        <div className="flex gap-3 items-center mb-2">
                           <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                              <input type="text" placeholder="Buscar docente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                 className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-200 placeholder-slate-400'}`} />
                           </div>
                           <select value={ventureFilter} onChange={e => setVentureFilter(e.target.value as any)} className={filterSelectCls}><option value="ALL">Vínculo: Todos</option><option value="EFETIVO">Efetivo</option><option value="PRESTADOR_TAREFA">PTTC</option><option value="CIVIL">Civil</option><option value="QOCON">QOCon</option></select>
                           <select value={titleFilter} onChange={e => setTitleFilter(e.target.value as any)} className={filterSelectCls}><option value="ALL">Titulação: Todas</option><option value="GRADUADO">Graduado</option><option value="ESPECIALISTA">Especialista</option><option value="MESTRE">Mestre</option><option value="DOUTOR">Doutor</option></select>
                           <button onClick={() => { setBulkEditOpen(true); setSaveResult(null); }} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700 shadow-sm'}`}><PenLine size={13} /> Massa</button>
                           <button onClick={() => { setEditingInstructor(null); setSelectedDisciplines([]); setSelectedClasses([]); setIsInstructorModalOpen(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"><Plus size={15} /> Novo</button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                           {[{label:'Sem Disciplina',cmd:'!disciplina'},{label:'Sem Turma',cmd:'!turma'},{label:'Sem CH',cmd:'!ch'}].map(({label,cmd}) => (
                              <button key={cmd} onClick={() => setSearchTerm(searchTerm === cmd ? '' : cmd)} className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1 ${searchTerm === cmd ? 'bg-amber-500 text-white border-amber-600' : (isDark ? 'bg-slate-800 text-slate-400 border-slate-700 hover:border-amber-500' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300')}`}><Zap size={10} />{label}</button>
                           ))}
                        </div>
                     </div>
                     <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className={`text-xs uppercase tracking-wider border-b ${isDark ? 'bg-slate-900/50 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                              {['Tri','Guerra','Vínculo','Disciplinas','Turmas','CH','Ações'].map((h,i) => (
                                 <th key={h} className={`sticky z-30 px-4 py-3 font-medium ${i===6?'text-right':i===5?'text-center':'text-left'} ${isDark?'bg-slate-900/50':'bg-slate-50'}`} style={{ top: regularTableHeadTop }}>{h}</th>
                              ))}
                           </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-100'}`}>
                           {filteredInstructors.length > 0 ? filteredInstructors.map(instructor => (
                              <tr key={instructor.trigram} className="hover:bg-blue-500/5 transition-colors">
                                 <td className="px-4 py-1.5 font-mono font-bold text-blue-500 text-sm">{instructor.trigram}</td>
                                 <td className="px-4 py-1.5 text-sm font-medium">{instructor.warName}</td>
                                 <td className="px-4 py-1.5">
                                    <Badge variant={instructor.venture === 'EFETIVO' ? 'blue' : instructor.venture === 'QOCON' ? 'purple' : instructor.venture === 'PRESTADOR_TAREFA' ? 'amber' : 'slate'}>
                                       {({ EFETIVO:'Efetivo', PRESTADOR_TAREFA:'PTTC', CIVIL:'Civil', QOCON:'QOCon' } as any)[instructor.venture]}
                                    </Badge>
                                 </td>
                                 <td className="px-4 py-1.5 min-w-[120px]">
                                    <div className="flex flex-wrap gap-1">
                                       {(instructor.enabledDisciplines || []).length > 0 ? instructor.enabledDisciplines?.map(id => { const disc = disciplines.find(d => d.id === id || d.code === id); return disc ? <Badge key={id} variant="slate" title={disc.name}>{disc.code}</Badge> : null; }) : <span className="text-[10px] text-slate-400 italic">Nenhuma</span>}
                                    </div>
                                 </td>
                                 <td className="px-4 py-1.5 min-w-[100px]">
                                    <div className="flex flex-wrap gap-1">
                                       {instructor.enabledClasses?.length === classes.length && classes.length > 0 ? <Badge variant="blue">Todas</Badge> : (instructor.enabledClasses || []).length > 0 ? instructor.enabledClasses?.map(id => { const cls = classes.find(c => c.id === id); return cls ? <Badge key={id} variant="blue">{cls.year}{cls.name}</Badge> : null; }) : <span className="text-[10px] text-slate-400 italic">Nenhuma</span>}
                                    </div>
                                 </td>
                                 <td className="px-4 py-1.5 text-center font-mono text-sm">{instructor.weeklyLoadLimit}h</td>
                                 <td className="px-4 py-1.5 text-right">
                                    <div className="flex justify-end gap-1">
                                       <button onClick={() => { setSelectedInstructorForOccurrence(instructor.trigram); setIsOccurrenceModalOpen(true); }} className="p-1 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded"><History size={14} /></button>
                                       <button onClick={() => { setEditingInstructor(instructor); setSelectedDisciplines(instructor.enabledDisciplines || []); setSelectedClasses(instructor.enabledClasses || []); setIsInstructorModalOpen(true); }} className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"><Edit2 size={14} /></button>
                                       <button onClick={() => { if (confirm(`Excluir ${instructor.warName}?`)) deleteInstructor(instructor.trigram); }} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={14} /></button>
                                    </div>
                                 </td>
                              </tr>
                           )) : (
                              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Nenhum docente encontrado.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               )}
            </div>
         )}

         {/* ─── SCHEDULE MODAL ─── */}
         {selectedDisc && (
            <ScheduleModal
               disc={selectedDisc}
               events={eventsByDisc[selectedDisc.id] || []}
               classMap={classMap}
               instructor={instructorByTrigram[selectedDisc.instructorTrigram || selectedDisc.instructor || '']}
               today={today}
               isDark={isDark}
               onClose={() => setSelectedDisc(null)}
            />
         )}

         {/* ─── INSTRUCTOR MODAL ─── */}
         {isInstructorModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
               <div className={`my-auto w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                  <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                     <h2 className="text-lg font-semibold">{editingInstructor ? 'Editar Docente' : 'Novo Docente'}</h2>
                     <button onClick={() => setIsInstructorModalOpen(false)} className="text-slate-400 hover:text-slate-600"><Plus size={24} className="rotate-45" /></button>
                  </div>
                  <form onSubmit={handleSaveInstructor} className="p-6">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                        <div className="space-y-4">
                           <h3 className="text-xs font-bold uppercase text-blue-500 tracking-widest border-b pb-1">Identificação</h3>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Trigrama *</label><input name="trigram" required maxLength={3} defaultValue={editingInstructor?.trigram} disabled={!!editingInstructor} className={inputCls + ' font-mono uppercase'} placeholder="SLV" /></div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Nome de Guerra *</label><input name="warName" required defaultValue={editingInstructor?.warName} className={inputCls} /></div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Nome Completo</label><input name="fullName" defaultValue={editingInstructor?.fullName} className={inputCls} /></div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Posto / Cargo</label><input name="rank" defaultValue={editingInstructor?.rank} className={inputCls} /></div>
                        </div>
                        <div className="space-y-4">
                           <h3 className="text-xs font-bold uppercase text-blue-500 tracking-widest border-b pb-1">Perfil</h3>
                           <div className="grid grid-cols-2 gap-2">
                              <div><label className="block text-xs font-medium text-slate-500 mb-1">Vínculo</label><select name="venture" defaultValue={editingInstructor?.venture || 'EFETIVO'} className={selectCls}><option value="EFETIVO">Efetivo</option><option value="PRESTADOR_TAREFA">PTTC</option><option value="CIVIL">Civil</option><option value="QOCON">QOCon</option></select></div>
                              <div><label className="block text-xs font-medium text-slate-500 mb-1">Titulação</label><select name="maxTitle" defaultValue={editingInstructor?.maxTitle || 'GRADUADO'} className={selectCls}><option value="GRADUADO">Graduado</option><option value="ESPECIALISTA">Especialista</option><option value="MESTRE">Mestre</option><option value="DOUTOR">Doutor</option></select></div>
                           </div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Especialidade</label><input name="specialty" defaultValue={editingInstructor?.specialty} className={inputCls} /></div>
                           <div className="grid grid-cols-2 gap-2">
                              <div><label className="block text-xs font-medium text-slate-500 mb-1">CH Máx (Semanal)</label><input name="weeklyLoadLimit" type="number" required defaultValue={editingInstructor?.weeklyLoadLimit || 12} className={inputCls} /></div>
                              <div><label className="block text-xs font-medium text-slate-500 mb-1">CPF/SARAM</label><input name="cpf_saram" defaultValue={editingInstructor?.cpf_saram} className={inputCls} /></div>
                           </div>
                        </div>
                        <div className="space-y-4">
                           <h3 className="text-xs font-bold uppercase text-blue-500 tracking-widest border-b pb-1">Vinculação</h3>
                           <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Matérias Habilitadas</label>
                              <div className="relative mb-2"><Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Filtrar..." value={disciplineSearch} onChange={e => setDisciplineSearch(e.target.value)} className={`w-full pl-7 pr-3 py-1 text-xs rounded border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} /></div>
                              <div className={`h-24 overflow-y-auto border rounded p-2 space-y-1 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50'}`}>
                                 {disciplines.filter(d => (d.code?.toLowerCase() || '').includes(disciplineSearch.toLowerCase()) || d.name.toLowerCase().includes(disciplineSearch.toLowerCase())).sort((a, b) => (a.code || '').localeCompare(b.code || '')).map(d => (
                                    <label key={d.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-blue-500/10 p-0.5 rounded">
                                       <input type="checkbox" checked={selectedDisciplines.includes(d.id)} onChange={e => setSelectedDisciplines(p => e.target.checked ? [...p, d.id] : p.filter(id => id !== d.id))} className="rounded text-blue-600" />
                                       <span className="font-mono text-blue-500">{d.code}</span><span className="truncate">{d.name}</span>
                                    </label>
                                 ))}
                              </div>
                           </div>
                           <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Turmas Habilitadas</label>
                              <div className="relative mb-2"><Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Filtrar..." value={classSearch} onChange={e => setClassSearch(e.target.value)} className={`w-full pl-7 pr-3 py-1 text-xs rounded border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} /></div>
                              <div className={`h-24 overflow-y-auto border rounded p-2 space-y-1 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50'}`}>
                                 <label className="flex items-center gap-2 text-xs cursor-pointer border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">
                                    <input type="checkbox" checked={selectedClasses.length === classes.length && classes.length > 0} onChange={e => setSelectedClasses(e.target.checked ? classes.map(c => c.id) : [])} className="rounded text-blue-600" />
                                    <span className="font-bold text-blue-600">Selecionar Todas</span>
                                 </label>
                                 {classes.filter(c => `${c.year} ${c.name} ${c.type}`.toLowerCase().includes(classSearch.toLowerCase())).sort((a, b) => a.year - b.year || a.name.localeCompare(b.name)).map(c => (
                                    <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-blue-500/10 p-0.5 rounded">
                                       <input type="checkbox" checked={selectedClasses.includes(c.id)} onChange={e => setSelectedClasses(p => e.target.checked ? [...p, c.id] : p.filter(id => id !== c.id))} className="rounded text-blue-600" />
                                       <span>{c.year}º Ano - {c.name}</span><span className="text-slate-400 text-[10px]">({c.type})</span>
                                    </label>
                                 ))}
                              </div>
                           </div>
                        </div>
                        <div className="md:col-span-3 grid grid-cols-2 gap-4 border-t pt-4">
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">E-mail</label><input name="email" type="email" defaultValue={editingInstructor?.email} className={inputCls} /></div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Telefone</label><input name="phone" defaultValue={editingInstructor?.phone} className={inputCls} /></div>
                        </div>
                     </div>
                     <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <button type="button" onClick={() => setIsInstructorModalOpen(false)} className={`px-4 py-2 rounded text-sm ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>Cancelar</button>
                        <button type="submit" className="px-8 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700">{editingInstructor ? 'Salvar' : 'Cadastrar'}</button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         {/* ─── OCCURRENCE MODAL ─── */}
         {isOccurrenceModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
               <div className={`w-full max-w-md rounded-xl shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
                  <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'bg-amber-900/10 border-slate-700' : 'bg-amber-50 border-amber-100'}`}>
                     <div className="flex items-center gap-3"><History className="text-amber-500" /><h2 className="font-semibold">Nova Ocorrência</h2></div>
                     <button onClick={() => setIsOccurrenceModalOpen(false)} className="text-slate-400 hover:text-slate-600"><Plus size={24} className="rotate-45" /></button>
                  </div>
                  <form onSubmit={handleSaveOccurrence} className="p-6">
                     <p className="text-xs text-slate-500 mb-4">Docente: <span className="font-bold text-blue-500">{selectedInstructorForOccurrence}</span></p>
                     <div className="space-y-4">
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Data</label><input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={inputCls} /></div>
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label><select name="type" required className={selectCls}><option value="FALTA">Falta</option><option value="ATRASO">Atraso</option><option value="INDISPONIBILIDADE">Indisponibilidade</option></select></div>
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Motivo</label><textarea name="reason" required rows={3} className={inputCls} /></div>
                     </div>
                     <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={() => setIsOccurrenceModalOpen(false)} className={`px-4 py-2 rounded text-sm ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}>Sair</button>
                        <button type="submit" className="px-6 py-2 bg-amber-600 text-white rounded font-semibold hover:bg-amber-700">Gravar</button>
                     </div>
                  </form>
               </div>
            </div>
         )}
      </div>
   );
};
