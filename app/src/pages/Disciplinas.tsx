import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, Edit2, ArrowUpDown, ArrowUp, ArrowDown, Calendar, ChevronUp, Save, Undo2, PenLine, CheckCircle2, AlertCircle, Zap, RefreshCw } from 'lucide-react';
import { useCourseStore } from '../store/useCourseStore';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { DisciplineForm } from '../components/DisciplineForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatTrainingField } from '../utils/formatters';
import type { Discipline, CourseYear } from '../types';
import { Link } from 'react-router-dom';
import { invalidateCache, fetchCollection } from '../services/supabaseService';

// ---------- Bulk Edit Types ----------
type EditableDisciplineFields = Pick<Discipline, 'name' | 'code' | 'instructor' | 'instructorTrigram' | 'noSpecificInstructor' | 'location' | 'load_hours' | 'trainingField' | 'color' | 'ppcLoads' | 'enabledCourses' | 'enabledYears'>;
type BulkEdits = Record<string, Partial<EditableDisciplineFields>>;

export const Disciplinas = () => {
    const { disciplines, instructors, locations, addDiscipline, updateDiscipline, updateBatchDisciplines, deleteBatchDisciplines, deleteDiscipline, unifyAllDisciplines, setDisciplines, updateInstructor } = useCourseStore();
    const activeLocations = locations.filter((l) => l.status === 'ATIVO').sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const { userProfile } = useAuth();
    const { theme } = useTheme();

    // Paleta de cores escuras/médias — texto branco legível em todas
    const COLOR_PALETTE = [
        "#1d4ed8","#7c3aed","#b45309","#047857","#dc2626","#0369a1","#6d28d9","#92400e",
        "#065f46","#991b1b","#1e40af","#5b21b6","#78350f","#064e3b","#7f1d1d","#1e3a8a",
        "#4c1d95","#451a03","#022c22","#450a0a","#0c4a6e","#3b0764","#713f12","#14532d",
        "#7f1d1d","#155e75","#4a044e","#431407","#052e16","#3f0818","#164e63","#2e1065",
        "#78350f","#14532d","#1a2e05","#0a0a0a","#1c1917","#0c0a09","#fbbf24","#f97316",
        "#84cc16","#06b6d4","#ec4899","#8b5cf6","#10b981","#f59e0b","#3b82f6","#ef4444",
    ].filter(c => {
        // Garante contraste mínimo com branco (luminância < 0.4)
        const r = parseInt(c.slice(1,3),16)/255, g = parseInt(c.slice(3,5),16)/255, b = parseInt(c.slice(5,7),16)/255;
        const lum = 0.2126*r + 0.7152*g + 0.0722*b;
        return lum < 0.45;
    });

    const [distributing, setDistributing] = useState(false);
    const handleDistribuirCores = async () => {
        if (!window.confirm(`Distribuir cores únicas para todas as ${disciplines.length} disciplinas? Cores editadas manualmente serão substituídas.`)) return;
        setDistributing(true);
        const updates: Record<string, { color: string }> = {};
        disciplines.forEach((d, i) => {
            updates[d.id] = { color: COLOR_PALETTE[i % COLOR_PALETTE.length] };
        });
        await updateBatchDisciplines(updates);
        setDistributing(false);
    };

    const [reloading, setReloading] = useState(false);
    const handleReloadDisciplines = async () => {
        setReloading(true);
        try {
            invalidateCache("disciplines");
            const data = await fetchCollection("disciplinas");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const expanded = (data as any[]).map((d) => ({
                ...d,
                ...(d.data && typeof d.data === "object" ? d.data : {}),
                id: d.id,
                code: (d.sigla || d.code || d.id || "").toUpperCase(),
                name: d.nome || d.name || "Sem Nome",
                color: d.color || d.data?.color || null,
                trainingField: d.campo || d.trainingField || d.data?.trainingField || "GERAL",
                load_hours: d.carga_horaria || d.load_hours,
                location: d.location || d.data?.location || null,
                instructorTrigram: d.instructorTrigram || d.data?.instructorTrigram || null,
                instructor: d.instructor || d.data?.instructor || null,
            }));
            setDisciplines(expanded as Discipline[]);
        } finally {
            setReloading(false);
        }
    };

    // ---- Sticky offset measurement via refs ----
    const pageHeaderRef = useRef<HTMLDivElement>(null);
    const bulkPanelHeaderRef = useRef<HTMLDivElement>(null);
    const smartActionsRef = useRef<HTMLDivElement>(null);
    const regularToolbarRef = useRef<HTMLDivElement>(null);
    const [pageHeaderH, setPageHeaderH] = useState(64);
    const [bulkPanelHeaderH, setBulkPanelHeaderH] = useState(64);
    const [smartActionsH, setSmartActionsH] = useState(90);
    const [regularToolbarH, setRegularToolbarH] = useState(96);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [quickMatrixId, setQuickMatrixId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce effect
    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedSearch(searchTerm), 400);
        return () => clearTimeout(timeout);
    }, [searchTerm]);

    const [yearFilter, setYearFilter] = useState<'ALL' | 1 | 2 | 3 | 4>('ALL');
    const [courseFilter, setCourseFilter] = useState<'ALL' | 'AVIATION' | 'INTENDANCY' | 'INFANTRY'>('ALL');
    const [trainingFieldFilter, setTrainingFieldFilter] = useState<'ALL' | 'GERAL' | 'MILITAR' | 'PROFISSIONAL' | 'ATIVIDADES_COMPLEMENTARES'>('ALL');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Discipline; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; disciplineId: string | null; disciplineName: string }>({ isOpen: false, disciplineId: null, disciplineName: '' });

    // Bulk edit state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkEditOpen, setBulkEditOpen] = useState(false);
    const [bulkEdits, setBulkEdits] = useState<BulkEdits>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<{ success: number; total: number } | null>(null);

    // ResizeObserver to measure sticky header heights at runtime
    useEffect(() => {
        const obs = new ResizeObserver(entries => {
            for (const entry of entries) {
                const size = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
                if (entry.target === pageHeaderRef.current) setPageHeaderH(Math.ceil(size));
                if (entry.target === bulkPanelHeaderRef.current) setBulkPanelHeaderH(Math.ceil(size));
                if (entry.target === smartActionsRef.current) setSmartActionsH(Math.ceil(size));
                if (entry.target === regularToolbarRef.current) setRegularToolbarH(Math.ceil(size));
            }
        });
        if (pageHeaderRef.current) obs.observe(pageHeaderRef.current);
        if (bulkPanelHeaderRef.current) obs.observe(bulkPanelHeaderRef.current);
        if (smartActionsRef.current) obs.observe(smartActionsRef.current);
        if (regularToolbarRef.current) obs.observe(regularToolbarRef.current);
        return () => obs.disconnect();
    }, [bulkEditOpen]);

    // Computed offsets for sticky elements
    const bulkPanelTop = pageHeaderH;
    const smartActionsTop = pageHeaderH + bulkPanelHeaderH;
    const bulkTableHeadTop = pageHeaderH + bulkPanelHeaderH + smartActionsH;
    const regularToolbarTop = pageHeaderH;
    const regularTableHeadTop = pageHeaderH + regularToolbarH;


    const handleBulkDelete = async () => {
        const targets = selectedIds.size > 0 ? Array.from(selectedIds) : [];
        if (targets.length === 0) {
            alert("Selecione pelo menos uma disciplina para excluir.");
            return;
        }

        if (window.confirm(`Tem certeza que deseja excluir ${targets.length} disciplinas e TODOS os seus eventos associados? Esta ação não pode ser desfeita.`)) {
            setIsSaving(true);
            try {
                await deleteBatchDisciplines(targets);
                setSelectedIds(new Set());
                setBulkEdits({});
                setSaveResult({ success: targets.length, total: targets.length });
                setTimeout(() => setSaveResult(null), 3000);
            } catch (error) {
                console.error("Erro ao excluir disciplinas em massa:", error);
                alert("Ocorreu um erro ao excluir as disciplinas.");
            } finally {
                setIsSaving(false);
            }
        }
    };

    const canEdit = useMemo(() => {
        return ['SUPER_ADMIN', 'ADMIN'].includes(userProfile?.role || '');
    }, [userProfile]);

    const handleSave = (data: Omit<Discipline, 'id'>) => {
        const disciplineId = editingId ?? (data.code || '').toUpperCase();
        if (editingId) {
            updateDiscipline(editingId, data);
        } else {
            addDiscipline({ ...data, id: disciplineId });
        }
        // Habilita os instrutores selecionados para esta disciplina
        const trigramsToEnable = [data.instructorTrigram, data.substituteTrigram].filter(Boolean) as string[];
        trigramsToEnable.forEach(trigram => {
            const inst = instructors.find(i => i.trigram === trigram);
            if (inst && !inst.enabledDisciplines?.includes(disciplineId)) {
                updateInstructor(trigram, {
                    enabledDisciplines: [...(inst.enabledDisciplines ?? []), disciplineId],
                });
            }
        });
        closeModal();
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const startEdit = (id: string) => {
        setEditingId(id);
        setIsModalOpen(true);
    };

    const confirmDelete = (id: string, name: string) => {
        setDeleteConfirm({ isOpen: true, disciplineId: id, disciplineName: name });
    };

    const handleDelete = () => {
        if (deleteConfirm.disciplineId) {
            deleteDiscipline(deleteConfirm.disciplineId);
        }
        setDeleteConfirm({ isOpen: false, disciplineId: null, disciplineName: '' });
    };

    const handleSort = (key: keyof Discipline) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: keyof Discipline) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
        }
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="text-blue-600 dark:text-blue-400" />
            : <ArrowDown size={14} className="text-blue-600 dark:text-blue-400" />;
    };


    const filteredDisciplines = useMemo(() => {
        const filtered = disciplines.filter(d => {
            // 1. SMART SEARCH (Missing Data)
            if (debouncedSearch.startsWith('!')) {
                const target = debouncedSearch.substring(1).toLowerCase();
                let isSmartMatch = true;
                if (target === 'instructor') isSmartMatch = !d.instructor && !d.noSpecificInstructor;
                else if (target === 'location') isSmartMatch = !d.location;
                else isSmartMatch = false; // Unknown smart filter

                if (!isSmartMatch) return false;
            }

            // 2. NORMAL SEARCH
            const matchesSearch = debouncedSearch.startsWith('!') ? true : (
                d.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                d.code?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                d.instructor?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                formatTrainingField(d.trainingField).toLowerCase().includes(debouncedSearch.toLowerCase())
            );

            // 3. OTHER FILTERS
            const matchesYear = yearFilter === 'ALL' || d.enabledYears?.includes(yearFilter as CourseYear) || (!d.enabledYears?.length && (d.year === yearFilter || d.year === 'ALL'));
            const matchesCourse = courseFilter === 'ALL' || d.enabledCourses?.includes(courseFilter) || (!d.enabledCourses?.length && (d.course === courseFilter || d.course === 'ALL'));
            const matchesTrainingField = trainingFieldFilter === 'ALL' || d.trainingField === trainingFieldFilter;

            return matchesSearch && matchesYear && matchesCourse && matchesTrainingField;
        });

        if (sortConfig) {
            filtered.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === bValue) return 0;
                if (aValue === undefined || aValue === null) return 1;
                if (bValue === undefined || bValue === null) return -1;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortConfig.direction === 'asc'
                        ? aValue.localeCompare(bValue, 'pt-BR')
                        : bValue.localeCompare(aValue, 'pt-BR');
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }, [disciplines, debouncedSearch, yearFilter, courseFilter, trainingFieldFilter, sortConfig]);

    // Selection Handlers
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = filteredDisciplines.map(d => d.id);
            setSelectedIds(new Set(allIds));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedIds(newSelected);
    };

    // ---------- Bulk Edit Logic ----------
    const changedCount = Object.keys(bulkEdits).length;

    const setBulkField = useCallback((id: string, field: keyof EditableDisciplineFields, value: string | number) => {
        const original = disciplines.find(d => d.id === id);
        if (!original) return;

        setBulkEdits(prev => {
            const current = { ...prev };
            const fieldEdits = { ...(current[id] || {}) };

            // Special case for synchronization between Instructor Name and Trigram
            if (field === 'instructorTrigram') {
                const trigram = value as string;

                if (trigram === '__NO_INSTRUCTOR__') {
                    fieldEdits.instructorTrigram = '';
                    fieldEdits.instructor = '';
                    fieldEdits.noSpecificInstructor = true;

                    if (original.noSpecificInstructor === true && original.instructorTrigram === '' && original.instructor === '') {
                        delete fieldEdits.instructorTrigram;
                        delete fieldEdits.instructor;
                        delete fieldEdits.noSpecificInstructor;
                    }
                } else {
                    const inst = instructors.find(i => i.trigram === trigram);
                    const name = inst ? inst.warName : '';

                    // Set both
                    fieldEdits.instructorTrigram = trigram;
                    fieldEdits.instructor = name;
                    fieldEdits.noSpecificInstructor = false;

                    // Compare with original for both to clean up if no change
                    if (original.instructorTrigram === trigram && original.instructor === name && !original.noSpecificInstructor) {
                        delete fieldEdits.instructorTrigram;
                        delete fieldEdits.instructor;
                        delete fieldEdits.noSpecificInstructor;
                    }
                }
            } else {
                // Normal field
                const originalValue = original[field];
                if (String(originalValue ?? '') === String(value)) {
                    delete fieldEdits[field];
                } else {
                    fieldEdits[field] = value as never;
                }
            }

            if (Object.keys(fieldEdits).length === 0) {
                delete current[id];
            } else {
                current[id] = fieldEdits;
            }
            return current;
        });
    }, [disciplines, instructors]);

    const setBulkMatrixLoad = useCallback((id: string, course: string, year: number, value: number) => {
        const original = disciplines.find(d => d.id === id);
        if (!original) return;

        setBulkEdits(prev => {
            const current = { ...prev };
            const fieldEdits = { ...(current[id] || {}) };
            const currentLoads = fieldEdits.ppcLoads || original.ppcLoads || {};
            const key = `${course}_${year}`;
            
            const newLoads = { ...currentLoads };
            if (value > 0) newLoads[key] = value;
            else delete newLoads[key];

            const newCourses = new Set<"AVIATION" | "INTENDANCY" | "INFANTRY">();
            const newYears = new Set<CourseYear>();
            let totalLoad = 0;
            
            Object.entries(newLoads).forEach(([k, v]) => {
                if (v > 0) {
                    const [c, y] = k.split('_');
                    newCourses.add(c as "AVIATION" | "INTENDANCY" | "INFANTRY");
                    newYears.add(parseInt(y) as CourseYear);
                    totalLoad += v;
                }
            });

            fieldEdits.ppcLoads = newLoads;
            fieldEdits.enabledCourses = Array.from(newCourses);
            fieldEdits.enabledYears = Array.from(newYears);
            fieldEdits.load_hours = totalLoad;

            current[id] = fieldEdits;
            return current;
        });
    }, [disciplines]);

    const getEditedValue = (id: string, field: keyof EditableDisciplineFields): string | number | boolean | Record<string, number> | string[] | undefined => {
        return bulkEdits[id]?.[field] as string | number | undefined;
    };

    const getCurrentValue = (discipline: Discipline, field: keyof EditableDisciplineFields): string | number => {
        const edited = getEditedValue(discipline.id, field);
        if (edited !== undefined) return edited as string | number;
        return (discipline[field] ?? '') as string | number;
    };

    const isFieldChanged = (id: string, field: keyof EditableDisciplineFields): boolean => {
        return bulkEdits[id]?.[field] !== undefined;
    };

    const discardEdits = () => {
        setBulkEdits({});
        setSaveResult(null);
    };

    const saveBulkEdits = () => {
        setIsSaving(true);
        setSaveResult(null);

        // Dispara a atualização sem esperar o backend
        updateBatchDisciplines(bulkEdits).catch(err => {
            console.error('Erro ao salvar edições em massa:', err);
        });

        // Mostra o feedback de sucesso imediatamente e fecha o painel
        setSaveResult({ success: changedCount, total: changedCount });
        setBulkEdits({});
        setIsSaving(false);
        setTimeout(() => setSaveResult(null), 4000);
    };

    // Summary of changes for preview
    const changesSummary = useMemo(() => {
        return Object.entries(bulkEdits).map(([id, updates]) => {
            const disc = disciplines.find(d => d.id === id);
            if (!disc) return null;
            const fields = Object.entries(updates)
                .filter(([field]) => !['instructorTrigram', 'enabledCourses', 'enabledYears'].includes(field)) 
                .map(([field, newVal]) => {
                    if (field === 'ppcLoads') {
                        return {
                            field: 'Matriz (PPC)',
                            from: '...',
                            to: 'Atualizada'
                        }
                    }
                    const oldVal = disc[field as keyof Discipline];
                    const fieldLabel: Record<string, string> = {
                        name: 'Nome',
                        code: 'Código',
                        instructor: 'Instrutor',
                        location: 'Local da Aula',
                        load_hours: 'Carga Horária (Soma)',
                        trainingField: 'Campo',
                        color: 'Cor',
                    };
                    return {
                        field: fieldLabel[field] || field,
                        from: String(oldVal ?? '(vazio)'),
                        to: String(newVal ?? '(vazio)'),
                    };
                });
            return { id: disc.id, name: disc.name, code: disc.code, fields };
        }).filter(Boolean);
    }, [bulkEdits, disciplines]);


    return (
        <div className={`w-full min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-slate-900'}`}>
            {/* Main Header - Sticky: top-0 pois é o primeiro sticky dentro do scroll container (main) */}
            <div
                ref={pageHeaderRef}
                className={`sticky top-0 z-50 px-4 md:px-6 py-3 border-b flex items-center justify-between gap-4 ${theme === 'dark' ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'} backdrop-blur-md`}
            >
                <div className="flex items-baseline gap-3">
                    <h1 className="text-xl font-bold tracking-tight">Disciplinas</h1>
                    <p className={`hidden sm:block text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Gestão de matriz curricular e instrutoria</p>
                </div>
                <div className="flex items-center gap-2">
                    {canEdit && (
                        <>
                            <button
                                onClick={() => { setBulkEditOpen(!bulkEditOpen); setSaveResult(null); }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm whitespace-nowrap border ${bulkEditOpen
                                    ? (theme === 'dark' ? 'bg-amber-900/30 text-amber-400 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200 shadow-inner')
                                    : (theme === 'dark' ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-white text-slate-700 border-slate-200 shadow-sm')
                                    }`}
                            >
                                <PenLine size={14} />
                                Edição em Massa
                                {changedCount > 0 && (
                                    <span className="bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{changedCount}</span>
                                )}
                            </button>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm text-sm whitespace-nowrap font-medium"
                            >
                                <Plus size={16} />
                                Novo
                            </button>
                            <button
                                onClick={handleDistribuirCores}
                                disabled={distributing}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm whitespace-nowrap border ${theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 shadow-sm'} disabled:opacity-50`}
                                title="Atribui uma cor única para cada disciplina"
                            >
                                🎨 {distributing ? 'Distribuindo...' : 'Distribuir Cores'}
                            </button>
                            <button
                                onClick={handleReloadDisciplines}
                                disabled={reloading}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm whitespace-nowrap border ${theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 shadow-sm'} disabled:opacity-50`}
                                title="Limpa o cache e recarrega disciplinas do banco"
                            >
                                <RefreshCw size={14} className={reloading ? 'animate-spin' : ''} />
                                {reloading ? 'Recarregando...' : 'Recarregar'}
                            </button>
                            {userProfile?.role === 'SUPER_ADMIN' && (
                                <button
                                    onClick={async () => {
                                        if (!confirm('Unificar todas as disciplinas? Isso normaliza os IDs no banco (id = code) e migra eventos órfãos. Não pode ser desfeito.')) return;
                                        try {
                                            const { merged, errors } = await unifyAllDisciplines();
                                            alert(`Unificação concluída. ${merged} disciplinas unificadas, ${errors} erros.`);
                                            window.location.reload();
                                        } catch (e: any) {
                                            alert(`Erro: ${e?.message ?? e}`);
                                        }
                                    }}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm whitespace-nowrap border ${theme === 'dark' ? 'bg-slate-800 text-orange-300 border-orange-700' : 'bg-orange-50 text-orange-700 border-orange-200 shadow-sm'}`}
                                    title="Normaliza id=code para todas as disciplinas e migra eventos"
                                >
                                    <Zap size={14} />
                                    Unificar
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="w-full">
                {canEdit && bulkEditOpen && (
                    <div className={`mb-0 border-b ${theme === 'dark' ? 'bg-slate-800 border-amber-900/30' : 'bg-amber-50/10 border-amber-200/30'}`}>
                        {/* Bulk Edit Panel Header - Sticky */}
                        <div
                            ref={bulkPanelHeaderRef}
                            className={`sticky z-40 px-4 md:px-6 py-3 border-b border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between ${theme === 'dark' ? 'bg-slate-950/95' : 'bg-amber-50/95'} backdrop-blur-md`}
                            style={{ top: bulkPanelTop }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center shadow-sm">
                                    <PenLine size={18} className="text-white" />
                                </div>
                                <div>
                                    <h2 className={` ${theme === 'dark' ? 'text-amber-100' : 'text-slate-800'}`}>Edição em Massa</h2>
                                    <p className={`text-xs ${theme === 'dark' ? 'text-amber-200/70' : 'text-slate-500'}`}>Edite diretamente na tabela. As alterações ficam pendentes até salvar.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={selectedIds.size === 0 || isSaving}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50 mr-2"
                                    title="Excluir disciplinas selecionadas"
                                >
                                    <Trash2 size={14} /> Excluir Selecionados
                                </button>
                                {changedCount > 0 && (
                                    <>
                                        <span className="text-sm  text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-3 py-1 rounded-full">
                                            {changedCount} disciplina{changedCount !== 1 ? 's' : ''} alterada{changedCount !== 1 ? 's' : ''}
                                        </span>
                                        <button
                                            onClick={discardEdits}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 bg-slate-800 border-slate-700 hover:bg-slate-700' : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            <Undo2 size={14} /> Descartar
                                        </button>
                                        <button
                                            onClick={saveBulkEdits}
                                            disabled={isSaving}
                                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm  text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                                        >
                                            <Save size={14} />
                                            {isSaving ? 'Salvando...' : 'Salvar Tudo'}
                                        </button>
                                    </>
                                )}
                                <button onClick={() => setBulkEditOpen(false)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors ml-2">
                                    <ChevronUp size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Save result toast */}
                        {saveResult && (
                            <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm  ${saveResult.success === saveResult.total
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/50'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/50'
                                }`}>
                                {saveResult.success === saveResult.total
                                    ? <><CheckCircle2 size={16} /> {saveResult.success} disciplina{saveResult.success !== 1 ? 's' : ''} atualizada{saveResult.success !== 1 ? 's' : ''} com sucesso! Logs de auditoria gerados.</>
                                    : <><AlertCircle size={16} /> {saveResult.success}/{saveResult.total} salvas. Algumas falharam.</>
                                }
                            </div>
                        )}

                        {/* Changes preview */}
                        {changesSummary.length > 0 && (
                            <div className="mx-5 mt-3 mb-1">
                                <div className="text-xs  text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Resumo das Alterações ({changedCount})</div>
                                <div className="grid gap-2 max-h-[160px] overflow-y-auto pr-1">
                                    {changesSummary.map((item, i) => item && (
                                        <div key={i} className="bg-white/70 dark:bg-slate-800/70 border border-amber-100 dark:border-amber-900/30 rounded-lg px-3 py-2 text-xs flex justify-between items-start transition-colors">
                                            <div>
                                                <span className=" text-slate-700 dark:text-slate-200">{item.code}</span>
                                                <span className="text-slate-400 ml-1">{item.name}</span>
                                                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                                                    {item.fields.map((f, j) => (
                                                        <span key={j} className="text-slate-500 dark:text-slate-400">
                                                            <span className=" text-slate-600 dark:text-slate-300">{f.field}:</span>
                                                            {' '}
                                                            <span className="text-red-500 dark:text-red-400 line-through text-[10px]">{f.from}</span>
                                                            {' → '}
                                                            <span className="text-green-600 dark:text-green-400 ">{f.to}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setBulkEdits(prev => {
                                                        const current = { ...prev };
                                                        delete current[item.id as string];
                                                        return current;
                                                    });
                                                }}
                                                className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                                title="Desfazer alterações desta disciplina"
                                            >
                                                <Undo2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ---------- SMART ACTIONS BAR - Sticky ---------- */}
                        <div
                            ref={smartActionsRef}
                            className={`sticky z-30 px-4 md:px-6 py-3 border-b ${theme === 'dark' ? 'bg-slate-950/95 border-amber-900/50' : 'bg-amber-50/95 border-amber-100/50'} backdrop-blur-sm`}
                            style={{ top: smartActionsTop }}
                        >
                            <div className="text-[10px] text-amber-700 dark:text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2 font-bold">
                                <PenLine size={12} />
                                Ações Inteligentes {selectedIds.size > 0
                                    ? `(Aplicar aos ${selectedIds.size} selecionados)`
                                    : `(Aplicar aos ${filteredDisciplines.length} itens filtrados)`}
                            </div>
                            <div className="flex flex-nowrap overflow-x-auto pb-1 gap-x-6 gap-y-2 items-center custom-scrollbar">
                                {/* Smart Instructor */}
                                <div className="flex-none w-[220px]">
                                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-2 uppercase tracking-wider">Definir Instrutor:</label>
                                    <div className="flex gap-1">
                                        <select
                                            id="smart-instructor"
                                            className={`w-full min-w-0 px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shrink ${theme === 'dark' ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white border-slate-200'}`}
                                        >
                                            <option value="">A Definir</option>
                                            <option value="__NO_INSTRUCTOR__">Sem instrutor definido (Setor)</option>
                                            {instructors
                                                .sort((a, b) => a.warName.localeCompare(b.warName))
                                                .map(inst => (
                                                    <option key={inst.trigram} value={inst.trigram}>
                                                        {inst.rank ? `${inst.rank} ` : ''}{inst.warName} ({inst.trigram})
                                                    </option>
                                                ))
                                            }
                                        </select>
                                        <button
                                            onClick={() => {
                                                const val = (document.getElementById('smart-instructor') as HTMLSelectElement).value;
                                                const targets = selectedIds.size > 0 ? Array.from(selectedIds) : filteredDisciplines.map(d => d.id);
                                                targets.forEach(id => setBulkField(id, 'instructorTrigram', val));
                                            }}
                                            className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-xs font-bold shadow-sm"
                                        >
                                            Aplicar
                                        </button>
                                    </div>
                                </div>

                                {/* Smart Location */}
                                <div className="flex-none w-[220px]">
                                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-2 uppercase tracking-wider">Definir Local:</label>
                                    <div className="flex gap-1">
                                        <select
                                            id="smart-location"
                                            className={`w-full min-w-0 px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shrink ${theme === 'dark' ? 'bg-slate-700 text-slate-100 border-slate-600' : 'border-slate-200'}`}
                                        >
                                            <option value="">— Selecionar local —</option>
                                            {activeLocations.map((l) => (
                                                <option key={l.id} value={l.name}>{l.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => {
                                                const val = (document.getElementById('smart-location') as HTMLSelectElement).value;
                                                if (!val) return;
                                                const targets = selectedIds.size > 0 ? Array.from(selectedIds) : filteredDisciplines.map(d => d.id);
                                                targets.forEach(id => setBulkField(id, 'location', val));
                                                (document.getElementById('smart-location') as HTMLSelectElement).value = '';
                                            }}
                                            className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-xs font-bold shadow-sm"
                                        >
                                            Aplicar
                                        </button>
                                    </div>
                                </div>


                                {/* Smart Training Field */}
                                <div className="flex-none w-[180px]">
                                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-2 uppercase tracking-wider">Alterar Campo:</label>
                                    <div className="flex gap-1">
                                        <select
                                            id="smart-field"
                                            className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shrink ${theme === 'dark' ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white border-slate-200'}`}
                                        >
                                            <option value="GERAL">Geral</option>
                                            <option value="MILITAR">Militar</option>
                                            <option value="PROFISSIONAL">Profissional</option>
                                            <option value="ATIVIDADES_COMPLEMENTARES">Atividades Complementares</option>
                                        </select>
                                        <button
                                            onClick={() => {
                                                const val = (document.getElementById('smart-field') as HTMLSelectElement).value;
                                                const targets = selectedIds.size > 0 ? Array.from(selectedIds) : filteredDisciplines.map(d => d.id);
                                                targets.forEach(id => setBulkField(id, 'trainingField', val));
                                            }}
                                            className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-xs font-bold shadow-sm"
                                        >
                                            Ok
                                        </button>
                                    </div>
                                </div>

                                {/* Smart Color Picker */}
                                <div className="flex-none w-[140px]">
                                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-2 uppercase tracking-wider">Alterar Cor:</label>
                                    <div className="flex gap-1">
                                        <input
                                            id="smart-color"
                                            type="color"
                                            className={`h-[30px] w-full p-0.5 border rounded cursor-pointer shrink-0 ${theme === 'dark' ? 'bg-slate-700 border-slate-600' : 'border-slate-200'}`}
                                            defaultValue="#3b82f6"
                                        />
                                        <button
                                            onClick={() => {
                                                const val = (document.getElementById('smart-color') as HTMLInputElement).value;
                                                const targets = selectedIds.size > 0 ? Array.from(selectedIds) : filteredDisciplines.map(d => d.id);
                                                targets.forEach(id => setBulkField(id, 'color', val));
                                            }}
                                            className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-xs font-bold shadow-sm"
                                        >
                                            Ok
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Smart Matrix */}
                                <div className="flex-none w-[340px]">
                                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-2 uppercase tracking-wider">Definir Carga na Matriz:</label>
                                    <div className="flex gap-1">
                                        <select id="smart-matrix-course" className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shrink ${theme === 'dark' ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white border-slate-200'}`}>
                                            <option value="AVIATION">Aviação</option>
                                            <option value="INTENDANCY">Intendência</option>
                                            <option value="INFANTRY">Infantaria</option>
                                        </select>
                                        <select id="smart-matrix-year" className={`w-20 px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shrink ${theme === 'dark' ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white border-slate-200'}`}>
                                            <option value="1">1º Esq</option>
                                            <option value="2">2º Esq</option>
                                            <option value="3">3º Esq</option>
                                            <option value="4">4º Esq</option>
                                        </select>
                                        <input id="smart-matrix-value" type="number" placeholder="CH" className={`w-16 px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shrink ${theme === 'dark' ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white border-slate-200'}`} min="0" />
                                        <button
                                            onClick={() => {
                                                const course = (document.getElementById('smart-matrix-course') as HTMLSelectElement).value;
                                                const year = parseInt((document.getElementById('smart-matrix-year') as HTMLSelectElement).value);
                                                const val = parseInt((document.getElementById('smart-matrix-value') as HTMLInputElement).value) || 0;
                                                const targets = selectedIds.size > 0 ? Array.from(selectedIds) : filteredDisciplines.map(d => d.id);
                                                targets.forEach(id => setBulkMatrixLoad(id, course, year, val));
                                                (document.getElementById('smart-matrix-value') as HTMLInputElement).value = '';
                                            }}
                                            className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-xs font-bold shadow-sm"
                                        >
                                            Aplicar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Editable table */}
                        <div className="w-full">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className={`text-[10px] uppercase tracking-wider border-b ${theme === 'dark' ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-gray-50 text-slate-500 border-slate-100'}`}>
                                        <th className={`sticky z-20 text-center py-2 px-3 w-[40px] ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}>
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                                checked={selectedIds.size === filteredDisciplines.length && filteredDisciplines.length > 0}
                                            />
                                        </th>
                                        <th className={`sticky z-20 text-left py-2 px-3 w-[60px] ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}>Cód</th>
                                        <th className={`sticky z-20 text-left py-2 px-3 min-w-[150px] ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}>Disciplina</th>
                                        <th className={`sticky z-20 text-left py-2 px-3 w-[120px] ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}>Instrutor</th>
                                        <th className={`sticky z-20 text-left py-2 px-3 w-[90px] ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}>Local</th>
                                        <th className={`sticky z-20 text-center py-2 px-3 w-[45px] ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}>CH</th>
                                        <th className={`sticky z-20 text-center py-2 px-3 w-[110px] ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}>Turma/Ano</th>
                                        <th className={`sticky z-20 text-center py-2 px-3 w-[35px] ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}>Cor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-amber-100/60 dark:divide-amber-900/30">
                                    {filteredDisciplines.map(disc => {
                                        const hasChanges = !!bulkEdits[disc.id];
                                        const isSelected = selectedIds.has(disc.id);
                                        return (
                                            <tr key={disc.id} className={`transition-colors ${isSelected ? (theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50') : hasChanges ? (theme === 'dark' ? 'bg-amber-900/10' : 'bg-amber-100/40') : (theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-white/50')}`}>
                                                <td className="px-3 py-1.5 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                                        checked={isSelected}
                                                        onChange={(e) => handleSelectOne(disc.id, e.target.checked)}
                                                    />
                                                </td>
                                                {/* Code (editable) */}
                                                <td className="px-2 py-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <div
                                                            className="w-6 h-6 rounded flex-shrink-0"
                                                            style={{ backgroundColor: getCurrentValue(disc, 'color') as string || disc.color }}
                                                        />
                                                        <input
                                                            type="text"
                                                            value={getCurrentValue(disc, 'code') as string}
                                                            onChange={(e) => setBulkField(disc.id, 'code', e.target.value)}
                                                            className={`w-20 px-1.5 py-1 text-xs font-mono border rounded transition-colors ${isFieldChanged(disc.id, 'code')
                                                                ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-900/40 dark:border-amber-500 dark:text-slate-100'
                                                                : 'border-slate-200 bg-white hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                                                                }`}
                                                        />
                                                    </div>
                                                </td>
                                                {/* Name (editable) */}
                                                <td className="px-2 py-1.5">
                                                    <div className="flex flex-col gap-1">
                                                        <input
                                                            type="text"
                                                            value={getCurrentValue(disc, 'name') as string}
                                                            onChange={(e) => setBulkField(disc.id, 'name', e.target.value)}
                                                            className={`w-full px-2 py-1 text-sm  border rounded transition-colors ${isFieldChanged(disc.id, 'name')
                                                                ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-900/40 dark:border-amber-500 dark:text-slate-100'
                                                                : (theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'border-slate-200 bg-white hover:border-slate-300')
                                                                }`}
                                                        />
                                                        <select
                                                            value={getCurrentValue(disc, 'trainingField') as string}
                                                            onChange={(e) => setBulkField(disc.id, 'trainingField', e.target.value)}
                                                            className={`w-full px-1 py-0.5 text-[10px] border rounded transition-colors ${isFieldChanged(disc.id, 'trainingField')
                                                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/40 dark:border-amber-500 dark:text-slate-100'
                                                                : (theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'border-slate-200 bg-white text-slate-500')
                                                                }`}
                                                        >
                                                            <option value="GERAL">Geral</option>
                                                            <option value="MILITAR">Militar</option>
                                                            <option value="PROFISSIONAL">Profissional</option>
                                                            <option value="ATIVIDADES_COMPLEMENTARES">Atividades Complementares</option>
                                                        </select>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <select
                                                        value={getCurrentValue(disc, 'noSpecificInstructor') ? '__NO_INSTRUCTOR__' : (getCurrentValue(disc, 'instructorTrigram') as string || '')}
                                                        onChange={(e) => setBulkField(disc.id, 'instructorTrigram', e.target.value)}
                                                        className={`w-full px-2 py-1 text-sm border rounded transition-colors ${isFieldChanged(disc.id, 'instructorTrigram') || isFieldChanged(disc.id, 'noSpecificInstructor')
                                                            ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-900/40 dark:border-amber-500 dark:text-slate-100'
                                                            : (theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'border-slate-200 bg-white hover:border-slate-300')
                                                            }`}
                                                    >
                                                        <option value="">A Definir</option>
                                                        <option value="__NO_INSTRUCTOR__">Sem instr. (Setor)</option>
                                                        {instructors
                                                            .filter(inst => inst.enabledDisciplines?.includes(disc.id))
                                                            .sort((a, b) => a.warName.localeCompare(b.warName))
                                                            .map(inst => (
                                                                <option key={inst.trigram} value={inst.trigram}>
                                                                    {inst.rank ? `${inst.rank} ` : ''}{inst.warName} ({inst.trigram})
                                                                </option>
                                                            ))
                                                        }
                                                    </select>
                                                </td>
                                                {/* Location (editable) */}
                                                <td className="px-1 py-1">
                                                    <select
                                                        value={(getCurrentValue(disc, 'location') as string) || ''}
                                                        onChange={(e) => setBulkField(disc.id, 'location', e.target.value)}
                                                        className={`w-full px-1.5 py-1 text-xs border rounded transition-colors ${isFieldChanged(disc.id, 'location')
                                                            ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-900/40 dark:border-amber-500 dark:text-slate-100'
                                                            : (theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'border-slate-200 bg-white hover:border-slate-300')
                                                            }`}
                                                    >
                                                        <option value="">— Local —</option>
                                                        {activeLocations.map((l) => (
                                                            <option key={l.id} value={l.name}>{l.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                {/* Load hours Matrix Button (editable) */}
                                                <td className="px-2 py-1.5 text-center">
                                                    <button
                                                        onClick={() => setQuickMatrixId(disc.id)}
                                                        className={`w-full whitespace-nowrap overflow-hidden text-ellipsis px-2 py-1 text-xs font-semibold text-center border rounded transition-colors mx-auto ${isFieldChanged(disc.id, 'ppcLoads') || isFieldChanged(disc.id, 'load_hours')
                                                            ? 'border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/40 dark:border-blue-500/50 dark:text-blue-200'
                                                            : (theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-300')
                                                            }`}
                                                    >
                                                        {((getCurrentValue(disc, 'load_hours') as number) || 0) > 0 ? `${getCurrentValue(disc, 'load_hours')}h Matriz` : 'Definir Matriz'}
                                                    </button>
                                                </td>
                                                <td className="px-1 py-1 text-center">
                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 align-middle">
                                                        {(getCurrentValue(disc, 'enabledYears') as unknown as CourseYear[])?.length ? (getCurrentValue(disc, 'enabledYears') as unknown as CourseYear[]).map(y => `${y}º`).join(', ') : '...'}
                                                        <br />
                                                        {(getCurrentValue(disc, 'enabledCourses') as unknown as string[])?.length ? (getCurrentValue(disc, 'enabledCourses') as unknown as string[]).map(c => c === 'AVIATION' ? 'Avi.' : c === 'INTENDANCY' ? 'Int.' : 'Inf.').join(', ') : '...'}
                                                    </div>
                                                </td>

                                                {/* Color (editable) */}
                                                <td className="px-2 py-1.5 text-center">
                                                    <input
                                                        type="color"
                                                        value={getCurrentValue(disc, 'color') as string}
                                                        onChange={(e) => setBulkField(disc.id, 'color', e.target.value)}
                                                        className={`w-8 h-8 rounded cursor-pointer border ${isFieldChanged(disc.id, 'color')
                                                            ? 'border-amber-400 ring-2 ring-amber-200 dark:ring-amber-900'
                                                            : (theme === 'dark' ? 'border-slate-600' : 'border-slate-200')
                                                            }`}
                                                        style={{ padding: 0 }}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Bottom save bar (sticky when there are changes) */}
                        {changedCount > 0 && (
                            <div className={`sticky bottom-0 px-5 py-3 backdrop-blur-sm border-t flex items-center justify-between ${theme === 'dark' ? 'bg-amber-900/90 border-amber-800' : 'bg-amber-100/90 border-amber-200'}`}>
                                <span className={`text-sm  ${theme === 'dark' ? 'text-amber-100' : 'text-amber-800'}`}>
                                    ⚠️ {changedCount} alteração{changedCount !== 1 ? 'ões' : ''} pendente{changedCount !== 1 ? 's' : ''}. Clique em <strong>Salvar Tudo</strong> para confirmar.
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={discardEdits}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm  border rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 bg-slate-800 border-slate-700 hover:bg-slate-700' : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        <Undo2 size={14} /> Descartar
                                    </button>
                                    <button
                                        onClick={saveBulkEdits}
                                        disabled={isSaving}
                                        className="flex items-center gap-1.5 px-4 py-1.5 text-sm  text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        <Save size={14} /> {isSaving ? 'Salvando...' : 'Salvar Tudo'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {!bulkEditOpen && (
                    <div className={`w-full flex flex-col ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`}>
                        {/* Regular Table Toolbar - Sticky */}
                        <div
                            ref={regularToolbarRef}
                            className={`sticky z-40 px-4 md:px-6 py-3 border-b space-y-3 shadow-md ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} backdrop-blur-md`}
                            style={{ top: regularToolbarTop }}
                        >
                            <div className="flex flex-row gap-4 items-center">
                                <div className="relative flex-1">
                                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                                    <input
                                        type="text"
                                        placeholder="Buscar nomes, TRG ou IDs..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-colors shadow-sm outline-none ${theme === 'dark'
                                            ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500'
                                            : 'bg-white border-slate-200 placeholder-slate-400'
                                            }`}
                                    />
                                </div>    <div className="flex items-center gap-2 flex-wrap">
                                    <label className="text-sm  text-gray-700 dark:text-slate-300 whitespace-nowrap">Curso:</label>
                                    <select
                                        value={courseFilter}
                                        onChange={(e) => setCourseFilter(e.target.value as 'ALL' | 'AVIATION' | 'INTENDANCY' | 'INFANTRY')}
                                        className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                                    >
                                        <option value="ALL">Todos</option>
                                        <option value="AVIATION">Aviação</option>
                                        <option value="INFANTRY">Infantaria</option>
                                        <option value="INTENDANCY">Intendência</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <label className="text-sm  text-gray-700 dark:text-slate-300 whitespace-nowrap">Campo:</label>
                                    <select
                                        value={trainingFieldFilter}
                                        onChange={(e) => setTrainingFieldFilter(e.target.value as 'ALL' | 'GERAL' | 'MILITAR' | 'PROFISSIONAL' | 'ATIVIDADES_COMPLEMENTARES')}
                                        className={`px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm max-w-[150px] ${theme === 'dark' ? 'bg-slate-800 text-slate-100 border-slate-700' : 'bg-white border-gray-200'}`}
                                    >
                                        <option value="ALL">Todos</option>
                                        <option value="GERAL">Geral</option>
                                        <option value="MILITAR">Militar</option>
                                        <option value="PROFISSIONAL">Profissional</option>
                                        <option value="ATIVIDADES_COMPLEMENTARES">Atividades Complementares</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm  text-gray-700 dark:text-slate-300 whitespace-nowrap">Ano:</label>
                                    <select
                                        value={yearFilter}
                                        onChange={(e) => setYearFilter(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value) as 1 | 2 | 3 | 4)}
                                        className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                                    >
                                        <option value="ALL">Todos</option>
                                        <option value={1}>1º</option>
                                        <option value={2}>2º</option>
                                        <option value={3}>3º</option>
                                        <option value={4}>4º</option>
                                    </select>
                                </div>
                            </div>

                            {/* Quick Filters */}
                            <div className="flex items-center gap-3 pt-1 border-t border-gray-100 dark:border-slate-700 overflow-x-auto whitespace-nowrap pb-1 h-8 no-scrollbar">
                                <div className="text-[10px]  text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mr-1">
                                    <Zap size={12} className="text-amber-500" /> Filtros Rápidos:
                                </div>
                                <button
                                    onClick={() => setSearchTerm('!instructor')}
                                    className={`px-3 py-1.5 text-xs  rounded-lg transition-all border flex items-center gap-1.5 ${searchTerm === '!instructor'
                                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                                        : (theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-amber-500 hover:bg-amber-900/10' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:bg-amber-50/30')}`}
                                >
                                    Sem Instrutor
                                </button>
                                <button
                                    onClick={() => setSearchTerm('!location')}
                                    className={`px-3 py-1.5 text-xs  rounded-lg transition-all border flex items-center gap-1.5 ${searchTerm === '!location'
                                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                                        : (theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-amber-500 hover:bg-amber-900/10' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:bg-amber-50/30')}`}
                                >
                                    Sem Local
                                </button>
                                {searchTerm.startsWith('!') && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="px-2 py-1.5 text-xs  text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
                                    >
                                        <Undo2 size={14} /> Limpar
                                    </button>
                                )}
                            </div>
                        </div>

                        {disciplines.length === 0 ? (
                            <div className="text-center py-16">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-50'}`}>
                                    <Plus size={24} className={theme === 'dark' ? 'text-slate-500' : 'text-gray-400'} />
                                </div>
                                <h3 className={`text-lg  ${theme === 'dark' ? 'text-slate-200' : 'text-gray-900'}`}>Nenhuma disciplina ainda</h3>
                                <p className={`mt-1 mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Se já existem disciplinas no banco, clique em Recarregar.</p>
                                <div className="flex items-center justify-center gap-3">
                                    <button
                                        onClick={handleReloadDisciplines}
                                        disabled={reloading}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw size={14} className={reloading ? 'animate-spin' : ''} />
                                        {reloading ? 'Recarregando...' : 'Recarregar'}
                                    </button>
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline text-sm"
                                    >
                                        Criar Disciplina
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full relative">
                                <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-gray-100'}`}>
                                    <thead className={`z-20 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                        <tr className="border-b dark:border-slate-800">
                                            <th
                                                onClick={() => handleSort('name')}
                                                className={`sticky z-30 px-4 py-3 text-left text-[10px] uppercase tracking-wider cursor-pointer group select-none min-w-[140px] ${theme === 'dark' ? 'bg-slate-950 hover:bg-slate-900 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]' : 'bg-gray-50 hover:bg-gray-100 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]'}`}
                                                style={{ top: regularTableHeadTop }}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Disciplina
                                                    {getSortIcon('name')}
                                                </div>
                                            </th>
                                            <th
                                                className={`sticky z-30 px-3 py-3 text-center text-[10px] uppercase tracking-wider group select-none min-w-[150px] ${theme === 'dark' ? 'bg-slate-950 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]' : 'bg-gray-50 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]'}`}
                                                style={{ top: regularTableHeadTop }}
                                            >
                                                <div className="flex justify-center items-center gap-1">
                                                    Matriz (Carga)
                                                </div>
                                            </th>
                                            <th
                                                onClick={() => handleSort('instructor')}
                                                className={`sticky z-30 px-3 py-3 text-left text-[10px] uppercase tracking-wider cursor-pointer group select-none min-w-[180px] ${theme === 'dark' ? 'bg-slate-950 hover:bg-slate-900 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]' : 'bg-gray-50 hover:bg-gray-100 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]'}`}
                                                style={{ top: regularTableHeadTop }}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Instrutor
                                                    {getSortIcon('instructor')}
                                                </div>
                                            </th>
                                            <th className={`sticky z-[32] backdrop-blur-sm px-3 py-3 text-center text-[10px] uppercase tracking-wider whitespace-nowrap border-l shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)] ${theme === 'dark' ? 'bg-slate-950 text-slate-400 border-slate-700' : 'bg-gray-50 text-gray-500 border-gray-100'}`} style={{ top: regularTableHeadTop }}>Grade</th>
                                            {canEdit && <th className={`sticky right-0 z-[32] backdrop-blur-sm px-4 py-3 text-right text-[10px] uppercase tracking-wider whitespace-nowrap border-l shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)] ${theme === 'dark' ? 'bg-slate-950 text-slate-400 border-slate-700' : 'bg-gray-50 text-gray-500 border-gray-100'}`} style={{ top: regularTableHeadTop }}>Ações</th>}
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${theme === 'dark' ? 'bg-slate-800 divide-slate-700' : 'bg-white divide-gray-100'}`}>
                                        {filteredDisciplines.map((discipline) => (
                                            <tr key={discipline.id} className={`transition-colors group ${theme === 'dark' ? 'hover:bg-blue-900/10' : 'hover:bg-blue-50/30'}`}>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center">
                                                        <div
                                                            className="w-10 h-6 rounded mr-2 flex-shrink-0 flex items-center justify-center text-white text-[9px]  shadow-sm"
                                                            style={{ backgroundColor: discipline.color }}
                                                        >
                                                            {discipline.code.substring(0, 4).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className={`text-[13px]  truncate ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`} title={discipline.name}>{discipline.name}</div>
                                                            <div className={`text-[10px] font-medium tracking-wide uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{formatTrainingField(discipline.trainingField)}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={`px-3 py-2 text-xs text-center ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                                    {discipline.ppcLoads && Object.values(discipline.ppcLoads).some(load => load > 0) ? (
                                                        <div className="flex flex-wrap justify-center gap-1">
                                                            {Object.entries(discipline.ppcLoads)
                                                                .sort(([keyA], [keyB]) => {
                                                                    const order: Record<string, number> = { AVIATION: 1, INTENDANCY: 2, INFANTRY: 3 };
                                                                    const cA = keyA.split('_')[0];
                                                                    const cB = keyB.split('_')[0];
                                                                    if (order[cA] !== order[cB]) return (order[cA] || 99) - (order[cB] || 99);
                                                                    const yA = Number(keyA.split('_')[1]);
                                                                    const yB = Number(keyB.split('_')[1]);
                                                                    return yA - yB;
                                                                })
                                                                .map(([key, load]) => {
                                                                if (load > 0) {
                                                                    const [c, y] = key.split('_');
                                                                    return (
                                                                        <span key={key} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] whitespace-nowrap shadow-sm border ${theme === 'dark' ? 'bg-slate-700/50 text-slate-300 border-slate-600' : 'bg-white text-slate-600 border-slate-200'}`} title={`${c === 'AVIATION' ? 'Aviação' : c === 'INTENDANCY' ? 'Intendência' : 'Infantaria'}: ${y}º Esq - ${load}h`}>
                                                                            <span className="opacity-70">{c === 'AVIATION' ? 'Av' : c === 'INTENDANCY' ? 'Int' : 'Inf'} {y}º:</span> <strong className={`font-mono ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{load}h</strong>
                                                                        </span>
                                                                    );
                                                                }
                                                                return null;
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <span className={`italic text-[10px] ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`}>Matriz Exclusiva (0h)</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-600 dark:text-slate-400">
                                                    <div className="flex items-center gap-1.5">
                                                        {(() => {
                                                            let displayInstructor = '';
                                                            if (discipline.instructorTrigram && instructors.some(i => i.trigram === discipline.instructorTrigram)) {
                                                                displayInstructor = instructors.find(i => i.trigram === discipline.instructorTrigram)?.warName || '';
                                                            } else if (discipline.instructor && instructors.some(i => i.warName === discipline.instructor || i.fullName === discipline.instructor)) {
                                                                displayInstructor = discipline.instructor;
                                                            }

                                                            if (discipline.noSpecificInstructor) {
                                                                return <span className={`italic text-[11px] font-medium ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>Sem Instrutor (Setor)</span>;
                                                            }

                                                            return displayInstructor ? (
                                                                <>
                                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px]  ${theme === 'dark' ? 'bg-slate-700 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                                                        {displayInstructor.charAt(0)}
                                                                    </div>
                                                                    <span className={`whitespace-normal ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} title={displayInstructor}>
                                                                        {displayInstructor}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className={`italic ${theme === 'dark' ? 'text-slate-600' : 'text-gray-300'}`}>A Definir</span>
                                                            );
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className={`sticky right-[100px] z-10 backdrop-blur-sm transition-colors px-4 py-2 text-center border-l shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)] ${theme === 'dark' ? 'bg-slate-900 group-hover:bg-slate-800 border-slate-700' : 'bg-white group-hover:bg-blue-50/95 border-gray-100'}`}>
                                                    <Link
                                                        to={`/discipline-report/${discipline.id}`}
                                                        className="p-1 inline-block text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                                                    >
                                                        <Calendar size={16} />
                                                    </Link>
                                                </td>
                                                {canEdit && (
                                                    <td className={`sticky right-0 z-10 backdrop-blur-sm transition-colors px-4 py-2 text-right border-l shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)] ${theme === 'dark' ? 'bg-slate-900 group-hover:bg-slate-800 border-slate-700' : 'bg-white group-hover:bg-blue-50/95 border-gray-100'}`}>
                                                        <div className="flex justify-end gap-1.5">
                                                            <button
                                                                onClick={() => startEdit(discipline.id)}
                                                                className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => confirmDelete(discipline.id, discipline.name)}
                                                                className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {isModalOpen && (
                    <DisciplineForm
                        initialData={editingId ? disciplines.find(d => d.id === editingId) : undefined}
                        onSubmit={handleSave}
                        onCancel={closeModal}
                    />
                )}

                <ConfirmDialog
                    isOpen={deleteConfirm.isOpen}
                    onClose={() => setDeleteConfirm({ isOpen: false, disciplineId: null, disciplineName: '' })}
                    onConfirm={handleDelete}
                    title="Excluir Disciplina"
                    message={`Tem certeza que deseja excluir a disciplina "${deleteConfirm.disciplineName}"? Esta ação não pode ser desfeita.`}
                    confirmText="Excluir"
                    cancelText="Cancelar"
                    type="danger"
                />

                {/* Quick Matrix Modal */}
                {quickMatrixId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className={`rounded-xl shadow-2xl p-6 max-w-lg w-full ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                                    Matriz PPC - {disciplines.find(d => d.id === quickMatrixId)?.code}
                                </h3>
                                <button onClick={() => setQuickMatrixId(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                    <Undo2 size={20} />
                                </button>
                            </div>
                            
                            <div className="overflow-x-auto rounded-lg border dark:border-slate-700">
                                <table className="w-full text-sm text-center">
                                    <thead className={`${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                                        <tr>
                                            <th className="px-2 py-2 w-24"></th>
                                            <th className="px-2 py-2">Aviação</th>
                                            <th className="px-2 py-2">Intendência</th>
                                            <th className="px-2 py-2">Infantaria</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'}`}>
                                        {([1, 2, 3, 4] as CourseYear[]).map(year => (
                                            <tr key={year} className={`${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/50'}`}>
                                                <td className={`px-2 py-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                                                    {year}º Esq
                                                </td>
                                                {['AVIATION', 'INTENDANCY', 'INFANTRY'].map(course => {
                                                    const key = `${course}_${year}`;
                                                    const currentLoads = getEditedValue(quickMatrixId, 'ppcLoads') || disciplines.find(d => d.id === quickMatrixId)?.ppcLoads || {};
                                                    const val = (currentLoads as Record<string, number>)[key] || 0;
                                                    return (
                                                        <td key={course} className="px-2 py-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={val === 0 ? '' : val}
                                                                onChange={e => setBulkMatrixLoad(quickMatrixId, course, year, parseInt(e.target.value) || 0)}
                                                                className={`w-full max-w-[80px] px-2 py-1.5 text-center border rounded transition-colors hide-arrows ${
                                                                    val > 0 
                                                                        ? 'border-blue-400 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:border-blue-500/50 dark:text-blue-100 ring-1 ring-blue-500/20' 
                                                                        : (theme === 'dark' ? 'bg-slate-950 border-slate-700 text-slate-300 focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 focus:bg-slate-50')
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

                            <div className="mt-6 flex justify-end">
                                <button 
                                    onClick={() => setQuickMatrixId(null)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                                >
                                    Concluir
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
