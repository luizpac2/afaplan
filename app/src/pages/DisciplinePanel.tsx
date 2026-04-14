import { useState, useMemo, useEffect, useRef } from 'react';
import {
   Search, CheckCircle2, BookOpen, Clock, GraduationCap,
   X, TrendingUp, Calendar, ChevronDown, FileText, CalendarCheck,
   Filter, Users,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCourseStore } from '../store/useCourseStore';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import type { Instructor, Discipline, ScheduleEvent, CourseClass } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
   GERAL: 'Geral',
   MILITAR: 'Militar',
   PROFISSIONAL: 'Profissional',
   ATIVIDADES_COMPLEMENTARES: 'Ativ. Complementares',
};
const FIELD_COLORS: Record<string, string> = {
   GERAL:                     'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-700 dark:border-slate-600',
   MILITAR:                   'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
   PROFISSIONAL:              'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800',
   ATIVIDADES_COMPLEMENTARES: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-900/20 dark:border-purple-800',
};
const WEEKDAYS  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
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

// classId format: "1A", "2B", "3C" etc. (squadronNumber + sectionLetter)
const SECTION_TYPE: Record<string, string> = { A: 'Av', B: 'Av', C: 'Av', D: 'Av', E: 'Int', F: 'Inf' };
function clsLabel(_cls: CourseClass | undefined, classId: string) {
   if (/^[1-4][A-F]$/.test(classId)) {
      const esq = classId[0];
      const sec = classId[1];
      return `${esq}º Esq · Turma ${sec} (${SECTION_TYPE[sec] || sec})`;
   }
   if (/^[1-4]ESQ$/.test(classId)) return `${classId[0]}º Esquadrão`;
   return classId; // fallback para "Geral", "GLOBAL", etc.
}

// ─── ICS Generator ───────────────────────────────────────────────────────────
function generateICS(
   disc: Discipline,
   events: ScheduleEvent[],
   classMap: Record<string, CourseClass>,
   instructor: Instructor | undefined,
   filePrefix: string,
) {
   const icsDate = (dateStr: string, time: string) => {
      const [y, m, d] = dateStr.split('-');
      const [h, min] = (time || '08:00').split(':');
      return `${y}${m}${d}T${h}${min}00`;
   };
   const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AFA Planner//PT',
      `X-WR-CALNAME:${disc.code} - ${disc.name}`,
      'X-WR-TIMEZONE:America/Sao_Paulo', 'CALSCALE:GREGORIAN',
   ];
   events.forEach(ev => {
      const cls = classMap[ev.classId];
      const turma = clsLabel(cls, ev.classId);
      const desc = [
         `Disciplina: ${disc.code} - ${disc.name}`,
         `Turma: ${turma}`,
         instructor ? `Docente: ${instructor.rank ? instructor.rank + ' ' : ''}${instructor.warName} (${instructor.trigram})` : '',
         ev.location ? `Local: ${ev.location}` : '',
      ].filter(Boolean).join('\\n');
      lines.push(
         'BEGIN:VEVENT', `UID:${ev.id}@afaplanner`,
         `DTSTAMP:${icsDate(new Date().toISOString().split('T')[0], '00:00')}`,
         `DTSTART:${icsDate(ev.date, ev.startTime || '08:00')}`,
         `DTEND:${icsDate(ev.date, ev.endTime || '10:00')}`,
         `SUMMARY:${disc.code} - ${disc.name} [${turma}]`,
         `DESCRIPTION:${desc}`,
         ev.location ? `LOCATION:${ev.location}` : '',
         'END:VEVENT',
      );
   });
   lines.push('END:VCALENDAR');
   const blob = new Blob([lines.filter(Boolean).join('\r\n')], { type: 'text/calendar;charset=utf-8' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a'); a.href = url; a.download = `${filePrefix}_Programacao.ics`; a.click();
   URL.revokeObjectURL(url);
}

// ─── PDF Generator ────────────────────────────────────────────────────────────
function generatePDF(
   disc: Discipline,
   events: ScheduleEvent[],
   classMap: Record<string, CourseClass>,
   instructor: Instructor | undefined,
   filePrefix: string,
) {
   const doc = new jsPDF();
   doc.setFontSize(14); doc.setFont('helvetica', 'bold');
   doc.text(`${disc.code} — ${disc.name}`, 14, 18);
   doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
   if (instructor) doc.text(`Docente: ${instructor.rank ? instructor.rank + ' ' : ''}${instructor.warName} (${instructor.trigram})`, 14, 25);
   doc.text(`Campo: ${FIELD_LABELS[disc.trainingField] || disc.trainingField}  |  PPC Total: ${getTotalPPC(disc)}h  |  Aulas: ${events.length}`, 14, 31);
   doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 37);
   doc.setTextColor(0);
   const rows = events.map((ev, i) => {
      const [yy, mm, dd] = ev.date.split('-').map(Number);
      const cls = classMap[ev.classId];
      return [
         String(i + 1),
         `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yy}`,
         WEEKDAYS[new Date(yy, mm - 1, dd).getDay()],
         `${ev.startTime || '--'} – ${ev.endTime || '--'}`,
         clsLabel(cls, ev.classId),
         ev.location || '—',
      ];
   });
   autoTable(doc, {
      startY: 43,
      head: [['#', 'Data', 'Dia', 'Horário', 'Turma', 'Local']],
      body: rows, theme: 'striped', headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 22 }, 2: { cellWidth: 12 }, 3: { cellWidth: 26 }, 4: { cellWidth: 60 } },
   });
   doc.save(`${filePrefix}_Programacao.pdf`);
}

