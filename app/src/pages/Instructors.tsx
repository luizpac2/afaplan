import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Trash2, Edit2, History, PenLine, Save, Undo2, ChevronUp, CheckCircle2, AlertCircle, Zap, Link2 } from 'lucide-react';
import { useCourseStore } from '../store/useCourseStore';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import type { Instructor, InstructorOccurrence, InstructorVenture, AcademicTitle } from '../types';
import { Badge } from '../components/common/Badge';
import { supabase } from '../config/supabase';

type BulkInstructorEdits = Record<string, Partial<Pick<Instructor, 'venture' | 'maxTitle' | 'weeklyLoadLimit' | 'specialty' | 'rank'>>>;

export const Instructors = () => {
   const pageHeaderRef  = useRef<HTMLDivElement>(null);
   const toolbarRef     = useRef<HTMLDivElement>(null);
   const bulkHeaderRef  = useRef<HTMLDivElement>(null);
   const bulkActionsRef = useRef<HTMLDivElement>(null);
   const [pageHeaderH, setPageHeaderH]   = useState(64);
   const [toolbarH, setToolbarH]         = useState(96);
   const [bulkHeaderH, setBulkHeaderH]   = useState(64);
   const [bulkActionsH, setBulkActionsH] = useState(100);

   const { instructors, addInstructor, updateInstructor, renameTrigram, deleteInstructor, addOccurrence, disciplines, classes } = useCourseStore();
   const { theme } = useTheme();
   const { userProfile } = useAuth();
   const isDark = theme === 'dark';

   const [searchTerm, setSearchTerm]         = useState('');
   const [debouncedSearch, setDebouncedSearch] = useState('');
   useEffect(() => { const t = setTimeout(() => setDebouncedSearch(searchTerm), 300); return () => clearTimeout(t); }, [searchTerm]);

   const [ventureFilter, setVentureFilter] = useState<InstructorVenture | 'ALL'>('ALL');
   const [titleFilter, setTitleFilter]     = useState<AcademicTitle | 'ALL'>('ALL');
   const [isInstructorModalOpen, setIsInstructorModalOpen]     = useState(false);
   const [isOccurrenceModalOpen, setIsOccurrenceModalOpen]     = useState(false);
   const [editingInstructor, setEditingInstructor]             = useState<Instructor | null>(null);
   const [selectedInstructorForOccurrence, setSelectedInstructorForOccurrence] = useState<string | null>(null);
   const [disciplineSearch, setDisciplineSearch] = useState('');
   const [classSearch, setClassSearch]           = useState('');
   const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
   const [selectedClasses, setSelectedClasses]         = useState<string[]>([]);

   const [bulkEditOpen, setBulkEditOpen] = useState(false);
   const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
   const [bulkEdits, setBulkEdits]       = useState<BulkInstructorEdits>({});
   const [isSaving, setIsSaving]         = useState(false);
   const [saveResult, setSaveResult]     = useState<{ success: number; total: number } | null>(null);

   const canEdit = useMemo(() => ['SUPER_ADMIN', 'ADMIN'].includes(userProfile?.role || ''), [userProfile]);

   // Set of emails that have a linked auth user (DOCENTE role)
   const [linkedEmails, setLinkedEmails] = useState<Set<string>>(new Set());
   useEffect(() => {
      if (!canEdit) return;
      supabase.functions.invoke('admin-list-users').then(({ data }) => {
         if (!data?.users) return;
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const emails = new Set<string>((data.users as any[])
            .filter((u: any) => u.role === 'DOCENTE' || u.role === 'docente')
            .map((u: any) => (u.email ?? '').toLowerCase())
            .filter(Boolean));
         setLinkedEmails(emails);
      });
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [canEdit]);

   useEffect(() => {
      const obs = new ResizeObserver(entries => {
         for (const e of entries) {
            const h = Math.ceil(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height);
            if (e.target === pageHeaderRef.current)  setPageHeaderH(h);
            if (e.target === toolbarRef.current)     setToolbarH(h);
            if (e.target === bulkHeaderRef.current)  setBulkHeaderH(h);
            if (e.target === bulkActionsRef.current) setBulkActionsH(h);
         }
      });
      [pageHeaderRef, toolbarRef, bulkHeaderRef, bulkActionsRef].forEach(r => { if (r.current) obs.observe(r.current); });
      return () => obs.disconnect();
   }, [bulkEditOpen]);

   const filteredInstructors = useMemo(() => {
      return [...instructors].sort((a, b) => a.warName.localeCompare(b.warName)).filter(i => {
         if (debouncedSearch.startsWith('!')) {
            const t = debouncedSearch.substring(1).toLowerCase();
            if (t === 'disciplina') return !disciplines.some(d => d.instructorTrigram === i.trigram || d.substituteTrigram === i.trigram);
            if (t === 'turma')      return !i.enabledClasses?.length;
            if (t === 'email')      return !i.email?.trim();
            return false;
         }
         const q = debouncedSearch.toLowerCase();
         return (!q || i.fullName?.toLowerCase().includes(q) || i.warName?.toLowerCase().includes(q) || i.trigram?.toLowerCase().includes(q) || i.specialty?.toLowerCase().includes(q) || i.rank?.toLowerCase().includes(q)) &&
            (ventureFilter === 'ALL' || i.venture === ventureFilter) &&
            (titleFilter   === 'ALL' || i.maxTitle === titleFilter);
      });
   }, [instructors, debouncedSearch, ventureFilter, titleFilter]);

   const getVentureLabel = (v: InstructorVenture) => ({ EFETIVO: 'Efetivo', PRESTADOR_TAREFA: 'PTTC', CIVIL: 'Civil', QOCON: 'QOCon' })[v];

   const changedCount = Object.keys(bulkEdits).length;

   const setBulkField = useCallback((id: string, field: keyof Pick<Instructor, 'venture' | 'maxTitle' | 'weeklyLoadLimit' | 'specialty' | 'rank'>, value: string | number) => {
      const original = instructors.find(i => i.trigram === id);
      if (!original) return;
      setBulkEdits(prev => {
         const current = { ...prev };
         const edits = { ...(current[id] || {}) };
         const origVal = original[field];
         if (String(origVal ?? '') === String(value)) { delete edits[field as keyof typeof edits]; }
         else { (edits as Partial<Pick<Instructor, 'venture' | 'maxTitle' | 'weeklyLoadLimit' | 'specialty' | 'rank'>>)[field] = value as never; }
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
      setIsSaving(true); setSaveResult(null);
      try {
         await Promise.all(Object.entries(bulkEdits).map(([trigram, updates]) => {
            const original = instructors.find(i => i.trigram === trigram);
            if (!original) return Promise.resolve();
            return updateInstructor(trigram, { ...original, ...updates });
         }));
         setSaveResult({ success: changedCount, total: changedCount }); setBulkEdits({});
      } catch { setSaveResult({ success: 0, total: changedCount }); }
      finally { setIsSaving(false); setTimeout(() => setSaveResult(null), 4000); }
   };

   const handleBulkDelete = async () => {
      const targets = Array.from(selectedIds);
      if (!targets.length) { alert('Selecione pelo menos um docente.'); return; }
      if (!confirm(`Excluir ${targets.length} docente(s)?`)) return;
      for (const trigram of targets) await deleteInstructor(trigram);
      setSelectedIds(new Set());
   };

   const handleSelectAll = (checked: boolean) => setSelectedIds(checked ? new Set(filteredInstructors.map(i => i.trigram)) : new Set());
   const handleSelectOne = (id: string, checked: boolean) => { const s = new Set(selectedIds); if (checked) { s.add(id); } else { s.delete(id); } setSelectedIds(s); };

   const handleSaveInstructor = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const newTrigram = (fd.get('trigram') as string || '').toUpperCase().slice(0, 3);
      const data: Instructor = {
         trigram: newTrigram,
         fullName: fd.get('fullName') as string || '', warName: fd.get('warName') as string || '',
         rank: fd.get('rank') as string || '', cpf_saram: fd.get('cpf_saram') as string || '',
         email: fd.get('email') as string || '', phone: fd.get('phone') as string || '',
         venture: fd.get('venture') as InstructorVenture, maxTitle: fd.get('maxTitle') as AcademicTitle,
         specialty: fd.get('specialty') as string || '',
         weeklyLoadLimit: editingInstructor?.weeklyLoadLimit || 0,
         fixedBlocks: [], plannedAbsences: editingInstructor?.plannedAbsences || [],
         preferences: fd.get('preferences') as string,
         enabledDisciplines: selectedDisciplines, enabledClasses: selectedClasses,
      };
      if (editingInstructor) {
         const oldTrigram = editingInstructor.trigram;
         if (newTrigram !== oldTrigram) {
            if (instructors.some(i => i.trigram === newTrigram)) { alert('Trigrama já em uso!'); return; }
            try {
               await renameTrigram(oldTrigram, newTrigram);
            } catch { alert('Erro ao renomear trigrama. Tente novamente.'); return; }
         }
         updateInstructor(newTrigram, data);
      } else {
         if (instructors.some(i => i.trigram === newTrigram)) { alert('Trigrama já em uso!'); return; }
         addInstructor(data);
      }
      setIsInstructorModalOpen(false); setEditingInstructor(null);
   };

   const handleSaveOccurrence = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      addOccurrence({
         id: crypto.randomUUID(), instructorTrigram: selectedInstructorForOccurrence!,
         date: fd.get('date') as string, type: fd.get('type') as InstructorOccurrence['type'],
         reason: fd.get('reason') as string,
         disciplineId: fd.get('disciplineId') as string || undefined,
      });
      setIsOccurrenceModalOpen(false); setSelectedInstructorForOccurrence(null);
   };

   const inputCls  = `w-full px-3 py-1.5 rounded border focus:ring-1 focus:ring-blue-500 text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200'}`;
   const selectCls = `w-full px-2 py-1.5 rounded border text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200'}`;

   const toolbarTop       = pageHeaderH;
   const regularHeadTop   = pageHeaderH + toolbarH;
   const bulkActionsTop   = pageHeaderH + bulkHeaderH;
   const bulkTableHeadTop = pageHeaderH + bulkHeaderH + bulkActionsH;

   return (
      <div className={`w-full min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-slate-900'}`}>

         {/* ─── PAGE HEADER ─── */}
         <div ref={pageHeaderRef} className={`sticky top-0 z-50 px-4 md:px-6 py-3 border-b flex items-center justify-between gap-4 backdrop-blur-md ${isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
            <div className="flex items-baseline gap-3">
               <h1 className="text-xl font-bold tracking-tight">Docentes</h1>
               <p className={`hidden sm:block text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Gestão de instrutores, especialidades e turmas.</p>
            </div>
            {canEdit && (
               <div className="flex items-center gap-2">
                  <button onClick={() => { setBulkEditOpen(!bulkEditOpen); setSaveResult(null); }}
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm border ${bulkEditOpen ? (isDark ? 'bg-amber-900/30 text-amber-400 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200') : (isDark ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-white text-slate-700 border-slate-200 shadow-sm')}`}>
                     <PenLine size={14} /> Edição em Massa
                     {changedCount > 0 && <span className="bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{changedCount}</span>}
                  </button>
                  <button onClick={() => { setEditingInstructor(null); setSelectedDisciplines([]); setSelectedClasses([]); setIsInstructorModalOpen(true); }}
                     className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm text-sm font-medium">
                     <Plus size={16} /> Novo
                  </button>
               </div>
            )}
         </div>

         {/* ─── BULK EDIT MODE ─── */}
         {canEdit && bulkEditOpen && (
            <div>
               <div ref={bulkHeaderRef} className={`sticky z-40 px-4 md:px-6 py-3 border-b flex items-center justify-between backdrop-blur-md ${isDark ? 'bg-slate-950/95 border-amber-900/60' : 'bg-amber-50/95 border-amber-200/60'}`} style={{ top: pageHeaderH }}>
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-sm"><PenLine size={16} className="text-white" /></div>
                     <div>
                        <h2 className={`text-sm font-semibold ${isDark ? 'text-amber-100' : 'text-slate-800'}`}>Edição em Massa</h2>
                        <p className={`text-xs ${isDark ? 'text-amber-200/70' : 'text-slate-500'}`}>Alterações pendentes até salvar.</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <button onClick={handleBulkDelete} disabled={selectedIds.size === 0 || isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50">
                        <Trash2 size={13} /> Excluir Selecionados
                     </button>
                     {changedCount > 0 && (
                        <>
                           <span className="text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-3 py-1 rounded-full">{changedCount} alterado{changedCount !== 1 ? 's' : ''}</span>
                           <button onClick={discardEdits} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg ${isDark ? 'text-slate-300 bg-slate-800 border-slate-700' : 'text-slate-600 bg-white border-slate-200'}`}><Undo2 size={13} /> Descartar</button>
                           <button onClick={saveBulkEdits} disabled={isSaving} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"><Save size={13} /> {isSaving ? 'Salvando...' : 'Salvar Tudo'}</button>
                        </>
                     )}
                     <button onClick={() => setBulkEditOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg ml-1"><ChevronUp size={18} /></button>
                  </div>
               </div>

               {saveResult && (
                  <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium ${saveResult.success === saveResult.total ? 'bg-green-100 dark:bg-green-900/30 text-green-800' : 'bg-red-100 text-red-800'}`}>
                     {saveResult.success === saveResult.total ? <><CheckCircle2 size={16} /> {saveResult.success} atualizados!</> : <><AlertCircle size={16} /> {saveResult.success}/{saveResult.total} salvos.</>}
                  </div>
               )}

               <div ref={bulkActionsRef} className={`sticky z-30 px-4 md:px-6 py-3 border-b backdrop-blur-sm ${isDark ? 'bg-slate-950/95 border-amber-900/50' : 'bg-amber-50/95 border-amber-100/50'}`} style={{ top: bulkActionsTop }}>
                  <div className="text-[10px] text-amber-700 dark:text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2 font-bold">
                     <PenLine size={12} /> Ações Inteligentes {selectedIds.size > 0 ? `(${selectedIds.size} selecionados)` : `(${filteredInstructors.length} filtrados)`}
                  </div>
                  <div className="flex flex-nowrap overflow-x-auto pb-1 gap-6 items-center">
                     {[
                        { id: 'sv', label: 'Definir Vínculo', opts: [['EFETIVO','Efetivo'],['PRESTADOR_TAREFA','PTTC'],['CIVIL','Civil'],['QOCON','QOCon']], field: 'venture' },
                        { id: 'st', label: 'Definir Titulação', opts: [['GRADUADO','Graduado'],['ESPECIALISTA','Especialista'],['MESTRE','Mestre'],['DOUTOR','Doutor']], field: 'maxTitle' },
                     ].map(({ id, label, opts, field }) => (
                        <div key={id} className="flex-none w-[200px]">
                           <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1.5 uppercase tracking-wider">{label}:</label>
                           <div className="flex gap-1">
                              <select id={id} className={`w-full px-2 py-1.5 text-xs border rounded-lg outline-none ${isDark ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white border-slate-200'}`}>
                                 {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                              <button onClick={() => { const val = (document.getElementById(id) as HTMLSelectElement).value; const targets = selectedIds.size > 0 ? Array.from(selectedIds) : filteredInstructors.map(i => i.trigram); targets.forEach(t => setBulkField(t, field as keyof Pick<Instructor, 'venture' | 'maxTitle' | 'weeklyLoadLimit' | 'specialty' | 'rank'>, val)); }}
                                 className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-xs font-bold shadow-sm">Aplicar</button>
                           </div>
                        </div>
                     ))}
                     <div className="flex-none w-[160px]">
                        <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1.5 uppercase tracking-wider">Definir CH Semanal:</label>
                        <div className="flex gap-1">
                           <input id="smart-ch" type="number" min="0" max="40" placeholder="h/sem" className={`w-full px-2 py-1.5 text-xs border rounded-lg outline-none ${isDark ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white border-slate-200'}`} />
                           <button onClick={() => { const val = parseInt((document.getElementById('smart-ch') as HTMLInputElement).value) || 0; const targets = selectedIds.size > 0 ? Array.from(selectedIds) : filteredInstructors.map(i => i.trigram); targets.forEach(t => setBulkField(t, 'weeklyLoadLimit', val)); (document.getElementById('smart-ch') as HTMLInputElement).value = ''; }}
                              className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-xs font-bold shadow-sm">Ok</button>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="w-full relative">
                  <table className="w-full text-sm">
                     <thead>
                        <tr className={`text-[10px] uppercase tracking-wider border-b ${isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-gray-50 text-slate-500 border-slate-100'}`}>
                           <th className={`sticky z-30 text-center py-2 px-3 w-10 ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}>
                              <input type="checkbox" className="rounded text-amber-600" onChange={e => handleSelectAll(e.target.checked)} checked={selectedIds.size === filteredInstructors.length && filteredInstructors.length > 0} />
                           </th>
                           {['Tri', 'Guerra', 'Posto', 'Vínculo', 'Titulação', 'CH (h/sem)', 'Especialidade'].map(h => (
                              <th key={h} className={`sticky z-30 text-left py-2 px-3 ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: bulkTableHeadTop }}>{h}</th>
                           ))}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-amber-100/60 dark:divide-amber-900/30">
                        {filteredInstructors.map(inst => {
                           const isSel = selectedIds.has(inst.trigram);
                           const hasChanges = !!bulkEdits[inst.trigram];
                           const cellCls = (f: string) => `w-full px-2 py-1 text-sm border rounded transition-colors ${isFieldChanged(inst.trigram, f) ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/40 ring-1 ring-amber-200' : (isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'border-slate-200 bg-white')}`;
                           return (
                              <tr key={inst.trigram} className={`transition-colors ${isSel ? (isDark ? 'bg-amber-900/20' : 'bg-amber-50') : hasChanges ? (isDark ? 'bg-amber-900/10' : 'bg-amber-100/30') : (isDark ? 'hover:bg-slate-800/30' : 'hover:bg-white/50')}`}>
                                 <td className="px-3 py-1.5 text-center"><input type="checkbox" className="rounded text-amber-600" checked={isSel} onChange={e => handleSelectOne(inst.trigram, e.target.checked)} /></td>
                                 <td className="px-3 py-1.5 font-mono text-blue-500 text-xs">{inst.trigram}</td>
                                 <td className="px-3 py-1.5 text-xs font-medium">{inst.warName}</td>
                                 <td className="px-2 py-1"><input type="text" value={getCurrentValue(inst,'rank') as string} onChange={e => setBulkField(inst.trigram,'rank',e.target.value)} className={cellCls('rank')} /></td>
                                 <td className="px-2 py-1"><select value={getCurrentValue(inst,'venture') as string} onChange={e => setBulkField(inst.trigram,'venture',e.target.value)} className={cellCls('venture')}><option value="EFETIVO">Efetivo</option><option value="PRESTADOR_TAREFA">PTTC</option><option value="CIVIL">Civil</option><option value="QOCON">QOCon</option></select></td>
                                 <td className="px-2 py-1"><select value={getCurrentValue(inst,'maxTitle') as string} onChange={e => setBulkField(inst.trigram,'maxTitle',e.target.value)} className={cellCls('maxTitle')}><option value="GRADUADO">Graduado</option><option value="ESPECIALISTA">Especialista</option><option value="MESTRE">Mestre</option><option value="DOUTOR">Doutor</option></select></td>
                                 <td className="px-2 py-1 w-24"><input type="number" min={0} value={getCurrentValue(inst,'weeklyLoadLimit') as number} onChange={e => setBulkField(inst.trigram,'weeklyLoadLimit',parseInt(e.target.value)||0)} className={cellCls('weeklyLoadLimit')} /></td>
                                 <td className="px-2 py-1"><input type="text" value={getCurrentValue(inst,'specialty') as string} onChange={e => setBulkField(inst.trigram,'specialty',e.target.value)} className={cellCls('specialty')} /></td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>

               {changedCount > 0 && (
                  <div className={`sticky bottom-0 px-5 py-3 backdrop-blur-sm border-t flex items-center justify-between ${isDark ? 'bg-amber-900/90 border-amber-800' : 'bg-amber-100/90 border-amber-200'}`}>
                     <span className={`text-sm font-medium ${isDark ? 'text-amber-100' : 'text-amber-800'}`}>⚠️ {changedCount} alteração{changedCount !== 1 ? 'ões' : ''} pendente{changedCount !== 1 ? 's' : ''}.</span>
                     <div className="flex gap-2">
                        <button onClick={discardEdits} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg ${isDark ? 'text-slate-300 bg-slate-800 border-slate-700' : 'text-slate-600 bg-white border-slate-200'}`}><Undo2 size={13} /> Descartar</button>
                        <button onClick={saveBulkEdits} disabled={isSaving} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"><Save size={13} /> {isSaving ? 'Salvando...' : 'Salvar Tudo'}</button>
                     </div>
                  </div>
               )}
            </div>
         )}

         {/* ─── NORMAL MODE ─── */}
         {!bulkEditOpen && (
            <div className="w-full flex flex-col">
               <div ref={toolbarRef} className={`sticky z-40 px-4 md:px-6 py-3 border-b space-y-2 shadow-md backdrop-blur-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`} style={{ top: toolbarTop }}>
                  <div className="flex flex-row gap-3 items-center">
                     <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="text" placeholder="Buscar docente por nome, trigrama, especialidade..."
                           value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                           className={`w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-200 placeholder-slate-400'}`} />
                     </div>
                     <select value={ventureFilter} onChange={e => setVentureFilter(e.target.value as InstructorVenture | 'ALL')} className={`px-3 py-2 rounded-lg border text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'}`}>
                        <option value="ALL">Vínculo: Todos</option><option value="EFETIVO">Efetivo</option><option value="PRESTADOR_TAREFA">PTTC</option><option value="CIVIL">Civil</option><option value="QOCON">QOCon</option>
                     </select>
                     <select value={titleFilter} onChange={e => setTitleFilter(e.target.value as AcademicTitle | 'ALL')} className={`px-3 py-2 rounded-lg border text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'}`}>
                        <option value="ALL">Titulação: Todas</option><option value="GRADUADO">Graduado</option><option value="ESPECIALISTA">Especialista</option><option value="MESTRE">Mestre</option><option value="DOUTOR">Doutor</option>
                     </select>
                  </div>
                  <div className="flex items-center gap-3 pt-1 border-t border-gray-100 dark:border-slate-700 overflow-x-auto whitespace-nowrap h-8">
                     <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mr-1"><Zap size={12} className="text-amber-500" /> Filtros Rápidos:</div>
                     {[{label:'Sem Disciplina',cmd:'!disciplina'},{label:'Sem Turma',cmd:'!turma'},{label:'Sem E-mail',cmd:'!email'}].map(({label,cmd}) => (
                        <button key={cmd} onClick={() => setSearchTerm(searchTerm === cmd ? '' : cmd)}
                           className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${searchTerm === cmd ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:bg-amber-50/30')}`}>
                           {label}
                        </button>
                     ))}
                     {searchTerm.startsWith('!') && <button onClick={() => setSearchTerm('')} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><Undo2 size={13} /> Limpar</button>}
                  </div>
               </div>

               <div className={`rounded-none w-full relative ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className={`text-xs uppercase tracking-wider border-b ${isDark ? 'bg-slate-900/50 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                           {['Tri', 'Guerra', 'Vínculo', 'Disciplinas', 'Turmas', 'E-mail', 'Ações'].map((h, i) => (
                              <th key={h} className={`sticky z-30 px-4 py-3 font-medium ${i===6?'text-right':'text-left'} ${isDark?'bg-slate-900/50':'bg-slate-50'}`} style={{ top: regularHeadTop }}>{h}</th>
                           ))}
                        </tr>
                     </thead>
                     <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-100'}`}>
                        {filteredInstructors.length > 0 ? filteredInstructors.map(instructor => (
                           <tr key={instructor.trigram} className="hover:bg-blue-500/5 transition-colors group">
                              <td className="px-4 py-1.5 text-sm font-mono font-bold text-blue-500">{instructor.trigram}</td>
                              <td className="px-4 py-1.5 text-sm font-medium">
                                 <div className="flex items-center gap-1.5">
                                    {instructor.warName}
                                    {instructor.email && linkedEmails.has(instructor.email.toLowerCase()) && (
                                       <span title={`Vinculado ao usuário ${instructor.email}`} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                          <Link2 size={8} /> USER
                                       </span>
                                    )}
                                 </div>
                              </td>
                              <td className="px-4 py-1.5 hidden lg:table-cell">
                                 <Badge variant={instructor.venture === 'EFETIVO' ? 'blue' : instructor.venture === 'QOCON' ? 'purple' : instructor.venture === 'PRESTADOR_TAREFA' ? 'amber' : 'slate'}>
                                    {getVentureLabel(instructor.venture)}
                                 </Badge>
                              </td>
                              <td className="px-4 py-1.5 min-w-[120px]">
                                 <div className="flex flex-wrap gap-1">
                                    {(() => { const assigned = disciplines.filter(d => d.instructorTrigram === instructor.trigram || d.substituteTrigram === instructor.trigram); return assigned.length > 0 ? assigned.map(d => <Badge key={d.id} variant="slate" title={d.name}>{d.code}</Badge>) : <span className="text-[10px] text-slate-400 italic">Nenhuma</span>; })()}
                                 </div>
                              </td>
                              <td className="px-4 py-1.5 min-w-[100px]">
                                 <div className="flex flex-wrap gap-1">
                                    {instructor.enabledClasses?.length === classes.length && classes.length > 0 ? <Badge variant="blue">Todas</Badge> : (instructor.enabledClasses || []).length > 0 ? instructor.enabledClasses?.map(id => { const cls = classes.find(c => c.id === id); return cls ? <Badge key={id} variant="blue">{cls.year}{cls.name}</Badge> : null; }) : <span className="text-[10px] text-slate-400 italic">Nenhuma</span>}
                                 </div>
                              </td>
                              <td className="px-4 py-1.5 text-xs text-slate-500">{instructor.email || <span className="italic opacity-50">—</span>}</td>
                              <td className="px-4 py-1.5 text-right">
                                 <div className="flex justify-end gap-1">
                                    <button onClick={() => { setSelectedInstructorForOccurrence(instructor.trigram); setIsOccurrenceModalOpen(true); }} className="p-1 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded" title="Ocorrência"><History size={14} /></button>
                                    {canEdit && (
                                       <>
                                          <button onClick={() => { setEditingInstructor(instructor); setSelectedDisciplines([...new Set([...disciplines.filter(d => d.instructorTrigram === instructor.trigram || d.substituteTrigram === instructor.trigram).map(d => d.id), ...(instructor.enabledDisciplines || [])])]); setSelectedClasses(instructor.enabledClasses || []); setIsInstructorModalOpen(true); }} className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"><Edit2 size={14} /></button>
                                          <button onClick={() => { if (confirm(`Excluir ${instructor.warName}?`)) deleteInstructor(instructor.trigram); }} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={14} /></button>
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
               <div className={`my-auto w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                  <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                     <h2 className="text-lg font-semibold">{editingInstructor ? 'Editar Docente' : 'Novo Docente'}</h2>
                     <button onClick={() => setIsInstructorModalOpen(false)} className="text-slate-400 hover:text-slate-600"><Plus size={24} className="rotate-45" /></button>
                  </div>
                  <form onSubmit={handleSaveInstructor} className="p-6">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                        <div className="space-y-4">
                           <h3 className="text-xs font-bold uppercase text-blue-500 tracking-widest border-b pb-1">Identificação</h3>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Trigrama *</label><input name="trigram" required maxLength={3} defaultValue={editingInstructor?.trigram} className={inputCls + ' font-mono uppercase'} placeholder="SLV" /></div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Nome de Guerra *</label><input name="warName" required defaultValue={editingInstructor?.warName} className={inputCls} /></div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Nome Completo</label><input name="fullName" defaultValue={editingInstructor?.fullName} className={inputCls} /></div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Posto / Cargo</label><input name="rank" defaultValue={editingInstructor?.rank} className={inputCls} /></div>
                        </div>
                        <div className="space-y-4">
                           <h3 className="text-xs font-bold uppercase text-blue-500 tracking-widest border-b pb-1">Perfil</h3>
                           <div className="grid grid-cols-2 gap-2">
                              <div><label className="block text-xs font-medium text-slate-500 mb-1">Vínculo</label><select name="venture" defaultValue={editingInstructor?.venture || 'EFETIVO'} className={selectCls}><option value="EFETIVO">Efetivo</option><option value="PRESTADOR_TAREFA">PTTC</option><option value="CIVIL">Civil</option><option value="QOCON">QOCon</option></select></div>
                              <div><label className="block text-xs font-medium text-slate-500 mb-1">Titulação</label><select name="maxTitle" defaultValue={editingInstructor?.maxTitle || 'GRADUADO'} className={selectCls}><option value="GRADUADO">Graduado</option><option value="ESPECIALISTA">Especialista</option><option value="MESTRE">Mestre</option><option value="DOUTOR">Doutor</option></select></div>
                           </div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Especialidade</label><input name="specialty" defaultValue={editingInstructor?.specialty} className={inputCls} /></div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">CPF/SARAM</label><input name="cpf_saram" defaultValue={editingInstructor?.cpf_saram} className={inputCls} /></div>
                        </div>
                        <div className="space-y-4">
                           <h3 className="text-xs font-bold uppercase text-blue-500 tracking-widest border-b pb-1">Vinculação Multi-Nível</h3>
                           <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Matérias Habilitadas</label>
                              <div className="relative mb-2"><Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={13} /><input type="text" placeholder="Filtrar matérias..." value={disciplineSearch} onChange={e => setDisciplineSearch(e.target.value)} className={`w-full pl-7 pr-3 py-1 text-xs rounded border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} /></div>
                              <div className={`h-24 overflow-y-auto border rounded p-2 space-y-1 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50'}`}>
                                 {disciplines.filter(d => (d.code?.toLowerCase() || '').includes(disciplineSearch.toLowerCase()) || d.name.toLowerCase().includes(disciplineSearch.toLowerCase())).sort((a, b) => (a.code || '').localeCompare(b.code || '')).map(d => (
                                    <label key={d.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-blue-500/10 p-0.5 rounded">
                                       <input type="checkbox" checked={selectedDisciplines.includes(d.id)} onChange={e => setSelectedDisciplines(p => e.target.checked ? [...p, d.id] : p.filter(id => id !== d.id))} className="rounded text-blue-600" />
                                       <span className="font-mono text-blue-500">{d.code}</span><span className="truncate">{d.name}</span>
                                    </label>
                                 ))}
                              </div>
                           </div>
                           <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Turmas Habilitadas</label>
                              <div className="relative mb-2"><Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={13} /><input type="text" placeholder="Filtrar turmas..." value={classSearch} onChange={e => setClassSearch(e.target.value)} className={`w-full pl-7 pr-3 py-1 text-xs rounded border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} /></div>
                              <div className={`h-24 overflow-y-auto border rounded p-2 space-y-1 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50'}`}>
                                 <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-blue-500/10 p-0.5 rounded border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">
                                    <input type="checkbox" checked={selectedClasses.length === classes.length && classes.length > 0} onChange={e => setSelectedClasses(e.target.checked ? classes.map(c => c.id) : [])} className="rounded text-blue-600" />
                                    <span className="font-bold text-blue-600 dark:text-blue-400">Selecionar Todas</span>
                                 </label>
                                 {classes.filter(c => `${c.year} ${c.name} ${c.type}`.toLowerCase().includes(classSearch.toLowerCase())).sort((a, b) => a.year - b.year || a.name.localeCompare(b.name)).map(c => (
                                    <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-blue-500/10 p-0.5 rounded">
                                       <input type="checkbox" checked={selectedClasses.includes(c.id)} onChange={e => setSelectedClasses(p => e.target.checked ? [...p, c.id] : p.filter(id => id !== c.id))} className="rounded text-blue-600" />
                                       <span>{c.year}º Ano - {c.name}</span><span className="text-slate-400 text-[10px] italic">({c.type})</span>
                                    </label>
                                 ))}
                              </div>
                           </div>
                        </div>
                        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                           <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">
                                 E-mail
                                 <span className="ml-1 font-normal text-blue-400">(chave de vínculo com usuário)</span>
                              </label>
                              <input name="email" type="email" defaultValue={editingInstructor?.email} className={inputCls} />
                              {editingInstructor?.email && linkedEmails.has(editingInstructor.email.toLowerCase()) && (
                                 <p className="mt-1 text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1">
                                    <Link2 size={10} /> Vinculado ao usuário {editingInstructor.email}
                                 </p>
                              )}
                              {editingInstructor?.email && !linkedEmails.has(editingInstructor.email.toLowerCase()) && (
                                 <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
                                    Nenhum usuário DOCENTE com este e-mail encontrado
                                 </p>
                              )}
                           </div>
                           <div><label className="block text-xs font-medium text-slate-500 mb-1">Telefone/WhatsApp</label><input name="phone" defaultValue={editingInstructor?.phone} className={inputCls} /></div>
                        </div>
                     </div>
                     <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <button type="button" onClick={() => setIsInstructorModalOpen(false)} className={`px-4 py-2 rounded text-sm ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>Cancelar</button>
                        <button type="submit" className="px-8 py-2 bg-blue-600 text-white rounded font-semibold shadow-lg hover:bg-blue-700 active:scale-95">{editingInstructor ? 'Salvar Alterações' : 'Confirmar Cadastro'}</button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         {/* ─── OCCURRENCE MODAL ─── */}
         {isOccurrenceModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
               <div className={`w-full max-w-md rounded-xl shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
                  <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'bg-amber-900/10 border-slate-700' : 'bg-amber-50 border-amber-100'}`}>
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
                        <button type="button" onClick={() => setIsOccurrenceModalOpen(false)} className={`px-4 py-2 rounded text-sm ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}>Sair</button>
                        <button type="submit" className="px-6 py-2 bg-amber-600 text-white rounded font-semibold shadow-md hover:bg-amber-700">Gravar</button>
                     </div>
                  </form>
               </div>
            </div>
         )}
      </div>
   );
};
