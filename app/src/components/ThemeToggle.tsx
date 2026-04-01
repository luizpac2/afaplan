import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export function ThemeToggle() {
   const { theme, toggleTheme } = useTheme();

   return (
      <button
         onClick={toggleTheme}
         className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors flex items-center justify-center relative border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
         title={`Alternar para modo ${theme === 'light' ? 'escuro' : 'claro'}`}
      >
         <div className="relative w-5 h-5">
            <Sun className={`h-[1.2rem] w-[1.2rem] transition-all absolute top-0 left-0 ${theme === 'dark' ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'}`} />
            <Moon className={`h-[1.2rem] w-[1.2rem] transition-all absolute top-0 left-0 ${theme === 'dark' ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0'}`} />
         </div>
      </button>
   );
}
