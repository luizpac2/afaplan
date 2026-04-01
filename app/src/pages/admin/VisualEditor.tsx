import { useState, useEffect, useRef } from 'react';
import { useCourseStore } from '../../store/useCourseStore';
import { useTheme } from '../../contexts/ThemeContext';
import {
    Palette, Info, Save, RotateCcw,
    AlertCircle, Tag
} from 'lucide-react';
import type { VisualConfig } from '../../types';

const DEFAULT_CONFIGS: VisualConfig[] = [
    {
        id: 'first-lesson',
        name: 'Início de Disciplina (Nova)',
        description: 'Destaque para a primeira aula de cada matéria.',
        active: true,
        ruleType: 'FIRST_LESSON',
        priority: 2,
        ringColor: '#FFFFFF',
        ringWidth: 2,
        showRing: true,
        showTag: true,
        tagText: 'NOVA',
        tagBgColor: '#FFFFFF',
        tagTextColor: '#2563eb', // text-blue-600
        showIcon: true,
        iconName: 'AlertCircle'
    },
    {
        id: 'last-lesson',
        name: 'Fim de Disciplina (Última)',
        description: 'Destaque para a aula de encerramento da matéria.',
        active: true,
        ruleType: 'LAST_LESSON',
        priority: 3,
        ringColor: '#FFFFFF',
        ringWidth: 2,
        showRing: true,
        showTag: true,
        tagText: 'ÚLTIMA',
        tagBgColor: '#FFFFFF',
        tagTextColor: '#2563eb',
        showIcon: true,
        iconName: 'AlertCircle'
    },
    {
        id: 'eval-partial',
        name: 'Prova Parcial',
        description: 'Destaque para avaliações parciais.',
        active: true,
        ruleType: 'EVALUATION',
        evaluationType: 'PARTIAL',
        priority: 10,
        ringColor: '#f59e0b', // Amber/Laranja
        ringWidth: 3,
        showRing: true,
        showTag: true,
        tagText: 'PARCIAL',
        tagBgColor: '#f59e0b',
        tagTextColor: '#FFFFFF',
        showIcon: true,
        iconName: 'Info'
    },
    {
        id: 'eval-final',
        name: 'Prova Final',
        description: 'Destaque para avaliações finais.',
        active: true,
        ruleType: 'EVALUATION',
        evaluationType: 'FINAL',
        priority: 11,
        ringColor: '#dc2626', // Red
        ringWidth: 3,
        showRing: true,
        showTag: true,
        tagText: 'FINAL',
        tagBgColor: '#dc2626',
        tagTextColor: '#FFFFFF',
        showIcon: true,
        iconName: 'Info'
    },
    {
        id: 'eval-exam',
        name: 'Exame Especial',
        description: 'Destaque para exames.',
        active: true,
        ruleType: 'EVALUATION',
        evaluationType: 'EXAM',
        priority: 12,
        ringColor: '#7c3aed', // Purple
        ringWidth: 3,
        showRing: true,
        showTag: true,
        tagText: 'EXAME',
        tagBgColor: '#7c3aed',
        tagTextColor: '#FFFFFF',
        showIcon: true,
        iconName: 'Info'
    },
    {
        id: 'eval-second',
        name: 'Segunda Chamada',
        description: 'Destaque para provas de segunda chamada.',
        active: true,
        ruleType: 'EVALUATION',
        evaluationType: 'SECOND_CHANCE',
        priority: 13,
        ringColor: '#eab308', // Yellow
        ringWidth: 3,
        showRing: true,
        showTag: true,
        tagText: '2ª CHAMADA',
        tagBgColor: '#eab308',
        tagTextColor: '#FFFFFF',
        showIcon: true,
        iconName: 'Info'
    },
    {
        id: 'eval-review',
        name: 'Revisão',
        description: 'Destaque para revisões de prova.',
        active: true,
        ruleType: 'EVALUATION',
        evaluationType: 'REVIEW',
        priority: 14,
        ringColor: '#ec4899', // Pink
        ringWidth: 3,
        showRing: true,
        showTag: true,
        tagText: 'REVISÃO',
        tagBgColor: '#ec4899',
        tagTextColor: '#FFFFFF',
        showIcon: true,
        iconName: 'Info'
    }
];

