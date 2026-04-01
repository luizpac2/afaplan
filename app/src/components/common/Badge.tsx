import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

export type BadgeVariant = 'blue' | 'purple' | 'amber' | 'emerald' | 'red' | 'slate' | 'indigo' | 'green' | 'orange' | 'custom';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    title?: string;
    className?: string; // allow overrides (like margin-top)
    customColor?: string; // for custom bg colors
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'slate', title, className = '', customColor }) => {
    const { theme } = useTheme();

    const getColors = () => {
        if (customColor) {
            return `${customColor} text-white border-transparent`;
        }

        switch (variant) {
            case 'blue':
                return theme === 'dark' ? 'bg-blue-900/20 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-100 text-blue-600';
            case 'purple':
                return theme === 'dark' ? 'bg-purple-900/20 border-purple-800 text-purple-300' : 'bg-purple-50 border-purple-100 text-purple-600';
            case 'amber':
                return theme === 'dark' ? 'bg-amber-900/20 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-100 text-amber-600';
            case 'emerald':
            case 'green':
                return theme === 'dark' ? 'bg-emerald-900/20 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-100 text-emerald-600';
            case 'red':
                return theme === 'dark' ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-100 text-red-600';
            case 'indigo':
                return theme === 'dark' ? 'bg-indigo-900/20 border-indigo-800 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-600';
            case 'orange':
                return theme === 'dark' ? 'bg-orange-900/20 border-orange-800 text-orange-300' : 'bg-orange-50 border-orange-100 text-orange-600';
            case 'slate':
            default:
                return theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600';
        }
    };

    return (
        <span
            className={`px-1.5 py-0.5 rounded text-[9px]  uppercase border ${getColors()} ${className}`}
            title={title}
        >
            {children}
        </span>
    );
};
