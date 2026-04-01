import { AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'danger'
}: ConfirmDialogProps) => {
    const { theme } = useTheme();

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const getTypeStyles = () => {
        switch (type) {
            case 'warning':
                return {
                    icon: theme === 'dark' ? 'text-amber-400 bg-amber-900/30' : 'text-amber-600 bg-amber-100',
                    button: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
                };
            case 'info':
                return {
                    icon: theme === 'dark' ? 'text-blue-400 bg-blue-900/30' : 'text-blue-600 bg-blue-100',
                    button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                };
            case 'danger':
            default:
                return {
                    icon: theme === 'dark' ? 'text-red-400 bg-red-900/30' : 'text-red-600 bg-red-100',
                    button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                };
        }
    };

    const styles = getTypeStyles();

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleBackdropClick}
        >
            <div className={`rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`flex-shrink-0 p-3 rounded-full ${styles.icon}`}>
                            <AlertTriangle size={24} />
                        </div>
                        <div className="flex-1 pt-1">
                            <h3 className={`text-lg  mb-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{title}</h3>
                            <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{message}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className={`flex-shrink-0 transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className={`px-6 py-4 flex justify-end gap-3 border-t ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 text-sm  rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-200'}`}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        className={`px-4 py-2 text-sm  text-white rounded-lg transition-all shadow-sm hover:shadow ${styles.button} focus:outline-none focus:ring-2 focus:ring-offset-2`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