export const VisualEditor = () => {
    const { theme } = useTheme();
    const { visualConfigs, updateVisualConfig } = useCourseStore();
    const [editingConfigs, setEditingConfigs] = useState<VisualConfig[]>([]);
    const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
    const initializedRef = useRef(false);
    const prevVisualConfigsRef = useRef<VisualConfig[]>([]);

    useEffect(() => {
        // Deep-compare to avoid spurious re-runs
        const hasChanged = JSON.stringify(visualConfigs) !== JSON.stringify(prevVisualConfigsRef.current);
        if (!hasChanged && initializedRef.current) return;

        prevVisualConfigsRef.current = visualConfigs;
        initializedRef.current = true;

        setEditingConfigs(prev => {
            const merged = DEFAULT_CONFIGS.map(defaultCfg => {
                const stored = visualConfigs.find(v => v.id === defaultCfg.id);
                const current = prev.find(v => v.id === defaultCfg.id);

                // Keep local edits if this item is dirty
                if (dirtyIds.has(defaultCfg.id) && current) return current;

                // Stored (Firestore) takes priority over defaults
                return stored ? { ...defaultCfg, ...stored } : defaultCfg;
            });

            // Preserve any custom rules from Firestore not in defaults
            const customRules = visualConfigs.filter(v => !DEFAULT_CONFIGS.some(d => d.id === v.id));
            const mergedCustoms = customRules.map(stored => {
                const current = prev.find(v => v.id === stored.id);
                return (dirtyIds.has(stored.id) && current) ? current : stored;
            });

            return [...merged, ...mergedCustoms].sort((a, b) => a.priority - b.priority);
        });
    }, [visualConfigs]);

    const handleUpdate = (id: string, updates: Partial<VisualConfig>) => {
        setDirtyIds(prev => new Set(prev).add(id));
        setEditingConfigs(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const handleSave = async (config: VisualConfig) => {
        try {
            // Call store update (updates local state)
            updateVisualConfig(config.id, config);
            // Also directly save to Supabase to guarantee persistence
            const { saveDocument } = await import('../../services/supabaseService');
            await saveDocument('visualConfigs', config.id, config);
            setDirtyIds(prev => {
                const next = new Set(prev);
                next.delete(config.id);
                return next;
            });
            alert('Configuração salva com sucesso!');
        } catch (err) {
            console.error('Erro ao salvar configuração:', err);
            alert('Erro ao salvar. Verifique o console.');
        }
    };

    const resetToDefault = (id: string) => {
        const defaultConfig = DEFAULT_CONFIGS.find(c => c.id === id);
        if (defaultConfig) {
            handleUpdate(id, defaultConfig);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto pb-20">
            <header className="mb-8">
                <h1 className={`text-3xl  tracking-tight flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    <Palette className="text-blue-500" size={32} />
                    Editor de Estilos Visuais
                </h1>
                <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Customize como as aulas e eventos são destacados no calendário.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {editingConfigs.map((config) => (
                    <div
                        key={config.id}
                        className={`rounded-2xl border overflow-hidden shadow-xl transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                            }`}
                    >
                        {/* Header Rule */}
                        <div className={`px-6 py-4 border-b flex items-center justify-between ${theme === 'dark' ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'
                            }`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg bg-blue-500 text-white`}>
                                    <Tag size={18} />
                                </div>
                                <div>
                                    <h3 className={` ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{config.name}</h3>
                                    <p className="text-[10px] uppercase tracking-wider  opacity-50">{config.ruleType}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleUpdate(config.id, { active: !config.active })}
                                    className={`px-3 py-1 rounded-full text-[10px]  transition-all ${config.active
                                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                                        }`}
                                >
                                    {config.active ? 'ATIVO' : 'INATIVO'}
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Preview Area */}
                            <div>
                                <label className={`text-[10px]  uppercase tracking-widest block mb-3 opacity-50`}>Preview</label>
                                <div className="flex justify-center p-6 rounded-xl bg-slate-100 dark:bg-slate-950/50 border-2 border-dashed border-slate-300 dark:border-slate-800">
                                    <div
                                        className="w-32 h-16 rounded shadow-lg p-2 flex flex-col justify-between relative overflow-hidden"
                                        style={{
                                            backgroundColor: '#3b82f6', // blue-500 mock color
                                            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                                            border: config.showRing ? `${config.ringWidth}px solid ${config.ringColor}` : '1px solid rgba(255,255,255,0.2)'
                                        }}
                                    >
                                        <div className="flex items-center justify-between pointer-events-none">
                                            <div className="flex items-center gap-1">
                                                {config.showIcon && <AlertCircle size={10} style={{ color: 'white' }} />}
                                                <span className="text-[10px]  text-white leading-none">MAT101</span>
                                            </div>
                                            {config.showTag && (
                                                <span
                                                    className="px-1 rounded-[3px] text-[7px]  uppercase tracking-tighter align-middle"
                                                    style={{ backgroundColor: config.tagBgColor, color: config.tagTextColor }}
                                                >
                                                    {config.tagText || 'TAG'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[8px] text-white/80 ">Turma A • Aula 1</div>
                                    </div>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Ring Settings */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs  mb-1.5 block">Contorno</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="color"
                                                value={config.ringColor}
                                                onChange={(e) => handleUpdate(config.id, { ringColor: e.target.value })}
                                                className="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent"
                                            />
                                            <div className="flex-1">
                                                <input
                                                    type="range" min="1" max="4"
                                                    value={config.ringWidth}
                                                    onChange={(e) => handleUpdate(config.id, { ringWidth: parseInt(e.target.value) })}
                                                    className="w-full"
                                                />
                                                <div className="flex justify-between text-[10px] opacity-50 ">
                                                    <span>Espessura: {config.ringWidth}px</span>
                                                </div>
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-2 mt-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={config.showRing}
                                                onChange={(e) => handleUpdate(config.id, { showRing: e.target.checked })}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-xs group-hover:text-blue-500 transition-colors">Exibir contorno</span>
                                        </label>
                                    </div>

                                    <div>
                                        <label className="text-xs  mb-1.5 block">Ícone</label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={config.showIcon}
                                                onChange={(e) => handleUpdate(config.id, { showIcon: e.target.checked })}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-xs group-hover:text-blue-500 transition-colors">Exibir ícone de alerta</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Tag Settings */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs  mb-1.5 block">Tag Informativa</label>
                                        <input
                                            type="text"
                                            placeholder="Texto da Tag"
                                            value={config.tagText || ''}
                                            onChange={(e) => handleUpdate(config.id, { tagText: e.target.value.toUpperCase() })}
                                            className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                                                }`}
                                        />
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div>
                                                <p className="text-[9px]  opacity-50 mb-1">Fundo</p>
                                                <input
                                                    type="color"
                                                    value={config.tagBgColor}
                                                    onChange={(e) => handleUpdate(config.id, { tagBgColor: e.target.value })}
                                                    className="w-full h-8 rounded cursor-pointer border-none bg-transparent"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[9px]  opacity-50 mb-1">Texto</p>
                                                <input
                                                    type="color"
                                                    value={config.tagTextColor}
                                                    onChange={(e) => handleUpdate(config.id, { tagTextColor: e.target.value })}
                                                    className="w-full h-8 rounded cursor-pointer border-none bg-transparent"
                                                />
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-2 mt-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={config.showTag}
                                                onChange={(e) => handleUpdate(config.id, { showTag: e.target.checked })}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-xs group-hover:text-blue-500 transition-colors">Exibir tag</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Rule Actions */}
                        <div className={`px-6 py-4 flex items-center justify-between ${theme === 'dark' ? 'bg-slate-800 border-t border-slate-700' : 'bg-slate-50 border-t border-slate-100'
                            }`}>
                            <button
                                onClick={() => resetToDefault(config.id)}
                                className={`flex items-center gap-1.5 text-xs  px-3 py-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                                    }`}
                            >
                                <RotateCcw size={14} /> Resetar
                            </button>
                            <button
                                onClick={() => handleSave(config)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white  py-2 px-6 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                            >
                                <Save size={16} /> Salvar Regra
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className={`mt-12 p-6 rounded-2xl border ${theme === 'dark' ? 'bg-blue-900/10 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'
                }`}>
                <div className="flex gap-4">
                    <Info className="flex-shrink-0 mt-1" />
                    <div>
                        <h4 className=" mb-1">Dica de Administração</h4>
                        <p className="text-sm">
                            As alterações feitas aqui refletem instantaneamente em todos os calendários do sistema para todos os usuários.
                            Use cores de alto contraste para garantir que os avisos sejam notados tanto no modo claro quanto no modo escuro.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
