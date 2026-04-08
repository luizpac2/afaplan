import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    // Initialize theme from localStorage or system preference
    const [theme, setTheme] = useState<Theme>(() => {
        const savedTheme = localStorage.getItem('theme') as Theme;
        if (savedTheme) {
            return savedTheme;
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        const root = window.document.documentElement;


        const syncTheme = () => {
            if (theme === 'dark') {
                if (!root.classList.contains('dark')) root.classList.add('dark');
                root.classList.remove('light');
                root.style.colorScheme = 'dark';
            } else {
                if (!root.classList.contains('light')) root.classList.add('light');
                root.classList.remove('dark');
                root.style.colorScheme = 'light';
            }
        };

        // 1. Immediate Sync
        syncTheme();

        // 2. Observer to prevent external tampering (e.g. extensions or hydration mismatches)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const isDark = root.classList.contains('dark');
                    if (theme === 'dark' && !isDark) {
                        console.warn('Theme mismatch detected (should be dark). Forcing sync.');
                        syncTheme();
                    } else if (theme === 'light' && isDark) {
                        console.warn('Theme mismatch detected (should be light). Forcing sync.');
                        syncTheme();
                    }
                }
            });
        });

        observer.observe(root, { attributes: true, attributeFilter: ['class'] });

        // 3. Cleanup debug styles from previous version
        document.body.style.backgroundColor = '';
        document.body.style.color = '';

        localStorage.setItem('theme', theme);

        return () => observer.disconnect();
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