// ─── PDF for all classes of an instructor ────────────────────────────────────
function generateInstructorPDF(
   instructor: Instructor,
   discsWithEvents: { disc: Discipline; events: ScheduleEvent[] }[],
   classMap: Record<string, CourseClass>,
) {
   const doc = new jsPDF();
   doc.setFontSize(14); doc.setFont('helvetica', 'bold');
   doc.text(`Programação — ${instructor.rank ? instructor.rank + ' ' : ''}${instructor.warName} (${instructor.trigram})`, 14, 18);
   doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
   doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 25);
   doc.setTextColor(0);

   let rows: string[][] = [];
   for (const { disc, events } of discsWithEvents) {
      for (const ev of events) {
         const [yy, mm, dd] = ev.date.split('-').map(Number);
         const cls = classMap[ev.classId];
         rows.push([
            `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yy}`,
            WEEKDAYS[new Date(yy, mm - 1, dd).getDay()],
            `${ev.startTime || '--'} – ${ev.endTime || '--'}`,
            `${disc.code}`,
            clsLabel(cls, ev.classId),
            ev.location || '—',
         ]);
      }
   }
   rows.sort((a, b) => a[0].localeCompare(b[0]));

   autoTable(doc, {
      startY: 31,
      head: [['Data', 'Dia', 'Horário', 'Disciplina', 'Turma', 'Local']],
      body: rows, theme: 'striped', headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 12 }, 2: { cellWidth: 26 }, 3: { cellWidth: 20 }, 4: { cellWidth: 55 } },
   });
   doc.save(`${instructor.trigram}_TodasAulas.pdf`);
}

