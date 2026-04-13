import { useState, useEffect } from 'react';
import { X, Shield, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { NoticeType, UserRole, CourseYear, SystemNotice } from '../types';

interface NoticeFormProps {
    initialData?: Partial<SystemNotice>;
    onSubmit: (data: Partial<SystemNotice>) => void;
    onCancel: () => void;
}

export const NoticeForm = ({ initialData, onSubmit, onCancel }: NoticeFormProps) => {
    const { theme } = useTheme();

    const [formData, setFormData] = useState<Partial<SystemNotice>>({
        type: 'INFO',
        title: '',
        description: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        targetRoles: ['CADETE', 'DOCENTE'],
        targetSquadron: undefined,
        targetCourse: 'ALL',
        targetClass: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                ...initialData
            }));
        }
    }, [initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onCancel}>
            <div
                className={`w-full max-w-2xl rounded-2xl shadow-2xl border animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`px-6 py-4 border-b flex items-center justify-between flex-shrink-0 ${theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'
                    }`}>
                    <h2 className={`text-lg  flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                        {initialData?.id ? 'Editar Aviso' : 'Novo Aviso'}
                    </h2>
                    <button
                        onClick={onCancel}
                        className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
                            }`}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form id="notice-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Título</label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none placeholder-slate-400 ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
                                placeholder="Ex: Manutenção na Rede"
                            />
                        </div>
                        <div>
                            <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Tipo</label>
                            <select
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value as NoticeType })}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
                            >
                                <option value="INFO">Informativo (Azul)</option>
                                <option value="WARNING">Atenção (Amarelo)</option>
                                <option value="URGENT">Urgente (Vermelho)</option>
                                <option value="EVENT">Evento (Roxo)</option>
                                <option value="EVALUATION">Avaliação (Índigo)</option>
                                <option value="GENERAL">Geral (Cinza)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Descrição</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none min-h-[100px] placeholder-slate-400 ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
                            placeholder="Detalhes do aviso..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Data Início</label>
                            <input
                                type="date"
                                required
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
                            />
                        </div>
                        <div>
                            <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Data Término</label>
                            <input
                                type="date"
                                required
                                value={formData.endDate}
                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
                            />
                        </div>
                    </div>

                    <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <h3 className={`text-sm  mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                            <Shield size={16} /> Público Alvo
                        </h3>

                        <div className="flex flex-wrap gap-4 mb-6">
                            {['CADETE', 'DOCENTE'].map(role => (
                                <label key={role} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.targetRoles?.includes(role as UserRole)}
                                        onChange={e => {
                                            const roles = new Set(formData.targetRoles);
                                            if (e.target.checked) roles.add(role as UserRole);
                                            else roles.delete(role as UserRole);
                                            setFormData({ ...formData, targetRoles: Array.from(roles) });
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className={`text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                                        {role === 'CADETE' ? 'Ensino' : 'Docente'}
                                    </span>
                                </label>
                            ))}
                        </div>

                        <div className="mb-6">
                            <label className={`block text-xs  uppercase mb-3 tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Público Alvo (Curso)</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                    { id: 'ALL', label: 'Geral', color: '#64748b' },
                                    { id: 'AVIATION', label: 'Aviação', color: '#1e40af' },
                                    { id: 'INTENDANCY', label: 'Intendência', color: '#d97706' },
                                    { id: 'INFANTRY', label: 'Infantaria', color: '#15803d' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, targetCourse: opt.id as any })}
                                        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-[10px]  uppercase transition-all ${formData.targetCourse === opt.id ? 'bg-blue-600 text-white border-blue-700 shadow-md scale-[1.02]' : (theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300')}`}
                                    >
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={`block text-xs  uppercase mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Esquadrão Específico (Opcional)</label>
                                <select
                                    value={formData.targetSquadron || ''}
                                    onChange={e => {
                                        const newSquadron = e.target.value ? Number(e.target.value) as CourseYear : null;
                                        setFormData({
                                            ...formData,
                                            targetSquadron: newSquadron,
                                            targetClass: null // Limpa turma quando altera o esquadrão
                                        });
                                    }}
                                    className={`w-full px-3 py-2 border rounded-lg text-sm ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
                                >
                                    <option value="">Todos</option>
                                    <option value="1">1º Esquadrão</option>
                                    <option value="2">2º Esquadrão</option>
                                    <option value="3">3º Esquadrão</option>
                                    <option value="4">4º Esquadrão</option>
                                </select>
                            </div>
                            <div>
                                <label className={`block text-xs  uppercase mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Turma (Opcional)</label>
                                <select
                                    value={formData.targetClass || ''}
                                    onChange={e => setFormData({ ...formData, targetClass: e.target.value || null })}
                                    className={`w-full px-3 py-2 border rounded-lg text-sm ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
                                    disabled={!formData.targetSquadron}
                                >
                                    <option value="">Todas as Turmas do Esquadrão</option>
                                    <optgroup label="Por Curso">
                                        <option value="COURSE:AVIATION">Todas da Aviação</option>
                                        <option value="COURSE:INTENDANCY">Todas da Intendência</option>
                                        <option value="COURSE:INFANTRY">Todas da Infantaria</option>
                                    </optgroup>
                                    {formData.targetSquadron && (
                                        <optgroup label="Turmas Específicas">
                                            <option value={`${formData.targetSquadron}A`}>Turma {formData.targetSquadron}A</option>
                                            <option value={`${formData.targetSquadron}B`}>Turma {formData.targetSquadron}B</option>
                                            <option value={`${formData.targetSquadron}C`}>Turma {formData.targetSquadron}C</option>
                                            <option value={`${formData.targetSquadron}D`}>Turma {formData.targetSquadron}D</option>
                                            <option value={`${formData.targetSquadron}E`}>Turma {formData.targetSquadron}E (Int)</option>
                                            <option value={`${formData.targetSquadron}F`}>Turma {formData.targetSquadron}F (Inf)</option>
                                        </optgroup>
                                    )}
                                </select>
                                <p className="text-xs text-slate-400 mt-1">
                                    {!formData.targetSquadron ? 'Selecione um esquadrão primeiro.' : 'Selecione um grupo ou turma específica.'}
                                </p>
                            </div>
                        </div>
                    </div>

                </form>
                <div className={`flex justify-end gap-3 px-6 py-4 border-t flex-shrink-0 ${theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'}`}>
                    <button
                        type="button"
                        onClick={onCancel}
                        className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="notice-form"
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
                    >
                        <Check size={18} />
                        {initialData?.id ? 'Salvar Alterações' : 'Criar Aviso'}
                    </button>
                </div>
            </div>
        </div>
    );
};
