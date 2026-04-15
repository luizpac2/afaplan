// Traditional AFA cohort colors with their design tokens

export type CohortColor = 'blue' | 'green' | 'black' | 'red';

interface ColorTokens {
    name: string;
    primary: string;       // main color (use on light backgrounds)
    primaryDark: string;   // lighter variant for dark mode backgrounds/text
    light: string;         // light tint background
    dark: string;          // darker shade
    border: string;
    textOnPrimary: string; // text color when placed on top of primary bg
}

export const COHORT_COLORS: Record<CohortColor, ColorTokens> = {
    blue: {
        name: 'Azul',
        primary: '#2563eb',
        primaryDark: '#60a5fa',
        light: '#dbeafe',
        dark: '#1e40af',
        border: '#3b82f6',
        textOnPrimary: '#ffffff',
    },
    green: {
        name: 'Verde',
        primary: '#16a34a',
        primaryDark: '#4ade80',
        light: '#dcfce7',
        dark: '#15803d',
        border: '#22c55e',
        textOnPrimary: '#ffffff',
    },
    black: {
        name: 'Preto',
        primary: '#18181b',
        primaryDark: '#a1a1aa',  // zinc-400 — readable on dark bg
        light: '#f4f4f5',
        dark: '#09090b',
        border: '#27272a',
        textOnPrimary: '#ffffff',
    },
    red: {
        name: 'Vermelho',
        primary: '#dc2626',
        primaryDark: '#f87171',
        light: '#fee2e2',
        dark: '#b91c1c',
        border: '#ef4444',
        textOnPrimary: '#ffffff',
    }
};

export const getCohortColorTokens = (color: CohortColor): ColorTokens => {
    return COHORT_COLORS[color];
};

export const getCohortColorName = (color: CohortColor): string => {
    return COHORT_COLORS[color].name;
};

/**
 * Returns the display color for a squadron in the given theme.
 * In dark mode, uses `primaryDark` so dark-colored squadrons (e.g. black)
 * remain visible against dark backgrounds.
 */
export const sqDisplayColor = (tokens: ColorTokens, isDark: boolean): string => {
    return isDark ? tokens.primaryDark : tokens.primary;
};
