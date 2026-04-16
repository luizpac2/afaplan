// Traditional AFA cohort colors with their design tokens

export type CohortColor = 'blue' | 'green' | 'black' | 'red';

interface ColorTokens {
    name: string;
    primary: string;
    light: string;      // badge bg (light mode) / adapted for dark mode
    dark: string;       // badge text (light mode) / adapted for dark mode
    border: string;
}

// Base tokens (light-mode optimized)
const BASE_TOKENS: Record<CohortColor, ColorTokens & { darkBg: string; darkText: string; darkBorder: string }> = {
    blue: {
        name: 'Azul',
        primary: '#2563eb',
        light: '#dbeafe',
        dark: '#1e40af',
        border: '#3b82f6',
        darkBg: '#1e3a5f',
        darkText: '#93c5fd',
        darkBorder: '#3b82f6',
    },
    green: {
        name: 'Verde',
        primary: '#16a34a',
        light: '#dcfce7',
        dark: '#15803d',
        border: '#22c55e',
        darkBg: '#14532d',
        darkText: '#86efac',
        darkBorder: '#22c55e',
    },
    black: {
        name: 'Preto',
        primary: '#71717a',
        light: '#f4f4f5',
        dark: '#09090b',
        border: '#27272a',
        darkBg: '#3f3f46',
        darkText: '#e4e4e7',
        darkBorder: '#71717a',
    },
    red: {
        name: 'Vermelho',
        primary: '#dc2626',
        light: '#fee2e2',
        dark: '#b91c1c',
        border: '#ef4444',
        darkBg: '#450a0a',
        darkText: '#fca5a5',
        darkBorder: '#f87171',
    }
};

// Light-mode-only constant for backwards compat (CohortManager color picker, etc.)
export const COHORT_COLORS: Record<CohortColor, ColorTokens> = Object.fromEntries(
    Object.entries(BASE_TOKENS).map(([k, v]) => [k, {
        name: v.name,
        primary: v.primary,
        light: v.light,
        dark: v.dark,
        border: v.border,
    }])
) as Record<CohortColor, ColorTokens>;

/**
 * Returns cohort color tokens adapted for the current theme.
 * When `theme` is `"dark"`, badge bg/text/border are swapped
 * to dark-mode-appropriate values so text remains legible.
 */
export const getCohortColorTokens = (color: CohortColor, theme?: string): ColorTokens => {
    const base = BASE_TOKENS[color];
    if (theme === 'dark') {
        return {
            name: base.name,
            primary: base.primary,
            light: base.darkBg,
            dark: base.darkText,
            border: base.darkBorder,
        };
    }
    return {
        name: base.name,
        primary: base.primary,
        light: base.light,
        dark: base.dark,
        border: base.border,
    };
};

export const getCohortColorName = (color: CohortColor): string => {
    return BASE_TOKENS[color].name;
};
