// Traditional AFA cohort colors with their design tokens

export type CohortColor = 'blue' | 'green' | 'black' | 'red';

interface ColorTokens {
    name: string;
    primary: string;
    light: string;
    dark: string;
    border: string;
}

export const COHORT_COLORS: Record<CohortColor, ColorTokens> = {
    blue: {
        name: 'Azul',
        primary: '#2563eb',
        light: '#dbeafe',
        dark: '#1e40af',
        border: '#3b82f6'
    },
    green: {
        name: 'Verde',
        primary: '#16a34a',
        light: '#dcfce7',
        dark: '#15803d',
        border: '#22c55e'
    },
    black: {
        name: 'Preto',
        primary: '#18181b',
        light: '#f4f4f5',
        dark: '#09090b',
        border: '#27272a'
    },
    red: {
        name: 'Vermelho',
        primary: '#dc2626',
        light: '#fee2e2',
        dark: '#b91c1c',
        border: '#ef4444'
    }
};

export const getCohortColorTokens = (color: CohortColor): ColorTokens => {
    return COHORT_COLORS[color];
};

export const getCohortColorName = (color: CohortColor): string => {
    return COHORT_COLORS[color].name;
};
