import { useState } from 'react';
import { useCourseStore } from '../store/useCourseStore';
import { useTheme } from '../contexts/ThemeContext';
import { Search, Save, X, AlertCircle, Clock, Calendar, Box, Activity, CalendarDays } from 'lucide-react';
import type { CourseYear, Discipline, SchedulingCriteria } from '../types';
import { TIME_SLOTS } from '../utils/constants';
import { formatTrainingField } from '../utils/formatters';

export const FichaInformativa = () => {
    const { theme } = useTheme();
    const { disciplines, updateDiscipline } = useCourseStore();
    const [selectedYear, setSelectedYear] = useState<CourseYear | 'ALL'>('ALL');
    const [courseFilter, setCourseFilter] = useState<'ALL' | 'AVIATION' | 'INTENDANCY' | 'INFANTRY'>('ALL');
    const [trainingFieldFilter, setTrainingFieldFilter] = useState<'ALL' | 'GERAL' | 'MILITAR' | 'PROFISSIONAL' | 'ATIVIDADES_COMPLEMENTARES'>('ALL');
    const [semesterFilter, setSemesterFilter] = useState<'ALL' | 1 | 2>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const { updateAllDisciplinesCriteria, semesterConfigs, updateSemesterConfig } = useCourseStore();
    const [isBulkSaving, setIsBulkSaving] = useState(false);
    const [showSemesterSettings, setShowSemesterSettings] = useState(false);

    // Bulk Edit State
    const [bulkForm, setBulkForm] = useState<SchedulingCriteria>({
        frequency: 2,
        allowConsecutiveDays: false,
        preferredSlots: [],
        requiredRoom: 'SALA_AULA',
        priority: 5,
        maxClassesPerDay: 2,
        semester: 1
    });
    const [bulkFields, setBulkFields] = useState<(keyof SchedulingCriteria)[]>([]);

    const [editForm, setEditForm] = useState<SchedulingCriteria>({
        frequency: 2,
        allowConsecutiveDays: false,
        preferredSlots: [],
        requiredRoom: 'SALA_AULA',
        priority: 5,
        maxClassesPerDay: 2,
        semester: 1
    });


    // Filter disciplines
    const filteredDisciplines = disciplines.filter(d => {
        const matchesYear = selectedYear === 'ALL' || d.year === selectedYear;
        const matchesCourse = courseFilter === 'ALL' || d.course === courseFilter || d.course === 'ALL';
        const matchesTrainingField = trainingFieldFilter === 'ALL' || d.trainingField === trainingFieldFilter;
        const matchesSemester = semesterFilter === 'ALL' || d.scheduling_criteria?.semester === semesterFilter;
        const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            formatTrainingField(d.trainingField).toLowerCase().includes(searchTerm.toLowerCase());

        return matchesYear && matchesSearch && matchesCourse && matchesTrainingField && matchesSemester;
    });

    const handleEdit = (discipline: Discipline) => {
        setEditingId(discipline.id);
        if (discipline.scheduling_criteria) {
            setEditForm(discipline.scheduling_criteria);
        } else {
            // Default values
            setEditForm({
                frequency: 2,
                allowConsecutiveDays: false,
                preferredSlots: [],
                requiredRoom: 'SALA_AULA',
                priority: 5,
                maxClassesPerDay: 2,
                semester: 1
            });
        }
    };

    const handleSave = () => {
        if (editingId) {
            updateDiscipline(editingId, { scheduling_criteria: editForm });
            setEditingId(null);
        }
    };

    const toggleBulkField = (field: keyof SchedulingCriteria) => {
        setBulkFields(prev =>
            prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
        );
    };

    const handleBulkSave = async () => {
        if (bulkFields.length === 0) return;

        if (confirm(`Ação Irreversível: Deseja aplicar estes ${bulkFields.length} critérios a TODAS as matérias do sistema?`)) {
            setIsBulkSaving(true);

            // Give a tiny delay for the UI to show the loading state
            setTimeout(() => {
                updateAllDisciplinesCriteria(bulkForm, bulkFields);
                setBulkFields([]);
                setIsBulkSaving(false);
                alert('Critérios aplicados com sucesso a todas as matérias.');
            }, 500);
        }
    };



    return (
        <div className={`p-8 max-w-7xl mx-auto min-h-full transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
            <header className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className={`text-3xl  tracking-tight ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>Critérios</h1>
                    <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Definição de critérios para o planejamento automático.</p>
                </div>
                <button
                    onClick={() => setShowSemesterSettings(true)}
                    className={`px-4 py-2 rounded-lg border flex items-center gap-2 transition-all ${theme === 'dark'
                        ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                >
                    <CalendarDays size={18} className="text-blue-500" />
                    <span>Configurar Semestres</span>
                </button>
            </header>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar disciplina..."
                        className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <label className={`text-sm  whitespace-nowrap hidden sm:inline ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Curso:</label>
                    <select
                        className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                        value={courseFilter}
                        onChange={(e) => setCourseFilter(e.target.value as 'ALL' | 'AVIATION' | 'INTENDANCY' | 'INFANTRY')}
                    >
                        <option value="ALL">Todos</option>
                        <option value="AVIATION">Aviação</option>
                        <option value="INTENDANCY">Intendência</option>
                        <option value="INFANTRY">Infantaria</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <label className={`text-sm  whitespace-nowrap hidden sm:inline ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Campo:</label>
                    <select
                        className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm max-w-[150px] ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                        value={trainingFieldFilter}
                        onChange={(e) => setTrainingFieldFilter(e.target.value as any)}
                    >
                        <option value="ALL">Todos</option>
                        <option value="GERAL">Geral</option>
                        <option value="MILITAR">Militar</option>
                        <option value="PROFISSIONAL">Profissional</option>
                        <option value="ATIVIDADES_COMPLEMENTARES">Comp.</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <label className={`text-sm  whitespace-nowrap hidden sm:inline ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Ano:</label>
                    <select
                        className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value) as CourseYear)}
                    >
                        <option value="ALL">Todos</option>
                        <option value="1">1º Ano</option>
                        <option value="2">2º Ano</option>
                        <option value="3">3º Ano</option>
                        <option value="4">4º Ano</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <label className={`text-sm  whitespace-nowrap hidden sm:inline ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Semestre:</label>
                    <select
                        className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                        value={semesterFilter}
                        onChange={(e) => setSemesterFilter(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value) as 1 | 2)}
                    >
                        <option value="ALL">Todos</option>
                        <option value="1">1º Semestre</option>
                        <option value="2">2º Semestre</option>
                    </select>
                </div>
            </div>

            {/* Bulk Edit Section */}
            <div className={`border rounded-xl p-6 mb-8 shadow-sm ${theme === 'dark' ? 'bg-amber-900/20 border-amber-800/50' : 'bg-amber-50 border-amber-200'}`}>
                <div className={`flex items-center gap-2 mb-4 ${theme === 'dark' ? 'text-amber-200' : 'text-amber-800'}`}>
                    <Activity size={24} className={theme === 'dark' ? 'text-amber-400' : 'text-amber-600'} />
                    <h2 className="text-lg ">Configuração Padrão (Edição em Massa)</h2>
                </div>
                <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>
                    Selecione os critérios que deseja aplicar a <strong>TODAS</strong> as disciplinas do sistema.
                    Apenas os campos marcados com o checkbox serão alterados.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    {/* Frequency */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={bulkFields.includes('frequency')}
                                onChange={() => toggleBulkField('frequency')}
                                className={`w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600' : ''}`}
                            />
                            <span className={`text-xs  uppercase tracking-wider transition-colors ${theme === 'dark' ? 'text-amber-200 group-hover:text-amber-100' : 'text-amber-900 group-hover:text-amber-700'}`}>Frequência Semanal</span>
                        </label>
                        <input
                            type="number"
                            min="1" max="10"
                            disabled={!bulkFields.includes('frequency')}
                            className={`w-full px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm ${theme === 'dark' ? 'border-amber-800 bg-slate-800 text-white disabled:bg-slate-800/50' : 'border-amber-200 bg-white disabled:bg-amber-50/50 disabled:opacity-50'}`}
                            value={bulkForm.frequency}
                            onChange={e => setBulkForm({ ...bulkForm, frequency: parseInt(e.target.value) })}
                        />
                    </div>

                    {/* Max per Day */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={bulkFields.includes('maxClassesPerDay')}
                                onChange={() => toggleBulkField('maxClassesPerDay')}
                                className={`w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600' : ''}`}
                            />
                            <span className={`text-xs  uppercase tracking-wider transition-colors ${theme === 'dark' ? 'text-amber-200 group-hover:text-amber-100' : 'text-amber-900 group-hover:text-amber-700'}`}>Máx de Aulas/Dia</span>
                        </label>
                        <input
                            type="number"
                            min="1" max="4"
                            disabled={!bulkFields.includes('maxClassesPerDay')}
                            className={`w-full px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm ${theme === 'dark' ? 'border-amber-800 bg-slate-800 text-white disabled:bg-slate-800/50' : 'border-amber-200 bg-white disabled:bg-amber-50/50 disabled:opacity-50'}`}
                            value={bulkForm.maxClassesPerDay}
                            onChange={e => setBulkForm({ ...bulkForm, maxClassesPerDay: parseInt(e.target.value) })}
                        />
                    </div>

                    {/* Consecutive Days */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={bulkFields.includes('allowConsecutiveDays')}
                                onChange={() => toggleBulkField('allowConsecutiveDays')}
                                className={`w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600' : ''}`}
                            />
                            <span className={`text-xs  uppercase tracking-wider transition-colors ${theme === 'dark' ? 'text-amber-200 group-hover:text-amber-100' : 'text-amber-900 group-hover:text-amber-700'}`}>Dias Consecutivos?</span>
                        </label>
                        <select
                            disabled={!bulkFields.includes('allowConsecutiveDays')}
                            className={`w-full px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm ${theme === 'dark' ? 'border-amber-800 bg-slate-800 text-white disabled:bg-slate-800/50' : 'border-amber-200 bg-white disabled:bg-amber-50/50 disabled:opacity-50'}`}
                            value={bulkForm.allowConsecutiveDays ? 'true' : 'false'}
                            onChange={e => setBulkForm({ ...bulkForm, allowConsecutiveDays: e.target.value === 'true' })}
                        >
                            <option value="false">Não (Pular 1 dia)</option>
                            <option value="true">Sim (Aceita)</option>
                        </select>
                    </div>

                    {/* Room */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={bulkFields.includes('requiredRoom')}
                                onChange={() => toggleBulkField('requiredRoom')}
                                className={`w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600' : ''}`}
                            />
                            <span className={`text-xs  uppercase tracking-wider transition-colors ${theme === 'dark' ? 'text-amber-200 group-hover:text-amber-100' : 'text-amber-900 group-hover:text-amber-700'}`}>Local</span>
                        </label>
                        <select
                            disabled={!bulkFields.includes('requiredRoom')}
                            className={`w-full px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm ${theme === 'dark' ? 'border-amber-800 bg-slate-800 text-white disabled:bg-slate-800/50' : 'border-amber-200 bg-white disabled:bg-amber-50/50 disabled:opacity-50'}`}
                            value={bulkForm.requiredRoom}
                            onChange={e => setBulkForm({ ...bulkForm, requiredRoom: e.target.value as any })}
                        >
                            <option value="SALA_AULA">Sala de Aula</option>
                            <option value="GINASIO">Ginásio</option>
                            <option value="OUTDOOR">Campo</option>
                        </select>
                    </div>

                    {/* Semester */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={bulkFields.includes('semester')}
                                onChange={() => toggleBulkField('semester' as any)}
                                className={`w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600' : ''}`}
                            />
                            <span className={`text-xs  uppercase tracking-wider transition-colors ${theme === 'dark' ? 'text-amber-200 group-hover:text-amber-100' : 'text-amber-900 group-hover:text-amber-700'}`}>Semestre</span>
                        </label>
                        <select
                            disabled={!bulkFields.includes('semester' as any)}
                            className={`w-full px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm ${theme === 'dark' ? 'border-amber-800 bg-slate-800 text-white disabled:bg-slate-800/50' : 'border-amber-200 bg-white disabled:bg-amber-50/50 disabled:opacity-50'}`}
                            value={bulkForm.semester || 1}
                            onChange={e => setBulkForm({ ...bulkForm, semester: parseInt(e.target.value) as 1 | 2 })}
                        >
                            <option value="1">1º Semestre</option>
                            <option value="2">2º Semestre</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleBulkSave}
                        disabled={bulkFields.length === 0 || isBulkSaving}
                        className="px-6 py-2.5 bg-amber-600 text-white rounded-lg  shadow-md shadow-amber-600/20 hover:bg-amber-700 transition-all flex items-center gap-2 disabled:bg-amber-200 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {isBulkSaving ? (
                            <Activity size={18} className="animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        {isBulkSaving ? 'Aplicando...' : 'Aplicar a Todas as Matérias'}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className={`rounded-xl shadow-sm border overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <table className="w-full text-left border-collapse">
                    <thead className={`text-xs uppercase tracking-wider  ${theme === 'dark' ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                        <tr>
                            <th className={`px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>Disciplina</th>
                            <th className={`px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>Critérios de Agendamento</th>
                            <th className={`px-6 py-4 border-b text-right ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>Ações</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y text-sm ${theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'}`}>
                        {filteredDisciplines.map(discipline => (
                            <tr key={discipline.id} className={`transition-colors group ${theme === 'dark' ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50/50'}`}>
                                <td className="px-6 py-4 align-top">
                                    <div className={` ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{discipline.name}</div>
                                    <div className={`text-xs font-mono mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{discipline.code} • {discipline.year}º Ano</div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    {discipline.scheduling_criteria ? (
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                                            <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                <Calendar size={14} className="text-blue-500" />
                                                <span>{discipline.scheduling_criteria.frequency}x por semana</span>
                                            </div>
                                            <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                <Activity size={14} className={discipline.scheduling_criteria.allowConsecutiveDays ? "text-green-500" : "text-amber-500"} />
                                                <span>{discipline.scheduling_criteria.allowConsecutiveDays ? "Aceita dias consecutivos" : "Pula dias consecutivos"}</span>
                                            </div>
                                            <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                <Box size={14} className="text-purple-500" />
                                                <span>{discipline.scheduling_criteria.requiredRoom.replace('_', ' ')}</span>
                                            </div>
                                            <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                <Clock size={14} className="text-orange-500" />
                                                <span>{discipline.scheduling_criteria.preferredSlots?.length > 0 ? `${discipline.scheduling_criteria.preferredSlots.length} horários pref.` : 'Sem horários pref.'}</span>
                                            </div>
                                            <div className={`col-span-2 flex items-center gap-2 mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                <AlertCircle size={14} className="text-red-500" />
                                                <span>Máx. {discipline.scheduling_criteria.maxClassesPerDay || 2} aulas/dia</span>
                                            </div>
                                            <div className={`col-span-2 flex items-center gap-2 mt-1 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                                                <CalendarDays size={14} className="text-blue-500" />
                                                <span className="font-semibold">{discipline.scheduling_criteria.semester}º Semestre</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`italic flex items-center gap-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                            <AlertCircle size={16} />
                                            Não definido
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right align-top">
                                    <button
                                        onClick={() => handleEdit(discipline)}
                                        className={`px-3 py-1.5 text-sm  rounded-lg transition-colors ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                    >
                                        Editar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {editingId && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className={`rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className={`px-6 py-4 border-b flex justify-between items-center ${theme === 'dark' ? 'border-slate-700 bg-slate-700/50' : 'border-slate-100 bg-slate-50'}`}>
                            <h3 className={` text-lg ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Editar Critérios</h3>
                            <button onClick={() => setEditingId(null)} className={`transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs  uppercase tracking-wider mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Frequência (Semanal)</label>
                                    <input
                                        type="number"
                                        min="1" max="10"
                                        className={`w-full px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
                                        value={editForm.frequency}
                                        onChange={e => setEditForm({ ...editForm, frequency: parseInt(e.target.value) })}
                                    />
                                </div>

                                <div>
                                    <label className={`block text-xs  uppercase tracking-wider mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Semestre</label>
                                    <select
                                        className={`w-full px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
                                        value={editForm.semester || 1}
                                        onChange={e => setEditForm({ ...editForm, semester: parseInt(e.target.value) as 1 | 2 })}
                                    >
                                        <option value="1">1º Semestre</option>
                                        <option value="2">2º Semestre</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={`block text-xs  uppercase tracking-wider mb-1.5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>Horários Preferenciais</label>
                                <div className={`grid grid-cols-4 gap-2 p-3 rounded-lg border ${theme === 'dark' ? 'bg-blue-900/30 border-blue-800/50' : 'bg-blue-50/50 border-blue-100'}`}>
                                    {TIME_SLOTS.map(slot => (
                                        <label key={slot.start} className="flex items-center gap-1.5 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                className={`w-3.5 h-3.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500/20 ${theme === 'dark' ? 'bg-slate-800 border-blue-600' : 'bg-white'}`}
                                                checked={editForm.preferredSlots?.includes(slot.start)}
                                                onChange={() => {
                                                    const current = editForm.preferredSlots || [];
                                                    const updated = current.includes(slot.start)
                                                        ? current.filter(s => s !== slot.start)
                                                        : [...current, slot.start];
                                                    setEditForm({ ...editForm, preferredSlots: updated });
                                                }}
                                            />
                                            <span className={`text-[10px]  transition-colors ${theme === 'dark' ? 'text-slate-300 group-hover:text-blue-300' : 'text-slate-600 group-hover:text-blue-600'}`}>{slot.start}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className={`text-[10px] mt-1.5 italic ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`}>Se o horário preferencial estiver ocupado, o sistema tentará outro disponível automaticamente.</p>
                            </div>

                            <div>
                                <label className={`block text-xs  uppercase tracking-wider mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Local Necessário</label>
                                <select
                                    className={`w-full px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
                                    value={editForm.requiredRoom}
                                    onChange={e => setEditForm({ ...editForm, requiredRoom: e.target.value as any })}
                                >
                                    <option value="SALA_AULA">Sala de Aula Padrão</option>
                                    <option value="GINASIO">Ginásio / Quadra</option>
                                    <option value="OUTDOOR">Área Externa (Campo)</option>
                                </select>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    onClick={() => setEditingId(null)}
                                    className={`px-4 py-2 text-sm  transition-colors ${theme === 'dark' ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-800'}`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-4 py-2 text-sm  text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2"
                                >
                                    <Save size={16} />
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Semester Settings Modal */}
            {showSemesterSettings && (
                <SemesterSettingsModal
                    onClose={() => setShowSemesterSettings(false)}
                    theme={theme}
                    semesterConfigs={semesterConfigs}
                    updateSemesterConfig={updateSemesterConfig}
                />
            )}
        </div>
    );
};

interface SemesterSettingsModalProps {
    onClose: () => void;
    theme: string;
    semesterConfigs: any[];
    updateSemesterConfig: (id: string, updates: any) => void;
}

const SemesterSettingsModal = ({ onClose, theme, semesterConfigs, updateSemesterConfig }: SemesterSettingsModalProps) => {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);

    const config = semesterConfigs.find(c => c.year === year) || {
        id: year.toString(),
        year: year,
        s1Start: `${year}-02-01`,
        s1End: `${year}-06-30`,
        s2Start: `${year}-08-01`,
        s2End: `${year}-12-15`
    };

    const [form, setForm] = useState(config);

    // Update form when year changes or configs sync
    useState(() => {
        if (config) setForm(config);
    });

    const handleSave = async () => {
        await updateSemesterConfig(form.id, form);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className={`rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`px-6 py-4 border-b flex justify-between items-center ${theme === 'dark' ? 'border-slate-700 bg-slate-700/50' : 'border-slate-100 bg-slate-50'}`}>
                    <h3 className={` text-lg ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Configurar Semestres</h3>
                    <button onClick={onClose} className={`transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label className={`block text-xs uppercase tracking-wider mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Ano de Referência</label>
                        <select
                            className={`w-full px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
                            value={year}
                            onChange={(e) => {
                                const newYear = parseInt(e.target.value);
                                setYear(newYear);
                                const newConfig = semesterConfigs.find(c => c.year === newYear) || {
                                    id: newYear.toString(),
                                    year: newYear,
                                    s1Start: `${newYear}-02-01`,
                                    s1End: `${newYear}-06-30`,
                                    s2Start: `${newYear}-08-01`,
                                    s2End: `${newYear}-12-15`
                                };
                                setForm(newConfig);
                            }}
                        >
                            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-4">
                        <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-blue-900/10 border-blue-800/30' : 'bg-blue-50 border-blue-100'}`}>
                            <h4 className={`text-xs uppercase tracking-wider mb-3 font-semibold ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>1º Semestre</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] uppercase text-slate-500 mb-1">Início</label>
                                    <input
                                        type="date"
                                        className={`w-full px-2 py-1.5 rounded border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200'}`}
                                        value={form.s1Start}
                                        onChange={e => setForm({ ...form, s1Start: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase text-slate-500 mb-1">Término</label>
                                    <input
                                        type="date"
                                        className={`w-full px-2 py-1.5 rounded border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200'}`}
                                        value={form.s1End}
                                        onChange={e => setForm({ ...form, s1End: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-purple-900/10 border-purple-800/30' : 'bg-purple-50 border-purple-100'}`}>
                            <h4 className={`text-xs uppercase tracking-wider mb-3 font-semibold ${theme === 'dark' ? 'text-purple-300' : 'text-purple-700'}`}>2º Semestre</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] uppercase text-slate-500 mb-1">Início</label>
                                    <input
                                        type="date"
                                        className={`w-full px-2 py-1.5 rounded border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200'}`}
                                        value={form.s2Start}
                                        onChange={e => setForm({ ...form, s2Start: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase text-slate-500 mb-1">Término</label>
                                    <input
                                        type="date"
                                        className={`w-full px-2 py-1.5 rounded border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200'}`}
                                        value={form.s2End}
                                        onChange={e => setForm({ ...form, s2End: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className={`px-4 py-2 text-sm transition-colors ${theme === 'dark' ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-800'}`}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
                        >
                            <Save size={16} />
                            Salvar Configuração
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
