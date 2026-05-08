import React, { useState, useMemo, useEffect } from 'react';
import { Trash2, CheckCircle2, ShieldCheck, MessageSquare, Pencil, X, Save } from 'lucide-react';
import { useCourseStore } from '../../store/useCourseStore';
import { useTheme } from '../../contexts/ThemeContext';
import { formatCourse } from '../../utils/formatters';
import { formatDate, createDateFromISO } from '../../utils/dateUtils';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { ScheduleEvent, SemesterConfig } from '../../types';
import { subscribeToEventsByDateRange } from '../../services/supabaseService';

const HOLIDAYS_2026 = [
    { start: '2026-01-01', end: '2026-01-11', label: 'Férias' },
    { start: '2026-02-16', end: '2026-02-17', label: 'Carnaval' },
    { start: '2026-02-18', end: '2026-02-18', label: 'Cinzas' },
    { start: '2026-04-02', end: '2026-04-03', label: 'Paixão de Cristo' },
    { start: '2026-04-20', end: '2026-04-20', label: 'Tiradentes' },
    { start: '2026-05-01', end: '2026-05-01', label: 'Dia do trabalhador' },
    { start: '2026-05-12', end: '2026-05-18', label: 'INTERAFA' },
    { start: '2026-06-04', end: '2026-06-04', label: 'Corpus Christi' },
    { start: '2026-06-05', end: '2026-06-05', label: 'Criação do MD' },
    { start: '2026-07-03', end: '2026-07-03', label: 'Espadim' },
    { start: '2026-08-07', end: '2026-08-07', label: 'Aniversário de Pirassununga' },
    { start: '2026-08-10', end: '2026-08-10', label: 'Dia dos pais' },
    { start: '2026-08-21', end: '2026-08-28', label: 'NAVAMAER' },
    { start: '2026-09-07', end: '2026-09-07', label: 'Independência do Brasil' },
    { start: '2026-10-12', end: '2026-10-12', label: 'Sra Aparecida' },
    { start: '2026-11-02', end: '2026-11-02', label: 'Finados' },
    { start: '2026-11-20', end: '2026-11-20', label: 'Consciência Negra' },
    { start: '2026-12-11', end: '2026-12-11', label: 'Aspirantado' },
    { start: '2026-12-12', end: '2026-12-31', label: 'Férias' },
];

