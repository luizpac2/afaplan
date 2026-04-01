
import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useCourseStore } from '../store/useCourseStore';
import type { Discipline, CourseYear } from '../types';

interface DisciplineFormProps {
    initialData?: Discipline;
    onSubmit: (data: Omit<Discipline, 'id'>) => void;
    onCancel: () => void;
}

export const DisciplineForm = ({ initialData, onSubmit, onCancel }: DisciplineFormProps) => {
    const { theme } = useTheme();
    const { instructors, classes } = useCourseStore();
    const [formData, setFormData] = useState<Omit<Discipline, 'id'>>({
        code: '',
        name: '',
        enabledCourses: [],
        enabledYears: [],
        ppcLoads: {},
        trainingField: 'GERAL',
        instructor: '',
        instructorTrigram: '',
        substituteTrigram: '',
        substituteHours: 0,
        location: 'Sala de Aula',
        color: '#3b82f6',
        noSpecificInstructor: false
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
                substituteTrigram: initialData.substituteTrigram || '',
                substituteHours: initialData.substituteHours || 0,
                location: initialData.location || '',
                color: initialData.color,
                noSpecificInstructor: initialData.noSpecificInstructor || false
            });
        }
    }, [initialData]);

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

                    <div>
                        <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Campo de Formação</label>
                        <select
                            value={formData.trainingField}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onChange={e => setFormData({ ...formData, trainingField: e.target.value as any })}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-gray-300'}`}
                        >
                            <option value="ATIVIDADES_COMPLEMENTARES">Atividades Complementares</option>
                            <option value="GERAL">Geral</option>
                            <option value="MILITAR">Militar</option>
                            <option value="PROFISSIONAL">Profissional</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Docente Titular</label>
                            <select
                                value={formData.noSpecificInstructor ? '__NO_INSTRUCTOR__' : formData.instructorTrigram}
                                onChange={e => {
                                    const trigram = e.target.value;
                                    if (trigram === '__NO_INSTRUCTOR__') {
                                        setFormData({
                                            ...formData,
                                            instructorTrigram: '',
                                            instructor: '',
                                            noSpecificInstructor: true
                                        });
                                    } else {
                                        const inst = instructors.find(i => i.trigram === trigram);
                                        setFormData({
                                            ...formData,
                                            instructorTrigram: trigram,
                                            instructor: inst ? inst.warName : '', // Keep legacy sync
                                            noSpecificInstructor: false
                                        });
                                    }
                                }}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-gray-300'}`}
                            >
                                <option value="">Nenhum</option>
                                <option value="__NO_INSTRUCTOR__">Sem instrutor (Setor)</option>
                                {instructors
                                    .filter(inst => {
                                        // 1. If editing, check if enabled for this specific discipline
                                        if (initialData?.id && !inst.enabledDisciplines?.includes(initialData.id)) return false;

                                        // 2. Check squadron/year compatibility
                                        if (formData.enabledYears.length > 0) {
                                            const hasClassInYears = inst.enabledClasses?.some(cid => {
                                                const classObj = classes.find(c => c.id === cid);
                                                return classObj && formData.enabledYears.includes(classObj.year);
                                            });
                                            if (!hasClassInYears) return false;
                                        }

                                        return true;
                                    })
                                    .map(inst => (
                                        <option key={inst.trigram} value={inst.trigram}>
                                            {inst.trigram} - {inst.warName}
                                        </option>
                                    ))}
                            </select>
                            {initialData?.id && instructors.filter(i => i.enabledDisciplines?.includes(initialData.id)).length === 0 && (
                                <p className="text-[10px] text-amber-600 mt-1 ">⚠️ Nenhum docente habilitado para esta disciplina.</p>
                            )}
                        </div>
                        <div>
                            <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Docente Suplente</label>
                            <select
                                value={formData.substituteTrigram}
                                onChange={e => setFormData({ ...formData, substituteTrigram: e.target.value })}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-gray-300'}`}
                            >
                                <option value="">Nenhum</option>
                                {instructors
                                    .filter(inst => {
                                        // 1. If editing, check if enabled for this specific discipline
                                        if (initialData?.id && !inst.enabledDisciplines?.includes(initialData.id)) return false;

                                        // 3. Check squadron/year compatibility (must be enabled for at least one class of that year)
                                        if (formData.enabledYears.length > 0) {
                                            const hasClassInYears = inst.enabledClasses?.some(cid => {
                                                const classObj = classes.find(c => c.id === cid);
                                                return classObj && formData.enabledYears.includes(classObj.year);
                                            });
                                            if (!hasClassInYears) return false;
                                        }

                                        return true;
                                    })
                                    .map(inst => (
                                        <option key={inst.trigram} value={inst.trigram}>
                                            {inst.trigram} - {inst.warName}
                                        </option>
                                    ))}
                            </select>
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

                    <div>
                        <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Local da Aula (Opcional)</label>
                        <input
                            type="text"
                            value={formData.location || ''}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-gray-300'}`}
                            placeholder="Ex: Sala de Aula, Cinema, Ginásio"
                        />
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
