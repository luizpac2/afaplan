
import { useState, useMemo } from 'react';
import { useCourseStore } from '../store/useCourseStore';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Users, Save, RefreshCw, AlertCircle } from 'lucide-react';
import type { CourseClass, CourseYear } from '../types';

const TURMA_NAMES = ['A', 'B', 'C', 'D', 'E', 'F'];
const SQUADRONS: CourseYear[] = [1, 2, 3, 4];

export const ClassStudentManager = () => {
   const { classes, addClass, updateBatchClasses } = useCourseStore();
   const { userProfile } = useAuth();
   const { theme } = useTheme();
   const [localCounts, setLocalCounts] = useState<Record<string, string>>({});
   const [isSaving, setIsSaving] = useState(false);
   const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

   const canEdit = useMemo(() => {
      return ['SUPER_ADMIN', 'ADMIN'].includes(userProfile?.role || '');
   }, [userProfile]);

   const getClassId = (squadron: number, turma: string) => `${squadron}${turma}`;

   // Map existing classes to local counts for the inputs
   useMemo(() => {
      const counts: Record<string, string> = {};
      classes.forEach(c => {
         counts[c.id] = c.studentCount?.toString() || '0';
      });
      setLocalCounts(counts);
   }, [classes]);

   const handleInputChange = (classId: string, value: string) => {
      // Only allow numbers
      if (value !== '' && !/^\d+$/.test(value)) return;
      setLocalCounts(prev => ({ ...prev, [classId]: value }));
   };

   const handleSaveAll = async () => {
      setIsSaving(true);
      setMessage(null);
      try {
         const updates: CourseClass[] = [];

         // Iterate over all possible combinations to ensure we don't miss any that might be new
         for (const squadron of SQUADRONS) {
            for (const turma of TURMA_NAMES) {
               const classId = getClassId(squadron, turma);
               const existing = classes.find(c => c.id === classId);
               const studentCount = parseInt(localCounts[classId] || '0');

               if (existing) {
                  updates.push({ ...existing, studentCount });
               } else {
                  // If it doesn't exist, we'll create it later if needed, but for now focus on existing
                  // Or we can add it here if it's missing
                  const type = turma === 'E' ? 'INTENDANCY' : turma === 'F' ? 'INFANTRY' : 'AVIATION';
                  addClass({
                     id: classId,
                     name: turma,
                     year: squadron as CourseYear,
                     type,
                     studentCount
                  });
               }
            }
         }

         if (updates.length > 0) {
            await updateBatchClasses(updates);
         }

         setMessage({ text: 'Quantidades salvas com sucesso!', type: 'success' });
      } catch (error) {
         console.error(error);
         setMessage({ text: 'Erro ao salvar quantidades.', type: 'error' });
      } finally {
         setIsSaving(false);
         setTimeout(() => setMessage(null), 3000);
      }
   };

   const initializeStandardClasses = async () => {
      if (!confirm('Deseja criar todas as turmas padrão (A-F para cada esquadrão)? As quantidades atuais serão mantidas onde já existirem.')) return;

      const newClasses: CourseClass[] = [];
      for (const squadron of SQUADRONS) {
         for (const turma of TURMA_NAMES) {
            const classId = getClassId(squadron, turma);
            if (!classes.find(c => c.id === classId)) {
               const type = turma === 'E' ? 'INTENDANCY' : turma === 'F' ? 'INFANTRY' : 'AVIATION';
               newClasses.push({
                  id: classId,
                  name: turma,
                  year: squadron as CourseYear,
                  type,
                  studentCount: 0
               });
            }
         }
      }

      if (newClasses.length > 0) {
         for (const c of newClasses) {
            addClass(c);
         }
         alert(`${newClasses.length} turmas criadas.`);
      } else {
         alert('Todas as turmas já existem.');
      }
   };

   const getTurmaColor = (turma: string) => {
      if (turma === 'E') return theme === 'dark' ? 'text-amber-400' : 'text-amber-600'; // Intendência
      if (turma === 'F') return theme === 'dark' ? 'text-orange-400' : 'text-orange-700'; // Infantaria
      return theme === 'dark' ? 'text-blue-400' : 'text-blue-600'; // Aviação
   };

   return (
      <div className={`rounded-xl shadow-sm border p-6 mb-8 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
               <h2 className={`text-xl  flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                  <Users className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} size={24} />
                  Quantidade de Alunos por Turma
               </h2>
               <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Defina o número de cadetes em cada seção para controle de ocupação de salas.
               </p>
            </div>

            <div className="flex gap-2">
               {canEdit && (
                  <button
                     onClick={initializeStandardClasses}
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs  border transition-colors ${theme === 'dark' ? 'border-slate-600 text-slate-400 hover:bg-slate-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                     title="Criar turmas ausentes"
                  >
                     <RefreshCw size={14} />
                     Resetar Padrão
                  </button>
               )}
               {canEdit && (
                  <button
                     onClick={handleSaveAll}
                     disabled={isSaving}
                     className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700  transition-all shadow-md active:scale-95 disabled:opacity-50`}
                  >
                     {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                     Salvar Alterações
                  </button>
               )}
            </div>
         </div>

         {message && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-2 ${message.type === 'success'
               ? (theme === 'dark' ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-green-50 text-green-700 border border-green-100')
               : (theme === 'dark' ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-red-50 text-red-700 border border-red-100')
               }`}>
               <AlertCircle size={16} />
               {message.text}
            </div>
         )}

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SQUADRONS.map(squadron => (
               <div
                  key={squadron}
                  className={`rounded-xl border overflow-hidden transition-colors ${theme === 'dark' ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50/50 border-slate-200'}`}
               >
                  <div className={`px-4 py-3 border-b  text-xs uppercase tracking-widest ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                     {squadron}º Esquadrão
                  </div>
                  <div className="p-4 space-y-3">
                     {TURMA_NAMES.map(turma => {
                        const classId = getClassId(squadron, turma);
                        return (
                           <div key={turma} className="flex items-center justify-between group">
                              <div className="flex items-center gap-2">
                                 <span className={`w-8 h-8 flex items-center justify-center rounded-lg  text-sm border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'} ${getTurmaColor(turma)}`}>
                                    {turma}
                                 </span>
                                 <span className={`text-xs  uppercase tracking-tighter ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {turma === 'E' ? 'Int' : turma === 'F' ? 'Inf' : 'Avi'}
                                 </span>
                              </div>
                              <div className="flex items-center gap-2">
                                 <input
                                    type="text"
                                    value={localCounts[classId] || '0'}
                                    onChange={(e) => handleInputChange(classId, e.target.value)}
                                    readOnly={!canEdit}
                                    className={`w-16 text-center py-1 rounded-lg border text-sm  transition-all focus:ring-2 focus:ring-blue-500/20 outline-none ${theme === 'dark'
                                       ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-blue-500'
                                       : 'bg-white border-slate-200 text-slate-800 focus:border-blue-400'
                                       }`}
                                 />
                                 <span className="text-[10px] text-slate-400 uppercase ">Alunos</span>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>
            ))}
         </div>

         <div className={`mt-6 p-4 rounded-lg flex items-start gap-3 border ${theme === 'dark' ? 'bg-blue-900/10 border-blue-800/50' : 'bg-blue-50/50 border-blue-100'}`}>
            <AlertCircle className="text-blue-500 mt-0.5" size={18} />
            <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
               <strong>Dica:</strong> Estas densidades populacionais serão usadas pelo módulo de inteligência para validar se a sala de aula designada comporta o esquadrão/turma. Certifique-se de manter estes números atualizados após as movimentações de cadetes (desligamentos, trancamentos, etc).
            </p>
         </div>
      </div>
   );
};
