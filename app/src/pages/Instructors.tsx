import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Trash2, Edit2, History, PenLine, Save, Undo2, ChevronUp, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { useCourseStore } from '../store/useCourseStore';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import type { Instructor, InstructorOccurrence, InstructorVenture, AcademicTitle } from '../types';
import { Badge } from '../components/common/Badge';

type BulkInstructorEdits = Record<string, Partial<Pick<Instructor, 'venture' | 'maxTitle' | 'weeklyLoadLimit' | 'specialty' | 'rank'>>>;

export const Instructors = () => {
   // --- Sticky refs ---
   const pageHeaderRef = useRef<HTMLDivElement>(null);
   const toolbarRef = useRef<HTMLDivElement>(null);
   const bulkHeaderRef = useRef<HTMLDivElement>(null);
   const bulkActionsRef = useRef<HTMLDivElement>(null);
   const [pageHeaderH, setPageHeaderH] = useState(64);
   const [toolbarH, setToolbarH] = useState(96);
   const [bulkHeaderH, setBulkHeaderH] = useState(64);
   const [bulkActionsH, setBulkActionsH] = useState(100);
   const { instructors, addInstructor, updateInstructor, deleteInstructor, addOccurrence, disciplines, classes } = useCourseStore();
   const { theme } = useTheme();
   const { userProfile } = useAuth();

   const [searchTerm, setSearchTerm] = useState('');
   const [debouncedSearch, setDebouncedSearch] = useState('');
   useEffect(() => { const t = setTimeout(() => setDebouncedSearch(searchTerm), 300); return () => clearTimeout(t); }, [searchTerm]);

   const [ventureFilter, setVentureFilter] = useState<InstructorVenture | 'ALL'>('ALL');
   const [titleFilter, setTitleFilter] = useState<AcademicTitle | 'ALL'>('ALL');
   const [isInstructorModalOpen, setIsInstructorModalOpen] = useState(false);
   const [isOccurrenceModalOpen, setIsOccurrenceModalOpen] = useState(false);
   const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
   const [selectedInstructorForOccurrence, setSelectedInstructorForOccurrence] = useState<string | null>(null);
   const [disciplineSearch, setDisciplineSearch] = useState('');
   const [classSearch, setClassSearch] = useState('');
   const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
   const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

   // --- Bulk edit ---
   const [bulkEditOpen, setBulkEditOpen] = useState(false);
   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
   const [bulkEdits, setBulkEdits] = useState<BulkInstructorEdits>({});
   const [isSaving, setIsSaving] = useState(false);
   const [saveResult, setSaveResult] = useState<{ success: number; total: number } | null>(null);

   useEffect(() => {
      const obs = new ResizeObserver(entries => {
         for (const e of entries) {
            const h = Math.ceil(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height);
            if (e.target === pageHeaderRef.current) setPageHeaderH(h);
            if (e.target === toolbarRef.current) setToolbarH(h);
            if (e.target === bulkHeaderRef.current) setBulkHeaderH(h);
            if (e.target === bulkActionsRef.current) setBulkActionsH(h);
         }
      });
      [pageHeaderRef, toolbarRef, bulkHeaderRef, bulkActionsRef].forEach(r => { 
         if (r.current) obs.observe(r.current); 
      });
      return () => obs.disconnect();
   }, [bulkEditOpen]);

   const canEdit = useMemo(() => ['SUPER_ADMIN', 'ADMIN'].includes(userProfile?.role || ''), [userProfile]);

   // --- Filters ---
   const filteredInstructors = useMemo(() => {
      return [...instructors].sort((a, b) => a.warName.localeCompare(b.warName)).filter(i => {
         // Smart search
         if (debouncedSearch.startsWith('!')) {
            const target = debouncedSearch.substring(1).toLowerCase();
            if (target === 'disciplina') return !i.enabledDisciplines?.length;
            if (target === 'turma') return !i.enabledClasses?.length;
            if (target === 'ch') return !i.weeklyLoadLimit;
            return false;
         }
         const q = debouncedSearch.toLowerCase();
         const matchesSearch = !q ||
            i.fullName?.toLowerCase().includes(q) ||
            i.warName?.toLowerCase().includes(q) ||
            i.trigram?.toLowerCase().includes(q) ||
            i.specialty?.toLowerCase().includes(q) ||
            i.rank?.toLowerCase().includes(q);
         const matchesVenture = ventureFilter === 'ALL' || i.venture === ventureFilter;
         const matchesTitle = titleFilter === 'ALL' || i.maxTitle === titleFilter;
         return matchesSearch && matchesVenture && matchesTitle;
      });
   }, [instructors, debouncedSearch, ventureFilter, titleFilter]);

   const getVentureLabel = (venture: InstructorVenture) => ({ EFETIVO: 'Efetivo', PRESTADOR_TAREFA: 'PTTC', CIVIL: 'Civil', QOCON: 'QOCon' })[venture];

   // --- Bulk edit helpers ---
   const changedCount = Object.keys(bulkEdits).length;

   const setBulkField = useCallback((id: string, field: keyof Pick<Instructor, 'venture' | 'maxTitle' | 'weeklyLoadLimit' | 'specialty' | 'rank'>, value: string | number) => {
      const original = instructors.find(i => i.trigram === id);
      if (!original) return;
      setBulkEdits(prev => {
         const current = { ...prev };
         const edits = { ...(current[id] || {}) };
         const origVal = original[field];
         if (String(origVal ?? '') === String(value)) { delete edits[field as keyof typeof edits]; }
         else { (edits as any)[field] = value; }
         if (Object.keys(edits).length === 0) delete current[id];
         else current[id] = edits;
         return current;
      });
   }, [instructors]);

   const getCurrentValue = (inst: Instructor, field: keyof Pick<Instructor, 'venture' | 'maxTitle' | 'weeklyLoadLimit' | 'specialty' | 'rank'>) => {
      const edited = bulkEdits[inst.trigram]?.[field];
      return edited !== undefined ? edited : (inst[field] ?? '');
   };

   const isFieldChanged = (id: string, field: string) => bulkEdits[id]?.[field as keyof typeof bulkEdits[string]] !== undefined;

   const discardEdits = () => { setBulkEdits({}); setSaveResult(null); };

   const saveBulkEdits = async () => {
      setIsSaving(true);
      setSaveResult(null);
      try {
         await Promise.all(Object.entries(bulkEdits).map(([trigram, updates]) => {
            const original = instructors.find(i => i.trigram === trigram);
            if (!original) return Promise.resolve();
            return updateInstructor(trigram, { ...original, ...updates });
         }));
         setSaveResult({ success: changedCount, total: changedCount });
         setBulkEdits({});
      } catch {
         setSaveResult({ success: 0, total: changedCount });
      } finally {
         setIsSaving(false);
         setTimeout(() => setSaveResult(null), 4000);
      }
   };

   const handleBulkDelete = async () => {
      const targets = selectedIds.size > 0 ? Array.from(selectedIds) : [];
      if (!targets.length) { alert('Selecione pelo menos um docente.'); return; }
      if (!confirm(`Excluir ${targets.length} docente(s)? Esta ação não pode ser desfeita.`)) return;
      for (const trigram of targets) await deleteInstructor(trigram);
      setSelectedIds(new Set());
   };

   const handleSelectAll = (checked: boolean) => setSelectedIds(checked ? new Set(filteredInstructors.map(i => i.trigram)) : new Set());
   const handleSelectOne = (id: string, checked: boolean) => {
      const s = new Set(selectedIds);
      checked ? s.add(id) : s.delete(id);
      setSelectedIds(s);
   };

   // --- Instructor form handlers ---
   const handleSaveInstructor = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const data: Instructor = {
         trigram: editingInstructor ? editingInstructor.trigram : (fd.get('trigram') as string || '').toUpperCase(),
         fullName: fd.get('fullName') as string || '',
         warName: fd.get('warName') as string || '',
         rank: fd.get('rank') as string || '',
         cpf_saram: fd.get('cpf_saram') as string || '',
         email: fd.get('email') as string || '',
         phone: fd.get('phone') as string || '',
         venture: fd.get('venture') as InstructorVenture,
         maxTitle: fd.get('maxTitle') as AcademicTitle,
         specialty: fd.get('specialty') as string || '',
         weeklyLoadLimit: parseInt(fd.get('weeklyLoadLimit') as string) || 0,
         fixedBlocks: [],
         plannedAbsences: editingInstructor?.plannedAbsences || [],
         preferences: fd.get('preferences') as string,
         enabledDisciplines: selectedDisciplines,
         enabledClasses: selectedClasses,
      };
      if (editingInstructor) { updateInstructor(editingInstructor.trigram, data); }
      else {
         if (instructors.some(i => i.trigram === data.trigram)) { alert('Trigrama já em uso!'); return; }
         addInstructor(data);
      }
      setIsInstructorModalOpen(false); setEditingInstructor(null);
   };

   const handleSaveOccurrence = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const occ: InstructorOccurrence = {
         id: crypto.randomUUID(),
         instructorTrigram: selectedInstructorForOccurrence!,
         date: fd.get('date') as string,
         type: fd.get('type') as InstructorOccurrence['type'],
         reason: fd.get('reason') as string,
         disciplineId: fd.get('disciplineId') as string || undefined,
      };
      addOccurrence(occ);
      setIsOccurrenceModalOpen(false); setSelectedInstructorForOccurrence(null);
   };

   const inputCls = `w-full px-3 py-1.5 rounded border focus:ring-1 focus:ring-blue-500 text-sm ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200'}`;
   const selectCls = `w-full px-2 py-1.5 rounded border text-sm ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200'}`;

   // Computed sticky tops
   const toolbarTop = pageHeaderH;
   const regularTableHeadTop = pageHeaderH + toolbarH;
   const bulkActionsTop = pageHeaderH + bulkHeaderH;
   const bulkTableHeadTop = pageHeaderH + bulkHeaderH + bulkActionsH;

   return (
      <div className={`w-full min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-slate-900'}`}>

         {/* ─── PAGE HEADER (sticky) ─── */}
         <div ref={pageHeaderRef} className={`sticky top-0 z-50 px-4 md:px-6 py-3 border-b flex items-center justify-between gap-4 backdrop-blur-md ${theme === 'dark' ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
            <div className="flex items-baseline gap-3">
               <h1 className="text-xl font-bold tracking-tight">Docentes</h1>
               <p className={`hidden sm:block text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Gestão de instrutores, especialidades e turmas.</p>
            </div>
            <div className="flex items-center gap-2">
               {canEdit && (
                  <>
                     <button
                        onClick={() => { setBulkEditOpen(!bulkEditOpen); setSaveResult(null); }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm whitespace-nowrap border ${bulkEditOpen
                           ? (theme === 'dark' ? 'bg-amber-900/30 text-amber-400 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200 shadow-inner')
                           : (theme === 'dark' ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-white text-slate-700 border-slate-200 shadow-sm')}`}
                     >
                        <PenLine size={14} />
                        Edição em Massa
                        {changedCount > 0 && <span className="bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{changedCount}</span>}
                     </button>
                     <button
                        onClick={() => { setEditingInstructor(null); setSelectedDisciplines([]); setSelectedClasses([]); setIsInstructorModalOpen(true); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm text-sm font-medium whitespace-nowrap"
                     >
                        <Plus size={16} /> Novo
                     </button>
                  </>
               )}
            </div>
         </div>

         {/* ─── BULK EDIT MODE ─── */}
         {canEdit && bulkEditOpen && (
            <div className={`border-b ${theme === 'dark' ? 'bg-slate-800 border-amber-900/30' : 'bg-amber-50/10 border-amber-200/30'}`}>
               {/* Bulk Header (sticky) */}
               <div ref={bulkHeaderRef} className={`sticky z-40 px-4 md:px-6 py-3 border-b flex items-center justify-between backdrop-blur-md ${theme === 'dark' ? 'bg-slate-950/95 border-amber-900/60' : 'bg-amber-50/95 border-amber-200/60'}`} style={{ top: pageHeaderH }}>
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-sm"><PenLine size={16} className="text-white" /></div>
                     <div>
                        <h2 className={`text-sm font-semibold ${theme === 'dark' ? 'text-amber-100' : 'text-slate-800'}`}>Edição em Massa</h2>
                        <p className={`text-xs ${theme === 'dark' ? 'text-amber-200/70' : 'text-slate-500'}`}>Edite diretamente na tabela. Alterações pendentes até salvar.</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <button onClick={handleBulkDelete} disabled={selectedIds.size === 0 || isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors shadow-sm">
                        <Trash2 size={13} /> Excluir Selecionados
                     </button>
                     {changedCount > 0 && (
                        <>
                           <span className="text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-3 py-1 rounded-full">{changedCount} alterado{changedCount !== 1 ? 's' : ''}</span>
                           <button onClick={discardEdits} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 bg-slate-800 border-slate-700 hover:bg-slate-700' : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'}`}>
                              <Undo2 size={13} /> Descartar
                           </button>
                           <button onClick={saveBulkEdits} disabled={isSaving}
                              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
                              <Save size={13} /> {isSaving ? 'Salvando...' : 'Salvar Tudo'}
                           </button>
                        </>
                     )}
                     <button onClick={() => setBulkEditOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800/60 ml-1">
                        <ChevronUp size={18} />
                     </button>
                  </div>
               </div>

               {/* Save result */}
               {saveResult && (
                  <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium ${saveResult.success === saveResult.total ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 border border-red-200'}`}>
                     {saveResult.success === saveResult.total ? <><CheckCircle2 size={16} /> {saveResult.success} docente{saveResult.success !== 1 ? 's' : ''} atualizados com sucesso!</> : <><AlertCircle size={16} /> {saveResult.success}/{saveResult.total} salvos. Alguns falharam.</>}
                  </div>
               )}

               {/* Smart actions bar (sticky) */}
               <div ref={bulkActionsRef} className={`sticky z-30 px-4 md:px-6 py-3 border-b backdrop-blur-sm ${theme === 'dark' ? 'bg-slate-950/95 border-amber-900/50' : 'bg-amber-50/95 border-amber-100/50'}`} style={{ top: bulkActionsTop }}>
                  <div className="text-[10px] text-amber-700 dark:text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2 font-bold">
                     <PenLine size={12} /> Ações Inteligentes {selectedIds.size > 0 ? `(${selectedIds.size} selecionados)` : `(${filteredInstructors.length} filtrados)`}
                  </div>
                  <div className="flex flex-nowrap overflow-x-auto pb-1 gap-6 items-center">
                     {/* Smart venture */}
                     <div className="flex-none w-[200px]">
                        <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1.5 uppercase tracking-wider">Definir Vínculo:</label>
                        <div className="flex gap-1">
                           <select id="smart-venture" className={`w-full px-2 py-1.5 text-xs border rounded-lg outline-none ${theme === 'dark' ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white border-slate-200'}`}>
                              <option value="EFETIVO">Efetivo</option>
                              <option value="PRESTADOR_TAREFA">PTTC</option>
                              <option value="CIVIL">Civil</option>
                              <option value="QOCON">QOCon</option>
                           </select>
                           <button onClick={() => {
                              const val = (document.getElementById('smart-venture') as HTMLSelectElement).value;
                              const targets = selectedIds.size > 0 ? Array.from(selectedIds) : filteredInstructors.map(i => i.trigram);
                              targets.forEach(id => setBulkField(id, 'venture', val));
                           }} className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-xs font-bold shadow-sm">Aplicar</button>
                        </div>
                     </div>
                     {/* Smart title */}
                     <div className="flex-none w-[180px]">
                        <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1.5 uppercase tracking-wider">Definir Titulação:</label>
                        <div className="flex gap-1">
                           <select id="smart-title" className={`w-full px-2 py-1.5 text-xs border rounded-lg outline-none ${theme === 'dark' ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white border-slate-200'}`}>
                              <option value="GRADUADO">Graduado</option>
                              <option value="ESPECIALISTA">Especialista</option>
                              <option value="MESTRE">Mestre</option>
                              <option value="DOUTOR">Doutor</option>
                           </select>
                           <button onClick={() => {
                              const val = (document.getElementById('smart-title') as HTMLSelectElement).value;
                              const targets = selectedIds.size > 0 ? Array.from(selectedIds) : filteredInstructors.map(i => i.trigram);
                              targets.forEach(id => setBulkField(id, 'maxTitle', val));
                           }} className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-xs font-bold shadow-sm">Aplicar</button>
                        </div>
                     </div>
                     {/* Smart CH */}
                     <div className="flex-none w-[160px]">
                        <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1.5 uppercase tracking-wider">Definir CH Semanal:</label>
                        <div className="flex gap-1">
                           <input id="smart-ch" type="number" min="0" max="40" placeholder="h/sem" className={`w-full px-2 py-1.5 text-xs border rounded-lg outline-none ${theme === 'dark' ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white border-slate-200'}`} />
                           <button onClick={() => {
                              const val = parseInt((document.getElementById('smart-ch') as HTMLInputElement).value) || 0;
                              const targets = selectedIds.size > 0 ? Array.from(selectedIds) : filteredInstructors.map(i => i.trigram);
                              targets.forEach(id => setBulkField(id, 'weeklyLoadLimit', val));
                              (document.getElementById('smart-ch') as HTMLInputElement).value = '';
                           }} className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-xs font-bold shadow-sm">Ok</button>
                        </div>
                     </div>
                     {/* Smart specialty */}
                     <div className="flex-none w-[220px]">
                        <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1.5 uppercase tracking-wider">Definir Especialidade:</label>
                        <div className="flex gap-1">
                           <input id="smart-specialty" type="text" placeholder="Ex: Matemática" className={`w-full px-2 py-1.5 text-xs border rounded-lg outline-none ${theme === 'dark' ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white border-slate-200'}`} />
                           <button onClick={() => {
                              const val = (document.getElementById('smart-specialty') as HTMLInputElement).value;
                              if (!val) return;
                              const targets = selectedIds.size > 0 ? Array.from(selectedIds) : filteredInstructors.map(i => i.trigram);
                              targets.forEach(id => setBulkField(id, 'specialty', val));
                              (document.getElementById('smart-specialty') as HTMLInputElement).value = '';
                           }} className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-xs font-bold shadow-sm">Aplicar</button>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Bulk table */}
               <div className="w-full relative">
                  <table className="w-full text-sm">
                     <thead>
                        <tr className={`text-[10px] uppercase tracking-wider border-b ${theme === 'dark' ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-gray-50 text-slate-500 border-slate-100'}`}>
                           <th className={`sticky z-30 text-center py-2 px-3 w-10 ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}>
                              <input type="checkbox" className="rounded text-amber-600" onChange={e => handleSelectAll(e.target.checked)} checked={selectedIds.size === filteredInstructors.length && filteredInstructors.length > 0} />
                           </th>
                           {['Tri', 'Guerra', 'Posto', 'Vínculo', 'Titulação', 'CH (h/sem)', 'Especialidade'].map(h => (
                              <th key={h} className={`sticky z-30 text-left py-2 px-3 ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}>{h}</th>
                           ))}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-amber-100/60 dark:divide-amber-900/30">
                        {filteredInstructors.map(inst => {
                           const isSelected = selectedIds.has(inst.trigram);
                           const hasChanges = !!bulkEdits[inst.trigram];
                           const cellCls = (field: string) => `w-full px-2 py-1 text-sm border rounded transition-colors ${isFieldChanged(inst.trigram, field) ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/40 dark:border-amber-500 ring-1 ring-amber-200' : (theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'border-slate-200 bg-white')}`;
                           return (
                              <tr key={inst.trigram} className={`transition-colors ${isSelected ? (theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50') : hasChanges ? (theme === 'dark' ? 'bg-amber-900/10' : 'bg-amber-100/30') : (theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-white/50')}`}>
                                 <td className="px-3 py-1.5 text-center"><input type="checkbox" className="rounded text-amber-600" checked={isSelected} onChange={e => handleSelectOne(inst.trigram, e.target.checked)} /></td>
                                 <td className="px-3 py-1.5 font-mono text-blue-500 text-xs">{inst.trigram}</td>
                                 <td className="px-3 py-1.5 text-xs font-medium">{inst.warName}</td>
                                 <td className="px-2 py-1">
                                    <input type="text" value={(getCurrentValue(inst, 'rank') as string)} onChange={e => setBulkField(inst.trigram, 'rank', e.target.value)} className={cellCls('rank')} />
                                 </td>
                                 <td className="px-2 py-1">
                                    <select value={(getCurrentValue(inst, 'venture') as string)} onChange={e => setBulkField(inst.trigram, 'venture', e.target.value)} className={cellCls('venture')}>
                                       <option value="EFETIVO">Efetivo</option>
                                       <option value="PRESTADOR_TAREFA">PTTC</option>
                                       <option value="CIVIL">Civil</option>
                                       <option value="QOCON">QOCon</option>
                                    </select>
                                 </td>
                                 <td className="px-2 py-1">
                                    <select value={(getCurrentValue(inst, 'maxTitle') as string)} onChange={e => setBulkField(inst.trigram, 'maxTitle', e.target.value)} className={cellCls('maxTitle')}>
                                       <option value="GRADUADO">Graduado</option>
                                       <option value="ESPECIALISTA">Especialista</option>
                                       <option value="MESTRE">Mestre</option>
                                       <option value="DOUTOR">Doutor</option>
                                    </select>
                                 </td>
                                 <td className="px-2 py-1 w-24">
                                    <input type="number" min={0} value={(getCurrentValue(inst, 'weeklyLoadLimit') as number)} onChange={e => setBulkField(inst.trigram, 'weeklyLoadLimit', parseInt(e.target.value) || 0)} className={cellCls('weeklyLoadLimit')} />
                                 </td>
                                 <td className="px-2 py-1">
                                    <input type="text" value={(getCurrentValue(inst, 'specialty') as string)} onChange={e => setBulkField(inst.trigram, 'specialty', e.target.value)} className={cellCls('specialty')} />
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>

               {/* Bottom save bar */}
               {changedCount > 0 && (
                  <div className={`sticky bottom-0 px-5 py-3 backdrop-blur-sm border-t flex items-center justify-between ${theme === 'dark' ? 'bg-amber-900/90 border-amber-800' : 'bg-amber-100/90 border-amber-200'}`}>
                     <span className={`text-sm font-medium ${theme === 'dark' ? 'text-amber-100' : 'text-amber-800'}`}>⚠️ {changedCount} alteração{changedCount !== 1 ? 'ões' : ''} pendente{changedCount !== 1 ? 's' : ''}.</span>
                     <div className="flex gap-2">
                        <button onClick={discardEdits} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg ${theme === 'dark' ? 'text-slate-300 bg-slate-800 border-slate-700' : 'text-slate-600 bg-white border-slate-200'}`}><Undo2 size={13} /> Descartar</button>
                        <button onClick={saveBulkEdits} disabled={isSaving} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"><Save size={13} /> {isSaving ? 'Salvando...' : 'Salvar Tudo'}</button>
                     </div>
                  </div>
               )}
            </div>
         )}

         {/* ─── NORMAL MODE ─── */}
         {!bulkEditOpen && (
            <div className="w-full flex flex-col">
               {/* Toolbar (sticky) */}
               <div ref={toolbarRef} className={`sticky z-40 px-4 md:px-6 py-3 border-b space-y-2 shadow-md backdrop-blur-md ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`} style={{ top: toolbarTop }}>
                  <div className="flex flex-row gap-3 items-center">
                     <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                           type="text"
                           placeholder="Buscar docente por nome, trigrama, especialidade..."
                           value={searchTerm}
                           onChange={e => setSearchTerm(e.target.value)}
                           className={`w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-200 placeholder-slate-400'}`}
                        />
                     </div>
                     <select value={ventureFilter} onChange={e => setVentureFilter(e.target.value as any)} className={`px-3 py-2 rounded-lg border text-sm outline-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'}`}>
                        <option value="ALL">Vínculo: Todos</option>
                        <option value="EFETIVO">Efetivo</option>
                        <option value="PRESTADOR_TAREFA">PTTC</option>
                        <option value="CIVIL">Civil</option>
                        <option value="QOCON">QOCon</option>
                     </select>
                     <select value={titleFilter} onChange={e => setTitleFilter(e.target.value as any)} className={`px-3 py-2 rounded-lg border text-sm outline-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'}`}>
                        <option value="ALL">Titulação: Todas</option>
                        <option value="GRADUADO">Graduado</option>
                        <option value="ESPECIALISTA">Especialista</option>
                        <option value="MESTRE">Mestre</option>
                        <option value="DOUTOR">Doutor</option>
                     </select>
                  </div>
                  {/* Quick filters */}
                  <div className="flex items-center gap-3 pt-1 border-t border-gray-100 dark:border-slate-700 overflow-x-auto whitespace-nowrap h-8">
                     <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mr-1"><Zap size={12} className="text-amber-500" /> Filtros Rápidos:</div>
                     {[
                        { label: 'Sem Disciplina', cmd: '!disciplina' },
                        { label: 'Sem Turma', cmd: '!turma' },
                        { label: 'Sem CH', cmd: '!ch' },
                     ].map(({ label, cmd }) => (
                        <button key={cmd} onClick={() => setSearchTerm(searchTerm === cmd ? '' : cmd)}
                           className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${searchTerm === cmd ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : (theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:bg-amber-50/30')}`}>
                           {label}
                        </button>
                     ))}
                     {searchTerm.startsWith('!') && (
                        <button onClick={() => setSearchTerm('')} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><Undo2 size={13} /> Limpar</button>
                     )}
                  </div>
               </div>

               {/* Table */}
               <div className={`rounded-none w-full relative ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className={`text-xs uppercase tracking-wider border-b ${theme === 'dark' ? 'bg-slate-900/50 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                           {['Tri', 'Guerra', 'Vínculo', 'Disciplinas', 'Turmas', 'CH', 'Ações'].map((h, i) => (
                              <th key={h} className={`sticky z-30 px-4 py-3 font-medium ${i === 6 ? 'text-right' : i === 5 ? 'text-center' : 'text-left'} ${i >= 2 && i <= 2 ? 'hidden lg:table-cell' : ''} ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`} style={{ top: regularTableHeadTop }}>{h}</th>
                           ))}
                        </tr>
                     </thead>
                     <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'}`}>
                        {filteredInstructors.length > 0 ? filteredInstructors.map(instructor => (
                           <tr key={instructor.trigram} className="hover:bg-blue-500/5 transition-colors group">
                              <td className="px-4 py-1.5 text-sm font-mono font-bold text-blue-500">{instructor.trigram}</td>
                              <td className="px-4 py-1.5 text-sm font-medium">{instructor.warName}</td>
                              <td className="px-4 py-1.5 hidden lg:table-cell">
                                 <Badge variant={instructor.venture === 'EFETIVO' ? 'blue' : instructor.venture === 'QOCON' ? 'purple' : instructor.venture === 'PRESTADOR_TAREFA' ? 'amber' : 'slate'}>
                                    {getVentureLabel(instructor.venture)}
                                 </Badge>
                              </td>
                              <td className="px-4 py-1.5 min-w-[120px]">
                                 <div className="flex flex-wrap gap-1">
                                    {(instructor.enabledDisciplines || []).length > 0 ? instructor.enabledDisciplines?.map(id => {
                                       const disc = disciplines.find(d => d.id === id || d.code === id);
                                       return disc ? <Badge key={id} variant="slate" title={disc.name}>{disc.code}</Badge> : null;
                                    }) : <span className="text-[10px] text-slate-400 italic">Nenhuma</span>}
                                 </div>
                              </td>
                              <td className="px-4 py-1.5 min-w-[100px]">
                                 <div className="flex flex-wrap gap-1">
                                    {(instructor.enabledClasses && instructor.enabledClasses.length === classes.length && classes.length > 0)
                                       ? <Badge variant="blue">Todas</Badge>
                                       : (instructor.enabledClasses || []).length > 0
                                          ? instructor.enabledClasses?.map(id => { const cls = classes.find(c => c.id === id); return cls ? <Badge key={id} variant="blue">{cls.year}{cls.name}</Badge> : null; })
                                          : <span className="text-[10px] text-slate-400 italic">Nenhuma</span>}
                                 </div>
                              </td>
                              <td className="px-4 py-1.5 text-sm text-center font-mono">{instructor.weeklyLoadLimit}h</td>
                              <td className="px-4 py-1.5 text-right">
                                 <div className="flex justify-end gap-1">
                                    <button onClick={() => { setSelectedInstructorForOccurrence(instructor.trigram); setIsOccurrenceModalOpen(true); }} className="p-1 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded" title="Ocorrência"><History size={14} /></button>
                                    {canEdit && (
                                       <>
                                          <button onClick={() => { setEditingInstructor(instructor); setSelectedDisciplines(instructor.enabledDisciplines || []); setSelectedClasses(instructor.enabledClasses || []); setIsInstructorModalOpen(true); }} className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="Editar"><Edit2 size={14} /></button>
                                          <button onClick={() => { if (confirm(`Excluir ${instructor.warName}?`)) deleteInstructor(instructor.trigram); }} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Excluir"><Trash2 size={14} /></button>
                                       </>
                                    )}
                                 </div>
                              </td>
                           </tr>
                        )) : (
                           <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Nenhum docente encontrado para os filtros selecionados.</td></tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {/* ─── INSTRUCTOR MODAL ─── */}
         {isInstructorModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
               <div className={`my-auto w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
                  <div className={`p-4 border-b flex justify-between items-center ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                     <h2 className="text-lg font-semibold">{editingInstructor ? 'Editar Docente' : 'Novo Docente'}</h2>
                     <button onClick={() => setIsInstructorModalOpen(false)} className="text-slate-400 hover:text-slate-200"><Plus size={24} className="rotate-45" /></button>
                  </div>
                  <form onSubmit={handleSaveInstructor} className="p-6">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                        <div className="space-y-4">
                           <h3 className="text-xs font-bold uppercase text-blue-500 tracking-widest border-b pb-1">Identificação</h3>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Trigrama *</label><input name="trigram" required maxLength={3} defaultValue={editingInstructor?.trigram} disabled={!!editingInstructor} className={inputCls + ' font-mono uppercase'} placeholder="SLV" /></div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Nome de Guerra *</label><input name="warName" required defaultValue={editingInstructor?.warName} className={inputCls} placeholder="Ex: Silva" /></div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Nome Completo</label><input name="fullName" defaultValue={editingInstructor?.fullName} className={inputCls} /></div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Posto / Cargo</label><input name="rank" defaultValue={editingInstructor?.rank} className={inputCls} placeholder="Cap, Prof, etc." /></div>
                        </div>
                        <div className="space-y-4">
                           <h3 className="text-xs font-bold uppercase text-blue-500 tracking-widest border-b pb-1">Perfil</h3>
                           <div className="grid grid-cols-2 gap-2">
                              <div><label className="block text-xs font-medium text-slate-500 mb-1">Vínculo</label><select name="venture" defaultValue={editingInstructor?.venture || 'EFETIVO'} className={selectCls}><option value="EFETIVO">Efetivo</option><option value="PRESTADOR_TAREFA">PTTC</option><option value="CIVIL">Civil</option><option value="QOCON">QOCon</option></select></div>
                              <div><label className="block text-xs font-medium text-slate-500 mb-1">Titulação</label><select name="maxTitle" defaultValue={editingInstructor?.maxTitle || 'GRADUADO'} className={selectCls}><option value="GRADUADO">Graduado</option><option value="ESPECIALISTA">Especialista</option><option value="MESTRE">Mestre</option><option value="DOUTOR">Doutor</option></select></div>
                           </div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Especialidade</label><input name="specialty" defaultValue={editingInstructor?.specialty} className={inputCls} /></div>
                           <div className="grid grid-cols-2 gap-2">
                              <div><label className="block text-xs font-medium text-slate-500 mb-1">CH Máx (Semanal)</label><input name="weeklyLoadLimit" type="number" required defaultValue={editingInstructor?.weeklyLoadLimit || 12} className={inputCls} /></div>
                              <div><label className="block text-xs font-medium text-slate-500 mb-1">CPF/SARAM</label><input name="cpf_saram" defaultValue={editingInstructor?.cpf_saram} className={inputCls} /></div>
                           </div>
                        </div>
                        <div className="space-y-4">
                           <h3 className="text-xs font-bold uppercase text-blue-500 tracking-widest border-b pb-1">Vinculação Multi-Nível</h3>
                           <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Matérias Habilitadas</label>
                              <div className="relative mb-2"><Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={13} /><input type="text" placeholder="Filtrar matérias..." value={disciplineSearch} onChange={e => setDisciplineSearch(e.target.value)} className={`w-full pl-7 pr-3 py-1 text-xs rounded border ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} /></div>
                              <div className={`h-24 overflow-y-auto border rounded p-2 space-y-1 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50'}`}>
                                 {disciplines.filter(d => (d.code?.toLowerCase() || "").includes(disciplineSearch.toLowerCase()) || (d.name?.toLowerCase() || "").includes(disciplineSearch.toLowerCase())).sort((a, b) => (a.code || "").localeCompare(b.code || "")).map(d => (
                                    <label key={d.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-blue-500/10 p-0.5 rounded">
                                       <input type="checkbox" checked={selectedDisciplines.includes(d.id)} onChange={e => setSelectedDisciplines(prev => e.target.checked ? [...prev, d.id] : prev.filter(id => id !== d.id))} className="rounded text-blue-600" />
                                       <span className="font-mono text-blue-500">{d.code}</span><span className="truncate">{d.name}</span>
                                    </label>
                                 ))}
                              </div>
                           </div>
                           <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Turmas Habilitadas</label>
                              <div className="relative mb-2"><Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={13} /><input type="text" placeholder="Filtrar turmas..." value={classSearch} onChange={e => setClassSearch(e.target.value)} className={`w-full pl-7 pr-3 py-1 text-xs rounded border ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} /></div>
                              <div className={`h-24 overflow-y-auto border rounded p-2 space-y-1 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50'}`}>
                                 <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-blue-500/10 p-0.5 rounded border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">
                                    <input type="checkbox" checked={selectedClasses.length === classes.length && classes.length > 0} onChange={e => setSelectedClasses(e.target.checked ? classes.map(c => c.id) : [])} className="rounded text-blue-600" />
                                    <span className="font-bold text-blue-600 dark:text-blue-400">Selecionar Todas</span>
                                 </label>
                                 {classes.filter(c => `${c.year} ${c.name} ${c.type}`.toLowerCase().includes(classSearch.toLowerCase())).sort((a, b) => a.year - b.year || a.name.localeCompare(b.name)).map(c => (
                                    <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-blue-500/10 p-0.5 rounded">
                                       <input type="checkbox" checked={selectedClasses.includes(c.id)} onChange={e => setSelectedClasses(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))} className="rounded text-blue-600" />
                                       <span>{c.year}º Ano - {c.name}</span><span className="text-slate-400 text-[10px] italic">({c.type})</span>
                                    </label>
                                 ))}
                              </div>
                           </div>
                        </div>
                        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">E-mail</label><input name="email" type="email" defaultValue={editingInstructor?.email} className={inputCls} /></div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Telefone/WhatsApp</label><input name="phone" defaultValue={editingInstructor?.phone} className={inputCls} /></div>
                        </div>
                     </div>
                     <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <button type="button" onClick={() => setIsInstructorModalOpen(false)} className={`px-4 py-2 rounded text-sm ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>Cancelar</button>
                        <button type="submit" className="px-8 py-2 bg-blue-600 text-white rounded font-semibold shadow-lg hover:bg-blue-700 active:scale-95 transition-all">{editingInstructor ? 'Salvar Alterações' : 'Confirmar Cadastro'}</button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         {/* ─── OCCURRENCE MODAL ─── */}
         {isOccurrenceModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
               <div className={`w-full max-w-md rounded-xl shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
                  <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'bg-amber-900/10 border-slate-700' : 'bg-amber-50 border-amber-100'}`}>
                     <div className="flex items-center gap-3"><History className="text-amber-500" /><h2 className="font-semibold">Nova Ocorrência</h2></div>
                     <button onClick={() => setIsOccurrenceModalOpen(false)} className="text-slate-400 hover:text-slate-600"><Plus size={24} className="rotate-45" /></button>
                  </div>
                  <form onSubmit={handleSaveOccurrence} className="p-6">
                     <p className="text-xs text-slate-500 mb-4">Docente: <span className="font-bold text-blue-500">{selectedInstructorForOccurrence}</span></p>
                     <div className="space-y-4">
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Data</label><input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={inputCls} /></div>
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label><select name="type" required className={selectCls}><option value="FALTA">Falta</option><option value="ATRASO">Atraso</option><option value="INDISPONIBILIDADE">Indisponibilidade</option></select></div>
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Motivo / Observação</label><textarea name="reason" required rows={3} className={inputCls} placeholder="Breve descrição da causa..." /></div>
                     </div>
                     <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={() => setIsOccurrenceModalOpen(false)} className={`px-4 py-2 rounded text-sm ${theme === 'dark' ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}>Sair</button>
                        <button type="submit" className="px-6 py-2 bg-amber-600 text-white rounded font-semibold shadow-md hover:bg-amber-700">Gravar</button>
                     </div>
                  </form>
               </div>
            </div>
         )}
      </div>
   );
};
