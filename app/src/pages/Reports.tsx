import { useState, useEffect, useMemo } from 'react';
import { formatClassId } from '../utils/formatters';
import { useCourseStore } from '../store/useCourseStore';
import { useTheme } from '../contexts/ThemeContext';
import { Printer, User, BookOpen, Loader2 } from 'lucide-react';
import type { CourseYear, ScheduleEvent } from '../types';

type ReportType = 'CURRICULUM' | 'INSTRUCTOR';

export const Reports = () => {
    const { disciplines, semesterConfigs, fetchYearlyEvents, yearEventsCache } = useCourseStore();
    const { theme } = useTheme();
    const [reportType, setReportType] = useState<ReportType>('CURRICULUM');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedSemester, setSelectedSemester] = useState<'ALL' | 1 | 2>('ALL');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        fetchYearlyEvents(selectedYear).finally(() => setIsLoading(false));
    }, [selectedYear, fetchYearlyEvents]);

    const reportEvents = useMemo(() => yearEventsCache[selectedYear] || [], [yearEventsCache, selectedYear]);

    // Filter events by semester - Memoized for performance
    const filteredEvents = useMemo(() => {
        if (!reportEvents) return [];
        if (selectedSemester === 'ALL') return reportEvents;

        const config = semesterConfigs.find(c => c.year === selectedYear);
        if (!config) return reportEvents;

        const s1S = config.s1Start ? new Date(config.s1Start + 'T00:00:00') : null;
        const s1E = config.s1End ? new Date(config.s1End + 'T23:59:59') : null;
        const s2S = config.s2Start ? new Date(config.s2Start + 'T00:00:00') : null;
        const s2E = config.s2End ? new Date(config.s2End + 'T23:59:59') : null;

        const start = selectedSemester === 1 ? s1S : s2S;
        const end = selectedSemester === 1 ? s1E : s2E;

        if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return reportEvents;

        return reportEvents.filter(e => {
            if (!e.date) return false;
            // Usamos T12:00:00 para evitar problemas de fuso horário local
            const eventTime = new Date(e.date + 'T12:00:00');
            return !isNaN(eventTime.getTime()) && eventTime >= start && eventTime <= end;
        });
    }, [reportEvents, selectedSemester, semesterConfigs, selectedYear]);

    const handlePrint = () => {
        window.print();
    };

    // --- CURRICULUM LOGIC ---
    const disciplinesByYear = useMemo(() => {
        return [1, 2, 3, 4].map(year => ({
            year: year as CourseYear,
            items: disciplines.filter(d => {
                const matchesYear = d.year === year;
                const matchesSemester = selectedSemester === 'ALL' || d.scheduling_criteria?.semester === selectedSemester;
                return matchesYear && matchesSemester;
            })
        }));
    }, [disciplines, selectedSemester]);

    interface Conflict {
        date: string;
        event1: ScheduleEvent & { name?: string };
        event2: ScheduleEvent & { name?: string };
    }

    // Conflict Detection Logic - Memoized O(N log N + N) approach
    const conflicts = useMemo(() => {
        const results: Conflict[] = [];
        const eventsForConflicts = filteredEvents.reduce((acc, event) => {
            if (!event.date) return acc;
            if (!acc[event.date]) acc[event.date] = [];
            acc[event.date].push(event);
            return acc;
        }, {} as Record<string, ScheduleEvent[]>);

        // Pre-create discipline map for O(1) lookup
        const discMap = new Map(disciplines.map(d => [d.id, d]));

        for (const date in eventsForConflicts) {
            const dayEvents = [...eventsForConflicts[date]].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
            for (let i = 0; i < dayEvents.length - 1; i++) {
                const current = dayEvents[i];
                const next = dayEvents[i + 1];

                // Check overlap if current ends after next starts
                if (current.endTime && next.startTime && current.endTime > next.startTime) {
                    const d1 = discMap.get(current.disciplineId);
                    const d2 = discMap.get(next.disciplineId);
                    results.push({
                        date,
                        event1: { name: d1?.name, ...current },
                        event2: { name: d2?.name, ...next }
                    });
                }
            }
        }
        return results;
    }, [filteredEvents, disciplines]);

    // Optimized Instructor Data calculation - Memoized and with O(1) lookups
    const instructorsData = useMemo(() => {
        if (reportType !== 'INSTRUCTOR') return [];

        const uniqueInstructors = Array.from(new Set(disciplines.map(d => d.instructor).filter(Boolean))) as string[];
        const todayStr = new Date().toISOString().split('T')[0];

        // Create map for O(1) discipline lookups
        const discMap = new Map(disciplines.map(d => [d.id, d]));

        return uniqueInstructors.map(instructor => {
            const instructorEvents = filteredEvents.filter(e => {
                const discipline = discMap.get(e.disciplineId);
                if (!discipline || discipline.instructor !== instructor) return false;
                if (!e.date) return false;
                const [dateYear] = e.date.split('-');
                return Number(dateYear) === selectedYear;
            }).sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return (a.startTime || '').localeCompare(b.startTime || '');
            });

            const given = instructorEvents.filter(e => e.date < todayStr).length;
            const remaining = instructorEvents.filter(e => e.date >= todayStr).length;

            return {
                name: instructor,
                events: instructorEvents,
                given,
                remaining,
                total: instructorEvents.length
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [disciplines, filteredEvents, selectedYear, reportType]);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header with Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 no-print">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>Relatórios</h1>
                        {isLoading && (
                            <div className="flex items-center justify-center p-1.5 bg-blue-500/10 rounded-xl animate-pulse">
                                <Loader2 className="animate-spin text-blue-500" size={20} />
                            </div>
                        )}
                    </div>
                    <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Resumos e cronogramas para impressão</p>
                </div>

                <div className="flex gap-4 items-center">
                    {/* Tabs */}
                    <div className={`flex p-1 rounded-lg border ${theme === 'dark' ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-200'}`}>
                        <button
                            onClick={() => setReportType('CURRICULUM')}
                            className={`px-4 py-2 rounded-md text-sm  transition-all flex items-center gap-2 ${reportType === 'CURRICULUM'
                                ? (theme === 'dark' ? 'bg-slate-600 shadow-sm text-blue-300 ' : 'bg-white shadow-sm text-blue-700 ')
                                : (theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}
                        >
                            <BookOpen size={16} />
                            Plano Curricular
                        </button>
                        <button
                            onClick={() => setReportType('INSTRUCTOR')}
                            className={`px-4 py-2 rounded-md text-sm  transition-all flex items-center gap-2 ${reportType === 'INSTRUCTOR'
                                ? (theme === 'dark' ? 'bg-slate-600 shadow-sm text-blue-300 ' : 'bg-white shadow-sm text-blue-700 ')
                                : (theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}
                        >
                            <User size={16} />
                            Por Professor
                        </button>
                    </div>

                    <div className="flex items-center gap-2 no-print">
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className={`border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <select
                            value={selectedSemester}
                            onChange={(e) => setSelectedSemester(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value) as 1 | 2)}
                            className={`border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
                        >
                            <option value="ALL">Ano Inteiro</option>
                            <option value="1">1º Semestre</option>
                            <option value="2">2º Semestre</option>
                        </select>
                    </div>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-all shadow-sm hover:shadow-md "
                    >
                        <Printer size={20} />
                        Imprimir
                    </button>
                </div>
            </div>

            {/* Content Switch */}
            {reportType === 'CURRICULUM' ? (
                <div className={`rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border p-10 print:shadow-none print:border-none print:p-0 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                    <div className="mb-10 text-center hidden print:block">
                        <h1 className="text-3xl  text-gray-900 mb-2">Plano de Curso AFA</h1>
                        <p className="text-gray-500">Resumo Curricular</p>
                    </div>

                    {disciplinesByYear.map(({ year, items }) => (
                        items.length > 0 && (
                            <div key={year} className="mb-10 break-inside-avoid">
                                <h2 className={`text-xl  border-b-2 mb-6 pb-2 uppercase tracking-wide ${theme === 'dark' ? 'text-blue-400 border-blue-400' : 'text-blue-900 border-blue-900'}`}>
                                    {year}º Esquadrão
                                </h2>
                                <div className={`overflow-hidden rounded-lg border ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
                                    <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-gray-200'}`}>
                                        <thead className={theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-50'}>
                                            <tr>
                                                <th className={`px-6 py-3 text-left text-xs  uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Disciplina</th>
                                                <th className={`px-6 py-3 text-left text-xs  uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Instrutor</th>
                                                <th className={`px-6 py-3 text-right text-xs  uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Carga (h)</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700 bg-slate-800' : 'divide-gray-200 bg-white'}`}>
                                            {items.map(d => {
                                                const getMaxPpcLoad = (disc: any) => {
                                                    if (disc.ppcLoads && Object.keys(disc.ppcLoads).length > 0) {
                                                        return Math.max(...Object.values(disc.ppcLoads) as number[]);
                                                    }
                                                    return disc.load_hours || 0;
                                                };
                                                return (
                                                <tr key={d.id}>
                                                    <td className={`px-6 py-4 text-sm  ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>{d.name}</td>
                                                    <td className={`px-6 py-4 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{d.instructor || '-'}</td>
                                                    <td className={`px-6 py-4 text-sm text-right font-mono ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>{getMaxPpcLoad(d)}</td>
                                                </tr>
                                                );
                                            })}
                                            <tr className={` print:bg-transparent ${theme === 'dark' ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
                                                <td className={`px-6 py-3 text-sm ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`} colSpan={2}>Total (Máximo por Escopo)</td>
                                                <td className={`px-6 py-3 text-sm text-right font-mono ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
                                                    {items.reduce((acc, curr) => {
                                                        const getMaxPpcLoad = (disc: any) => {
                                                            if (disc.ppcLoads && Object.keys(disc.ppcLoads).length > 0) {
                                                                return Math.max(...Object.values(disc.ppcLoads) as number[]);
                                                            }
                                                            return disc.load_hours || 0;
                                                        };
                                                        return acc + getMaxPpcLoad(curr);
                                                    }, 0)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    ))}

                    {conflicts.length > 0 && (
                        <div className="mb-8 break-inside-avoid print:break-before-page">
                            <h2 className={`text-xl  border-b-2 mb-4 pb-2 uppercase tracking-wide ${theme === 'dark' ? 'text-red-400 border-red-400' : 'text-red-700 border-red-700'}`}>
                                Conflitos de Horário Detectados
                            </h2>
                            <div className={`border rounded-lg p-5 ${theme === 'dark' ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-200'}`}>
                                {conflicts.map((c, idx) => (
                                    <div key={idx} className={`mb-2 text-sm flex items-start gap-2 ${theme === 'dark' ? 'text-red-300' : 'text-red-800'}`}>
                                        <span className={` mt-0.5 ${theme === 'dark' ? 'text-red-400' : 'text-red-900'}`}>•</span>
                                        <span>
                                            <strong>{new Date(c.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>:
                                            Sobreposição entre <span className="">{c.event1.name}</span> ({c.event1.startTime}-{c.event1.endTime})
                                            e <span className="">{c.event2.name}</span> ({c.event2.startTime}-{c.event2.endTime}).
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {disciplines.length === 0 && (
                        <div className="text-center text-gray-500 dark:text-slate-400 py-16">
                            Nenhuma disciplina encontrada. Vá para 'Cursos' para adicionar.
                        </div>
                    )}
                </div>
            ) : (
                <div className={`rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border p-10 print:shadow-none print:border-none print:p-0 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                    <div className="mb-8 flex justify-between items-center no-print">
                        <h2 className={`text-xl  ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Relatório de Aulas por Professor</h2>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm  ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Ano Letivo:</span>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className={`border rounded-md px-3 py-1.5 text-sm  shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
                            >
                                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                    <option key={y} value={y} className={theme === 'dark' ? 'bg-slate-700' : ''}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Print Header for Instructor Report */}
                    <div className="hidden print:block mb-8 text-center">
                        <h1 className="text-2xl  text-gray-900">Relatório de Aulas por Professor</h1>
                        <p className="text-gray-500">Ano Letivo: {selectedYear}</p>
                    </div>

                    {instructorsData.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 italic">Nenhum professor com aulas encontradas neste ano.</div>
                    ) : (
                        <div className="space-y-10">
                            {instructorsData.map(instructor => (
                                <div key={instructor.name} className="break-inside-avoid">
                                    <div className={`px-6 py-4 border-b flex justify-between items-center rounded-t-lg border-x border-t ${theme === 'dark' ? 'bg-slate-700/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center  text-xs ${theme === 'dark' ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                                                {instructor.name.charAt(0)}
                                            </div>
                                            <h3 className={`text-lg  ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{instructor.name}</h3>
                                        </div>
                                        <div className="flex gap-4 text-sm">
                                            <span className={`px-3 py-1 rounded-full  ${theme === 'dark' ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'}`}>Dadas: {instructor.given}</span>
                                            <span className={`px-3 py-1 rounded-full  ${theme === 'dark' ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-100 text-yellow-700'}`}>Faltam: {instructor.remaining}</span>
                                            <span className={`px-3 py-1 rounded-full  ${theme === 'dark' ? 'bg-slate-600 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>Total: {instructor.total}</span>
                                        </div>
                                    </div>

                                    <div className={`border rounded-b-lg overflow-hidden ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                                        <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-gray-200'}`}>
                                            <thead className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs  text-gray-400 dark:text-slate-500 uppercase tracking-wider">Data</th>
                                                    <th className="px-6 py-3 text-left text-xs  text-gray-400 dark:text-slate-500 uppercase tracking-wider">Horário</th>
                                                    <th className="px-6 py-3 text-left text-xs  text-gray-400 dark:text-slate-500 uppercase tracking-wider">Disciplina</th>
                                                    <th className="px-6 py-3 text-left text-xs  text-gray-400 dark:text-slate-500 uppercase tracking-wider">Turma</th>
                                                    <th className="px-6 py-3 text-right text-xs  text-gray-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                                                </tr>

                                            </thead>
                                            <tbody className={`divide-y ${theme === 'dark' ? 'bg-slate-800 divide-slate-700' : 'bg-white divide-gray-100'}`}>
                                                {instructor.events.map(event => {
                                                    const isDone = event.date < new Date().toISOString().split('T')[0];
                                                    const discipline = disciplines.find(d => d.id === event.disciplineId);
                                                    return (
                                                        <tr key={event.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
                                                            <td className={`px-6 py-3 whitespace-nowrap text-sm font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                                                {new Date(event.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                            </td>
                                                            <td className={`px-6 py-3 whitespace-nowrap text-sm font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                                                {event.startTime} - {event.endTime}
                                                            </td>
                                                            <td className={`px-6 py-3 whitespace-nowrap text-sm  ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                                                                {discipline?.name}
                                                            </td>
                                                            <td className={`px-6 py-3 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                                                                {formatClassId(event.classId)}
                                                            </td>
                                                            <td className="px-6 py-3 whitespace-nowrap text-sm text-right">
                                                                {isDone ? (
                                                                    <span className={` text-xs uppercase tracking-wide ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>Realizada</span>
                                                                ) : (
                                                                    <span className={` text-xs uppercase tracking-wide ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>Agendada</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
