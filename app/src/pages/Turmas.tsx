import { CohortManager } from '../components/CohortManager';
import { ClassStudentManager } from '../components/ClassStudentManager';
import { CadetManager } from '../components/CadetManager';
import { useTheme } from '../contexts/ThemeContext';

export const Turmas = () => {
    const { theme } = useTheme();
    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className={`text-3xl tracking-tight ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>Turmas</h1>
                <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Gerencie os Esquadrões e Turmas.</p>
            </div>

            <ClassStudentManager />
            <CohortManager />

            <div className="mt-8">
                <CadetManager />
            </div>
        </div>
    );
};
