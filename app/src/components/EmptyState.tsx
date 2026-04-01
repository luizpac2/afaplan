import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    className = ""
}) => {
    const { theme } = useTheme();

    return (
        <div className={`p-12 text-center flex flex-col items-center justify-center ${className}`}>
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 transition-all duration-300 ${theme === 'dark' ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-300'}`}>
                <Icon size={40} strokeWidth={1.5} className="opacity-60" />
            </div>

            <h3 className={`text-xl  mb-2 tracking-tight ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                {title}
            </h3>

            {description && (
                <p className={`text-sm max-w-xs mx-auto leading-relaxed mb-8 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {description}
                </p>
            )}

            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all  text-sm"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};
