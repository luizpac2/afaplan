import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Info, X, AlertTriangle } from 'lucide-react';
import { useCourseStore } from '../store/useCourseStore';
import { useTheme } from '../contexts/ThemeContext';


interface QuickAllocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (disciplineId: string) => void;
    onMoreDetails: () => void;
    currentSquadron: number;
    selectedClass: string;
}

export const QuickAllocationModal = ({
    isOpen,
    onClose,
    onSelect,
    onMoreDetails,
    currentSquadron,
    selectedClass
}: QuickAllocationModalProps) => {
    const { disciplines, classes } = useCourseStore();
    const { theme } = useTheme();
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const filteredDisciplines = useMemo(() => {
        if (!search.trim()) return [];

        const term = search.toLowerCase();

        // Filter by squadron/year and course compatibility
        // First, find what course the selected class belongs to
        const classObj = classes.find(c => c.id === (selectedClass === 'ALL' ? `${currentSquadron}A` : `${currentSquadron}${selectedClass}`));
        const currentCourse = classObj?.type || 'ALL';

        return disciplines.filter(d => {
            // Match search term
            const matchesSearch = d.name.toLowerCase().includes(term) || d.code.toLowerCase().includes(term);
            if (!matchesSearch) return false;

            // Match squadron (year)
            const matchesYear = d.year === 'ALL' || d.year === currentSquadron;
            if (!matchesYear) return false;

            // Match course type
            if (d.course !== 'ALL' && currentCourse !== 'ALL' && d.course !== currentCourse) return false;

            return true;
        }).slice(0, 10); // Limit results for speed
    }, [search, disciplines, currentSquadron, selectedClass, classes]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className={`relative w-full max-w-md animate-in zoom-in-95 fade-in duration-200 rounded-2xl border shadow-2xl ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                <div className="p-4">
                    <div className="relative mb-4">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                            }`} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Buscar disciplina (Código ou Nome)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-blue-500/20 outline-none ${theme === 'dark'
                                ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600'
                                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                                }`}
                        />
                        <button
                            onClick={onClose}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'
                                }`}
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {filteredDisciplines.length > 0 ? (
                            filteredDisciplines.map(d => (
                                <button
                                    key={d.id}
                                    onClick={() => onSelect(d.id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${theme === 'dark' ? 'hover:bg-blue-900/20' : 'hover:bg-blue-50'
                                        }`}
                                >
                                    <div className="flex flex-col items-start min-w-0 flex-1">
                                        <div className="flex items-center gap-2 w-full">
                                            <span className={`text-[10px]  uppercase tracking-widest ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                                                }`}>
                                                {d.code}
                                            </span>
                                            {(() => {
                                                const trigram = d.instructorTrigram;
                                                if (!trigram) return null;
                                                const { instructors } = useCourseStore.getState();
                                                const inst = instructors.find(i => i.trigram === trigram);
                                                const classId = selectedClass === 'ALL' ? `${currentSquadron}A` : `${currentSquadron}${selectedClass}`;
                                                const yearNum = parseInt(classId[0]);
                                                const { classes } = useCourseStore.getState();
                                                const isUnauthorized = inst && inst.enabledClasses?.length > 0 &&
                                                  !inst.enabledClasses.some(id => classes.find(c => c.id === id)?.year === yearNum);

                                                if (isUnauthorized) {
                                                    return (
                                                        <span className="flex items-center gap-1 text-[8px]  text-red-500 bg-red-100 dark:bg-red-900/30 px-1 rounded" title="Docente padrão não habilitado para esta turma">
                                                            <AlertTriangle size={8} />
                                                            {trigram}
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span className={`text-[8px]  px-1 rounded ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                                        {trigram}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <span className={`text-sm  truncate w-full ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'
                                            }`}>
                                            {d.name}
                                        </span>
                                    </div>
                                    <div className={`w-8 h-8 rounded-full border-2 border-transparent flex items-center justify-center transition-all group-hover:border-blue-500/50 group-hover:bg-blue-500 group-hover:text-white ${theme === 'dark' ? 'text-slate-600 bg-slate-800' : 'text-slate-400 bg-slate-100'
                                        }`}>
                                        <Info size={14} className="group-hover:hidden" />
                                        <div className="hidden group-hover:block  text-[10px]">OK</div>
                                    </div>
                                </button>
                            ))
                        ) : search.trim() ? (
                            <div className="p-8 text-center">
                                <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Nenhuma disciplina compatível encontrada.
                                </p>
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Digite para buscar...
                                </p>
                            </div>
                        )}
                    </div>

                    <div className={`mt-4 pt-4 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                        <button
                            onClick={onMoreDetails}
                            className={`w-full py-2.5 rounded-xl text-xs  uppercase tracking-widest transition-all ${theme === 'dark'
                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            Mais Detalhes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
