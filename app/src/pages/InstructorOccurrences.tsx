import { useMemo, useState } from 'react';
import { History, Search, Calendar, AlertTriangle, Filter, Trash2 } from 'lucide-react';
import { useCourseStore } from '../store/useCourseStore';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { formatOccurrenceType } from '../utils/formatters';
import type { InstructorOccurrence } from '../types';
import { Badge } from '../components/common/Badge';
import type { BadgeVariant } from '../components/common/Badge';

export const InstructorOccurrences = () => {
   const { occurrences, instructors, deleteOccurrence, disciplines } = useCourseStore();
   const { theme } = useTheme();
   const { userProfile } = useAuth();

   const [searchTerm, setSearchTerm] = useState('');
   const [typeFilter, setTypeFilter] = useState<InstructorOccurrence['type'] | 'ALL'>('ALL');

   const canEdit = useMemo(() => {
      return ['SUPER_ADMIN', 'ADMIN'].includes(userProfile?.role || '');
   }, [userProfile]);

   const filteredOccurrences = useMemo(() => {
      return [...occurrences]
         .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
         .filter(o => {
            const instructor = instructors.find(i => i.trigram === o.instructorTrigram);
            const matchesSearch =
               o.instructorTrigram.toLowerCase().includes(searchTerm.toLowerCase()) ||
               instructor?.warName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               o.reason.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesType = typeFilter === 'ALL' || o.type === typeFilter;

            return matchesSearch && matchesType;
         });
   }, [occurrences, instructors, searchTerm, typeFilter]);

   const getTypeVariant = (type: InstructorOccurrence['type']): BadgeVariant => {
      switch (type) {
         case 'FALTA': return 'red';
         case 'ATRASO': return 'amber';
         case 'INDISPONIBILIDADE': return 'blue';
         default: return 'slate';
      }
   };

   return (
      <div className={`p-4 md:p-6 w-full max-w-[1200px] mx-auto min-h-screen ${theme === 'dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
         {/* Header */}
         <div className="mb-6">
            <h1 className="text-2xl  tracking-tight">Histórico de Ocorrências</h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Acompanhamento de faltas, atrasos e indisponibilidades dos docentes.</p>
         </div>

         {/* Filters */}
         <div className={`mb-6 p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-center ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="relative flex-1 w-full">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
               <input
                  type="text"
                  placeholder="Buscar por docente ou motivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm focus:outline-none ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-gray-50 border-gray-200'}`}
               />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
               <div className="flex items-center gap-2 text-xs  text-slate-500 uppercase px-2">
                  <Filter size={14} /> Filtro:
               </div>
               <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className={`px-3 py-2 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-gray-50 border-gray-200'}`}
               >
                  <option value="ALL">Todos os Tipos</option>
                  <option value="FALTA">Faltas</option>
                  <option value="ATRASO">Atrasos</option>
                  <option value="INDISPONIBILIDADE">Indisponibilidades</option>
               </select>
            </div>
         </div>

         {/* Timeline / List */}
         <div className="space-y-4">
            {filteredOccurrences.length > 0 ? (
               filteredOccurrences.map(occurrence => {
                  const instructor = instructors.find(i => i.trigram === occurrence.instructorTrigram);
                  const discipline = disciplines.find(d => d.id === occurrence.disciplineId);

                  return (
                     <div key={occurrence.id} className={`p-4 rounded-xl border transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                           <div className="flex gap-4">
                              <div className={`p-3 rounded-lg flex flex-col items-center justify-center min-w-[70px] ${theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
                                 <span className="text-[10px]  uppercase text-blue-500">Mês/Dia</span>
                                 <span className="text-lg ">{occurrence.date.split('-').slice(1).reverse().join('/')}</span>
                              </div>
                              <div>
                                 <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className=" text-blue-500 font-mono tracking-tighter">{occurrence.instructorTrigram}</span>
                                    <span className="">{instructor?.warName || 'Docente Removido'}</span>
                                    <Badge variant={getTypeVariant(occurrence.type)}>
                                       {formatOccurrenceType(occurrence.type)}
                                    </Badge>
                                 </div>
                                 <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{occurrence.reason}</p>
                                 <div className="flex items-center gap-4 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><Calendar size={12} /> {occurrence.date}</span>
                                    {discipline && (
                                       <span className="flex items-center gap-1 font-mono text-blue-500/80">
                                          <AlertTriangle size={12} /> {discipline.code} - {discipline.name}
                                       </span>
                                    )}
                                 </div>
                              </div>
                           </div>
                           {canEdit && (
                              <button
                                 onClick={() => { if (confirm('Excluir este registro permanentemente?')) deleteOccurrence(occurrence.id); }}
                                 className="self-end sm:self-center p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                 title="Excluir Ocorrência"
                              >
                                 <Trash2 size={18} />
                              </button>
                           )}
                        </div>
                     </div>
                  );
               })
            ) : (
               <div className="py-20 text-center border-2 border-dashed rounded-2xl border-slate-200 dark:border-slate-800">
                  <History size={48} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">Nenhuma ocorrência registrada com os filtros atuais.</p>
               </div>
            )}
         </div>
      </div>
   );
};
