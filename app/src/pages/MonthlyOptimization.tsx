import { useState } from 'react';
import { Calendar, Filter, Zap } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const MonthlyOptimization = () => {
    const { theme } = useTheme();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizationResults, setOptimizationResults] = useState<null | {
        conflictsResolved: number;
        distributionScore: number;
        suggestions: string[];
    }>(null);

    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const handleApplySuggestion = (index: number) => {
        alert('Sugestão aplicada com sucesso! (Simulação)');
        setOptimizationResults(prev => {
            if (!prev) return null;
            return {
                ...prev,
                suggestions: prev.suggestions.filter((_, i) => i !== index),
                conflictsResolved: prev.conflictsResolved + 1,
                distributionScore: prev.distributionScore + 2
            };
        });
    };

    const handleApplyAll = () => {
        alert('Todas as sugestões foram aplicadas! (Simulação)');
        setOptimizationResults(null);
    };

    const handleOptimize = () => {
        setIsOptimizing(true);
        setOptimizationResults(null);

        // Simulate complex calculation
        setTimeout(() => {
            setIsOptimizing(false);
            setOptimizationResults({
                conflictsResolved: 3,
                distributionScore: 92,
                suggestions: [
                    'Mover "Cálculo I" da Turma 1A de Sexta-feira 10:40 para Terça-feira 07:00 (1º Tempo) para eliminar janela matinal.',
                    'Agrupar turmas de "Educação Física" (atualmente dispersas) no período da tarde de Quinta-feira (13:20).',
                    'Trocar sala da "Física Experimental" (Sala Teórica) para Laboratório de Física (Sala 102) para adequação de recursos.'
                ]
            });
        }, 2000);
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className={`text-2xl  flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                        <Zap className="text-yellow-500" />
                        Otimização Mensal
                    </h1>
                    <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Análise e sugestões de otimização da grade horária.</p>
                </div>

                <div className="flex gap-2">
                    <div className={`flex items-center border rounded-lg px-3 py-2 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <Calendar size={18} className="text-slate-400 mr-2" />
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className={`bg-transparent outline-none text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}
                        >
                            {months.map((m, i) => (
                                <option key={i} value={i} className={theme === 'dark' ? 'bg-slate-800' : ''}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleOptimize}
                        disabled={isOptimizing}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg text-sm  transition-colors
                            ${isOptimizing
                                ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'}
                        `}
                    >
                        {isOptimizing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-slate-400 border-t-blue-600 rounded-full animate-spin"></div>
                                Otimizando...
                            </>
                        ) : (
                            <>
                                <Zap size={18} />
                                Gerar Otimização
                            </>
                        )}
                    </button>
                </div>
            </div>

            {!optimizationResults && !isOptimizing && (
                <div className={`rounded-xl border p-8 text-center shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${theme === 'dark' ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        <Zap size={32} />
                    </div>
                    <h3 className={`text-lg  mb-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>Otimização de Grade</h3>
                    <p className={`max-w-md mx-auto mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        Esta ferramenta analisará a carga horária e sugerirá a melhor distribuição de aulas para o mês de {months[selectedMonth]}.
                    </p>
                    <div className={`p-4 border rounded-lg max-w-lg mx-auto text-left ${theme === 'dark' ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-100'}`}>
                        <h4 className={` mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                            <Filter size={16} />
                            Filtros Ativos
                        </h4>
                        <ul className={`text-sm space-y-1 ml-6 list-disc ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'}`}>
                            <li>Considerar apenas disciplinas obrigatórias</li>
                            <li>Evitar janelas maiores que 2 horas</li>
                            <li>Priorizar aulas práticas no período da manhã</li>
                        </ul>
                    </div>
                </div>
            )}

            {optimizationResults && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className={`p-6 rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <h3 className={`text-sm  mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Score de Distribuição</h3>
                            <div className="flex items-end gap-2">
                                <span className={`text-3xl  ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>{optimizationResults.distributionScore}%</span>
                                <span className={`text-sm mb-1 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>+12% vs anterior</span>
                            </div>
                        </div>
                        <div className={`p-6 rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <h3 className={`text-sm  mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Conflitos Resolvidos</h3>
                            <div className="flex items-end gap-2">
                                <span className={`text-3xl  ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{optimizationResults.conflictsResolved}</span>
                                <span className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>potenciais</span>
                            </div>
                        </div>
                        <div className={`p-6 rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <h3 className={`text-sm  mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Status</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className={` ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Otimizado</span>
                            </div>
                        </div>
                    </div>

                    <div className={`rounded-xl border shadow-sm overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className={`px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
                            <h3 className={` ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Sugestões de Melhoria</h3>
                        </div>
                        <div className="p-6">
                            <ul className="space-y-4">
                                {optimizationResults.suggestions.map((suggestion, index) => (
                                    <li key={index} className={`flex gap-3 items-start p-3 rounded-lg transition-colors border border-transparent ${theme === 'dark' ? 'hover:bg-slate-700/50 hover:border-slate-600' : 'hover:bg-slate-50 hover:border-slate-100'}`}>
                                        <div className={`mt-1 min-w-[24px] h-6 flex items-center justify-center rounded text-xs  ${theme === 'dark' ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                            {index + 1}
                                        </div>
                                        <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{suggestion}</span>
                                        <button
                                            onClick={() => handleApplySuggestion(index)}
                                            className={`ml-auto text-xs  underline ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                                        >
                                            Aplicar
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {optimizationResults.suggestions.length > 0 && (
                            <div className={`px-6 py-4 border-t flex justify-end gap-3 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                <button
                                    onClick={() => setOptimizationResults(null)}
                                    className={`text-sm  px-4 py-2 ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Descartar
                                </button>
                                <button
                                    onClick={handleApplyAll}
                                    className="bg-blue-600 text-white hover:bg-blue-700 text-sm  px-4 py-2 rounded-lg"
                                >
                                    Aplicar Todas as Sugestões
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
