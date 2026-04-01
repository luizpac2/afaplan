import { useMemo, useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useCourseStore } from '../store/useCourseStore';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { Filter, Calendar, TrendingUp, BookOpen, Clock, Printer, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';

export const Statistics = () => {
    const { disciplines, classes: defaultClasses, fetchYearlyEvents, yearEventsCache, dataReady } = useCourseStore();
    const { theme } = useTheme();
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedSquadron, setSelectedSquadron] = useState<string>('ALL');
    const [selectedCourse, setSelectedCourse] = useState<string>('ALL');
    const [selectedClass, setSelectedClass] = useState<string>('ALL');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!dataReady) return;
        setIsLoading(true);
        fetchYearlyEvents(selectedYear).finally(() => setIsLoading(false));
    }, [selectedYear, fetchYearlyEvents, dataReady]);

    const yearEvents = useMemo(() => yearEventsCache[selectedYear] || [], [yearEventsCache, selectedYear]);

    // Helper to check if a class letter belongs to a course
    const isClassInCourse = (classLetter: string, course: string) => {
        if (course === 'ALL') return true;
        if (course === 'AVIATION') return ['A', 'B', 'C', 'D'].includes(classLetter);
        if (course === 'INTENDANCY') return ['E'].includes(classLetter);
        if (course === 'INFANTRY') return ['F'].includes(classLetter);
        return false;
    };




    // Helper to calculate target load by summing up loads for specific classes
    const getTargetLoadForStats = (d: any, classes: any[]) => {
        let sum = 0;

        classes.forEach(c => {
            const sqNum = c.squadron;
            const key = `${c.type}_${sqNum}`;
            const ppc = d.ppcLoads?.[key];

            if (typeof ppc === 'number') {
                sum += ppc;
            } else {
                // Fallback to legacy fields if ppcLoads isn't populated
                const enabledCourses = d.enabledCourses || [];
                const enabledYears = d.enabledYears || [];

                const isCourseEnabled = enabledCourses.includes(c.type) ||
                    d.course === 'ALL' || d.course === c.type ||
                    d.category === 'COMMON' || d.category === c.type;

                const isYearEnabled = enabledYears.includes(Number(sqNum)) ||
                    d.year === 'ALL' || d.year === Number(sqNum);

                if (isCourseEnabled && isYearEnabled) {
                    sum += (d.load_hours || 0);
                }
            }
        });

        // If 0 and no configuration found, return 0.
        return sum;
    };

    // --- Data Processing Logic ---

    // Get relevant classes based on filters
    const relevantClasses = useMemo(() => {
        let classes: any[] = [];
        defaultClasses.forEach(cls => {
            const sqNum = cls.year.toString();
            if (selectedSquadron !== 'ALL' && sqNum !== selectedSquadron) return;

            if (selectedCourse !== 'ALL' && cls.type !== selectedCourse) return;
            if (selectedClass !== 'ALL' && !cls.id.endsWith(selectedClass)) return;

            classes.push({ ...cls, squadron: sqNum });
        });
        return classes;
    }, [defaultClasses, selectedSquadron, selectedCourse, selectedClass]);

    // 1. Calculate General KPIs
    const kpis = useMemo(() => {
        let filteredDisciplines = disciplines;
        // Filter events by selected calendar year first
        let filteredEvents = yearEvents.filter(e => new Date(e.date).getFullYear() === selectedYear);

        // 1. Filter by Squadron (Year)
        if (selectedSquadron !== 'ALL') {
            filteredDisciplines = filteredDisciplines.filter(d =>
                (d.enabledYears && d.enabledYears.includes(Number(selectedSquadron) as any)) || d.year === Number(selectedSquadron)
            );
            filteredEvents = filteredEvents.filter(e => e.classId.startsWith(selectedSquadron));
        }

        if (selectedCourse !== 'ALL') {
            filteredDisciplines = filteredDisciplines.filter(d =>
                (d.enabledCourses && d.enabledCourses.includes(selectedCourse as any)) || d.course === 'ALL' || d.course === selectedCourse
            );
            // Check if the event's class corresponds to the selected course
            filteredEvents = filteredEvents.filter(e => {
                const classLetter = e.classId.slice(-1); // Assuming ID format "1A", "2B"
                return isClassInCourse(classLetter, selectedCourse);
            });
        }

        // 3. Filter by Specific Class (Turma A, B, C...)
        if (selectedClass !== 'ALL') {
            // Events are easy: exact match or ends with
            filteredEvents = filteredEvents.filter(e => e.classId.endsWith(selectedClass));
        }

        const totalPlannedHours = filteredDisciplines.reduce((acc, d) => acc + getTargetLoadForStats(d, relevantClasses), 0);
        const totalRealizedHours = filteredEvents.length; // Assuming 1 event = 1 hour
        const progress = totalPlannedHours > 0 ? (totalRealizedHours / totalPlannedHours) * 100 : 0;

        return {
            totalDisciplines: filteredDisciplines.length,
            totalPlannedHours,
            totalRealizedHours,
            progress: Math.min(progress, 100).toFixed(1)
        };
    }, [disciplines, yearEvents, selectedYear, selectedSquadron, selectedCourse, selectedClass, relevantClasses]);

    // 2. Prepare Data for Discipline Comparison Chart
    const disciplineData = useMemo(() => {
        let filteredDisciplines = disciplines;

        // Filter Disciplines
        if (selectedSquadron !== 'ALL') {
            filteredDisciplines = filteredDisciplines.filter(d =>
                (d.enabledYears && d.enabledYears.includes(Number(selectedSquadron) as any)) || d.year === Number(selectedSquadron)
            );
        }
        if (selectedCourse !== 'ALL') {
            filteredDisciplines = filteredDisciplines.filter(d =>
                (d.enabledCourses && d.enabledCourses.includes(selectedCourse as any)) || d.course === 'ALL' || d.course === selectedCourse
            );
        }

        return filteredDisciplines.map(d => {
            // Calculate realized hours for this discipline applying all filters
            const realization = yearEvents.filter(e => {
                const eventYear = new Date(e.date).getFullYear() === selectedYear;
                const matchDiscipline = e.disciplineId === d.id;

                if (!eventYear || !matchDiscipline) return false;

                // Squadron Filter
                if (selectedSquadron !== 'ALL' && !e.classId.startsWith(selectedSquadron)) return false;

                // Course Filter
                const classLetter = e.classId.slice(-1);
                if (selectedCourse !== 'ALL' && !isClassInCourse(classLetter, selectedCourse)) return false;

                // Class Filter
                if (selectedClass !== 'ALL' && !e.classId.endsWith(selectedClass)) return false;

                return true;
            }).length;

            const targetLoad = getTargetLoadForStats(d, relevantClasses);

            return {
                name: d.code || d.name.substring(0, 10),
                fullName: d.name,
                Previsto: targetLoad,
                Realizado: realization,
                Diferença: realization - targetLoad
            };
        }).filter(d => d.Previsto > 0 || d.Realizado > 0)
            .sort((a, b) => b.Previsto - a.Previsto)
            .slice(0, 20);
    }, [disciplines, yearEvents, selectedYear, selectedSquadron, selectedCourse, selectedClass, relevantClasses]);

    // 3. Prepare Data for Evolution Chart
    const evolutionData = useMemo(() => {
        const data: Record<string, number> = {};
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        yearEvents.forEach(e => {
            const date = new Date(e.date);
            if (date.getFullYear() !== selectedYear) return;

            // Apply Filters
            if (selectedSquadron !== 'ALL' && !e.classId.startsWith(selectedSquadron)) return;

            const classLetter = e.classId.slice(-1);
            if (selectedCourse !== 'ALL' && !isClassInCourse(classLetter, selectedCourse)) return;
            if (selectedClass !== 'ALL' && !e.classId.endsWith(selectedClass)) return;

            const monthIndex = date.getMonth();
            const monthName = months[monthIndex];
            data[monthName] = (data[monthName] || 0) + 1;
        });

        let cumulative = 0;
        return months.map(m => {
            cumulative += (data[m] || 0);
            return {
                name: m,
                Horas: cumulative,
                Mensal: data[m] || 0
            };
        });
    }, [yearEvents, selectedYear, selectedSquadron, selectedCourse, selectedClass]);

    const academicMetrics = useMemo(() => {
        const filteredAcademicEvents = yearEvents.filter(e => {
            if (!(e.type === 'ACADEMIC' || e.disciplineId === 'ACADEMIC')) return false;
            if (new Date(e.date).getFullYear() !== selectedYear) return false;

            if (selectedSquadron !== 'ALL') {
                const matchesSquadron = !e.targetSquadron || e.targetSquadron === 'ALL' || e.targetSquadron.toString() === selectedSquadron;
                if (!matchesSquadron) return false;
            }

            if (selectedCourse !== 'ALL') {
                const matchesCourse = !e.targetCourse || e.targetCourse === 'ALL' || e.targetCourse === selectedCourse;
                if (!matchesCourse) return false;
            }

            if (selectedClass !== 'ALL') {
                const matchesClass = !e.targetClass || e.targetClass === 'ALL' || e.targetClass === selectedClass;
                if (!matchesClass) return false;
            }

            return true;
        });

        const yearStart = new Date(selectedYear, 0, 1);
        const yearEnd = new Date(selectedYear, 11, 31);

        let totalWeekDays = 0;
        let blockedDaysCount = 0;

        const blockedDates = new Set(filteredAcademicEvents
            .filter(e => e.isBlocking !== false)
            .map(e => e.date)
        );

        const current = new Date(yearStart);
        while (current <= yearEnd) {
            const day = current.getDay();
            const isWeekDay = day >= 1 && day <= 5;
            if (isWeekDay) {
                totalWeekDays++;
                if (blockedDates.has(formatDate(current))) {
                    blockedDaysCount++;
                }
            }
            current.setDate(current.getDate() + 1);
        }

        const availableDays = totalWeekDays - blockedDaysCount;
        const totalTemposAvailable = availableDays * 6;

        let filteredDisciplines = disciplines;
        if (selectedSquadron !== 'ALL') filteredDisciplines = filteredDisciplines.filter(d =>
            (d.enabledYears && d.enabledYears.includes(Number(selectedSquadron) as any)) || d.year === Number(selectedSquadron)
        );
        if (selectedCourse !== 'ALL') filteredDisciplines = filteredDisciplines.filter(d =>
            (d.enabledCourses && d.enabledCourses.includes(selectedCourse as any)) || d.course === 'ALL' || d.course === selectedCourse
        );

        const totalPPCLoad = filteredDisciplines.reduce((acc, d) => acc + getTargetLoadForStats(d, relevantClasses), 0);

        return {
            totalWeekDays,
            blockedDaysCount,
            availableDays,
            totalTemposAvailable,
            totalPPCLoad
        };
    }, [selectedYear, selectedSquadron, selectedCourse, selectedClass, yearEvents, disciplines]);


    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

                {/* Print Only Header */}
                <div className="hidden print:block w-full border-b-2 border-slate-800 pb-4 mb-4">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <img src="/logo.png?v=2" alt="AFA Logo" className="h-16 w-auto object-contain" />
                            <div>
                                <h1 className="text-2xl  text-slate-900 uppercase">Academia da Força Aérea</h1>
                                <p className="text-sm text-slate-600  uppercase tracking-wider">Divisão de Ensino</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl  text-slate-800">Relatório de Estatísticas e PPC</h2>
                            <p className="text-sm text-slate-500">Gerado em: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às {new Date().toLocaleTimeString('pt-BR')}</p>
                        </div>
                    </div>

                    {/* Active Filters Summary for Print */}
                    <div className={`flex gap-6 p-2 rounded border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <p><span className="">Ano Letivo:</span> {selectedYear}</p>
                        <p><span className="">Esquadrão:</span> {selectedSquadron === 'ALL' ? 'Todos' : `${selectedSquadron}º Esquadrão`}</p>
                        <p><span className="">Curso:</span> {selectedCourse === 'ALL' ? 'Todos' :
                            selectedCourse === 'AVIATION' ? 'Aviação' :
                                selectedCourse === 'INTENDANCY' ? 'Intendência' : 'Infantaria'
                        }</p>
                        <p><span className="">Turma:</span> {selectedClass === 'ALL' ? 'Todas' : `Turma ${selectedClass}`}</p>
                    </div>
                </div>

                <div className="no-print">
                    <div className="flex items-center gap-3">
                        <h1 className={`text-3xl font-bold tracking-tight flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                            <TrendingUp className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
                            Estatísticas e PPC
                        </h1>
                        {isLoading && (
                            <div className="flex items-center justify-center p-1.5 bg-blue-500/10 rounded-xl animate-pulse">
                                <Loader2 className="animate-spin text-blue-500" size={20} />
                            </div>
                        )}
                    </div>
                    <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Comparativo de planejado x realizado e evolução da carga horária.</p>
                </div>

                {/* Filters */}
                <div className={`flex flex-wrap gap-2 items-center p-2 rounded-lg border shadow-sm no-print ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <button
                        onClick={() => window.print()}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm  rounded-md transition-colors mr-2 border ${theme === 'dark'
                            ? 'text-slate-200 bg-slate-700 hover:bg-slate-600 border-slate-600'
                            : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-200'
                            }`}
                        title="Imprimir Página"
                    >
                        <Printer size={16} />
                        Imprimir
                    </button>

                    <div className={`h-6 w-px mx-1 ${theme === 'dark' ? 'bg-slate-600' : 'bg-slate-200'}`}></div>

                    <div className="flex items-center gap-2 px-2">
                        <Filter size={16} className={`hover:text-slate-600 ${theme === 'dark' ? 'text-slate-400 dark:hover:text-slate-300' : 'text-slate-400'}`} />
                        <span className={`text-sm  ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Filtros:</span>
                    </div>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className={`border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${theme === 'dark'
                            ? 'bg-slate-700 border-slate-600 text-slate-100'
                            : 'bg-slate-50 border-slate-200 text-slate-900'
                            }`}
                    >
                        {[2023, 2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>

                    <select
                        value={selectedSquadron}
                        onChange={(e) => {
                            setSelectedSquadron(e.target.value);
                            setSelectedClass('ALL'); // Reset class when squadron changes
                        }}
                        className={`border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${theme === 'dark'
                            ? 'bg-slate-700 border-slate-600 text-slate-100'
                            : 'bg-slate-50 border-slate-200 text-slate-900'
                            }`}
                    >
                        <option value="ALL">Todos Esquadrões</option>
                        <option value="1">1º Esquadrão</option>
                        <option value="2">2º Esquadrão</option>
                        <option value="3">3º Esquadrão</option>
                        <option value="4">4º Esquadrão</option>
                    </select>

                    <select
                        value={selectedCourse}
                        onChange={(e) => {
                            setSelectedCourse(e.target.value);
                            setSelectedClass('ALL'); // Reset class when course changes
                        }}
                        className={`border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${theme === 'dark'
                            ? 'bg-slate-700 border-slate-600 text-slate-100'
                            : 'bg-slate-50 border-slate-200 text-slate-900'
                            }`}
                    >
                        <option value="ALL">Todos Cursos</option>
                        <option value="AVIATION">Aviação</option>
                        <option value="INTENDANCY">Intendência</option>
                        <option value="INFANTRY">Infantaria</option>
                    </select>

                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className={`border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 opacity-100 disabled:opacity-50 ${theme === 'dark'
                            ? 'bg-slate-700 border-slate-600 text-slate-100'
                            : 'bg-slate-50 border-slate-200 text-slate-900'
                            }`}
                        disabled={selectedSquadron === 'ALL'}
                    >
                        <option value="ALL">Todas Turmas</option>
                        {/* Dynamic classes based on course selection? 
                            Ideally use config, but hardcoding standard flows for now:
                            Aviação: A, B, C, D
                            Intendência: E
                            Infantaria: F
                         */}
                        {/* Show A-D only if Aviation or All selected */}
                        {(selectedCourse === 'ALL' || selectedCourse === 'AVIATION') && (
                            <>
                                <option value="A">Turma A</option>
                                <option value="B">Turma B</option>
                                <option value="C">Turma C</option>
                                <option value="D">Turma D</option>
                            </>
                        )}
                        {/* Show E only if Intendancy or All selected (and squadron permits, e.g. usually not 1st year?) 
                             Actually 1st/2nd year is common. 4th year splits.
                             We'll just show all relevant to the course filter.
                          */}
                        {(selectedCourse === 'ALL' || selectedCourse === 'INTENDANCY') && (
                            <option value="E">Turma E</option>
                        )}
                        {(selectedCourse === 'ALL' || selectedCourse === 'INFANTRY') && (
                            <option value="F">Turma F</option>
                        )}
                    </select>
                </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard
                    title="Dias Úteis"
                    value={academicMetrics.totalWeekDays}
                    icon={<Calendar className="text-blue-500" />}
                    theme={theme}
                />
                <MetricCard
                    title="Dias Bloqueados"
                    value={academicMetrics.blockedDaysCount}
                    icon={<AlertCircle className="text-amber-500" />}
                    theme={theme}
                    highlight={academicMetrics.blockedDaysCount > 0}
                />
                <MetricCard
                    title="Dias Disponíveis"
                    value={academicMetrics.availableDays}
                    icon={<CheckCircle2 className="text-green-500" />}
                    theme={theme}
                />
                <MetricCard
                    title="Tempos de Aula"
                    value={academicMetrics.totalTemposAvailable}
                    subtitle={`Req. PPC: ${academicMetrics.totalPPCLoad}h`}
                    icon={<TrendingUp className="text-purple-500" />}
                    theme={theme}
                    urgent={academicMetrics.totalTemposAvailable < academicMetrics.totalPPCLoad}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`p-6 rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                            <Clock size={20} />
                        </div>
                        <span className={`text-sm  ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Horas Previstas (PPC)</span>
                    </div>
                    <p className={`text-3xl  ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{kpis.totalPlannedHours}</p>
                </div>

                <div className={`p-6 rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'}`}>
                            <Calendar size={20} />
                        </div>
                        <span className={`text-sm  ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Horas Realizadas</span>
                    </div>
                    <p className={`text-3xl  ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{kpis.totalRealizedHours}</p>
                </div>

                <div className={`p-6 rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                            <BookOpen size={20} />
                        </div>
                        <span className={`text-sm  ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Total Disciplinas</span>
                    </div>
                    <p className={`text-3xl  ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{kpis.totalDisciplines}</p>
                </div>

                <div className={`p-6 rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                            <TrendingUp size={20} />
                        </div>
                        <span className={`text-sm  ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Execução Global</span>
                    </div>
                    <div className="flex items-end gap-2">
                        <p className={`text-3xl  ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{kpis.progress}%</p>
                        <div className={`w-full h-2 rounded-full mb-2 ml-2 overflow-hidden flex-1 max-w-[100px] ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'}`}>
                            <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${Math.min(Number(kpis.progress), 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Evolution Chart */}
                <div className={`p-6 rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <h3 className={`text-lg  mb-6 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Evolução da Carga Horária (Acumulado)</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={evolutionData}>
                                <defs>
                                    <linearGradient id="colorHoras" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} tick={{ fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: '#fff' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="Horas"
                                    stroke="#3b82f6"
                                    fillOpacity={1}
                                    fill="url(#colorHoras)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Comparison Chart */}
                <div className={`p-6 rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <h3 className={`text-lg  mb-6 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Previsto vs. Realizado (Top Disciplinas)</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={disciplineData} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: '#fff' }}
                                />
                                <Legend />
                                <Bar dataKey="Previsto" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={20} />
                                <Bar dataKey="Realizado" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Gantt Chart (Simplified Visual) */}
            <div className={`p-6 rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <h3 className={`text-lg  mb-4 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Cronograma de Disciplinas (Gantt)</h3>
                <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                        {/* Header Months */}
                        <div className={`flex border-b pb-2 mb-2 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                            <div className={`w-48 flex-shrink-0  text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Disciplina</div>
                            <div className={`flex-1 grid grid-cols-12 gap-0 text-center text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(m => (
                                    <div key={m}>{m}</div>
                                ))}
                            </div>
                        </div>

                        {/* Rows */}
                        <div className="space-y-3">
                            {disciplineData.map((d, idx) => {
                                // Mock start/duration for visual demo (since we don't have start/end dates stored in discipline, calculating from events would be expensive here)
                                // In a real scenario, we would calculate the first and last event date for each discipline.
                                // For now, we simulate based on "Realizado" to show the concept.
                                const hasActivity = d.Realizado > 0;
                                const randomStart = (idx % 8); // Random start month
                                const duration = Math.max(2, (d.Realizado / 10));

                                return (
                                    <div key={idx} className={`flex items-center rounded py-1 transition-colors ${theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
                                        <div className={`w-48 flex-shrink-0 text-sm  truncate pr-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`} title={d.fullName}>
                                            {d.name}
                                        </div>
                                        <div className={`flex-1 grid grid-cols-12 gap-0 relative h-6 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-700/30' : 'bg-slate-100/50'}`}>
                                            {hasActivity && (
                                                <div
                                                    className="absolute h-full bg-blue-500/80 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm"
                                                    style={{
                                                        left: `${(randomStart / 12) * 100}%`,
                                                        width: `${Math.min((duration / 12) * 100, 100 - (randomStart / 12) * 100)}%`
                                                    }}
                                                >
                                                    {d.Realizado}h
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface MetricCardProps {
    title: string;
    value: number | string;
    subtitle?: string;
    icon: React.ReactNode;
    theme: 'light' | 'dark';
    highlight?: boolean;
    urgent?: boolean;
}

const MetricCard = ({ title, value, subtitle, icon, theme, highlight, urgent }: MetricCardProps) => (
    <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${urgent ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900' :
        highlight ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900' :
            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 shadow-sm text-slate-900'
        }`}>
        <div className="mb-2 p-2 rounded-full bg-slate-100 dark:bg-slate-800">
            {icon}
        </div>
        <div className="text-2xl  mb-1">{value}</div>
        <div className="text-[10px]  uppercase tracking-widest text-slate-500">{title}</div>
        {subtitle && <div className={`text-[9px] mt-1  ${urgent ? 'text-red-500' : 'text-slate-400'}`}>{subtitle}</div>}
    </div>
);
