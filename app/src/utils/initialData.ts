import type { Discipline, CourseClass, Cohort } from '../types';

export const getInitialData = () => {
    // Basic structure for bootstrapping the system
    const rawData = [
        { name: "Treinamento Físico 1", code: "TFM1" },
        { name: "Instrução de Voo Primária", code: "VOOP" },
        { name: "Logística 1", code: "LOG1" },
        { name: "Infantaria da Aeronáutica 1", code: "INF1" },
    ];

    const disciplines: Discipline[] = rawData.map((d, index) => {
        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];
        return {
            id: d.code,
            code: d.code,
            name: d.name,
            year: 1,
            course: 'ALL',
            trainingField: 'MILITAR',
            load_hours: 0,
            category: 'COMMON',
            instructor: '',
            color: colors[index % colors.length],
            enabledCourses: [] as ('AVIATION' | 'INTENDANCY' | 'INFANTRY')[],
            enabledYears: [] as (1 | 2 | 3 | 4)[],
            ppcLoads: {}
        };
    });

    // Generate Classes for each Year (1st to 4th)
    const currentYear = new Date().getFullYear();
    const cohortsData = [
        { id: '1', name: 'Turma Espada', entryYear: currentYear, year: 1, color: 'blue' as const },
        { id: '2', name: 'Turma Jaguar', entryYear: currentYear - 1, year: 2, color: 'green' as const },
        { id: '3', name: 'Turma Condor', entryYear: currentYear - 2, year: 3, color: 'black' as const },
        { id: '4', name: 'Turma Águia', entryYear: currentYear - 3, year: 4, color: 'red' as const },
    ];

    const classes: CourseClass[] = [];
    cohortsData.forEach(c => {
        const classTypes = [
            { name: 'A', type: 'AVIATION' },
            { name: 'B', type: 'AVIATION' },
            { name: 'C', type: 'AVIATION' },
            { name: 'D', type: 'AVIATION' },
            { name: 'E', type: 'INTENDANCY' },
            { name: 'F', type: 'INFANTRY' },
        ];

        classTypes.forEach(cls => {
            classes.push({
                id: `${c.year}${cls.name}`,
                name: cls.name,
                year: c.year as 1 | 2 | 3 | 4,
                type: cls.type as 'AVIATION' | 'INTENDANCY' | 'INFANTRY'
            });
        });
    });

    const cohorts: Cohort[] = cohortsData.map(({ year: _year, ...rest }) => rest);

    return { disciplines, classes, cohorts };
};
