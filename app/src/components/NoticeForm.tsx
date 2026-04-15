import { useState, useEffect } from 'react';
import { X, Check, Trash2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { NoticeType, SystemNotice } from '../types';

interface NoticeFormProps {
    initialData?: Partial<SystemNotice>;
    onSubmit: (data: Partial<SystemNotice>) => void;
    onDelete?: () => void;
    onCancel: () => void;
}

export const NoticeForm = ({ initialData, onSubmit, onDelete, onCancel }: NoticeFormProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [formData, setFormData] = useState<Partial<SystemNotice>>({
        type: 'INFO',
        title: '',
        description: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        targetSquadron: null,
    });

    useEffect(() => {
        if (initialData) setFormData(prev => ({ ...prev, ...initialData }));
    }, [initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const inputCls = `w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${isDark ? 'border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400' : 'border-slate-300 bg-white text-slate-900 placeholder-slate-400'}`;
    const labelCls = `block text-sm mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onCancel}>
            <div
                className={`w-full max-w-md rounded-2xl shadow-2xl border animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`px-6 py-4 border-b flex items-center justify-between flex-shrink-0 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                    <h2 className={`text-lg flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                        {initialData?.id ? 'Editar Aviso' : 'Novo Aviso'}
                    </h2>
                    <button onClick={onCancel} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}>
                        <X size={20} />
                    </button>
                </div>

                <form id="notice-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className={labelCls}>Título</label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className={inputCls}
                            placeholder="Ex: Manutenção na Rede"
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Tipo</label>
                        <select
                            value={formData.type}
                            onChange={e => setFormData({ ...formData, type: e.target.value as NoticeType })}
                            className={inputCls}
                        >
                            <option value="INFO">Informativo (Azul)</option>
                            <option value="WARNING">Atenção (Amarelo)</option>
                            <option value="URGENT">Urgente (Vermelho)</option>
                            <option value="EVENT">Evento (Roxo)</option>
                            <option value="EVALUATION">Avaliação (Laranja)</option>
                            <option value="GENERAL">Geral (Cinza)</option>
                        </select>
                    </div>

                    <div>
                        <label className={labelCls}>Esquadrão</label>
                        <select
                            value={formData.targetSquadron ?? ""}
                            onChange={e => setFormData({ ...formData, targetSquadron: e.target.value === "" ? null : Number(e.target.value) as any })}
                            className={inputCls}
                        >
                            <option value="">Todos os Esquadrões</option>
                            <option value="1">1º Esquadrão</option>
                            <option value="2">2º Esquadrão</option>
                            <option value="3">3º Esquadrão</option>
                            <option value="4">4º Esquadrão</option>
                        </select>
                    </div>

                    <div>
                        <label className={labelCls}>Descrição</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className={`${inputCls} min-h-[80px]`}
                            placeholder="Detalhes do aviso..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Data Início</label>
                            <input
                                type="date"
                                required
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Data Término</label>
                            <input
                                type="date"
                                required
                                value={formData.endDate}
                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                className={inputCls}
                            />
                        </div>
                    </div>
                </form>

                <div className={`flex items-center justify-between px-6 py-4 border-t flex-shrink-0 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'}`}>
                    <div>
                        {onDelete && (
                            <button
                                type="button"
                                onClick={onDelete}
                                className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1.5 text-sm"
                            >
                                <Trash2 size={15} /> Excluir
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className={`px-4 py-2 rounded-lg transition-colors text-sm ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form="notice-form"
                            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2 text-sm"
                        >
                            <Check size={16} />
                            {initialData?.id ? 'Salvar' : 'Criar Aviso'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