function generateInstructorICS(
   instructor: Instructor,
   discsWithEvents: { disc: Discipline; events: ScheduleEvent[] }[],
   classMap: Record<string, CourseClass>,
) {
   const icsDate = (dateStr: string, time: string) => {
      const [y, m, d] = dateStr.split('-');
      const [h, min] = (time || '08:00').split(':');
      return `${y}${m}${d}T${h}${min}00`;
   };
   const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AFA Planner//PT',
      `X-WR-CALNAME:Aulas — ${instructor.warName}`,
      'X-WR-TIMEZONE:America/Sao_Paulo', 'CALSCALE:GREGORIAN',
   ];
   for (const { disc, events } of discsWithEvents) {
      events.forEach(ev => {
         const cls = classMap[ev.classId];
         const turma = clsLabel(cls, ev.classId);
         const desc = [
            `Disciplina: ${disc.code} - ${disc.name}`,
            `Turma: ${turma}`,
            `Docente: ${instructor.rank ? instructor.rank + ' ' : ''}${instructor.warName} (${instructor.trigram})`,
            ev.location ? `Local: ${ev.location}` : '',
         ].filter(Boolean).join('\\n');
         lines.push(
            'BEGIN:VEVENT', `UID:${ev.id}@afaplanner`,
            `DTSTAMP:${icsDate(new Date().toISOString().split('T')[0], '00:00')}`,
            `DTSTART:${icsDate(ev.date, ev.startTime || '08:00')}`,
            `DTEND:${icsDate(ev.date, ev.endTime || '10:00')}`,
            `SUMMARY:${disc.code} [${turma}]`,
            `DESCRIPTION:${desc}`,
            ev.location ? `LOCATION:${ev.location}` : '',
            'END:VEVENT',
         );
      });
   }
   lines.push('END:VCALENDAR');
   const blob = new Blob([lines.filter(Boolean).join('\r\n')], { type: 'text/calendar;charset=utf-8' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a'); a.href = url; a.download = `${instructor.trigram}_TodasAulas.ics`; a.click();
   URL.revokeObjectURL(url);
}

// ─── Schedule Modal ───────────────────────────────────────────────────────────
function ScheduleModal({ disc, events, classMap, instructor, today, isDark, onClose }: {
   disc: Discipline; events: ScheduleEvent[]; classMap: Record<string, CourseClass>;
   instructor: Instructor | undefined; today: string; isDark: boolean; onClose: () => void;
}) {
   const completed = events.filter(e => e.date < today);
   const upcoming  = events.filter(e => e.date >= today);
   const [showAll, setShowAll] = useState(false);
   const displayUpcoming = showAll ? upcoming : upcoming.slice(0, 15);
   const filePrefix = disc.code.replace(/\//g, '-');

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
         <div className={`w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`px-5 py-4 border-b flex items-start justify-between ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
               <div>
                  <div className="flex items-center gap-2 mb-0.5">
                     <span className="font-mono text-sm font-bold text-blue-500">{disc.code}</span>
                     <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${FIELD_COLORS[disc.trainingField] || FIELD_COLORS.GERAL}`}>{FIELD_LABELS[disc.trainingField] || disc.trainingField}</span>
                  </div>
                  <h2 className="text-base font-semibold">{disc.name}</h2>
                  {instructor && (
                     <p className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono font-bold text-blue-500">{instructor.trigram}</span> — {instructor.rank ? `${instructor.rank} ` : ''}{instructor.warName}
                     </p>
                  )}
               </div>
               <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => generatePDF(disc, events, classMap, instructor, filePrefix)} disabled={events.length === 0} title="Baixar PDF"
                     className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20 disabled:opacity-40">
                     <FileText size={13} /> PDF
                  </button>
                  <button onClick={() => generateICS(disc, events, classMap, instructor, filePrefix)} disabled={events.length === 0} title="Exportar para Google Agenda / iCal"
                     className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20 disabled:opacity-40">
                     <CalendarCheck size={13} /> .ICS
                  </button>
                  <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X size={18} /></button>
               </div>
            </div>
            {/* Stats */}
            <div className={`px-5 py-2.5 flex gap-6 text-xs border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
               <span><span className="font-bold">{events.length}</span> <span className="text-slate-400">total</span></span>
               <span><span className="font-bold text-green-500">{completed.length}</span> <span className="text-slate-400">realizadas</span></span>
               <span><span className="font-bold text-blue-500">{upcoming.length}</span> <span className="text-slate-400">próximas</span></span>
               <span className="text-slate-400">PPC: <span className="font-bold">{getTotalPPC(disc)}h</span></span>
               {getTotalPPC(disc) > 0 && <span className="text-slate-400">Cumprimento: <span className="font-bold text-blue-500">{Math.min(100, Math.round((events.length / getTotalPPC(disc)) * 100))}%</span></span>}
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
                     {upcoming.length > 0 && (
                        <div>
                           <div className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-blue-400 bg-blue-900/10' : 'text-blue-600 bg-blue-50/60'}`}>Próximas aulas ({upcoming.length})</div>
                           {displayUpcoming.map((ev, i) => {
                              const cls = classMap[ev.classId];
                              const [yy, mm, dd] = ev.date.split('-').map(Number);
                              const isNext = i === 0;
                              return (
                                 <div key={ev.id} className={`px-5 py-3 flex items-center gap-4 ${isNext ? (isDark ? 'bg-blue-900/10' : 'bg-blue-50/40') : ''} hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors`}>
                                    <div className={`shrink-0 w-12 text-center rounded-lg py-1 ${isNext ? 'bg-blue-600 text-white' : (isDark ? 'bg-slate-700' : 'bg-slate-100')}`}>
                                       <div className={`text-[10px] font-bold uppercase ${isNext ? 'text-blue-200' : 'text-slate-400'}`}>{MONTHS_PT[mm - 1]}</div>
                                       <div className={`text-lg font-bold leading-none ${isNext ? 'text-white' : (isDark ? 'text-slate-100' : 'text-slate-700')}`}>{dd}</div>
                                       <div className={`text-[9px] ${isNext ? 'text-blue-200' : 'text-slate-400'}`}>{WEEKDAYS[new Date(yy, mm - 1, dd).getDay()]}</div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                       <div className="flex items-center gap-2 flex-wrap">
                                          {cls && <span className={`text-xs font-medium px-2 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'}`}>{cls.year}º Ano · Turma {cls.name}</span>}
                                          {isNext && <span className="text-[10px] font-bold text-blue-500 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">Próxima</span>}
                                       </div>
                                       <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                          {(ev.startTime || ev.endTime) && <span className="flex items-center gap-1"><Clock size={10} /> {ev.startTime || '--'}–{ev.endTime || '--'}</span>}
                                          {ev.location && <span className="truncate">{ev.location}</span>}
                                       </div>
                                    </div>
                                 </div>
                              );
                           })}
                           {upcoming.length > 15 && !showAll && (
                              <button onClick={() => setShowAll(true)} className={`w-full py-2.5 text-xs font-medium text-blue-500 hover:text-blue-700 flex items-center justify-center gap-1 ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                                 <ChevronDown size={13} /> Ver mais {upcoming.length - 15} aulas
                              </button>
                           )}
                        </div>
                     )}
                     {completed.length > 0 && (
                        <div>
                           <div className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-green-400 bg-green-900/10' : 'text-green-600 bg-green-50/60'}`}>Realizadas ({completed.length})</div>
                           {[...completed].reverse().slice(0, 5).map(ev => {
                              const cls = classMap[ev.classId];
                              const [yy, mm, dd] = ev.date.split('-').map(Number);
                              return (
                                 <div key={ev.id} className="px-5 py-2.5 flex items-center gap-4 opacity-60 hover:opacity-100 transition-opacity">
                                    <div className={`shrink-0 w-12 text-center rounded-lg py-1 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                       <div className="text-[10px] font-bold uppercase text-slate-400">{MONTHS_PT[mm - 1]}</div>
                                       <div className={`text-lg font-bold leading-none ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{dd}</div>
                                       <div className="text-[9px] text-slate-400">{WEEKDAYS[new Date(yy, mm - 1, dd).getDay()]}</div>
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
                           {completed.length > 5 && <p className="px-5 py-2 text-xs text-slate-400 italic">... e mais {completed.length - 5} aulas realizadas</p>}
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
function DisciplineCard({ disc, instructor, events, today, isDark, onViewSchedule }: {
   disc: Discipline; instructor: Instructor | undefined; events: ScheduleEvent[];
   today: string; isDark: boolean; onViewSchedule: () => void;
}) {
   const scheduled = events.length;
   const completed = events.filter(e => e.date < today).length;
   const remaining = events.filter(e => e.date >= today).length;
   const ppcTotal  = getTotalPPC(disc);
   const pct = ppcTotal > 0 ? Math.min(100, Math.round((scheduled / ppcTotal) * 100)) : 0;
   const nextClass = events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
   const fieldColor = FIELD_COLORS[disc.trainingField] || FIELD_COLORS.GERAL;

   return (
      <div className={`rounded-xl border shadow-sm flex flex-col overflow-hidden hover:shadow-md transition-shadow ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
         <div className={`h-1 ${pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
         <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
               <span className="font-mono text-xs font-bold text-blue-500">{disc.code}</span>
               <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${fieldColor}`}>{FIELD_LABELS[disc.trainingField] || disc.trainingField}</span>
            </div>
            <p className={`text-sm font-semibold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{disc.name}</p>
         </div>
         <div className={`px-4 py-1.5 flex items-center gap-2 border-t border-b ${isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-100 bg-slate-50/60'}`}>
            <GraduationCap size={11} className="text-slate-400 shrink-0" />
            {instructor ? (
               <span className="text-xs truncate">
                  <span className="font-mono font-bold text-blue-500">{instructor.trigram}</span>
                  <span className={isDark ? ' text-slate-300' : ' text-slate-600'}> — {instructor.warName}</span>
                  {instructor.rank && <span className="text-slate-400"> · {instructor.rank}</span>}
               </span>
            ) : <span className="text-xs text-slate-400 italic">Sem docente atribuído</span>}
         </div>
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
         {nextClass && (
            <div className={`px-4 py-1.5 border-t text-[11px] flex items-center gap-1.5 ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
               <Calendar size={10} className="text-blue-400 shrink-0" />
               <span>Próxima: <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fmtDate(nextClass.date)}</span></span>
            </div>
         )}
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
         <button onClick={onViewSchedule} disabled={scheduled === 0}
            className={`mx-4 mb-4 mt-2 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${scheduled > 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : (isDark ? 'bg-slate-700 text-slate-500 cursor-default' : 'bg-slate-100 text-slate-400 cursor-default')}`}>
            <Calendar size={12} />
            {scheduled > 0 ? `Ver programação (${scheduled} aulas)` : 'Sem aulas agendadas'}
         </button>
      </div>
   );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export const DisciplinePanel = () => {
   const headerRef = useRef<HTMLDivElement>(null);
   const [headerH, setHeaderH] = useState(56);

   const { disciplines, instructors, yearEventsCache, fetchYearlyEvents } = useCourseStore();
   const { theme } = useTheme();
   const { userProfile } = useAuth();
   const isDark = theme === 'dark';
   const isDocente = userProfile?.role === 'DOCENTE';

   const [selectedDisc, setSelectedDisc] = useState<Discipline | null>(null);
   const [discSearch, setDiscSearch]     = useState('');
   const [fieldFilter, setFieldFilter]   = useState('ALL');
   const [courseFilter, setCourseFilter] = useState('ALL');
   const [yearFilter, setYearFilter]     = useState('ALL');
   const [instrFilter, setInstrFilter]   = useState('ALL');
   const [classFilter, setClassFilter]   = useState('ALL');
   const [statusFilter, setStatusFilter] = useState('ALL');
   const [showFilters, setShowFilters]   = useState(false);

   useEffect(() => {
      const obs = new ResizeObserver(entries => {
         for (const e of entries) {
            const h = Math.ceil(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height);
            if (e.target === headerRef.current) setHeaderH(h);
         }
      });
      if (headerRef.current) obs.observe(headerRef.current);
      return () => obs.disconnect();
   }, []);

   useEffect(() => {
      const year = new Date().getFullYear();
      if (!yearEventsCache[year]) fetchYearlyEvents(year);
   }, []);

   const today = new Date().toISOString().split('T')[0];

   const allEvents: ScheduleEvent[] = useMemo(
      () => Object.values(yearEventsCache).flat().filter(e => e.disciplineId && e.disciplineId !== 'ACADEMIC'),
      [yearEventsCache],
   );

   // Events grouped by discipline, optionally filtered by classFilter
   const eventsByDisc = useMemo(() => {
      const map: Record<string, ScheduleEvent[]> = {};
      for (const ev of allEvents) {
         if (classFilter !== 'ALL' && ev.classId !== classFilter) continue;
         if (!map[ev.disciplineId]) map[ev.disciplineId] = [];
         map[ev.disciplineId].push(ev);
      }
      for (const id of Object.keys(map)) map[id].sort((a, b) => a.date.localeCompare(b.date));
      return map;
   }, [allEvents, classFilter]);

   // Full events by disc (unfiltered by class) for modal
   const allEventsByDisc = useMemo(() => {
      const map: Record<string, ScheduleEvent[]> = {};
      for (const ev of allEvents) {
         if (!map[ev.disciplineId]) map[ev.disciplineId] = [];
         map[ev.disciplineId].push(ev);
      }
      for (const id of Object.keys(map)) map[id].sort((a, b) => a.date.localeCompare(b.date));
      return map;
   }, [allEvents]);

   // classMap is kept for function signatures but lookups use clsLabel(undefined, ev.classId)
   const classMap: Record<string, CourseClass> = {};

   const instructorByTrigram = useMemo(() => {
      const m: Record<string, Instructor> = {};
      for (const i of instructors) m[i.trigram] = i;
      return m;
   }, [instructors]);

   // Secondary lookup by warName for disciplines that store instructor name instead of trigram
   const instructorByWarName = useMemo(() => {
      const m: Record<string, Instructor> = {};
      for (const i of instructors) if (i.warName) m[i.warName] = i;
      return m;
   }, [instructors]);

   const resolveInstructor = (disc: Discipline): Instructor | undefined =>
      instructorByTrigram[disc.instructorTrigram || ''] ||
      instructorByWarName[disc.instructor || ''] ||
      undefined;

   const myInstructor = useMemo(() => {
      if (!isDocente || !userProfile) return null;
      return instructors.find(i => i.email === userProfile.email) || null;
   }, [isDocente, userProfile, instructors]);

   // Auto-set instrFilter for DOCENTE role
   useEffect(() => {
      if (isDocente && myInstructor && instrFilter === 'ALL') {
         setInstrFilter(myInstructor.trigram);
      }
   }, [isDocente, myInstructor]);

   const filteredDiscs = useMemo(() => {
      const q = discSearch.toLowerCase();
      return [...disciplines].filter(d => {
         // Docente role: only show disciplines they are assigned to
         if (isDocente && myInstructor) {
            const tri = d.instructorTrigram || (instructorByWarName[d.instructor || '']?.trigram);
            if (tri !== myInstructor.trigram) return false;
         }
         if (instrFilter !== 'ALL') {
            const tri = d.instructorTrigram || (instructorByWarName[d.instructor || '']?.trigram);
            if (tri !== instrFilter) return false;
         }
         if (fieldFilter !== 'ALL' && d.trainingField !== fieldFilter) return false;
         if (courseFilter !== 'ALL' && !d.enabledCourses?.includes(courseFilter as any)) return false;
         if (yearFilter !== 'ALL' && !d.enabledYears?.includes(Number(yearFilter) as any)) return false;
         const evs = eventsByDisc[d.id] || [];
         // Quando turma selecionada, oculta disciplinas sem aulas naquela turma
         if (classFilter !== 'ALL' && evs.length === 0) return false;
         if (statusFilter === 'HAS_EVENTS'     && evs.length === 0) return false;
         if (statusFilter === 'NO_EVENTS'      && evs.length > 0)  return false;
         if (statusFilter === 'IN_PROGRESS') { const comp = evs.filter(e => e.date < today).length; if (comp === 0 || comp >= evs.length) return false; }
         if (statusFilter === 'UPCOMING_ONLY'  && evs.filter(e => e.date >= today).length === 0) return false;
         if (statusFilter === 'DONE') { const ppc = getTotalPPC(d); if (ppc === 0 || evs.length < ppc) return false; }
         if (q) return d.name.toLowerCase().includes(q) || (d.code || '').toLowerCase().includes(q) || (FIELD_LABELS[d.trainingField] || '').toLowerCase().includes(q);
         return true;
      }).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
   }, [disciplines, discSearch, fieldFilter, courseFilter, yearFilter, instrFilter, classFilter, statusFilter, eventsByDisc, today, isDocente, myInstructor, instructors, instructorByWarName]);

   const totalScheduled = useMemo(() => filteredDiscs.reduce((s, d) => s + (eventsByDisc[d.id]?.length || 0), 0), [filteredDiscs, eventsByDisc]);
   const totalCompleted = useMemo(() => filteredDiscs.reduce((s, d) => s + (eventsByDisc[d.id]?.filter(e => e.date < today).length || 0), 0), [filteredDiscs, eventsByDisc, today]);
   const totalPPC       = useMemo(() => filteredDiscs.reduce((s, d) => s + getTotalPPC(d), 0), [filteredDiscs]);
   const hasActiveFilters = fieldFilter !== 'ALL' || courseFilter !== 'ALL' || yearFilter !== 'ALL' || instrFilter !== 'ALL' || classFilter !== 'ALL' || statusFilter !== 'ALL';

   // Selected instructor (for bulk download)
   const selectedInstructor = instrFilter !== 'ALL' ? instructorByTrigram[instrFilter] : undefined;
   const instrDiscsWithEvents = useMemo(() => {
      if (!selectedInstructor) return [];
      return filteredDiscs
         .map(d => ({ disc: d, events: allEventsByDisc[d.id] || [] }))
         .filter(x => x.events.length > 0);
   }, [selectedInstructor, filteredDiscs, allEventsByDisc]);

   const filterSelectCls = `px-3 py-2 rounded-lg border text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'}`;

   // Deriva turmas de aula reais dos eventos (formato "1A", "2B", "3C" etc.)
   // Filtra fora valores especiais como "Geral", "GLOBAL", "*ESQ"
   const availableClassIds = useMemo(() => {
      const SECTION_PATTERN = /^[1-4][A-F]$/;
      const seen = new Set<string>();
      for (const ev of allEvents) {
         if (ev.classId && SECTION_PATTERN.test(ev.classId)) seen.add(ev.classId);
      }
      return [...seen].sort((a, b) => {
         const [sa, la] = [Number(a[0]), a[1]];
         const [sb, lb] = [Number(b[0]), b[1]];
         return sa !== sb ? sa - sb : la.localeCompare(lb);
      });
   }, [allEvents]);

   return (
      <div className={`w-full min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-slate-900'}`}>

         {/* Header */}
         <div ref={headerRef} className={`sticky top-0 z-50 px-4 md:px-6 border-b backdrop-blur-md ${isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
            <div className="flex items-center justify-between gap-4 py-2.5 flex-wrap">
               <div className="flex items-center gap-3">
                  <h1 className="text-lg font-bold tracking-tight">Painel de Disciplinas</h1>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{filteredDiscs.length} disciplinas</span>
               </div>
               <div className="flex items-center gap-2">
                  {/* Docente quick selector */}
                  {!isDocente && (
                     <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-slate-400 shrink-0" />
                        <select value={instrFilter} onChange={e => setInstrFilter(e.target.value)}
                           className={`pr-7 py-1.5 pl-2 rounded-lg border text-sm outline-none ${instrFilter !== 'ALL' ? (isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-300') : (isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700')}`}>
                           <option value="ALL">Todos os docentes</option>
                           {[...instructors].sort((a, b) => a.warName.localeCompare(b.warName)).map(i => (
                              <option key={i.trigram} value={i.trigram}>{i.trigram} — {i.warName}</option>
                           ))}
                        </select>
                     </div>
                  )}
                  {/* Bulk download when instructor selected */}
                  {selectedInstructor && instrDiscsWithEvents.length > 0 && (
                     <>
                        <button onClick={() => generateInstructorPDF(selectedInstructor, instrDiscsWithEvents, classMap)}
                           className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20">
                           <FileText size={13} /> PDF Geral
                        </button>
                        <button onClick={() => generateInstructorICS(selectedInstructor, instrDiscsWithEvents, classMap)}
                           className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20">
                           <CalendarCheck size={13} /> ICS Geral
                        </button>
                     </>
                  )}
                  <button onClick={() => setShowFilters(v => !v)}
                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${showFilters || hasActiveFilters ? (isDark ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-blue-50 text-blue-600 border-blue-200') : (isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600 shadow-sm')}`}>
                     <Filter size={13} /> Filtros
                     {hasActiveFilters && <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center font-bold">!</span>}
                  </button>
               </div>
            </div>
         </div>

         {/* Toolbar */}
         <div className={`sticky z-40 px-4 md:px-6 py-3 border-b backdrop-blur-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`} style={{ top: headerH }}>
            {/* Search + Turma filter (always visible) */}
            <div className="flex gap-2 items-center mb-2">
               <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input type="text" placeholder="Buscar por nome, código ou campo..."
                     value={discSearch} onChange={e => setDiscSearch(e.target.value)}
                     className={`w-full pl-9 pr-8 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-200 placeholder-slate-400'}`} />
                  {discSearch && <button onClick={() => setDiscSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
               </div>
               {/* Turma de aula — sempre visível */}
               <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
                  className={`shrink-0 py-2 pl-3 pr-8 rounded-lg border text-sm outline-none ${classFilter !== 'ALL' ? (isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-300') : (isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700')}`}>
                  <option value="ALL">Todas as turmas</option>
                  {availableClassIds.map(cid => (
                     <option key={cid} value={cid}>{cid[0]}º Esq · Turma {cid[1]}</option>
                  ))}
               </select>
            </div>

            {/* Expanded filters (secondary) */}
            {showFilters && (
               <div className={`rounded-lg border p-3 mb-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
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
                  <div className="flex items-end">
                     <button onClick={() => { setFieldFilter('ALL'); setCourseFilter('ALL'); setYearFilter('ALL'); setInstrFilter('ALL'); setClassFilter('ALL'); setStatusFilter('ALL'); }}
                        className="w-full py-2 px-3 rounded-lg text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
                        Limpar filtros
                     </button>
                  </div>
               </div>
            )}

            {/* Summary */}
            <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
               <span><strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{filteredDiscs.length}</strong> disciplinas</span>
               <span>·</span>
               <span className="flex items-center gap-1"><Calendar size={10} /> <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{totalScheduled}</strong> agendadas</span>
               <span className="flex items-center gap-1 text-green-500"><CheckCircle2 size={10} /> <strong>{totalCompleted}</strong> realizadas</span>
               <span className="flex items-center gap-1 text-blue-500"><Clock size={10} /> <strong>{totalScheduled - totalCompleted}</strong> restantes</span>
               {totalPPC > 0 && <span className="flex items-center gap-1"><TrendingUp size={10} /> <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{Math.round((totalScheduled / totalPPC) * 100)}%</strong> do PPC ({totalPPC}h)</span>}
               {classFilter !== 'ALL' && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${isDark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                     {clsLabel(undefined, classFilter)}
                  </span>
               )}
            </div>
         </div>

         {/* Cards */}
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
                        key={disc.id} disc={disc}
                        instructor={resolveInstructor(disc)}
                        events={eventsByDisc[disc.id] || []}
                        today={today} isDark={isDark}
                        onViewSchedule={() => setSelectedDisc(disc)}
                     />
                  ))}
               </div>
            )}
         </div>

         {/* Schedule modal — shows events filtered by classFilter */}
         {selectedDisc && (
            <ScheduleModal
               disc={selectedDisc}
               events={classFilter !== 'ALL'
                  ? (allEventsByDisc[selectedDisc.id] || []).filter(e => e.classId === classFilter)
                  : (allEventsByDisc[selectedDisc.id] || [])}
               classMap={classMap}
               instructor={resolveInstructor(selectedDisc)}
               today={today} isDark={isDark}
               onClose={() => setSelectedDisc(null)}
            />
         )}
      </div>
   );
};