export const AcademicCalendar = () => {
    const {
        addEvent, addBatchEvents, deleteBatchEvents,
        semesterConfigs, updateSemesterConfig
    } = useCourseStore();
    const { theme } = useTheme();

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [title, setTitle] = useState('');
    const [detailedDescription, setDetailedDescription] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [isBlocking, setIsBlocking] = useState(true);
    const [color, setColor] = useState('#f59e0b');

    const [targetSquadron, setTargetSquadron] = useState<number | 'ALL'>('ALL');
    const [targetCourse, setTargetCourse] = useState<'AVIATION' | 'INTENDANCY' | 'INFANTRY' | 'ALL'>('ALL');
    const [targetClass, setTargetClass] = useState<string | 'ALL'>('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState<string[] | null>(null);
    const [deleteIds, setDeleteIds] = useState<string[] | null>(null);

    // Local state for events to enable real-time updates
    const [academicYearEvents, setAcademicYearEvents] = useState<ScheduleEvent[]>([]);

    useEffect(() => {
        const start = `${selectedYear}-01-01`;
        const end = `${selectedYear}-12-31`;

        const unsubscribe = subscribeToEventsByDateRange(start, end, (data) => {
            setAcademicYearEvents(data as ScheduleEvent[]);
        });

        return () => unsubscribe();
    }, [selectedYear]);

    const academicEvents = useMemo(() => {
        return academicYearEvents
            .filter(e => e.type === 'ACADEMIC' || e.disciplineId === 'ACADEMIC')
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [academicYearEvents]);

    const groupedAcademicEvents = useMemo(() => {
        if (academicEvents.length === 0) return [];

        const groups: any[] = [];
        let cur = academicEvents[0];
        let currentGroup = {
            id: cur.id,
            ids: [cur.id],
            startDate: cur.date,
            endDate: cur.date,
            location: cur.location,
            description: cur.description,
            isBlocking: cur.isBlocking,
            targetSquadron: cur.targetSquadron || 'ALL',
            targetCourse: cur.targetCourse || 'ALL',
            targetClass: cur.targetClass || 'ALL',
            color: cur.color,
        };

        for (let i = 1; i < academicEvents.length; i++) {
            const event = academicEvents[i];
            const prevEnd = new Date(currentGroup.endDate + 'T00:00:00');
            const currStart = new Date(event.date + 'T00:00:00');
            const diffDays = Math.round((currStart.getTime() - prevEnd.getTime()) / (1000 * 3600 * 24));

            const isSame =
                event.location === currentGroup.location &&
                event.description === currentGroup.description &&
                event.isBlocking === currentGroup.isBlocking &&
                (event.targetSquadron || 'ALL') === currentGroup.targetSquadron &&
                (event.targetCourse || 'ALL') === currentGroup.targetCourse &&
                (event.targetClass || 'ALL') === currentGroup.targetClass;

            if (isSame && diffDays === 1) {
                currentGroup.endDate = event.date;
                currentGroup.ids.push(event.id);
            } else {
                groups.push(currentGroup);
                currentGroup = {
                    id: event.id,
                    ids: [event.id],
                    startDate: event.date,
                    endDate: event.date,
                    location: event.location,
                    description: event.description,
                    isBlocking: event.isBlocking,
                    targetSquadron: event.targetSquadron || 'ALL',
                    targetCourse: event.targetCourse || 'ALL',
                    targetClass: event.targetClass || 'ALL',
                    color: event.color,
                };
            }
        }
        groups.push(currentGroup);
        return groups;
    }, [academicEvents]);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !title) return;

        const idsToRemove = editingGroupId || [];
        const activeEvents = idsToRemove.length > 0
            ? academicYearEvents.filter(e => !idsToRemove.includes(e.id))
            : academicYearEvents;

        const start = createDateFromISO(startDate);
        const end = endDate ? createDateFromISO(endDate) : start;

        if (end < start) {
            alert('A data final deve ser igual ou posterior à data inicial.');
            return;
        }

        const newEvents: ScheduleEvent[] = [];
        const currentArr = new Date(start);
        while (currentArr <= end) {
            const dateStr = formatDate(currentArr);
            const exists = activeEvents.find(e =>
                e.date === dateStr &&
                (e.type === 'ACADEMIC' || e.disciplineId === 'ACADEMIC') &&
                e.location === title &&
                e.description === detailedDescription &&
                (e.targetSquadron || 'ALL') === targetSquadron &&
                (e.targetCourse || 'ALL') === targetCourse &&
                (e.targetClass || 'ALL') === targetClass
            );

            if (!exists) {
                newEvents.push({
                    id: crypto.randomUUID(),
                    date: dateStr,
                    disciplineId: 'ACADEMIC',
                    classId: targetClass === 'ALL' ? 'Geral' : (targetSquadron !== 'ALL' ? `${targetSquadron}${targetClass}` : targetClass),
                    startTime: '00:00',
                    endTime: '23:59',
                    type: 'ACADEMIC',
                    location: title,
                    description: detailedDescription,
                    isBlocking,
                    color,
                    targetSquadron,
                    targetCourse,
                    targetClass
                });
            }
            currentArr.setDate(currentArr.getDate() + 1);
        }

        if (idsToRemove.length > 0) {
            deleteBatchEvents(idsToRemove);
        }

        if (newEvents.length > 0) {
            if (newEvents.length > 1) addBatchEvents(newEvents);
            else addEvent(newEvents[0]);
        }

        resetForm();
        setIsModalOpen(false);
    };

    const resetForm = () => {
        setStartDate('');
        setEndDate('');
        setTitle('');
        setDetailedDescription('');
        setEditingGroupId(null);
    };

    const handleEditStart = (group: any) => {
        setStartDate(group.startDate);
        setEndDate(group.endDate);
        setTitle(group.location);
        setDetailedDescription(group.description || '');
        setIsBlocking(group.isBlocking !== false);
        setColor(group.color || (group.isBlocking !== false ? '#f59e0b' : '#3b82f6'));
        setTargetSquadron(group.targetSquadron || 'ALL');
        setTargetCourse(group.targetCourse || 'ALL');
        setTargetClass(group.targetClass || 'ALL');
        setEditingGroupId(group.ids);
        setIsModalOpen(true);
    };

    const handleCancelEdit = () => {
        resetForm();
        setIsModalOpen(false);
    };

    const handleImport2026 = () => {
        const newEvents: ScheduleEvent[] = [];
        HOLIDAYS_2026.forEach(holiday => {
            const start = createDateFromISO(holiday.start);
            const end = createDateFromISO(holiday.end);
            const current = new Date(start);
            while (current <= end) {
                const dateStr = formatDate(current);
                const exists = academicEvents.find(e => e.date === dateStr && e.location === holiday.label);
                if (!exists) {
                    newEvents.push({
                        id: crypto.randomUUID(),
                        date: dateStr,
                        disciplineId: 'ACADEMIC',
                        classId: 'Geral',
                        startTime: '00:00',
                        endTime: '23:59',
                        type: 'ACADEMIC',
                        location: holiday.label,
                        isBlocking: true,
                        color: '#f59e0b',
                        targetSquadron: 'ALL',
                        targetCourse: 'ALL',
                        targetClass: 'ALL'
                    });
                }
                current.setDate(current.getDate() + 1);
            }
        });

        if (newEvents.length > 0) {
            addBatchEvents(newEvents);
        }
        setSelectedYear(2026);
    };

    const handleDelete = async () => {
        if (deleteIds) {
            await deleteBatchEvents(deleteIds);
            setDeleteIds(null);
        }
    };

    return (
        <div className="p-6 md:p-12 pt-12 md:pt-20 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className={`text-3xl  tracking-tight ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                        Bloqueios
                    </h1>
                    <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        Defina dias não programáveis e visualize a disponibilidade anual.
                    </p>
                </div>

                <div className="flex gap-4 items-center">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border dark:border-slate-700 mr-2">
                        <button
                            onClick={() => {
                                resetForm();
                                setIsModalOpen(true);
                            }}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm "
                        >
                            <Pencil size={18} />
                            Novo Bloqueio
                        </button>
                    </div>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className={`border rounded-lg px-3 py-2 text-sm  shadow-sm outline-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
                    >
                        {[2024, 2025, 2026, 2027, 2028].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>

                    {selectedYear === 2026 && academicEvents.length === 0 && (
                        <button
                            onClick={handleImport2026}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm "
                        >
                            <CheckCircle2 size={18} />
                            Carregar Dados 2026
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-12">
                <section>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className={`text-xl  flex items-center gap-2 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                            <ShieldCheck className="text-blue-500" />
                            Eventos e Bloqueios {selectedYear}
                        </h2>
                        <span className="text-sm text-slate-500">{groupedAcademicEvents.length} grupos de eventos</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupedAcademicEvents.map((group) => (
                            <div
                                key={group.id}
                                className={`group p-4 rounded-xl border transition-all hover:shadow-md relative ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div
                                        className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                                        style={{ backgroundColor: group.color }}
                                    />
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleEditStart(group)}
                                            className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                                            title="Editar"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => setDeleteIds(group.ids)}
                                            className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-slate-400 transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <h3 className={`font-medium mb-1 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {group.location}
                                </h3>

                                <div className={`text-sm mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {group.startDate === group.endDate ? (
                                        <span>{formatDate(new Date(group.startDate + 'T12:00:00'))}</span>
                                    ) : (
                                        <span>{formatDate(new Date(group.startDate + 'T12:00:00'))} a {formatDate(new Date(group.endDate + 'T12:00:00'))}</span>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2 mt-auto">
                                    {(group.targetSquadron !== 'ALL' || group.targetCourse !== 'ALL' || group.targetClass !== 'ALL') ? (
                                        <div className="flex flex-wrap gap-1">
                                            {group.targetSquadron !== 'ALL' && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                    {group.targetSquadron}º Esquadrão
                                                </span>
                                            )}
                                            {group.targetCourse !== 'ALL' && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                    {formatCourse(group.targetCourse)}
                                                </span>
                                            )}
                                            {group.targetClass !== 'ALL' && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                    Turma {group.targetClass}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                            Geral (Toda AFA)
                                        </span>
                                    )}
                                    {group.isBlocking && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                            <ShieldCheck size={10} />
                                            Bloqueio
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {groupedAcademicEvents.length === 0 && (
                            <div className={`col-span-full py-12 text-center rounded-2xl border-2 border-dashed ${theme === 'dark' ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
                                <MessageSquare className="mx-auto mb-3 opacity-20" size={48} />
                                <p>Nenhum evento acadêmico cadastrado para {selectedYear}</p>
                            </div>
                        )}
                    </div>
                </section>

                <SemesterConfigSection
                    semesterConfigs={semesterConfigs}
                    selectedYear={selectedYear}
                    onUpdate={updateSemesterConfig}
                />
            </div>

            <AcademicEventModal
                isOpen={isModalOpen}
                onClose={handleCancelEdit}
                onSubmit={handleAdd}
                editingGroupId={editingGroupId}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                title={title}
                setTitle={setTitle}
                detailedDescription={detailedDescription}
                setDetailedDescription={setDetailedDescription}
                isBlocking={isBlocking}
                setIsBlocking={setIsBlocking}
                color={color}
                setColor={setColor}
                targetSquadron={targetSquadron}
                setTargetSquadron={setTargetSquadron}
                targetCourse={targetCourse}
                setTargetCourse={setTargetCourse}
                targetClass={targetClass}
                setTargetClass={setTargetClass}
            />

            <ConfirmDialog
                isOpen={deleteIds !== null}
                onClose={() => setDeleteIds(null)}
                onConfirm={handleDelete}
                title="Excluir Evento"
                message={`Deseja realmente excluir este evento acadêmico? ${deleteIds?.length || 0} dias serão afetados.`}
                type="danger"
            />
        </div>
    );
};

// --- Subcomponentes ---

interface AcademicEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    editingGroupId: string[] | null;
    startDate: string;
    setStartDate: (v: string) => void;
    endDate: string;
    setEndDate: (v: string) => void;
    title: string;
    setTitle: (v: string) => void;
    detailedDescription: string;
    setDetailedDescription: (v: string) => void;
    isBlocking: boolean;
    setIsBlocking: (v: boolean) => void;
    color: string;
    setColor: (v: string) => void;
    targetSquadron: number | 'ALL';
    setTargetSquadron: (v: number | 'ALL') => void;
    targetCourse: 'AVIATION' | 'INTENDANCY' | 'INFANTRY' | 'ALL';
    setTargetCourse: (v: 'AVIATION' | 'INTENDANCY' | 'INFANTRY' | 'ALL') => void;
    targetClass: string | 'ALL';
    setTargetClass: (v: string | 'ALL') => void;
}

const AcademicEventModal = (props: AcademicEventModalProps) => {
    const { theme } = useTheme();
    if (!props.isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className={`w-full max-w-lg rounded-2xl shadow-2xl border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
                <div className="flex justify-between items-center p-6 border-b dark:border-slate-800">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        {props.editingGroupId ? <Pencil size={20} className="text-blue-500" /> : <div className="p-2 bg-blue-500 rounded-lg text-white"><ShieldCheck size={20} /></div>}
                        {props.editingGroupId ? 'Editar Bloqueio' : 'Novo Bloqueio Acadêmico'}
                    </h2>
                    <button onClick={props.onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={props.onSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wider opacity-60">Data Inicial</label>
                            <input
                                type="date"
                                required
                                value={props.startDate}
                                onChange={(e) => props.setStartDate(e.target.value)}
                                className={`w-full px-4 py-2 rounded-xl border outline-none transition-all focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wider opacity-60">Data Final (Opcional)</label>
                            <input
                                type="date"
                                value={props.endDate}
                                onChange={(e) => props.setEndDate(e.target.value)}
                                className={`w-full px-4 py-2 rounded-xl border outline-none transition-all focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider opacity-60">Título do Evento</label>
                        <input
                            type="text"
                            placeholder="Ex: Férias, Exercício de Sobrevivência..."
                            required
                            value={props.title}
                            onChange={(e) => props.setTitle(e.target.value)}
                            className={`w-full px-4 py-2 rounded-xl border outline-none transition-all focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wider opacity-60">Esquadrão</label>
                            <select
                                value={props.targetSquadron}
                                onChange={(e) => props.setTargetSquadron(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                                className={`w-full px-4 py-2 rounded-xl border outline-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                            >
                                <option value="ALL">Todo o Corpo de Cadetes</option>
                                <option value={1}>1º Esquadrão</option>
                                <option value={2}>2º Esquadrão</option>
                                <option value={3}>3º Esquadrão</option>
                                <option value={4}>4º Esquadrão</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wider opacity-60">Curso/Arma</label>
                            <select
                                value={props.targetCourse}
                                onChange={(e) => props.setTargetCourse(e.target.value as any)}
                                className={`w-full px-4 py-2 rounded-xl border outline-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                            >
                                <option value="ALL">Todos os Cursos</option>
                                <option value="AVIATION">Aviação</option>
                                <option value="INTENDANCY">Intendência</option>
                                <option value="INFANTRY">Infantaria</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 py-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div
                                onClick={() => props.setIsBlocking(!props.isBlocking)}
                                className={`w-12 h-6 rounded-full p-1 transition-all ${props.isBlocking ? 'bg-amber-500' : 'bg-slate-400'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white transition-all ${props.isBlocking ? 'translate-x-6' : 'translate-x-0'}`} />
                            </div>
                            <span className="text-sm font-medium">Impedir Programação</span>
                        </label>

                        <div className="flex gap-2">
                            {['#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#8b5cf6'].map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => props.setColor(c)}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-125 ${props.color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-50'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={props.onClose}
                            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 bg-slate-800/50' : 'hover:bg-slate-100 bg-slate-50'}`}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                        >
                            <Save size={18} />
                            {props.editingGroupId ? 'Salvar Edição' : 'Criar Bloqueio'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SemesterConfigSection = ({
    semesterConfigs,
    selectedYear,
    onUpdate
}: {
    semesterConfigs: SemesterConfig[],
    selectedYear: number,
    onUpdate: (id: string, updates: Partial<SemesterConfig>) => void
}) => {
    const { theme } = useTheme();
    const config = semesterConfigs.find(c => c.year === selectedYear);

    if (!config) return null;

    return (
        <section>
            <div className="flex items-center gap-2 mb-6">
                <CheckCircle2 className="text-green-500" />
                <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                    Configuração de Semestres {selectedYear}
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1º Semestre */}
                <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center text-sm">1º</span>
                        Semestre Acadêmico
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase opacity-40">Início</label>
                            <input
                                type="date"
                                value={config.s1Start || ''}
                                onChange={(e) => onUpdate(config.id, { s1Start: e.target.value })}
                                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-1 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase opacity-40">Término</label>
                            <input
                                type="date"
                                value={config.s1End || ''}
                                onChange={(e) => onUpdate(config.id, { s1End: e.target.value })}
                                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-1 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}
                            />
                        </div>
                    </div>
                </div>

                {/* 2º Semestre */}
                <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center text-sm">2º</span>
                        Semestre Acadêmico
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase opacity-40">Início</label>
                            <input
                                type="date"
                                value={config.s2Start || ''}
                                onChange={(e) => onUpdate(config.id, { s2Start: e.target.value })}
                                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-1 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase opacity-40">Término</label>
                            <input
                                type="date"
                                value={config.s2End || ''}
                                onChange={(e) => onUpdate(config.id, { s2End: e.target.value })}
                                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-1 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
