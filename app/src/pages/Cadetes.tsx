import { useTheme } from '../contexts/ThemeContext';
import { CadetManager } from '../components/CadetManager';

export const Cadetes = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className={`text-3xl tracking-tight ${dark ? 'text-slate-100' : 'text-slate-900'}`}>
          Gestão de Cadetes
        </h1>
        <p className={`mt-1 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          Lista e edição de cadetes
        </p>
      </div>
      <CadetManager />
    </div>
  );
};
