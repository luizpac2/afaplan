
import { useState, useMemo } from 'react';
import { useCourseStore } from '../store/useCourseStore';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Users, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { COHORT_COLORS, getCohortColorTokens } from '../utils/cohortColors';
import type { Cohort } from '../types';

export const CohortManager = () => {
    const { cohorts, classes, addCohort, updateCohort, deleteCohort } = useCourseStore();
    const { userProfile } = useAuth();
    const { theme } = useTheme();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; cohortId: string | null; cohortName: string }>({ isOpen: false, cohortId: null, cohortName: '' });
    const [formData, setFormData] = useState<Omit<Cohort, 'id'>>({
        name: '',
        entryYear: new Date().getFullYear(),
        color: 'blue'
    });

    const canEdit = useMemo(() => {
        return ['SUPER_ADMIN', 'ADMIN'].includes(userProfile?.role || '');
    }, [userProfile]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            updateCohort(editingId, formData);
            setEditingId(null);
            setIsAdding(false); // Close form after editing
        } else {
            addCohort({
                id: crypto.randomUUID(),
                ...formData
            });
            setIsAdding(false);
        }
        setFormData({ name: '', entryYear: new Date().getFullYear(), color: 'blue' });
    };

    const startEdit = (cohort: Cohort) => {
        setFormData({
            name: cohort.name,
            entryYear: cohort.entryYear,
            color: cohort.color || 'blue' // Default to blue if color is missing
        });
        setEditingId(cohort.id);
        setIsAdding(true);
    };

    const handleDelete = () => {
        if (deleteConfirm.cohortId) {
            deleteCohort(deleteConfirm.cohortId);
        }
        setDeleteConfirm({ isOpen: false, cohortId: null, cohortName: '' });
    };

    return (
        <div className={`rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border p-6 mb-8 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className={`text-xl  flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                        <Users className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} size={24} />
                        Gerenciar Turmas
                    </h2>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Defina o nome das turmas, ano de ingresso e cor tradicional.</p>
                </div>
                {!isAdding && canEdit && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg  transition-colors ${theme === 'dark' ? 'bg-slate-700 text-blue-400 hover:bg-slate-600' : 'bg-slate-50 text-blue-600 hover:bg-slate-100'}`}
                    >
                        <Plus size={18} />
                        Nova Turma
                    </button>
                )}
            </div>

            {isAdding && (
                <form onSubmit={handleSubmit} className={`mb-6 p-5 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                    {/* Nome e Ano */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                            <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Nome da Turma</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Turma Jaguar"
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${theme === 'dark' ? 'bg-slate-800 border-slate-500 text-slate-100' : 'border-slate-300'}`}
                            />
                        </div>
                        <div>
                            <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Ano de Ingresso</label>
                            <input
                                type="number"
                                required
                                min="2000"
                                max="2100"
                                value={formData.entryYear}
                                onChange={e => setFormData({ ...formData, entryYear: Number(e.target.value) })}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${theme === 'dark' ? 'bg-slate-800 border-slate-500 text-slate-100' : 'border-slate-300'}`}
                            />
                        </div>
                    </div>

                    {/* Cor Tradicional - Row própria */}
                    <div className="mb-4">
                        <label className={`block text-sm  mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Cor Tradicional da AFA</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {Object.entries(COHORT_COLORS).map(([colorKey, colorData]) => {
                                const isSelected = formData.color === colorKey;
                                return (
                                    <button
                                        key={colorKey}
                                        type="button"
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        onClick={() => setFormData({ ...formData, color: colorKey as any })}
                                        className={`p-4 rounded-lg border-2 transition-all ${isSelected
                                            ? `border-slate-800 ring-4 shadow-md scale-105 ${theme === 'dark' ? 'border-slate-100 ring-slate-600' : 'ring-slate-200'}`
                                            : `hover:scale-102 ${theme === 'dark' ? 'border-slate-600 hover:border-slate-500' : 'border-slate-300 hover:border-slate-400'}`
                                            }`}
                                        style={{ backgroundColor: colorData.light }}
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <div
                                                className="w-12 h-12 rounded-full border-3 border-white shadow-md"
                                                style={{ backgroundColor: colorData.primary }}
                                            />
                                            <span className="text-sm  text-slate-800">
                                                {colorData.name}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className={`flex justify-end gap-2 mt-5 pt-4 border-t ${theme === 'dark' ? 'border-slate-600' : 'border-slate-200'}`}>
                        <button
                            type="button"
                            onClick={() => {
                                setIsAdding(false);
                                setEditingId(null);
                                setFormData({ name: '', entryYear: new Date().getFullYear(), color: 'blue' });
                            }}
                            className={`px-4 py-2 rounded-lg  transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-600' : 'text-slate-600 hover:bg-slate-200'}`}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700  transition-colors"
                        >
                            <Save size={18} />
                            Salvar
                        </button>
                    </div>
                </form>
            )}

            <div className="overflow-x-auto">
                <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'}`}>
                    <thead className={theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-50/50'}>
                        <tr>
                            <th className={`px-4 py-3 text-left text-xs  uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Cor</th>
                            <th className={`px-4 py-3 text-left text-xs  uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Nome da Turma</th>
                            <th className={`px-4 py-3 text-left text-xs  uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Ano de Ingresso</th>
                            <th className={`px-4 py-3 text-left text-xs  uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Total Cadetes</th>
                            {canEdit && <th className={`px-4 py-3 text-right text-xs  uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Ações</th>}
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'}`}>
                        {cohorts.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                                    Nenhuma turma cadastrada.
                                </td>
                            </tr>
                        ) : (
                            cohorts.sort((a, b) => b.entryYear - a.entryYear).map((cohort) => {
                                const currentYear = new Date().getFullYear();
                                const squadron = currentYear - cohort.entryYear + 1;
                                let squadronLabel = '-';
                                if (squadron >= 1 && squadron <= 4) squadronLabel = `${squadron}º Esquadrão`;
                                else if (squadron > 4) squadronLabel = 'Formada';
                                else squadronLabel = 'Futura';

                                // Defensive: use blue as default if color is missing
                                const cohortColor = getCohortColorTokens(cohort.color || 'blue');

                                return (

                                    <tr key={cohort.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50/50'}`}>
                                        <td className="px-4 py-3">
                                            <div
                                                className="w-8 h-8 rounded-full border-2 border-white shadow-md"
                                                style={{ backgroundColor: cohortColor.primary }}
                                                title={cohortColor.name}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className="text-sm "
                                                style={{ color: cohortColor.primary }}
                                            >
                                                {cohort.name}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{cohort.entryYear}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <span
                                                className="px-3 py-1 rounded-lg text-xs  border-2"
                                                style={{
                                                    backgroundColor: squadronLabel.includes('Esquadrão') ? cohortColor.light :
                                                        squadronLabel === 'Formada' ? '#dcfce7' : '#f4f4f5',
                                                    color: squadronLabel.includes('Esquadrão') ? cohortColor.dark :
                                                        squadronLabel === 'Formada' ? '#15803d' : '#71717a',
                                                    borderColor: squadronLabel.includes('Esquadrão') ? cohortColor.border : 'transparent'
                                                }}
                                            >
                                                {squadronLabel}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 text-sm  ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                            {squadron >= 1 && squadron <= 4 ? (
                                                classes
                                                    .filter(c => c.year === squadron)
                                                    .reduce((acc: number, curr) => acc + (curr.studentCount || 0), 0)
                                            ) : '-'}
                                        </td>
                                        {canEdit && (
                                            <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                <button
                                                    onClick={() => startEdit(cohort)}
                                                    className={`p-1.5 rounded transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-blue-400 hover:bg-blue-900/40' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm({ isOpen: true, cohortId: cohort.id, cohortName: cohort.name })}
                                                    className={`p-1.5 rounded transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-red-400 hover:bg-red-900/40' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, cohortId: null, cohortName: '' })}
                onConfirm={handleDelete}
                title="Excluir Turma"
                message={`Tem certeza que deseja excluir a turma "${deleteConfirm.cohortName}"? Esta ação não pode ser desfeita.`}
                confirmText="Excluir"
                cancelText="Cancelar"
                type="danger"
            />
        </div>
    );
};
