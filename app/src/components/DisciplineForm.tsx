
import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Save, Search, Users } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useCourseStore } from '../store/useCourseStore';
import type { Discipline, CourseYear } from '../types';
import { InstructorCombobox } from './InstructorCombobox';

interface DisciplineFormProps {
    initialData?: Discipline;
    onSubmit: (data: Omit<Discipline, 'id'>) => void;
    onCancel: () => void;
}

// Mapping: ppcLoad course key → class letter(s)
const COURSE_LETTERS: Record<string, string[]> = {
    AVIATION:   ['A', 'B', 'C', 'D'],
    INTENDANCY: ['E'],
    INFANTRY:   ['F'],
};
const COURSE_LABELS: Record<string, string> = {
    AVIATION: 'Aviação', INTENDANCY: 'Intendência', INFANTRY: 'Infantaria',
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];

function InstructorByYearSection({
    formData,
    setFormData,
    instructors,
    theme,
}: {
    formData: Omit<import('../types').Discipline, 'id'>;
    setFormData: React.Dispatch<React.SetStateAction<Omit<import('../types').Discipline, 'id'>>>;
    instructors: import('../types').Instructor[];
    theme: string;
}) {
    const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
    const [expanded, setExpanded] = useState(false);

    const isDark = theme === 'dark';
    const inputCls = `w-full px-2 py-1.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`;
    const mutedCls = isDark ? 'text-slate-400' : 'text-slate-500';

    // Derive enabled classIds from ppcLoads > 0
    const enabledClassIds = useMemo(() => {
        const ids: string[] = [];
        for (const [key, val] of Object.entries(formData.ppcLoads || {})) {
            if (!val) continue;
            const [course, yr] = key.split('_');
            const letters = COURSE_LETTERS[course] ?? [];
            for (const letter of letters) ids.push(`${yr}${letter}`);
        }
        return [...new Set(ids)].sort();
    }, [formData.ppcLoads]);

    const yearKey = String(selectedYear);
    const yearData = formData.instructorByYear?.[yearKey];

    // Effective values: year-specific falls back to default
    const hasYearOverride = !!yearData;
    const totalYears = Object.keys(formData.instructorByYear || {}).length;

    const sortedInstructors = useMemo(
        () => [...instructors].sort((a, b) => a.warName.localeCompare(b.warName)),
        [instructors],
    );

    const setYearTrigram = (trigram: string) => {
        setFormData(prev => {
            const byYear = { ...(prev.instructorByYear || {}) };
            byYear[yearKey] = { ...(byYear[yearKey] || {}), trigram: trigram || undefined };
            if (!byYear[yearKey].trigram && !byYear[yearKey].byClass) delete byYear[yearKey];
            return { ...prev, instructorByYear: byYear };
        });
    };

    const setYearClassTrigram = (classId: string, trigram: string) => {
        setFormData(prev => {
            const byYear = { ...(prev.instructorByYear || {}) };
            const entry = { ...(byYear[yearKey] || {}) };
            const byClass = { ...(entry.byClass || {}) };
            if (trigram) byClass[classId] = trigram;
            else delete byClass[classId];
            entry.byClass = Object.keys(byClass).length > 0 ? byClass : undefined;
            if (!entry.trigram && !entry.byClass) delete byYear[yearKey];
            else byYear[yearKey] = entry;
            return { ...prev, instructorByYear: byYear };
        });
    };

    const copyFromPrevYear = () => {
        const prevKey = String(selectedYear - 1);
        const prevData = formData.instructorByYear?.[prevKey];
        const sourceTrigram = prevData?.trigram ?? formData.instructorTrigram;
        const sourceByClass = prevData?.byClass ?? formData.instructorByClass;
        setFormData(prev => {
            const byYear = { ...(prev.instructorByYear || {}) };
            if (sourceTrigram || (sourceByClass && Object.keys(sourceByClass).length > 0)) {
                byYear[yearKey] = {
                    trigram: sourceTrigram || undefined,
                    byClass: sourceByClass && Object.keys(sourceByClass).length > 0 ? { ...sourceByClass } : undefined,
                };
            }
            return { ...prev, instructorByYear: byYear };
        });
    };

    const clearYear = () => {
        setFormData(prev => {
            const byYear = { ...(prev.instructorByYear || {}) };
            delete byYear[yearKey];
            return { ...prev, instructorByYear: byYear };
        });
    };

    // Group classIds by course year
    const byClassYear: Record<string, string[]> = {};
    for (const cid of enabledClassIds) {
        const yr = cid[0];
        if (!byClassYear[yr]) byClassYear[yr] = [];
        byClassYear[yr].push(cid);
    }

    return (
        <div className={`rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700/50 text-slate-300' : 'hover:bg-slate-50 text-slate-700'}`}
            >
                <span className="flex items-center gap-2">
                    <Users size={14} className={totalYears > 0 ? 'text-amber-500' : mutedCls} />
                    Docente por Ano Letivo
                    {totalYears > 0 && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                            {totalYears} ano(s) configurado(s)
                        </span>
                    )}
                </span>
                <span className={`text-xs ${mutedCls}`}>{expanded ? '▲' : '▼'}</span>
            </button>

            {expanded && (
                <div className={`px-3 pb-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <p className={`text-[10px] mt-2 mb-3 ${mutedCls}`}>
                        Configure o docente para um ano letivo específico. Sem configuração, usa o Docente Titular padrão.
                    </p>

                    {/* Year tabs */}
                    <div className="flex gap-1 mb-3 flex-wrap">
                        {YEAR_OPTIONS.map(yr => {
                            const hasConfig = !!formData.instructorByYear?.[String(yr)];
                            const isCurrent = yr === selectedYear;
                            return (
                                <button
                                    key={yr}
                                    type="button"
                                    onClick={() => setSelectedYear(yr)}
                                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors relative ${
                                        isCurrent
                                            ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                                            : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {yr}
                                    {hasConfig && (
                                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Year config panel */}
                    <div className={`rounded-lg p-3 space-y-3 ${isDark ? 'bg-slate-700/30' : 'bg-slate-50'}`}>
                        <div className="flex items-center justify-between">
                            <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                Configuração de {selectedYear}
                            </span>
                            <div className="flex gap-1.5">
                                <button
                                    type="button"
                                    onClick={copyFromPrevYear}
                                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${isDark ? 'border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400' : 'border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600'}`}
                                    title={`Copiar configuração de ${selectedYear - 1}`}
                                >
                                    ← Copiar de {selectedYear - 1}
                                </button>
                                {hasYearOverride && (
                                    <button
                                        type="button"
                                        onClick={clearYear}
                                        className="text-[10px] px-2 py-0.5 rounded border border-red-300 text-red-500 hover:bg-red-50 dark:border-red-800 dark:text-red-400 transition-colors"
                                    >
                                        Limpar
                                    </button>
                                )}
                            </div>
                        </div>

                        {!hasYearOverride && (
                            <p className={`text-[10px] italic ${mutedCls}`}>
                                Sem configuração específica — usa o Docente Titular padrão{formData.instructorTrigram ? ` (${formData.instructorTrigram})` : ''}.
                            </p>
                        )}

                        {/* Titular for this year */}
                        <div>
                            <label className={`text-[10px] font-semibold block mb-1 ${mutedCls}`}>
                                Docente Titular em {selectedYear}
                            </label>
                            <InstructorCombobox
                                instructors={sortedInstructors}
                                value={yearData?.trigram ?? ''}
                                onChange={setYearTitular}
                                emptyLabel={`— Usar padrão${formData.instructorTrigram ? ` (${formData.instructorTrigram})` : ''} —`}
                                size="sm"
                            />
                            {hasYearOverride && yearData?.trigram && (
                                <p className={`text-[10px] mt-0.5 text-blue-500`}>✓ {yearData.trigram} — titular para {selectedYear}</p>
                            )}
                        </div>

                        {/* Per-class overrides for this year */}
                        {enabledClassIds.length > 0 && (
                            <div>
                                <label className={`text-[10px] font-semibold block mb-1.5 ${mutedCls}`}>
                                    Exceções por Turma em {selectedYear}
                                </label>
                                <div className="space-y-2">
                                    {Object.entries(byClassYear).sort().map(([yr, classIds]) => (
                                        <div key={yr}>
                                            <p className={`text-[10px] uppercase mb-1 ${mutedCls}`}>{yr}º Esquadrão</p>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {classIds.map(cid => {
                                                    const course = Object.entries(COURSE_LETTERS).find(([, ls]) => ls.includes(cid[1]))?.[0];
                                                    const val = yearData?.byClass?.[cid] ?? '';
                                                    return (
                                                        <div key={cid}>
                                                            <label className={`text-[9px] font-medium mb-0.5 block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                                                {cid} — {course ? COURSE_LABELS[course] : ''}
                                                            </label>
                                                            <InstructorCombobox
                                                                instructors={sortedInstructors}
                                                                value={val}
                                                                onChange={v => setYearClassTrigram(cid, v)}
                                                                emptyLabel="— Titular do ano —"
                                                                size="sm"
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Summary of configured years */}
                    {totalYears > 0 && (
                        <div className={`mt-3 rounded p-2 text-[10px] ${isDark ? 'bg-slate-800' : 'bg-white border border-slate-200'}`}>
                            <p className={`font-semibold mb-1 ${mutedCls}`}>Anos configurados:</p>
                            {Object.entries(formData.instructorByYear || {}).sort().map(([yr, yd]) => (
                                <div key={yr} className={`flex items-center gap-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                    <span className="font-mono font-bold text-blue-500">{yr}</span>
                                    <span>→</span>
                                    <span>{yd.trigram || `padrão`}</span>
                                    {yd.byClass && Object.keys(yd.byClass).length > 0 && (
                                        <span className={mutedCls}>+ {Object.keys(yd.byClass).length} exceção(ões)</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    function setYearTitular(trigram: string) { setYearTrigram(trigram); }
}

export const DisciplineForm = ({ initialData, onSubmit, onCancel }: DisciplineFormProps) => {
    const { theme } = useTheme();
    const { instructors, locations, disciplineAreas } = useCourseStore();
    const [titularSearch, setTitularSearch] = useState('');
    const [substituteSearch, setSubstituteSearch] = useState('');
    const [showTitularDropdown, setShowTitularDropdown] = useState(false);
    const [showSubstituteDropdown, setShowSubstituteDropdown] = useState(false);
    const titularRef = useRef<HTMLDivElement>(null);
    const substituteRef = useRef<HTMLDivElement>(null);
    const activeLocations = locations.filter((l) => l.status === 'ATIVO').sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const [formData, setFormData] = useState<Omit<Discipline, 'id'>>({
        code: '',
        name: '',
        enabledCourses: [],
        enabledYears: [],
        ppcLoads: {},
        trainingField: 'GERAL',
        instructor: '',
        instructorTrigram: '',
        instructorByClass: {},
        instructorByYear: {},
        substituteTrigram: '',
        substituteHours: 0,
        location: 'Sala de Aula',
        color: '#3b82f6',
        noSpecificInstructor: false,
        areaId: undefined,
    });

    useEffect(() => {
        if (initialData) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                code: initialData.code || '',
                name: initialData.name,
                enabledCourses: initialData.enabledCourses || [],
                enabledYears: initialData.enabledYears || [],
                ppcLoads: initialData.ppcLoads || {},
                trainingField: initialData.trainingField || 'GERAL',
                instructor: initialData.instructor || '',
                instructorTrigram: initialData.instructorTrigram || '',
                instructorByClass: initialData.instructorByClass || {},
                instructorByYear: initialData.instructorByYear || {},
                substituteTrigram: initialData.substituteTrigram || '',
                substituteHours: initialData.substituteHours || 0,
                location: initialData.location || '',
                color: initialData.color,
                noSpecificInstructor: initialData.noSpecificInstructor || false,
                areaId: initialData.areaId,
            });
            // Pré-preenche os campos de busca com o nome do instrutor atual
            const titular = instructors.find(i => i.trigram === initialData.instructorTrigram);
            if (titular) setTitularSearch(`${titular.trigram} - ${titular.warName}`);
            const substitute = instructors.find(i => i.trigram === initialData.substituteTrigram);
            if (substitute) setSubstituteSearch(`${substitute.trigram} - ${substitute.warName}`);
        }
    }, [initialData, instructors]);

    // Fecha dropdowns ao clicar fora
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (titularRef.current && !titularRef.current.contains(e.target as Node)) setShowTitularDropdown(false);
            if (substituteRef.current && !substituteRef.current.contains(e.target as Node)) setShowSubstituteDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLoadChange = (course: string, year: number, value: number) => {
        setFormData(prev => {
            const newLoads = { ...prev.ppcLoads };
            const key = `${course}_${year}`;
            if (value > 0) {
                newLoads[key] = value;
            } else {
                delete newLoads[key];
            }
            return { ...prev, ppcLoads: newLoads };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Derivar enabledCourses e enabledYears a partir de ppcLoads
        const newCourses = new Set<"AVIATION" | "INTENDANCY" | "INFANTRY">();
        const newYears = new Set<CourseYear>();
        
        Object.entries(formData.ppcLoads || {}).forEach(([key, val]) => {
            if (val > 0) {
                const [c, y] = key.split('_');
                newCourses.add(c as "AVIATION" | "INTENDANCY" | "INFANTRY");
                newYears.add(parseInt(y) as CourseYear);
            }
        });

        onSubmit({
            ...formData,
            enabledCourses: Array.from(newCourses),
            enabledYears: Array.from(newYears),
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`rounded-xl shadow-2xl w-full max-w-md overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
                <div className={`px-6 py-4 border-b flex justify-between items-center ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50/50 border-gray-100'}`}>
                    <h2 className={`text-lg  ${theme === 'dark' ? 'text-slate-100' : 'text-gray-800'}`}>
                        {initialData ? 'Editar Disciplina' : 'Nova Disciplina'}
                    </h2>
                    <button onClick={onCancel} className={`transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}`}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                            <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Código</label>
                            <input
                                type="text"
                                required
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all uppercase ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-gray-300'}`}
                                placeholder="MAT101"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Nome da Disciplina</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-gray-300'}`}
                                placeholder="Ex: Cálculo I"
                            />
                        </div>
                    </div>

                    <div>
                        <label className={`block text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Matriz de Carga Horária (PPC)</label>
                        <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                            Insira a carga horária para cada curso e esquadrão. Valores maiores que 0 habilitam automaticamente a disciplina para aquela turma.
                        </p>
                        
                        <div className="overflow-x-auto rounded-lg border dark:border-slate-700">
                            <table className="w-full text-sm text-center">
                                <thead className={`${theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                                    <tr>
                                        <th className="px-2 py-2 w-24"></th>
                                        <th className="px-2 py-2">Aviação</th>
                                        <th className="px-2 py-2">Intendência</th>
                                        <th className="px-2 py-2">Infantaria</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'}`}>
                                    {([1, 2, 3, 4] as CourseYear[]).map(year => (
                                        <tr key={year} className={`${theme === 'dark' ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50/50'}`}>
                                            <td className={`px-2 py-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                                                {year}º Esq
                                            </td>
                                            {['AVIATION', 'INTENDANCY', 'INFANTRY'].map(course => {
                                                const key = `${course}_${year}`;
                                                const val = formData.ppcLoads?.[key] || 0;
                                                return (
                                                    <td key={course} className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={val === 0 ? '' : val}
                                                            onChange={e => handleLoadChange(course, year, parseInt(e.target.value) || 0)}
                                                            className={`w-full max-w-[80px] px-2 py-1 text-center border rounded transition-colors hide-arrows ${
                                                                val > 0 
                                                                    ? 'border-blue-400 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:border-blue-500/50 dark:text-blue-100 ring-1 ring-blue-500/20' 
                                                                    : (theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300 focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-700')
                                                            }`}
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Campo de Formação</label>
                            <select
                                value={formData.trainingField}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                onChange={e => setFormData({ ...formData, trainingField: e.target.value as any })}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-gray-300'}`}
                            >
                                <option value="ATIVIDADES_COMPLEMENTARES">Ativ. Complementares</option>
                                <option value="GERAL">Geral</option>
                                <option value="MILITAR">Militar</option>
                                <option value="PROFISSIONAL">Profissional</option>
                            </select>
                        </div>
                        <div>
                            <label className={`block text-sm mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Área Acadêmica</label>
                            <select
                                value={formData.areaId ?? ''}
                                onChange={e => setFormData({ ...formData, areaId: e.target.value || undefined })}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-gray-300'}`}
                            >
                                <option value="">— Nenhuma —</option>
                                {[...disciplineAreas].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(area => (
                                    <option key={area.id} value={area.id}>{area.code ? `[${area.code}] ` : ''}{area.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Docente Titular — pesquisa livre */}
                        <div ref={titularRef}>
                            <label className={`block text-sm mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Docente Titular</label>
                            <div className="flex gap-1 mb-1">
                                <button type="button" onClick={() => { setFormData({ ...formData, noSpecificInstructor: true, instructorTrigram: '', instructor: '' }); setTitularSearch('Sem instrutor (Setor)'); setShowTitularDropdown(false); }}
                                    className={`text-[10px] px-2 py-1 rounded border transition-colors ${formData.noSpecificInstructor ? 'bg-blue-600 text-white border-blue-600' : theme === 'dark' ? 'border-slate-600 text-slate-400 hover:border-blue-500' : 'border-gray-300 text-gray-500 hover:border-blue-400'}`}>
                                    Sem instrutor (Setor)
                                </button>
                                {(formData.instructorTrigram || formData.noSpecificInstructor) && (
                                    <button type="button" onClick={() => { setFormData({ ...formData, instructorTrigram: '', instructor: '', noSpecificInstructor: false }); setTitularSearch(''); }}
                                        className={`text-[10px] px-2 py-1 rounded border transition-colors ${theme === 'dark' ? 'border-slate-600 text-slate-400 hover:text-red-400' : 'border-gray-300 text-gray-400 hover:text-red-500'}`}>
                                        Limpar
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                                <input
                                    type="text"
                                    placeholder="Buscar por trigrama ou nome..."
                                    value={titularSearch}
                                    onChange={e => { setTitularSearch(e.target.value); setShowTitularDropdown(true); }}
                                    onFocus={() => setShowTitularDropdown(true)}
                                    className={`w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-gray-300'}`}
                                />
                                {showTitularDropdown && titularSearch.length > 0 && (
                                    <div className={`absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border shadow-xl ${theme === 'dark' ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
                                        {instructors
                                            .filter(i => {
                                                const term = titularSearch.toLowerCase();
                                                return i.trigram.toLowerCase().includes(term) || i.warName.toLowerCase().includes(term);
                                            })
                                            .map(inst => (
                                                <button key={inst.trigram} type="button"
                                                    onClick={() => { setFormData({ ...formData, instructorTrigram: inst.trigram, instructor: inst.warName, noSpecificInstructor: false }); setTitularSearch(`${inst.trigram} - ${inst.warName}`); setShowTitularDropdown(false); }}
                                                    className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 transition-colors ${theme === 'dark' ? 'border-slate-700 hover:bg-slate-700 text-slate-200' : 'border-gray-100 hover:bg-blue-50 text-slate-800'}`}>
                                                    <span className={`text-xs font-mono font-bold mr-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{inst.trigram}</span>
                                                    {inst.warName}
                                                    {inst.enabledDisciplines?.includes(initialData?.id || '') && (
                                                        <span className="ml-2 text-[9px] text-green-500">✓ habilitado</span>
                                                    )}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                            {formData.instructorTrigram && !formData.noSpecificInstructor && (
                                <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                                    ✓ {formData.instructorTrigram} selecionado — será habilitado para esta disciplina ao salvar
                                </p>
                            )}
                        </div>

                        {/* Docente Suplente — pesquisa livre */}
                        <div ref={substituteRef}>
                            <label className={`block text-sm mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Docente Suplente</label>
                            <div className="relative mt-6">
                                <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                                <input
                                    type="text"
                                    placeholder="Buscar por trigrama ou nome..."
                                    value={substituteSearch}
                                    onChange={e => { setSubstituteSearch(e.target.value); setShowSubstituteDropdown(true); }}
                                    onFocus={() => setShowSubstituteDropdown(true)}
                                    className={`w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-gray-300'}`}
                                />
                                {formData.substituteTrigram && (
                                    <button type="button" onClick={() => { setFormData({ ...formData, substituteTrigram: '' }); setSubstituteSearch(''); }}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400">
                                        <X size={14} />
                                    </button>
                                )}
                                {showSubstituteDropdown && substituteSearch.length > 0 && (
                                    <div className={`absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border shadow-xl ${theme === 'dark' ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
                                        {instructors
                                            .filter(i => {
                                                const term = substituteSearch.toLowerCase();
                                                return i.trigram.toLowerCase().includes(term) || i.warName.toLowerCase().includes(term);
                                            })
                                            .map(inst => (
                                                <button key={inst.trigram} type="button"
                                                    onClick={() => { setFormData({ ...formData, substituteTrigram: inst.trigram }); setSubstituteSearch(`${inst.trigram} - ${inst.warName}`); setShowSubstituteDropdown(false); }}
                                                    className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 transition-colors ${theme === 'dark' ? 'border-slate-700 hover:bg-slate-700 text-slate-200' : 'border-gray-100 hover:bg-blue-50 text-slate-800'}`}>
                                                    <span className={`text-xs font-mono font-bold mr-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{inst.trigram}</span>
                                                    {inst.warName}
                                                    {inst.enabledDisciplines?.includes(initialData?.id || '') && (
                                                        <span className="ml-2 text-[9px] text-green-500">✓ habilitado</span>
                                                    )}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                            {formData.substituteTrigram && (
                                <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                                    ✓ {formData.substituteTrigram} selecionado — será habilitado para esta disciplina ao salvar
                                </p>
                            )}
                        </div>
                    </div>

                    {formData.substituteTrigram && (
                        <div>
                            <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Carga Horária Suplente</label>
                            <input
                                type="number"
                                value={formData.substituteHours}
                                onChange={e => setFormData({ ...formData, substituteHours: parseInt(e.target.value) || 0 })}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-gray-300'}`}
                                placeholder="Horas dadas pelo suplente"
                                min={0}
                            />
                        </div>
                    )}

                    <InstructorByYearSection
                        formData={formData}
                        setFormData={setFormData}
                        instructors={instructors}
                        theme={theme}
                    />

                    <div>
                        <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Local da Aula (Opcional)</label>
                        <select
                            value={formData.location || ''}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-gray-300'}`}
                        >
                            <option value="">— Sem local definido —</option>
                            {activeLocations.map((l) => (
                                <option key={l.id} value={l.name}>{l.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Cor de Identificação</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={formData.color}
                                onChange={e => setFormData({ ...formData, color: e.target.value })}
                                className={`h-10 w-14 p-1 rounded border cursor-pointer ${theme === 'dark' ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-200'}`}
                            />
                            <span className={`text-sm uppercase font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{formData.color}</span>
                        </div>
                    </div>

                    <div className={`pt-4 flex justify-end gap-3 border-t mt-6 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-100'}`}>
                        <button
                            type="button"
                            onClick={onCancel}
                            className={`px-4 py-2 text-sm  rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-4 py-2 text-sm  text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all"
                        >
                            <Save size={18} />
                            Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
